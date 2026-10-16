/**
 * Pedidos na nuvem (Cloudflare Durable Object com SQLite).
 *
 * O tablet da loja envia cada pedido para cá; na confecção os pedidos são
 * vistos no computador em /pedidos.html. Tudo protegido pela "senha da
 * confecção": a senha inicial é 000000 e pode ser trocada pelo tablet
 * (Administrador → Configurações). A variável secreta PEDIDOS_SENHA no Worker,
 * se existir, tem prioridade.
 *
 * Rotas (todas pedem o cabeçalho x-chave, menos a de criar/testar a senha):
 *   POST   /api/pedidos/chave                  {chave, nova?} → confere (e troca, com nova)
 *   GET    /api/pedidos                        lista (resumo)
 *   PUT    /api/pedidos/:id                    grava/atualiza o pedido (JSON)
 *   GET    /api/pedidos/:id                    pedido completo + lista de arquivos
 *   PATCH  /api/pedidos/:id                    {status}
 *   DELETE /api/pedidos/:id                    apaga o pedido e os arquivos
 *   PUT    /api/pedidos/:id/arquivos/:nome     grava um arquivo (corpo binário)
 *   GET    /api/pedidos/:id/arquivos/:nome     baixa o arquivo
 */

import { DurableObject } from 'cloudflare:workers';

const PEDACO = 1024 * 1024;            // o SQLite do Durable Object guarda até 2 MB por valor
const MAX_ARQUIVO = 40 * 1024 * 1024;
const MAX_PEDIDO = 30 * 1024 * 1024;
const SENHA_INICIAL = '000000';
const STATUS = ['novo', 'producao', 'pronto', 'entregue'];

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

async function sha256(txt) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** Encaminha /api/pedidos* para o Durable Object (um só, da loja). */
export function rotaPedidos(req, env) {
  if (!env.PEDIDOS) return json({ erro: 'Armazenamento de pedidos não configurado no Worker.' }, 501);
  const obj = env.PEDIDOS.get(env.PEDIDOS.idFromName('loja'));
  return obj.fetch(req);
}

