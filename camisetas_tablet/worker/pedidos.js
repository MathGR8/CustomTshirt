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
 *   GET    /api/pedidos/notificacoes           chave pública + aparelhos que recebem avisos
 *   POST   /api/pedidos/notificacoes           {endpoint, keys, nome} cadastra este aparelho
 *   DELETE /api/pedidos/notificacoes/:id       para de avisar o aparelho
 *   POST   /api/pedidos/notificacoes/teste     manda um aviso de teste para todos
 *   GET    /api/pedidos/espaco?meses=N         espaço usado + quanto a limpeza liberaria
 *   POST   /api/pedidos/espaco/limpar          {meses} apaga os ARQUIVOS dos pedidos entregues
 *                                              há mais de N meses (os dados do pedido ficam)
 *
 * Pedidos do site da Art Rock (personalizador da loja virtual):
 *   POST   /api/externo/pedido                 multipart: "pedido" (JSON), "miniatura"
 *                                              (data URL) e "arquivo" (vários: PDF e artes)
 *       SEM senha (o site é público), com limites: tamanho, quantidade de
 *       arquivos, tipos permitidos e 6 pedidos por hora por endereço de rede.
 *       Só cria pedidos novos (não lê, não altera, não apaga nada). Numeração
 *       própria (AR-0001…), etiqueta "Art Rock" no painel e o mesmo aviso.
 *       ARTROCK_ORIGENS (variável do Worker, opcional): endereços do site
 *       permitidos, separados por vírgula (ex.: https://artrock-personalize.x.workers.dev).
 *
 * Loja / Balcão (senha própria, a inicial é 111111; variável LOJA_SENHA no Worker tem prioridade):
 *   O pedido feito no tablet fica "aguardando pagamento" e só aparece para a
 *   confecção depois que o caixa registra o pagamento (cobrado na maquininha).
 *   POST   /api/pedidos/chave                  também aceita a senha da loja → {ok, papel: 'loja'}
 *   POST   /api/pedidos/chave-loja             {chave (da loja ou da confecção), nova} troca a senha da loja
 *   GET    /api/pedidos                        (senha da loja) pedidos do tablet, pagos ou não
 *   POST   /api/pedidos/:id/pagamento          {forma, valor, parcelas?, recebido?, atendente?, obs?}
 *                                              registra o pagamento → o pedido vai para a confecção
 *   POST   /api/pedidos/:id/cancelar           {desfazer?} cancela (ou reabre) um pedido ainda não pago
 *   PATCH  /api/pedidos/:id                    (senha da loja) só {status: 'entregue' | 'pronto'} de pedido pago
 *
 * Recuperar senha por e-mail (sem senha, com limite de 3 pedidos por hora):
 *   POST   /api/pedidos/recuperar              {tipo: 'confeccao' | 'loja' | 'admin'} manda um código de 6 números
 *                                              para o e-mail de recuperação (vale 30 minutos)
 *   POST   /api/pedidos/recuperar/conferir     {tipo, codigo, nova?} confere o código e troca a senha
 *                                              (admin: a senha fica no tablet, que grava a nova)
 *   E-mail: RECUPERACAO_EMAIL (variável do Worker) ou o padrão abaixo. Envio pelo
 *   Resend (resend.com, grátis): segredo RESEND_API_KEY no Worker; RESEND_FROM opcional.
 *
 * Aviso de pedido: a cada pedido (ou contato) novo o servidor manda uma
 * notificação do navegador (Web Push) para cada computador/celular que ativou
 * "Receber avisos" no painel da confecção. Grátis e sem serviço de terceiros
 * (ver worker/push.js). O tablet não precisa de chip nem de WhatsApp.
 */

import { DurableObject } from 'cloudflare:workers';
import { novasChaves, enviarPush } from './push.js';

const PEDACO = 1024 * 1024;            // o SQLite do Durable Object guarda até 2 MB por valor
const MAX_ARQUIVO = 40 * 1024 * 1024;
const MAX_PEDIDO = 30 * 1024 * 1024;
const SENHA_INICIAL = '000000';
const SENHA_LOJA_INICIAL = '111111';
/** E-mail que recebe os códigos de recuperação de senha (a variável RECUPERACAO_EMAIL tem prioridade). */
const EMAIL_RECUPERACAO = 'matheus@artrock.com.br';
const NOME_SENHA = { confeccao: 'da confecção', loja: 'da loja (balcão)', admin: 'do administrador do tablet' };
const FORMAS = ['credito', 'debito', 'pix', 'dinheiro', 'outro'];
/** Pedido feito no tablet que ainda não foi pago no balcão (a confecção não vê). */
const NAO_PAGO = "(p.origem = 'loja' AND COALESCE(p.tipo, 'pedido') = 'pedido' AND p.pago IS NULL)";
// Espaço do plano grátis da Cloudflare: 1 GB por Durable Object (o número mais conservador da documentação).
// Variável ESPACO_LIMITE_MB no Worker muda o limite (ex.: no plano pago, 10240).
const LIMITE_PADRAO_MB = 1024;
const MES = 30 * 24 * 3600 * 1000;

const reais = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Notificação de um pedido (ou contato) novo: { titulo, texto, url, tag } */
export function avisoDoPedido(p, origem = '') {
  const c = p.cliente || {};
  const url = `${origem}/?pedido=${encodeURIComponent(p.id)}#confeccao`;
  if (p.origem === 'artrock') {
    const itens = p.itens || [];
    const pecas = itens.reduce((s, it) => s + Object.values(it.quantidades || {}).reduce((a, n) => a + (+n || 0), 0), 0);
    return { titulo: `🎸 Novo pedido Art Rock nº AR-${String(p.numero || 0).padStart(4, '0')}`, tag: `p-${p.id}`, url,
      texto: [`${c.nome || 'Sem nome'}${c.telefone ? ' · ' + c.telefone : ''} · ${pecas} peça${pecas === 1 ? '' : 's'}`,
        ...itens.slice(0, 3).map(it => `${it.modelo || ''} ${it.cor || ''} — ${Object.entries(it.quantidades || {}).filter(([, q]) => q > 0).map(([t, q]) => `${t}×${q}`).join(' ')}`.replace(/\s+/g, ' ').trim()),
        itens.length > 3 ? `… e mais ${itens.length - 3} modelo(s)` : '', c.obs ? `Obs.: ${c.obs}` : ''].filter(Boolean).join('\n') };
  }
  if (p.tipo === 'contato') {
    return { titulo: '📞 Novo contato — arte própria', tag: `p-${p.id}`, url,
      texto: [`${c.nome || 'Sem nome'}${c.telefone ? ' · ' + c.telefone : ''}`, 'Quer fazer camiseta com a própria arte: chame no WhatsApp.', c.obs ? `Obs.: ${c.obs}` : ''].filter(Boolean).join('\n') };
  }
  const itens = p.itens || [];
  const pecas = itens.reduce((s, it) => s + Object.values(it.quantidades || {}).reduce((a, n) => a + (+n || 0), 0), 0);
  const linhas = itens.slice(0, 3).map(it => {
    const tam = Object.entries(it.quantidades || {}).filter(([, q]) => q > 0).map(([t, q]) => `${t}×${q}`).join(' ');
    return `${it.modelo || ''} ${it.cor || ''} — ${tam}`.replace(/\s+/g, ' ').trim();
  });
  if (itens.length > 3) linhas.push(`… e mais ${itens.length - 3} camiseta(s)`);
  if (p.paraLoja) return { titulo: `🛒 Pedido nº ${String(p.numero || 0).padStart(4, '0')} aguardando pagamento`, tag: `p-${p.id}`, url: `${origem}/?pedido=${encodeURIComponent(p.id)}#loja`,
    texto: [`${c.nome || 'Sem nome'} · ${pecas} peça${pecas === 1 ? '' : 's'}${p.total ? ' · ' + reais(p.total) : ''}`, 'Cobrar no balcão e registrar o pagamento.'].join('\n') };
  const pago = p.pagamento ? ` · pago (${{ credito: 'crédito', debito: 'débito', pix: 'Pix', dinheiro: 'dinheiro', outro: 'outro' }[p.pagamento.forma] || p.pagamento.forma})` : '';
  return { titulo: `🧾 Novo pedido nº ${String(p.numero || 0).padStart(4, '0')}${pago}`, tag: `p-${p.id}`, url,
    texto: [`${c.nome || 'Sem nome'} · ${pecas} peça${pecas === 1 ? '' : 's'}${p.total ? ' · ' + reais(p.total) : ''}`, ...linhas, c.obs ? `Obs.: ${c.obs}` : ''].filter(Boolean).join('\n') };
}
const STATUS = ['novo', 'producao', 'pronto', 'entregue', 'cancelado'];

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
      CREATE TABLE IF NOT EXISTS aparelhos (id TEXT PRIMARY KEY, endpoint TEXT, p256dh TEXT, auth TEXT, nome TEXT, criado INTEGER, ultimo INTEGER, erro TEXT);
    `);
    this.sql.exec("DELETE FROM cfg WHERE k IN ('aviso', 'aviso_ultimo')"); // aviso antigo pelo CallMeBot
    // Tipo do registro ("pedido" ou "contato": cliente que quer usar a própria arte)
    try { this.sql.exec("ALTER TABLE pedidos ADD COLUMN tipo TEXT DEFAULT 'pedido'"); } catch { /* já existe */ }
    // Quando os arquivos do pedido foram apagados para liberar espaço
    try { this.sql.exec('ALTER TABLE pedidos ADD COLUMN limpo INTEGER'); } catch { /* já existe */ }
    // De onde veio o pedido: 'loja' (tablet) ou 'artrock' (site da Art Rock)
    try { this.sql.exec("ALTER TABLE pedidos ADD COLUMN origem TEXT DEFAULT 'loja'"); } catch { /* já existe */ }
    // Pagamento no balcão: quando foi pago (null = aguardando) e como; pedido com texto (sem troca)
    try { this.sql.exec('ALTER TABLE pedidos ADD COLUMN pago INTEGER'); } catch { /* já existe */ }
    try { this.sql.exec('ALTER TABLE pedidos ADD COLUMN pagamento TEXT'); } catch { /* já existe */ }
    try { this.sql.exec('ALTER TABLE pedidos ADD COLUMN texto INTEGER'); } catch { /* já existe */ }
    // Quem recebe cada aviso: 'confeccao' ou 'loja' (balcão)
    try { this.sql.exec("ALTER TABLE aparelhos ADD COLUMN papel TEXT DEFAULT 'confeccao'"); } catch { /* já existe */ }
    // Uma vez só: os pedidos de antes do balcão já estavam na confecção (contam como pagos)
    if (!this.um("SELECT v FROM cfg WHERE k = 'pagamento_v1'")) {
      this.sql.exec('UPDATE pedidos SET pago = recebido WHERE pago IS NULL');
      this.sql.exec("INSERT OR REPLACE INTO cfg (k, v) VALUES ('pagamento_v1', '1')");
    }
    // Limite de pedidos do site por endereço de rede (contra abuso)
    this.sql.exec('CREATE TABLE IF NOT EXISTS externos (ip TEXT PRIMARY KEY, n INTEGER, ate INTEGER)');
    // Uma vez só: apaga a senha gravada pelas versões antigas (a 1ª senha usada
    // ficava valendo) e volta para a senha inicial 000000. Os pedidos ficam.
    if (!this.um("SELECT v FROM cfg WHERE k = 'senha_inicial_v2'")) {
      this.sql.exec("DELETE FROM cfg WHERE k IN ('chave', 'sal')");
      this.sql.exec('DELETE FROM tentativas');
      this.sql.exec("INSERT OR REPLACE INTO cfg (k, v) VALUES ('senha_inicial_v2', '1')");
    }
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
  acertou(ip) { this.sql.exec('DELETE FROM tentativas WHERE ip = ?', ip); }
  async confere(chave) {
    if (!chave) return false;
    if (this.env.PEDIDOS_SENHA) return chave === this.env.PEDIDOS_SENHA;
    const salvo = this.um("SELECT v FROM cfg WHERE k = 'chave'");
    if (!salvo) return chave === SENHA_INICIAL;
    const sal = this.um("SELECT v FROM cfg WHERE k = 'sal'");
    return !!salvo && salvo.v === await sha256(sal.v + chave);
  }
  async confereLoja(chave) {
    if (!chave) return false;
    if (this.env.LOJA_SENHA) return chave === this.env.LOJA_SENHA;
    const salvo = this.um("SELECT v FROM cfg WHERE k = 'chave_loja'");
    if (!salvo) return chave === SENHA_LOJA_INICIAL;
    const sal = this.um("SELECT v FROM cfg WHERE k = 'sal_loja'");
    return salvo.v === await sha256(sal.v + chave);
  }
  /** 'confeccao' (acesso completo), 'loja' (balcão) ou null. */
  async papel(chave) {
    if (await this.confere(chave)) return 'confeccao';
    if (await this.confereLoja(chave)) return 'loja';
    return null;
  }

  async fetch(req) {
    const url = new URL(req.url);
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const partes = url.pathname.replace(/^\/api\/pedidos\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    // Pedido do site da Art Rock: sem senha, só cria (ver receberExterno)
    if (url.pathname === '/api/externo/pedido') return this.externo(req, ip, url.origin);
    try {
      if (this.bloqueado(ip)) return json({ erro: 'Muitas tentativas com a senha errada. Espere 15 minutos.' }, 429);

      // Testar (e trocar) a senha
      if (partes[0] === 'chave' && req.method === 'POST') {
        const { chave, nova } = await req.json().catch(() => ({}));
        const papel = await this.papel(String(chave || ''));
        if (!papel) {
          this.errou(ip);
          return json({ erro: 'Senha da confecção errada.' }, 401);
        }
        this.acertou(ip);
        if (papel === 'loja') return nova == null ? json({ ok: true, papel }) : json({ erro: 'Esta é a senha da loja. Para trocar a senha da confecção, use a senha da confecção.' }, 400);
        if (nova == null || String(nova) === String(chave)) return json({ ok: true, papel });
        if (this.env.PEDIDOS_SENHA) return json({ erro: 'A senha está fixa no Worker (PEDIDOS_SENHA). Troque por lá.' }, 400);
        if (String(nova).length < 6) return json({ erro: 'A nova senha precisa ter pelo menos 6 caracteres.' }, 400);
        const sal = crypto.randomUUID();
        this.sql.exec("INSERT OR REPLACE INTO cfg (k, v) VALUES ('sal', ?), ('chave', ?)", sal, await sha256(sal + nova));
        return json({ ok: true, trocada: true });
      }

      // Esqueci a senha: código por e-mail
      if (partes[0] === 'recuperar' && req.method === 'POST') return await this.recuperar(req, ip, partes[1]);

      // Trocar a senha da loja (com a senha atual da loja ou a da confecção)
      if (partes[0] === 'chave-loja' && req.method === 'POST') {
        const { chave, nova } = await req.json().catch(() => ({}));
        if (!(await this.papel(String(chave || '')))) { this.errou(ip); return json({ erro: 'Senha atual errada.' }, 401); }
        this.acertou(ip);
        if (this.env.LOJA_SENHA) return json({ erro: 'A senha da loja está fixa no Worker (LOJA_SENHA). Troque por lá.' }, 400);
        if (String(nova || '').length < 6) return json({ erro: 'A nova senha precisa ter pelo menos 6 caracteres.' }, 400);
        if (await this.confere(String(nova))) return json({ erro: 'A senha da loja precisa ser diferente da senha da confecção.' }, 400);
        const sal = crypto.randomUUID();
        this.sql.exec("INSERT OR REPLACE INTO cfg (k, v) VALUES ('sal_loja', ?), ('chave_loja', ?)", sal, await sha256(sal + nova));
        return json({ ok: true, trocada: true });
      }

      const papel = await this.papel(req.headers.get('x-chave') || '');
      if (!papel) {
        this.errou(ip);
        return json({ erro: 'Senha da confecção errada.' }, 401);
      }
      this.acertou(ip);

      // Avisos de pedido no navegador (computador/celular do gestor ou do balcão)
      if (partes[0] === 'notificacoes') return await this.notificacoes(req, partes[1], url.origin, papel);

      if (papel === 'loja') return await this.rotaLoja(req, url, partes);

      // Espaço usado e limpeza dos arquivos de pedidos antigos
      if (partes[0] === 'espaco') {
        if (req.method === 'GET' && !partes[1]) return json(this.espaco(+url.searchParams.get('meses') || 0));
        if (req.method === 'POST' && partes[1] === 'limpar') {
          const { meses } = await req.json().catch(() => ({}));
          if (!(+meses >= 1)) return json({ erro: 'escolha de quantos meses' }, 400);
          return json(this.limpar(+meses));
        }
      }

      const [id, sub, nome] = partes;
      if (!id && req.method === 'GET') return this.lista(url);
      if (id && sub === 'pagamento' && req.method === 'POST') return await this.pagar(id, req, url.origin);
      if (id && sub === 'cancelar' && req.method === 'POST') return await this.cancelar(id, req);
      if (id && !sub) {
        if (req.method === 'PUT') return this.gravar(id, req, url.origin);
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

  // ---------- Recuperar senha por e-mail ----------

  emailRecuperacao() { return String(this.env.RECUPERACAO_EMAIL || EMAIL_RECUPERACAO).trim(); }

  async recuperar(req, ip, passo) {
    const d = await req.json().catch(() => ({}));
    const tipo = String(d.tipo || '');
    if (!NOME_SENHA[tipo]) return json({ erro: 'tipo de senha inválido' }, 400);
    const chaveCfg = `recuperar_${tipo}`;
    const email = this.emailRecuperacao();
    const mascara = email.replace(/^(.{2}).*(@.*)$/, '$1***$2');

    if (passo === 'conferir') {
      const r = JSON.parse(this.um('SELECT v FROM cfg WHERE k = ?', chaveCfg)?.v || 'null');
      if (!r || r.expira < Date.now()) return json({ erro: 'Código vencido ou não pedido. Peça um código novo.' }, 400);
      if (r.hash !== await sha256(r.sal + String(d.codigo || '').replace(/\D/g, ''))) {
        r.erros = (r.erros || 0) + 1;
        if (r.erros >= 5) this.sql.exec('DELETE FROM cfg WHERE k = ?', chaveCfg);
        else this.sql.exec('INSERT OR REPLACE INTO cfg (k, v) VALUES (?, ?)', chaveCfg, JSON.stringify(r));
        this.errou(ip);
        return json({ erro: r.erros >= 5 ? 'Código errado 5 vezes. Peça um código novo.' : 'Código errado.' }, 400);
      }
      if (tipo !== 'admin') {
        const nova = String(d.nova || '');
        if (nova.length < 6) return json({ erro: 'A nova senha precisa ter pelo menos 6 caracteres.' }, 400);
        if (tipo === 'confeccao') {
          if (this.env.PEDIDOS_SENHA) return json({ erro: 'A senha da confecção está fixa no Worker (PEDIDOS_SENHA). Troque por lá.' }, 400);
          if (await this.confereLoja(nova)) return json({ erro: 'A senha da confecção precisa ser diferente da senha da loja.' }, 400);
          const sal = crypto.randomUUID();
          this.sql.exec("INSERT OR REPLACE INTO cfg (k, v) VALUES ('sal', ?), ('chave', ?)", sal, await sha256(sal + nova));
        } else {
          if (this.env.LOJA_SENHA) return json({ erro: 'A senha da loja está fixa no Worker (LOJA_SENHA). Troque por lá.' }, 400);
          if (await this.confere(nova)) return json({ erro: 'A senha da loja precisa ser diferente da senha da confecção.' }, 400);
          const sal = crypto.randomUUID();
          this.sql.exec("INSERT OR REPLACE INTO cfg (k, v) VALUES ('sal_loja', ?), ('chave_loja', ?)", sal, await sha256(sal + nova));
        }
      }
      this.sql.exec('DELETE FROM cfg WHERE k = ?', chaveCfg);
      this.acertou(ip);
      return json({ ok: true });
    }

    if (passo) return json({ erro: 'rota desconhecida' }, 404);
    if (!this.env.RESEND_API_KEY) return json({ erro: 'A recuperação por e-mail ainda não foi configurada (falta a chave RESEND_API_KEY no Worker).' }, 501);
    // No máximo 3 códigos por hora (de qualquer lugar), para não lotar o e-mail
    const lim = this.um("SELECT n, ate FROM externos WHERE ip = 'recuperar'");
    const vale = lim && lim.ate > Date.now();
    if (vale && lim.n >= 3) return json({ erro: 'Já foram pedidos 3 códigos na última hora. Espere um pouco ou use o último código recebido.' }, 429);
    const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    const sal = crypto.randomUUID();
    const nome = NOME_SENHA[tipo];
    const r = await fetch(this.env.RESEND_URL || 'https://api.resend.com/emails', { // RESEND_URL: só para testes
      method: 'POST',
      headers: { authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: this.env.RESEND_FROM || 'Estúdio de Camisetas <onboarding@resend.dev>',
        to: [email],
        subject: `Código para trocar a senha ${nome}: ${codigo}`,
        text: `Alguém pediu para trocar a senha ${nome} do app de camisetas.\n\nCódigo: ${codigo}\n\nVale por 30 minutos. Se não foi você, ignore este e-mail: a senha atual continua valendo.${tipo === 'confeccao' ? '\n\nDepois de trocar, atualize a senha da confecção no tablet (Administrador → Configurações), senão os pedidos não chegam.' : ''}`,
        html: `<div style="font-family:Arial,sans-serif;font-size:16px;color:#111"><p>Alguém pediu para trocar a <b>senha ${nome}</b> do app de camisetas.</p>
          <p style="font-size:34px;font-weight:bold;letter-spacing:6px;margin:18px 0">${codigo}</p>
          <p>O código vale por <b>30 minutos</b>. Se não foi você, ignore este e-mail: a senha atual continua valendo.</p>
          ${tipo === 'confeccao' ? '<p>Depois de trocar, atualize a senha da confecção no tablet (Administrador → Configurações), senão os pedidos não chegam.</p>' : ''}</div>`
      })
    });
    if (!r.ok) return json({ erro: `Não foi possível enviar o e-mail (${r.status}). ${(await r.text().catch(() => '')).slice(0, 160)}` }, 502);
    this.sql.exec('INSERT OR REPLACE INTO cfg (k, v) VALUES (?, ?)', chaveCfg, JSON.stringify({ hash: await sha256(sal + codigo), sal, expira: Date.now() + 30 * 60000, erros: 0 }));
    this.sql.exec("INSERT OR REPLACE INTO externos (ip, n, ate) VALUES ('recuperar', ?, ?)", vale ? lim.n + 1 : 1, vale ? lim.ate : Date.now() + 3600000);
    return json({ ok: true, para: mascara });
  }

  // ---------- Pedidos do site da Art Rock ----------

  /** Cabeçalhos CORS para o site da Art Rock (todas as origens, ou só as de ARTROCK_ORIGENS). */
  cors(req) {
    const origem = req.headers.get('origin') || '';
    const lista = String(this.env.ARTROCK_ORIGENS || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
    const permitida = !lista.length || lista.includes(origem);
    return {
      permitida,
      h: {
        'access-control-allow-origin': lista.length ? (permitida ? origem : 'null') : '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
        vary: 'origin'
      }
    };
  }

  async externo(req, ip, origemServidor) {
    const { permitida, h } = this.cors(req);
    const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...h } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method !== 'POST') return resp({ erro: 'use POST' }, 405);
    if (!permitida) return resp({ erro: 'site não autorizado' }, 403);
    try {
      return resp(...await this.receberExterno(req, ip, origemServidor));
    } catch (e) {
      return resp({ erro: 'falha no servidor', detalhe: String(e && e.message || e) }, 500);
    }
  }

  /**
   * Cria um pedido vindo do site da Art Rock.
   * Só aceita os campos conhecidos (o resto é descartado) e arquivos de imagem/PDF.
   * @returns {Promise<[Object, number]>} corpo e status da resposta
   */
  async receberExterno(req, ip, origemServidor) {
    // 6 pedidos por hora por endereço de rede
    const t = this.um('SELECT n, ate FROM externos WHERE ip = ?', ip);
    const vale = t && t.ate > Date.now();
    if (vale && t.n >= 6) return [{ erro: 'Muitos pedidos seguidos. Tente de novo daqui a pouco ou fale com a gente pelo WhatsApp.' }, 429];
    if (+req.headers.get('content-length') > 80 * 1024 * 1024) return [{ erro: 'arquivos grandes demais (máx. 80 MB no total)' }, 413];
    const form = await req.formData().catch(() => null);
    if (!form) return [{ erro: 'envio inválido' }, 400];

    const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
    let bruto;
    try { bruto = JSON.parse(String(form.get('pedido') || '')); } catch { return [{ erro: 'pedido inválido' }, 400]; }
    const c = bruto.cliente || {};
    const cliente = { nome: txt(c.nome, 80), telefone: txt(c.telefone, 30), obs: txt(c.obs, 1000) };
    if (!cliente.nome || cliente.telefone.replace(/\D/g, '').length < 8) return [{ erro: 'Informe nome e WhatsApp.' }, 400];
    const itens = (Array.isArray(bruto.itens) ? bruto.itens : []).slice(0, 30).map(it => ({
      nome: txt(it.nome, 80), modelo: txt(it.modelo, 40), malha: txt(it.malha, 40), cor: txt(it.cor, 40),
      quantidades: Object.fromEntries(Object.entries(it.quantidades || {}).slice(0, 40)
        .map(([k, v]) => [txt(k, 12), Math.max(0, Math.min(100000, parseInt(v, 10) || 0))]).filter(([k, v]) => k && v > 0)),
      artes: (Array.isArray(it.artes) ? it.artes : []).slice(0, 30).map(a => ({
        nome: txt(a.nome, 120), tipo: a.tipo === 'texto' ? 'texto' : 'imagem', texto: txt(a.texto, 300),
        lado: a.lado === 'Costas' ? 'Costas' : 'Frente', medidas: txt(a.medidas, 60), arquivo: txt(a.arquivo, 120)
      }))
    }));
    if (!itens.length || !itens.some(it => Object.keys(it.quantidades).length)) return [{ erro: 'O pedido está vazio.' }, 400];

    // Arquivos: PDF do pedido e artes (imagens, PDF, SVG, ZIP)
    const TIPOS = /^(application\/pdf|image\/(png|jpeg|webp|gif|svg\+xml)|application\/zip|application\/x-zip-compressed)$/;
    const arquivos = [];
    let total = 0;
    for (const f of form.getAll('arquivo')) {
      if (typeof f === 'string') continue;
      if (arquivos.length >= 40) return [{ erro: 'arquivos demais' }, 413];
      const nome = txt(f.name, 120).replace(/[\\/:*?"<>|]+/g, '_') || `arquivo-${arquivos.length + 1}`;
      const tipo = (f.type || '').toLowerCase();
      if (!TIPOS.test(tipo)) continue; // ignora o que não é imagem/PDF
      if (f.size > MAX_ARQUIVO) return [{ erro: `arquivo grande demais: ${nome}` }, 413];
      total += f.size;
      if (total > 80 * 1024 * 1024) return [{ erro: 'arquivos grandes demais (máx. 80 MB no total)' }, 413];
      arquivos.push({ nome, tipo, buf: new Uint8Array(await f.arrayBuffer()) });
    }
    const mini = String(form.get('miniatura') || '');
    const miniatura = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(mini) && mini.length <= 200000 ? mini : '';

    // Número próprio (AR-0001…) e gravação
    const numero = (+(this.um("SELECT v FROM cfg WHERE k = 'numero_artrock'")?.v) || 0) + 1;
    const id = 'ar-' + crypto.randomUUID();
    const p = { id, numero, origem: 'artrock', tipo: 'pedido', data: new Date().toISOString(), cliente, itens, total: 0, loja: 'Art Rock' };
    const dados = JSON.stringify(p);
    const n = Math.ceil(dados.length / PEDACO) || 1;
    const pecas = itens.reduce((s, it) => s + Object.values(it.quantidades).reduce((a, q) => a + q, 0), 0);
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("INSERT OR REPLACE INTO cfg (k, v) VALUES ('numero_artrock', ?)", String(numero));
      for (let i = 0; i < n; i++) this.sql.exec('INSERT INTO pedido_partes (id, idx, dados) VALUES (?, ?, ?)', id, i, dados.slice(i * PEDACO, (i + 1) * PEDACO));
      this.sql.exec(`INSERT INTO pedidos (id, numero, data, nome, telefone, total, pecas, camisetas, status, miniatura, recebido, partes, alerta, tipo, origem)
                     VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'novo', ?, ?, ?, 0, 'pedido', 'artrock')`,
        id, numero, p.data, cliente.nome, cliente.telefone, pecas, itens.length, miniatura, Date.now(), n);
      for (const a of arquivos) {
        const partes = Math.ceil(a.buf.length / PEDACO) || 1;
        for (let i = 0; i < partes; i++) this.sql.exec('INSERT OR REPLACE INTO arquivo_partes (pedido, nome, idx, dados) VALUES (?, ?, ?, ?)', id, a.nome, i, a.buf.subarray(i * PEDACO, (i + 1) * PEDACO));
        this.sql.exec('INSERT OR REPLACE INTO arquivos (pedido, nome, tipo, tamanho, partes) VALUES (?, ?, ?, ?, ?)', id, a.nome, a.tipo, a.buf.length, partes);
      }
      this.sql.exec('INSERT OR REPLACE INTO externos (ip, n, ate) VALUES (?, ?, ?)', ip, vale ? t.n + 1 : 1, vale ? t.ate : Date.now() + 3600 * 1000);
    });
    this.ctx.waitUntil(this.avisarTodos(avisoDoPedido(p, origemServidor), origemServidor).catch(() => {}));
    return [{ ok: true, numero, codigo: `AR-${String(numero).padStart(4, '0')}` }, 200];
  }

  // ---------- Pedidos ----------

  /**
   * Lista (resumo). Confecção: tudo menos os pedidos do tablet ainda não pagos (e os cancelados).
   * Loja: só os pedidos do tablet (pagos, aguardando e cancelados), com o pagamento.
   */
  lista(url, papel = 'confeccao') {
    const status = url.searchParams.get('status');
    const cond = [papel === 'loja' ? "p.origem = 'loja' AND COALESCE(p.tipo, 'pedido') = 'pedido'" : `NOT ${NAO_PAGO} AND p.status != 'cancelado'`];
    const args = [];
    if (status && STATUS.includes(status)) { cond.push('p.status = ?'); args.push(status); }
    const rows = this.sql.exec(
      `SELECT p.id, p.numero, p.data, p.nome, p.telefone, p.total, p.pecas, p.camisetas, p.status, p.miniatura, p.recebido, p.alerta, p.tipo, p.limpo, p.origem,
              p.pago, p.pagamento, p.texto, (SELECT COUNT(*) FROM arquivos a WHERE a.pedido = p.id) AS arquivos
         FROM pedidos p WHERE ${cond.join(' AND ')}
        ORDER BY p.recebido DESC LIMIT ${papel === 'loja' ? 2000 : 500}`, ...args).toArray();
    for (const r of rows) r.pagamento = r.pagamento ? JSON.parse(r.pagamento) : null;
    return json({ pedidos: rows });
  }

  // ---------- Loja / Balcão ----------

  /** O que a senha da loja pode fazer: ver os pedidos do tablet, receber, cancelar e entregar. */
  async rotaLoja(req, url, partes) {
    const [id, sub, nome] = partes;
    if (!id && req.method === 'GET') return this.lista(url, 'loja');
    if (!id) return json({ erro: 'rota desconhecida' }, 404);
    const cab = this.um("SELECT origem, COALESCE(tipo, 'pedido') AS tipo, pago FROM pedidos WHERE id = ?", id);
    if (!cab || cab.origem !== 'loja' || cab.tipo !== 'pedido') return json({ erro: 'pedido não encontrado' }, 404);
    if (!sub && req.method === 'GET') return this.ler(id);
    if (sub === 'arquivos' && nome && req.method === 'GET') return this.lerArquivo(id, nome);
    if (sub === 'pagamento' && req.method === 'POST') return await this.pagar(id, req, url.origin);
    if (sub === 'cancelar' && req.method === 'POST') return await this.cancelar(id, req);
    if (!sub && req.method === 'PATCH') {
      const { status } = await req.json().catch(() => ({}));
      if (!cab.pago) return json({ erro: 'O pedido ainda não foi pago.' }, 400);
      if (!['entregue', 'pronto'].includes(status)) return json({ erro: 'No balcão só dá para marcar como entregue.' }, 403);
      this.sql.exec('UPDATE pedidos SET status = ? WHERE id = ?', status, id);
      return json({ ok: true });
    }
    return json({ erro: 'Sem permissão com a senha da loja.' }, 403);
  }

  /** Registra o pagamento (cobrado por fora, na maquininha). Na 1ª vez o pedido vai para a confecção. */
  async pagar(id, req, origem) {
    const d = await req.json().catch(() => ({}));
    const cab = this.um("SELECT origem, COALESCE(tipo, 'pedido') AS tipo, pago, status FROM pedidos WHERE id = ?", id);
    if (!cab || cab.tipo !== 'pedido') return json({ erro: 'pedido não encontrado' }, 404);
    if (cab.status === 'cancelado') return json({ erro: 'Este pedido está cancelado. Reabra antes de receber.' }, 400);
    const forma = String(d.forma || '');
    if (!FORMAS.includes(forma)) return json({ erro: 'Escolha a forma de pagamento.' }, 400);
    const valor = Math.round((+d.valor || 0) * 100) / 100;
    if (!(valor > 0) || valor > 1e6) return json({ erro: 'Informe o valor cobrado.' }, 400);
    const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
    const pagamento = {
      forma, valor,
      parcelas: forma === 'credito' ? Math.max(1, Math.min(24, parseInt(d.parcelas, 10) || 1)) : null,
      recebido: forma === 'dinheiro' && +d.recebido > 0 ? Math.round(+d.recebido * 100) / 100 : null,
      atendente: txt(d.atendente, 60), obs: txt(d.obs, 300),
      em: cab.pago ? (JSON.parse(this.um('SELECT pagamento FROM pedidos WHERE id = ?', id)?.pagamento || '{}').em || cab.pago) : Date.now()
    };
    if (pagamento.recebido != null && pagamento.recebido < valor) return json({ erro: 'O valor recebido em dinheiro é menor que o valor cobrado.' }, 400);
    if (cab.pago) pagamento.corrigido = Date.now();
    this.sql.exec('UPDATE pedidos SET pago = COALESCE(pago, ?), pagamento = ? WHERE id = ?', pagamento.em, JSON.stringify(pagamento), id);
    // Primeiro pagamento: agora a confecção recebe (avisa os aparelhos dela)
    if (!cab.pago) {
      const p = JSON.parse(this.sql.exec('SELECT dados FROM pedido_partes WHERE id = ? ORDER BY idx', id).toArray().map(r => r.dados).join('') || '{}');
      p.id = id; p.pagamento = pagamento;
      this.ctx.waitUntil(this.avisarTodos(avisoDoPedido(p, origem), origem, 'confeccao').catch(() => {}));
    }
    return json({ ok: true, pagamento });
  }

  /** Cancela um pedido que ainda não foi pago (ou reabre, com {desfazer: true}). */
  async cancelar(id, req) {
    const { desfazer } = await req.json().catch(() => ({}));
    const cab = this.um('SELECT pago, status FROM pedidos WHERE id = ?', id);
    if (!cab) return json({ erro: 'pedido não encontrado' }, 404);
    if (cab.pago) return json({ erro: 'Pedido já pago não pode ser cancelado aqui. Fale com a confecção.' }, 400);
    this.sql.exec('UPDATE pedidos SET status = ? WHERE id = ?', desfazer ? 'novo' : 'cancelado', id);
    return json({ ok: true });
  }

  // ---------- Espaço ----------

  /** Pedidos entregues há mais de N meses que ainda têm arquivos. */
  antigos(meses) {
    return this.sql.exec(`SELECT p.id, (SELECT COALESCE(SUM(a.tamanho), 0) FROM arquivos a WHERE a.pedido = p.id) AS bytes
      FROM pedidos p WHERE p.status IN ('entregue', 'cancelado') AND p.recebido < ? AND EXISTS (SELECT 1 FROM arquivos a WHERE a.pedido = p.id)`,
    Date.now() - meses * MES).toArray();
  }

  espaco(meses = 0) {
    const um = q => this.um(q)?.n || 0;
    const arquivos = um('SELECT COALESCE(SUM(tamanho), 0) AS n FROM arquivos');
    const dados = um('SELECT COALESCE(SUM(LENGTH(dados)), 0) AS n FROM pedido_partes') + um('SELECT COALESCE(SUM(LENGTH(miniatura)), 0) AS n FROM pedidos');
    const limite = (+this.env.ESPACO_LIMITE_MB || LIMITE_PADRAO_MB) * 1048576;
    const usado = arquivos + dados;
    const r = {
      usado, limite, arquivos, dados, banco: this.ctx.storage.sql.databaseSize || null,
      pedidos: um('SELECT COUNT(*) AS n FROM pedidos'), entregues: um("SELECT COUNT(*) AS n FROM pedidos WHERE status = 'entregue'"),
      porPedido: um("SELECT COUNT(*) AS n FROM pedidos WHERE tipo != 'contato'") ? Math.round(usado / um("SELECT COUNT(*) AS n FROM pedidos WHERE tipo != 'contato'")) : 0
    };
    if (meses) { const l = this.antigos(meses); r.limpeza = { meses, pedidos: l.length, bytes: l.reduce((s, x) => s + x.bytes, 0) }; }
    return r;
  }

  /** Apaga os arquivos (imagens das artes) dos pedidos entregues há mais de N meses. Os dados ficam. */
  limpar(meses) {
    const l = this.antigos(meses), agora = Date.now();
    this.ctx.storage.transactionSync(() => {
      for (const { id } of l) {
        this.sql.exec('DELETE FROM arquivo_partes WHERE pedido = ?', id);
        this.sql.exec('DELETE FROM arquivos WHERE pedido = ?', id);
        this.sql.exec('UPDATE pedidos SET limpo = ? WHERE id = ?', agora, id);
      }
    });
    return { ok: true, pedidos: l.length, bytes: l.reduce((s, x) => s + x.bytes, 0), espaco: this.espaco() };
  }

  // ---------- Avisos no navegador (Web Push) ----------

  async chavesPush(origem) {
    const salvo = this.um("SELECT v FROM cfg WHERE k = 'vapid'");
    if (salvo) return JSON.parse(salvo.v);
    const c = { ...(await novasChaves()), contato: origem.startsWith('https://') ? origem : 'mailto:avisos@example.com' };
    this.sql.exec("INSERT OR REPLACE INTO cfg (k, v) VALUES ('vapid', ?)", JSON.stringify(c));
    return c;
  }

  async notificacoes(req, sub, origem, papel = 'confeccao') {
    const lista = () => this.sql.exec("SELECT id, nome, criado, ultimo, erro FROM aparelhos WHERE COALESCE(papel, 'confeccao') = ? ORDER BY criado", papel).toArray();
    if (req.method === 'GET' && !sub) return json({ chave: (await this.chavesPush(origem)).publica, aparelhos: lista() });
    if (req.method === 'POST' && !sub) {
      const d = await req.json().catch(() => ({}));
      const endpoint = String(d.endpoint || ''), p256dh = String(d.keys?.p256dh || ''), auth = String(d.keys?.auth || '');
      if (!/^https:\/\//.test(endpoint) && !(this.env.PUSH_LIVRE && /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(endpoint))) return json({ erro: 'endereço de notificação inválido' }, 400);
      if (endpoint.length > 2000 || p256dh.length < 80 || p256dh.length > 120 || auth.length < 16 || auth.length > 40) return json({ erro: 'dados da notificação inválidos' }, 400);
      const id = (await sha256(endpoint)).slice(0, 16);
      const antigo = this.um('SELECT criado FROM aparelhos WHERE id = ?', id);
      this.sql.exec('INSERT OR REPLACE INTO aparelhos (id, endpoint, p256dh, auth, nome, criado, ultimo, erro, papel) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)',
        id, endpoint, p256dh, auth, String(d.nome || 'Aparelho').slice(0, 60), antigo?.criado || Date.now(), papel);
      return json({ ok: true, id, aparelhos: lista() });
    }
    if (req.method === 'DELETE' && sub) {
      this.sql.exec("DELETE FROM aparelhos WHERE id = ? AND COALESCE(papel, 'confeccao') = ?", sub, papel);
      return json({ ok: true, aparelhos: lista() });
    }
    if (req.method === 'POST' && sub === 'teste') {
      const r = await this.avisarTodos(papel === 'loja'
        ? { titulo: '🔔 Teste: avisos do balcão ligados', texto: 'Quando um cliente fechar um pedido no tablet, o aviso aparece assim.', url: `${origem}/#loja`, tag: 'teste' }
        : { titulo: '🔔 Teste: avisos de pedido ligados', texto: 'Quando chegar um pedido novo da loja, o aviso aparece assim.', url: `${origem}/#confeccao`, tag: 'teste' }, origem, papel);
      return json({ ...r, aparelhos: lista() }, r.enviados ? 200 : (r.total ? 502 : 400));
    }
    return json({ erro: 'rota desconhecida' }, 404);
  }

  /** Manda o aviso para todos os aparelhos cadastrados. */
  async avisarTodos(dados, origem, papel = 'confeccao') {
    const aparelhos = this.sql.exec("SELECT * FROM aparelhos WHERE COALESCE(papel, 'confeccao') = ?", papel).toArray();
    if (!aparelhos.length) return { total: 0, enviados: 0, erro: 'nenhum aparelho cadastrado para receber avisos' };
    const chaves = await this.chavesPush(origem);
    let enviados = 0;
    const falhas = [];
    await Promise.all(aparelhos.map(async a => {
      const r = await enviarPush(a, dados, chaves, chaves.contato);
      if (r.ok) { enviados++; this.sql.exec('UPDATE aparelhos SET ultimo = ?, erro = NULL WHERE id = ?', Date.now(), a.id); return; }
      if (r.sumiu) this.sql.exec('DELETE FROM aparelhos WHERE id = ?', a.id);
      else this.sql.exec('UPDATE aparelhos SET erro = ? WHERE id = ?', `${r.status || 'sem conexão'} ${r.detalhe || ''}`.trim().slice(0, 200), a.id);
      falhas.push(`${a.nome}: ${r.sumiu ? 'o navegador cancelou os avisos (ative de novo nele)' : r.status || 'sem conexão'}`);
    }));
    return { total: aparelhos.length, enviados, falhas, erro: enviados ? undefined : falhas.join('; ') };
  }

  async gravar(id, req, origem = '') {
    const txt = await req.text();
    if (txt.length > MAX_PEDIDO) return json({ erro: 'pedido grande demais' }, 413);
    const p = JSON.parse(txt);
    const antigo = this.um('SELECT status, recebido, pago, pagamento, limpo FROM pedidos WHERE id = ?', id);
    const texto = (p.itens || []).some(it => (it.artes || []).some(a => a.tipo === 'texto')) ? 1 : 0;
    const contato = p.tipo === 'contato';
    const pecas = (p.itens || []).reduce((s, it) => s + Object.values(it.quantidades || {}).reduce((a, n) => a + (n || 0), 0), 0);
    const alerta = (p.itens || []).some(it => (it.artes || []).some(a => /Baixa/i.test(a.qualidade || ''))) ? 1 : 0;
    const miniatura = String(p.miniatura || '').slice(0, 200000);
    delete p.miniatura;
    const dados = JSON.stringify(p);
    const n = Math.ceil(dados.length / PEDACO) || 1;
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM pedido_partes WHERE id = ?', id);
      for (let i = 0; i < n; i++) this.sql.exec('INSERT INTO pedido_partes (id, idx, dados) VALUES (?, ?, ?)', id, i, dados.slice(i * PEDACO, (i + 1) * PEDACO));
      this.sql.exec(`INSERT OR REPLACE INTO pedidos (id, numero, data, nome, telefone, total, pecas, camisetas, status, miniatura, recebido, partes, alerta, tipo,
                       origem, pago, pagamento, limpo, texto)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'loja', ?, ?, ?, ?)`,
        id, p.numero || 0, p.data || new Date().toISOString(), p.cliente?.nome || '', p.cliente?.telefone || '',
        +p.total || 0, pecas, (p.itens || []).length, antigo?.status || 'novo', miniatura, antigo?.recebido || Date.now(), n, alerta,
        contato ? 'contato' : 'pedido', antigo?.pago ?? null, antigo?.pagamento ?? null, antigo?.limpo ?? null, texto);
    });
    // Novo: contato vai direto para a confecção; pedido vai primeiro para o balcão (aguardando pagamento)
    if (!antigo) {
      p.id = id;
      if (contato) this.ctx.waitUntil(this.avisarTodos(avisoDoPedido(p, origem), origem, 'confeccao').catch(() => {}));
      else this.ctx.waitUntil(this.avisarTodos(avisoDoPedido({ ...p, paraLoja: true }, origem), origem, 'loja').catch(() => {}));
    }
    return json({ ok: true });
  }

  ler(id) {
    const cab = this.um('SELECT status, recebido, limpo, pago, pagamento FROM pedidos WHERE id = ?', id);
    if (!cab) return json({ erro: 'pedido não encontrado' }, 404);
    const dados = this.sql.exec('SELECT dados FROM pedido_partes WHERE id = ? ORDER BY idx', id).toArray().map(r => r.dados).join('');
    const p = JSON.parse(dados);
    p.status = cab.status; p.recebido = cab.recebido; if (cab.limpo) p.limpo = cab.limpo;
    p.pago = cab.pago || null; p.pagamento = cab.pagamento ? JSON.parse(cab.pagamento) : null;
    p.arquivos = this.sql.exec('SELECT nome, tipo, tamanho FROM arquivos WHERE pedido = ? ORDER BY nome', id).toArray();
    return json(p);
  }

  async mudar(id, req) {
    const { status } = await req.json().catch(() => ({}));
    if (!STATUS.includes(status) || status === 'cancelado') return json({ erro: 'status inválido' }, 400);
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
