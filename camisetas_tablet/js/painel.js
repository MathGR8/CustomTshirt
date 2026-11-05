/**
 * @module painel
 * @description Pedidos no computador da confecção.
 * Abre no próprio app: "Acesso da equipe" (ou 5 toques no nome da loja) com a
 * senha da confecção. O endereço antigo pedidos.html leva para cá.
 *
 * Mostra os pedidos que o tablet da loja enviou: lista com filtro por situação,
 * busca, e o pedido em tela cheia (camisetas, tamanhos, cada arte e texto),
 * com PDF, arquivos das artes e a situação (novo → em produção → pronto → entregue).
 * Entra com a senha da confecção (a mesma configurada no tablet).
 */

import { $, $$, esc, aviso, confirmar, ajudarTeclado, janela } from './ui.js';
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

const guardada = () => { try { return localStorage.getItem('chaveConfeccao') || sessionStorage.getItem('chaveConfeccao') || ''; } catch { return ''; } };

async function api(caminho = '', opc = {}) {
  const r = await fetch(`${API}${caminho ? '/' + caminho : ''}`, { ...opc, headers: { 'x-chave': E.chave, ...(opc.headers || {}) } });
  if (r.status === 401) { sair(); throw new Error('Senha da confecção errada.'); }
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.erro || `erro ${r.status}`);
  }
  return r;
}

function esquecer() {
  try { localStorage.removeItem('chaveConfeccao'); sessionStorage.removeItem('chaveConfeccao'); } catch { /* ok */ }
  E.chave = '';
}
function sair() { esquecer(); telaEntrar(); }
/** Volta para o app da loja (mesmo endereço, sem a confecção). */
function voltarLoja() {
  esquecer();
  history.replaceState(null, '', location.pathname.replace(/pedidos\.html$/, ''));
  location.reload();
}