export class Pedidos extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS cfg (k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS pedidos (id TEXT PRIMARY KEY, numero INTEGER, data TEXT, nome TEXT, telefone TEXT,
        total REAL, pecas INTEGER, camisetas INTEGER, status TEXT, miniatura TEXT, recebido INTEGER, partes INTEGER, alerta INTEGER);
      CREATE TABLE IF NOT EXISTS pedido_partes (id TEXT, idx INTEGER, dados TEXT, PRIMARY KEY (id, idx));
      CREATE TABLE IF NOT EXISTS arquivos (pedido TEXT, nome TEXT, tipo TEXT, tamanho INTEGER, partes INTEGER, PRIMARY KEY (pedido, nome));
      CREATE TABLE IF NOT EXISTS arquivo_partes (pedido TEXT, nome TEXT, idx INTEGER, dados BLOB, PRIMARY KEY (pedido, nome, idx));
      CREATE TABLE IF NOT EXISTS tentativas (ip TEXT PRIMARY KEY, n INTEGER, ate INTEGER);
    `);
  }

  um(q, ...p) { return this.sql.exec(q, ...p).toArray()[0]; }

  // ---------- Senha ----------

  bloqueado(ip) {
    const t = this.um('SELECT n, ate FROM tentativas WHERE ip = ?', ip);
    return t && t.n >= 10 && t.ate > Date.now();
  }
  errou(ip) {
    const t = this.um('SELECT n, ate FROM tentativas WHERE ip = ?', ip);
    const n = t && t.ate > Date.now() ? t.n + 1 : 1;
    this.sql.exec('INSERT OR REPLACE INTO tentativas (ip, n, ate) VALUES (?, ?, ?)', ip, n, Date.now() + 15 * 60 * 1000);
  }
  async confere(chave) {
    if (!chave) return false;
    if (this.env.PEDIDOS_SENHA) return chave === this.env.PEDIDOS_SENHA;
    const salvo = this.um("SELECT v FROM cfg WHERE k = 'chave'");
    if (!salvo) return chave === SENHA_INICIAL;
    const sal = this.um("SELECT v FROM cfg WHERE k = 'sal'");
    return !!salvo && salvo.v === await sha256(sal.v + chave);
  }

  async fetch(req) {
    const url = new URL(req.url);
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const partes = url.pathname.replace(/^\/api\/pedidos\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    try {
      if (this.bloqueado(ip)) return json({ erro: 'Muitas tentativas com a senha errada. Espere 15 minutos.' }, 429);

      // Testar (e trocar) a senha
      if (partes[0] === 'chave' && req.method === 'POST') {
        const { chave, nova } = await req.json().catch(() => ({}));
        if (!(await this.confere(String(chave || '')))) {
          this.errou(ip);
          return json({ erro: 'Senha da confecção errada.' }, 401);
        }
        if (nova == null || String(nova) === String(chave)) return json({ ok: true });
        if (this.env.PEDIDOS_SENHA) return json({ erro: 'A senha está fixa no Worker (PEDIDOS_SENHA). Troque por lá.' }, 400);
        if (String(nova).length < 6) return json({ erro: 'A nova senha precisa ter pelo menos 6 caracteres.' }, 400);
        const sal = crypto.randomUUID();
        this.sql.exec("INSERT OR REPLACE INTO cfg (k, v) VALUES ('sal', ?), ('chave', ?)", sal, await sha256(sal + nova));
        return json({ ok: true, trocada: true });
      }

      if (!(await this.confere(req.headers.get('x-chave') || ''))) {
        this.errou(ip);
        return json({ erro: 'Senha da confecção errada.' }, 401);
      }

      const [id, sub, nome] = partes;
      if (!id && req.method === 'GET') return this.lista(url);
      if (id && !sub) {
        if (req.method === 'PUT') return this.gravar(id, req);
        if (req.method === 'GET') return this.ler(id);
        if (req.method === 'PATCH') return this.mudar(id, req);
        if (req.method === 'DELETE') return this.apagar(id);
      }
      if (id && sub === 'arquivos' && nome) {
        if (req.method === 'PUT') return this.gravarArquivo(id, nome, req);
        if (req.method === 'GET') return this.lerArquivo(id, nome);
      }
      return json({ erro: 'rota desconhecida' }, 404);
    } catch (e) {
      return json({ erro: 'falha no servidor', detalhe: String(e && e.message || e) }, 500);
    }
  }

  // ---------- Pedidos ----------

  lista(url) {
    const status = url.searchParams.get('status');
    const rows = this.sql.exec(
      `SELECT p.id, p.numero, p.data, p.nome, p.telefone, p.total, p.pecas, p.camisetas, p.status, p.miniatura, p.recebido, p.alerta,
              (SELECT COUNT(*) FROM arquivos a WHERE a.pedido = p.id) AS arquivos
         FROM pedidos p ${status && STATUS.includes(status) ? 'WHERE p.status = ?' : ''}
        ORDER BY p.recebido DESC LIMIT 500`, ...(status && STATUS.includes(status) ? [status] : [])).toArray();
    return json({ pedidos: rows });
  }

  async gravar(id, req) {
    const txt = await req.text();
    if (txt.length > MAX_PEDIDO) return json({ erro: 'pedido grande demais' }, 413);
    const p = JSON.parse(txt);
    const antigo = this.um('SELECT status, recebido FROM pedidos WHERE id = ?', id);
    const pecas = (p.itens || []).reduce((s, it) => s + Object.values(it.quantidades || {}).reduce((a, n) => a + (n || 0), 0), 0);
    const alerta = (p.itens || []).some(it => (it.artes || []).some(a => /Baixa/i.test(a.qualidade || ''))) ? 1 : 0;
    const miniatura = String(p.miniatura || '').slice(0, 200000);
    delete p.miniatura;
    const dados = JSON.stringify(p);
    const n = Math.ceil(dados.length / PEDACO) || 1;
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM pedido_partes WHERE id = ?', id);
      for (let i = 0; i < n; i++) this.sql.exec('INSERT INTO pedido_partes (id, idx, dados) VALUES (?, ?, ?)', id, i, dados.slice(i * PEDACO, (i + 1) * PEDACO));
      this.sql.exec(`INSERT OR REPLACE INTO pedidos (id, numero, data, nome, telefone, total, pecas, camisetas, status, miniatura, recebido, partes, alerta)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, p.numero || 0, p.data || new Date().toISOString(), p.cliente?.nome || '', p.cliente?.telefone || '',
        +p.total || 0, pecas, (p.itens || []).length, antigo?.status || 'novo', miniatura, antigo?.recebido || Date.now(), n, alerta);
    });
    return json({ ok: true });
  }

  ler(id) {
    const cab = this.um('SELECT status, recebido FROM pedidos WHERE id = ?', id);
    if (!cab) return json({ erro: 'pedido não encontrado' }, 404);
    const dados = this.sql.exec('SELECT dados FROM pedido_partes WHERE id = ? ORDER BY idx', id).toArray().map(r => r.dados).join('');
    const p = JSON.parse(dados);
    p.status = cab.status; p.recebido = cab.recebido;
    p.arquivos = this.sql.exec('SELECT nome, tipo, tamanho FROM arquivos WHERE pedido = ? ORDER BY nome', id).toArray();
    return json(p);
  }

  async mudar(id, req) {
    const { status } = await req.json().catch(() => ({}));
    if (!STATUS.includes(status)) return json({ erro: 'status inválido' }, 400);
    this.sql.exec('UPDATE pedidos SET status = ? WHERE id = ?', status, id);
    return json({ ok: true });
  }

  apagar(id) {
    this.ctx.storage.transactionSync(() => {
      for (const t of ['pedidos', 'pedido_partes']) this.sql.exec(`DELETE FROM ${t} WHERE id = ?`, id);
      for (const t of ['arquivos', 'arquivo_partes']) this.sql.exec(`DELETE FROM ${t} WHERE pedido = ?`, id);
    });
    return json({ ok: true });
  }

  // ---------- Arquivos (artes do cliente, prévias das artes) ----------

  async gravarArquivo(id, nome, req) {
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length > MAX_ARQUIVO) return json({ erro: 'arquivo grande demais' }, 413);
    const tipo = (req.headers.get('content-type') || 'application/octet-stream').slice(0, 100);
    const n = Math.ceil(buf.length / PEDACO) || 1;
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM arquivo_partes WHERE pedido = ? AND nome = ?', id, nome);
      for (let i = 0; i < n; i++) this.sql.exec('INSERT INTO arquivo_partes (pedido, nome, idx, dados) VALUES (?, ?, ?, ?)', id, nome, i, buf.subarray(i * PEDACO, (i + 1) * PEDACO));
      this.sql.exec('INSERT OR REPLACE INTO arquivos (pedido, nome, tipo, tamanho, partes) VALUES (?, ?, ?, ?, ?)', id, nome, tipo, buf.length, n);
    });
    return json({ ok: true });
  }

  lerArquivo(id, nome) {
    const a = this.um('SELECT tipo, tamanho FROM arquivos WHERE pedido = ? AND nome = ?', id, nome);
    if (!a) return json({ erro: 'arquivo não encontrado' }, 404);
    const out = new Uint8Array(a.tamanho);
    let pos = 0;
    for (const r of this.sql.exec('SELECT dados FROM arquivo_partes WHERE pedido = ? AND nome = ? ORDER BY idx', id, nome)) {
      const b = new Uint8Array(r.dados); out.set(b, pos); pos += b.length;
    }
    return new Response(out, {
      headers: {
        'content-type': a.tipo, 'cache-control': 'private, max-age=3600',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
        'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox"
      }
    });
  }
}
