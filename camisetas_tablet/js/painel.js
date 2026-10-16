/**
 * @module painel
 * @description Pedidos no computador da confecção (pedidos.html).
 *
 * Mostra os pedidos que o tablet da loja enviou: lista com filtro por situação,
 * busca, e o pedido em tela cheia (camisetas, tamanhos, cada arte e texto),
 * com PDF, arquivos das artes e a situação (novo → em produção → pronto → entregue).
 * Entra com a senha da confecção (a mesma configurada no tablet).
 */

import { $, $$, esc, aviso, confirmar, ajudarTeclado } from './ui.js';
import { icone } from './icons.js';
import { verPedido } from './admin.js';
import { pdfPedido, baixar, numeroPedido } from './order.js';
import { dinheiro } from './precos.js';
import { lib } from './catalog.js';
import { arquivosTexto } from './textoVetor.js';

const API = 'api/pedidos';
const SITUACOES = [
  ['novo', 'Novo'], ['producao', 'Em produção'], ['pronto', 'Pronto'], ['entregue', 'Entregue']
];
const nomeSituacao = s => (SITUACOES.find(x => x[0] === s) || SITUACOES[0])[1];

const E = { chave: '', pedidos: [], filtro: 'abertos', busca: '', vistos: new Set(), primeira: true };

// ---------- Acesso ----------

const guardada = () => localStorage.getItem('chaveConfeccao') || sessionStorage.getItem('chaveConfeccao') || '';

async function api(caminho = '', opc = {}) {
  const r = await fetch(`${API}${caminho ? '/' + caminho : ''}`, { ...opc, headers: { 'x-chave': E.chave, ...(opc.headers || {}) } });
  if (r.status === 401) { sair(); throw new Error('Senha da confecção errada.'); }
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.erro || `erro ${r.status}`);
  }
  return r;
}

function sair() {
  localStorage.removeItem('chaveConfeccao'); sessionStorage.removeItem('chaveConfeccao');
  E.chave = '';
  telaEntrar();
}

function telaEntrar(msg = '') {
  document.body.innerHTML = `
    <main class="painelEntrar">
      <form class="caixaEntrar" id="formEntrar">
        <span class="marcaIcone grande">${icone('lista', 34)}</span>
        <h1>Pedidos da loja</h1>
        <p class="textoAjuda">Use a <b>senha da confecção</b> (a inicial é <b>000000</b>; dá para trocar no tablet em Administrador → Configurações).</p>
        <label class="campoPeq"><span>Senha da confecção</span><input id="chave" type="password" autocomplete="current-password" required minlength="6"></label>
        <label class="checkLinha"><input type="checkbox" id="lembrar" checked> Lembrar neste computador</label>
        ${msg ? `<p class="alertaPedido">${esc(msg)}</p>` : ''}
        <button type="submit" class="btn btnEscuro btnGrande btnLargo">${icone('check')} Entrar</button>
      </form>
    </main>`;
  $('#chave').focus();
  $('#formEntrar').onsubmit = async e => {
    e.preventDefault();
    E.chave = $('#chave').value.trim();
    try {
      const r = await fetch(`${API}`, { headers: { 'x-chave': E.chave } });
      if (r.status === 401) return telaEntrar('Senha errada.');
      if (r.status === 429) return telaEntrar('Muitas tentativas. Espere 15 minutos.');
      if (!r.ok) return telaEntrar((await r.json().catch(() => ({}))).erro || 'Servidor indisponível.');
      ($('#lembrar').checked ? localStorage : sessionStorage).setItem('chaveConfeccao', E.chave);
      iniciarPainel();
    } catch { telaEntrar('Sem conexão com o servidor.'); }
  };
}

// ---------- Lista ----------