function telaEntrar(msg = '') {
  document.body.innerHTML = `
    <main class="painelEntrar">
      <form class="caixaEntrar" id="formEntrar">
        <span class="marcaIcone grande">${icone('lista', 34)}</span>
        <h1>Pedidos da loja</h1>
        <p class="textoAjuda">Use a <b>senha da confecção</b> (a inicial é <b>000000</b>; dá para trocar no tablet em Administrador → Configurações).</p>
        <label class="campoPeq"><span>Senha da confecção</span><input id="chave" type="password" autocomplete="off" required minlength="6" inputmode="text"></label>
        <label class="checkLinha"><input type="checkbox" id="mostrar"> Mostrar a senha</label>
        <label class="checkLinha"><input type="checkbox" id="lembrar" ${matchMedia('(pointer: coarse)').matches ? '' : 'checked'}> Lembrar neste aparelho</label>
        ${msg ? `<p class="alertaPedido">${esc(msg)}</p>` : ''}
        <button type="submit" class="btn btnEscuro btnGrande btnLargo">${icone('check')} Entrar</button>
        <button type="button" class="btnTexto" id="voltarLoja">${icone('voltar', 18)} Voltar para o app da loja</button>
      </form>
    </main>`;
  $('#chave').focus();
  $('#voltarLoja').onclick = voltarLoja;
  $('#mostrar').onchange = e => { $('#chave').type = e.target.checked ? 'text' : 'password'; };
  $('#formEntrar').onsubmit = async e => {
    e.preventDefault();
    E.chave = $('#chave').value.trim();
    try {
      const r = await fetch(`${API}`, { headers: { 'x-chave': E.chave } });
      if (r.status === 401) return telaEntrar('Senha errada. Confira a senha no tablet: Administrador → Configurações → "Senha da confecção".');
      if (r.status === 429) return telaEntrar('Muitas tentativas com a senha errada (deste computador ou do tablet, se estiverem na mesma internet). Espere 15 minutos e tente de novo.');
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
  $('#sair').onclick = async () => { if (await confirmar('Sair dos pedidos da confecção e voltar para o app da loja? Vai precisar da senha de novo.', { sim: 'Sair' })) voltarLoja(); };
  carregar();
  setInterval(() => { if (!document.querySelector('dialog[open]')) carregar(); }, 30000);
}

async function carregar(avisar = false) {
  try {
    const { pedidos } = await (await api()).json();
    const novos = pedidos.filter(p => !E.vistos.has(p.id));
    const novosPed = novos.filter(p => p.tipo !== 'contato'), novosCont = novos.filter(p => p.tipo === 'contato');
    if (!E.primeira && novosPed.length) aviso(`${novosPed.length} pedido${novosPed.length > 1 ? 's' : ''} novo${novosPed.length > 1 ? 's' : ''} chegou${novosPed.length > 1 ? 'ram' : ''}!`, 'ok');
    if (!E.primeira && novosCont.length) aviso(`${novosCont.length === 1 ? `${novosCont[0].nome || 'Um cliente'} quer` : `${novosCont.length} clientes querem`} fazer camiseta com a própria arte: chame no WhatsApp.`, 'ok');
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
    if (p.tipo === 'contato') return `<button type="button" class="cartaoPedido contatoCartao st-${esc(p.status)}" data-id="${esc(p.id)}">
      <span class="cpImg">${icone('whatsapp', 48)}</span>
      <span class="cpInfo">
        <span class="cpTopo"><strong>Contato</strong><span class="chipSituacao st-${esc(p.status)}">${p.status === 'entregue' ? 'Atendido' : 'Chamar'}</span></span>
        <span class="cpNome">${esc(p.nome || 'Sem nome')}</span>
        <small>${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${p.telefone ? ' · ' + esc(p.telefone) : ''}</small>
        <small>Quer fazer camiseta com a própria arte</small>
      </span>
    </button>`;
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

// ---------- Contato (cliente que quer usar a própria arte) ----------

function verContato(p) {
  const id = String(p.id), c = p.cliente || {}, d = new Date(p.data);
  const dig = String(c.telefone || '').replace(/\D/g, '');
  const zap = `https://wa.me/${dig.length <= 11 ? '55' + dig : dig}?text=${encodeURIComponent(`Olá, ${c.nome || ''}! Aqui é da confecção. Você pediu informações sobre camiseta com a sua própria arte.`)}`;
  const j = janela({ titulo: `${icone('whatsapp')} Contato — ${esc(c.nome || 'Sem nome')}`, classe: 'janelaPequena', html: `
    <p><b>WhatsApp:</b> ${esc(c.telefone || '—')}<br><small>${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · pelo tablet da loja</small></p>
    <p>Quer fazer camiseta com a <b>própria arte</b>.</p>
    ${c.obs ? `<div class="obsContato">${esc(c.obs)}</div>` : '<p class="textoAjuda">Não deixou observação.</p>'}
    <div class="linhaBotoes">
      <a class="btn btnEscuro" href="${zap}" target="_blank" rel="noopener">${icone('whatsapp', 20)} Chamar no WhatsApp</a>
      <button type="button" class="btn btnClaro" id="cAtendido">${icone('check', 20)} ${p.status === 'entregue' ? 'Marcar como não atendido' : 'Marcar como atendido'}</button>
      <button type="button" class="btnIcone btnPerigoTexto" id="cApagar" aria-label="Apagar">${icone('lixo', 20)}</button>
    </div>` });
  $('#cAtendido', j.el).onclick = async () => {
    try {
      await api(encodeURIComponent(id), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: p.status === 'entregue' ? 'novo' : 'entregue' }) });
      j.fechar(); await carregar();
    } catch (e) { aviso(e.message, 'erro'); }
  };
  $('#cApagar', j.el).onclick = async () => {
    if (!(await confirmar('Apagar este contato?', { sim: 'Apagar', perigo: true }))) return;
    try { await api(encodeURIComponent(id), { method: 'DELETE' }); j.fechar(); await carregar(); } catch (e) { aviso(e.message, 'erro'); }
  };
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
  if (p.tipo === 'contato') return verContato(p);
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

/** Abre a área da confecção (chamado pelo app quando o endereço tem #confeccao ou a senha está lembrada). */
export function iniciar() {
  document.body.className = 'paginaPainel';
  document.title = 'Pedidos · Confecção';
  ajudarTeclado();
  E.chave = guardada();
  if (E.chave) iniciarPainel(); else telaEntrar();
}