function iniciarPainel() {
  document.body.innerHTML = `
    <div class="painel">
      <header class="painelTopo">
        <div class="painelMarca"><span class="marcaIcone">${icone('lista', 22)}</span><strong>Pedidos da loja</strong></div>
        <div class="segmento" id="filtros" role="tablist">
          ${[['abertos', 'Em aberto'], ...SITUACOES, ['todos', 'Todos']].map(([v, n]) => `<button type="button" data-filtro="${v}" aria-pressed="${E.filtro === v}">${n} <small data-conta="${v}"></small></button>`).join('')}
        </div>
        <label class="busca">${icone('busca')}<input type="search" id="busca" placeholder="Nome, telefone ou nº…" value="${esc(E.busca)}"></label>
        <div class="linhaBotoes">
          <button type="button" class="btn btnClaro" id="atualizar">${icone('virar', 20)} Atualizar</button>
          <button type="button" class="btnIcone" id="sair" title="Sair" aria-label="Sair">${icone('sair', 22)}</button>
        </div>
      </header>
      <main class="painelLista" id="lista"><div class="vazio"><span class="girando"></span></div></main>
    </div>`;
  $$('[data-filtro]').forEach(b => (b.onclick = () => { E.filtro = b.dataset.filtro; $$('[data-filtro]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); pintarLista(); }));
  let t;
  $('#busca').oninput = e => { clearTimeout(t); t = setTimeout(() => { E.busca = e.target.value; pintarLista(); }, 200); };
  $('#atualizar').onclick = () => carregar(true);
  $('#sair').onclick = async () => { if (await confirmar('Sair deste computador? Vai precisar da senha de novo.', { sim: 'Sair' })) sair(); };
  carregar();
  setInterval(() => { if (!document.querySelector('dialog[open]')) carregar(); }, 60000);
}

async function carregar(avisar = false) {
  try {
    const { pedidos } = await (await api()).json();
    const novos = pedidos.filter(p => !E.vistos.has(p.id));
    if (!E.primeira && novos.length) aviso(`${novos.length} pedido${novos.length > 1 ? 's' : ''} novo${novos.length > 1 ? 's' : ''} chegou${novos.length > 1 ? 'ram' : ''}!`, 'ok');
    pedidos.forEach(p => E.vistos.add(p.id));
    E.primeira = false;
    E.pedidos = pedidos;
    const abertos = pedidos.filter(p => p.status !== 'entregue').length;
    document.title = `${abertos ? `(${abertos}) ` : ''}Pedidos · Confecção`;
    pintarLista();
    if (avisar) aviso('Lista atualizada.');
  } catch (e) {
    if (E.chave) aviso(navigator.onLine ? e.message : 'Sem internet.', 'erro');
  }
}

function filtrados() {
  const b = E.busca.trim().toLowerCase();
  return E.pedidos.filter(p =>
    (E.filtro === 'todos' || (E.filtro === 'abertos' ? p.status !== 'entregue' : p.status === E.filtro)) &&
    (!b || `${p.nome} ${p.telefone} ${numeroPedido(p.numero)} ${p.numero}`.toLowerCase().includes(b)));
}

function pintarLista() {
  const conta = f => E.pedidos.filter(p => f === 'todos' || (f === 'abertos' ? p.status !== 'entregue' : p.status === f)).length;
  $$('[data-conta]').forEach(s => (s.textContent = conta(s.dataset.conta) || ''));
  const lista = filtrados();
  $('#lista').innerHTML = lista.length ? `<div class="gradePedidos">${lista.map(p => {
    const d = new Date(p.data);
    return `<button type="button" class="cartaoPedido st-${esc(p.status)}" data-id="${esc(p.id)}">
      <span class="cpImg">${p.miniatura ? `<img src="${esc(p.miniatura)}" alt="">` : icone('camisa', 48)}</span>
      <span class="cpInfo">
        <span class="cpTopo"><strong>Nº ${numeroPedido(p.numero)}</strong><span class="chipSituacao st-${esc(p.status)}">${nomeSituacao(p.status)}</span></span>
        <span class="cpNome">${esc(p.nome || 'Sem nome')}</span>
        <small>${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${p.telefone ? ' · ' + esc(p.telefone) : ''}</small>
        <small>${p.camisetas} camiseta${p.camisetas === 1 ? '' : 's'} · ${p.pecas} peça${p.pecas === 1 ? '' : 's'}${p.total ? ` · <b>${dinheiro(p.total)}</b>` : ''}</small>
        ${p.alerta ? `<small class="alertaPedido">${icone('fechar', 14)} Arte com qualidade baixa</small>` : ''}
      </span>
    </button>`;
  }).join('')}</div>`
    : `<div class="vazio">${icone('lista', 48)}<p>${E.pedidos.length ? 'Nenhum pedido neste filtro.' : 'Nenhum pedido ainda. Assim que o tablet enviar, aparece aqui (a lista atualiza sozinha).'}</p></div>`;
  $$('#lista [data-id]').forEach(b => (b.onclick = () => abrir(b.dataset.id)));
}

// ---------- Pedido ----------

const urls = new Map();
async function urlArquivo(id, nome) {
  const k = id + '|' + nome;
  if (!urls.has(k)) urls.set(k, URL.createObjectURL(await (await api(`${encodeURIComponent(id)}/arquivos/${encodeURIComponent(nome)}`)).blob()));
  return urls.get(k);
}
async function blobArquivo(id, nome) {
  return (await api(`${encodeURIComponent(id)}/arquivos/${encodeURIComponent(nome)}`)).blob();
}

async function abrir(id) {
  let p;
  try { p = await (await api(encodeURIComponent(id))).json(); } catch (e) { return aviso(e.message, 'erro'); }
  const nomeArq = `pedido-${numeroPedido(p.numero)}`;
  const j = await verPedidoPainel(p, nomeArq);
  return j;
}

function verPedidoPainel(p, nomeArq) {
  const id = String(p.id);
  return verPedido(p, {
    pdf: async () => {
      try { baixar(await pdfPedido(p, p.loja || 'Pedido'), `${nomeArq}.pdf`); }
      catch (e) { aviso('Não foi possível gerar o PDF: ' + e.message, 'erro'); }
    },
    artes: async () => {
      try {
        const JSZip = await lib('jszip');
        const zip = new JSZip();
        for (const f of p.arquivos || []) zip.file(f.nome, await blobArquivo(id, f.nome));
        let n = 0;
        for (const it of p.itens) for (const a of it.artes) {
          if (a.tipo === 'texto' && a.texto) { // vetor (SVG) + PNG 300 dpi
            n++;
            for (const f of await arquivosTexto(a, `texto-${n}`)) zip.file(f.nome, f.blob);
            zip.file(`texto-${n}.txt`, `${a.texto}\n${a.descricao || ''}\n${a.lado} · ${a.medidas}\n`);
          }
          if (a.credito) zip.file(`credito-${(a.nome || 'imagem').replace(/[\\/:*?"<>|]+/g, '_')}.txt`, `${a.nome}\n${a.credito}\n`);
        }
        baixar(await zip.generateAsync({ type: 'blob' }), `${nomeArq}-artes.zip`);
      } catch (e) { aviso('Não foi possível baixar: ' + e.message, 'erro'); }
    },
    // Imagem de cada arte: texto (já vem no pedido) ou a prévia enviada pelo tablet
    fonteArte: async a => (a.tipo === 'texto' ? a.url : a.arquivos?.previa ? urlArquivo(id, a.arquivos.previa) : null),
    extraArte: a => (a.arquivos?.original || a.arquivos?.previa)
      ? `<button type="button" class="btnTexto btnArquivo" data-arq="${esc(a.arquivos.original || a.arquivos.previa)}">${icone('baixar', 16)} ${a.arquivos.original ? 'Baixar arquivo original' : 'Baixar imagem'}</button>` : '',
    topo: `<div class="situacaoPedido">
        <span>Situação:</span>
        <div class="segmento" id="dSituacao">${SITUACOES.map(([v, n]) => `<button type="button" data-st="${v}" aria-pressed="${p.status === v}">${n}</button>`).join('')}</div>
        <button type="button" class="btn btnClaro btnPerigoTexto" id="dApagar">${icone('lixo', 20)} Apagar</button>
      </div>`,
    aoAbrir: j => {
      $$('[data-arq]', j.el).forEach(b => (b.onclick = async () => {
        try { baixar(await blobArquivo(id, b.dataset.arq), b.dataset.arq); } catch (e) { aviso(e.message, 'erro'); }
      }));
      $$('[data-st]', j.el).forEach(b => (b.onclick = async () => {
        try {
          await api(encodeURIComponent(id), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: b.dataset.st }) });
          $$('[data-st]', j.el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          const item = E.pedidos.find(x => String(x.id) === id); if (item) item.status = b.dataset.st;
          pintarLista();
          aviso(`Pedido nº ${numeroPedido(p.numero)}: ${nomeSituacao(b.dataset.st)}.`, 'ok');
        } catch (e) { aviso(e.message, 'erro'); }
      }));
      $('#dApagar', j.el).onclick = async () => {
        if (!(await confirmar(`Apagar o pedido nº ${numeroPedido(p.numero)} da nuvem? (o tablet continua com a cópia dele)`, { sim: 'Apagar', perigo: true }))) return;
        try { await api(encodeURIComponent(id), { method: 'DELETE' }); j.fechar(); await carregar(); aviso('Pedido apagado.'); } catch (e) { aviso(e.message, 'erro'); }
      };
    }
  });
}

// ---------- Início ----------

ajudarTeclado();
E.chave = guardada();
if (E.chave) iniciarPainel(); else telaEntrar();
