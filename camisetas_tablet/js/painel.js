/**
 * @module painel
 * @description Pedidos no computador da confecção.
 * Abre no próprio app: "Acesso da equipe" (ou 5 toques no nome da loja) com a
 * senha da confecção. O endereço antigo pedidos.html leva para cá.
 *
 * Mostra os pedidos que o tablet da loja enviou (só depois de pagos no balcão,
 * ver balcao.js) e os do site da Art Rock: lista com filtro por situação,
 * busca, e o pedido em tela cheia (camisetas, tamanhos, cada arte e texto),
 * com PDF, arquivos das artes e a situação (novo → em produção → pronto → entregue).
 * Entra com a senha da confecção (a mesma configurada no tablet).
 * "🔔 Avisos": alerta do navegador a cada pedido novo (ver avisos.js).
 */

import { $, $$, esc, aviso, confirmar, ajudarTeclado, janela } from './ui.js';
import { icone } from './icons.js';
import { verPedido } from './admin.js';
import { pdfPedido, baixar, numeroPedido } from './order.js';
import { dinheiro } from './precos.js';
import { lib } from './catalog.js';
import { arquivosTexto } from './textoVetor.js';
import { janelaAvisos, situacao, renovar, alertar, parar, temSuporte } from './avisos.js';

const API = 'api/pedidos';
const SITUACOES = [
  ['novo', 'Novo'], ['producao', 'Em produção'], ['pronto', 'Pronto'], ['entregue', 'Entregue']
];
const nomeSituacao = s => (SITUACOES.find(x => x[0] === s) || SITUACOES[0])[1];

const E = { chave: '', pedidos: [], filtro: 'abertos', origem: 'todas', busca: '', vistos: new Set(), primeira: true, novos: new Set() };

/** Pedido do site da Art Rock tem numeração própria: AR-0001. */
const codigo = p => (p.origem === 'artrock' ? `AR-${numeroPedido(p.numero)}` : numeroPedido(p.numero));
const ORIGENS = [['todas', 'Todas'], ['loja', 'Loja'], ['artrock', 'Art Rock']];
/** Etiqueta "Loja" (tablet) ou "Art Rock" (site). */
const etiqueta = p => (p.origem === 'artrock'
  ? '<span class="etiquetaOrigem origemArtrock">Art Rock</span>'
  : '<span class="etiquetaOrigem origemLoja">Loja</span>');

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
      const r = await fetch(`${API}/chave`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chave: E.chave }) });
      if (r.status === 401) return telaEntrar('Senha errada. Confira a senha no tablet: Administrador → Configurações → "Senha da confecção".');
      if (r.status === 429) return telaEntrar('Muitas tentativas com a senha errada (deste computador ou do tablet, se estiverem na mesma internet). Espere 15 minutos e tente de novo.');
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return telaEntrar(d.erro || 'Servidor indisponível.');
      if (d.papel === 'loja') return telaEntrar('Esta é a senha da loja (balcão). Para receber pedidos, abra o endereço do app com #loja.');
      ($('#lembrar').checked ? localStorage : sessionStorage).setItem('chaveConfeccao', E.chave);
      iniciarPainel();
    } catch { telaEntrar('Sem conexão com o servidor.'); }
  };
}

// ---------- Espaço na nuvem ----------

const mb = b => (b >= 1073741824 ? `${(b / 1073741824).toFixed(2).replace('.', ',')} GB` : `${Math.max(b > 0 ? 0.1 : 0, b / 1048576).toFixed(b < 10485760 ? 1 : 0).replace('.', ',')} MB`);
const pct = e => Math.min(100, Math.round(e.usado / e.limite * 100));

/** Botão "Espaço: 12%" e faixa de aviso a partir de 70%. */
async function estadoEspaco() {
  try {
    const e = await (await api('espaco')).json();
    const p = pct(e);
    $('#espacoTxt') && ($('#espacoTxt').textContent = `Espaço: ${p}%`);
    $('#btnEspaco')?.classList.toggle('espacoAlto', p >= 70);
    const f = $('#faixaEspaco'); if (!f) return;
    f.hidden = p < 70;
    f.classList.toggle('critico', p >= 90);
    f.innerHTML = p >= 70 ? `${icone('pasta', 22)} <span><b>O espaço dos pedidos está em ${p}%</b> (${mb(e.usado)} de ${mb(e.limite)}). ${p >= 90 ? 'Quando encher, os pedidos novos ficam esperando no tablet.' : 'Libere espaço apagando os arquivos de pedidos antigos já entregues.'}</span>
      <button type="button" class="btn btnEscuro" id="faixaLimpar">Liberar espaço</button>` : '';
    $('#faixaLimpar') && ($('#faixaLimpar').onclick = () => janelaEspaco());
  } catch { /* sem internet: tenta na próxima */ }
}

async function janelaEspaco() {
  let meses = 6;
  const j = janela({ titulo: `${icone('pasta')} Espaço dos pedidos`, classe: 'janelaPequena janelaEspaco', html: '<div class="vazio"><span class="girando"></span></div>' });
  const corpo = j.el.querySelector('.janelaCorpo');
  const pintar = async () => {
    let e;
    try { e = await (await api(`espaco?meses=${meses}`)).json(); } catch (err) { corpo.innerHTML = `<p class="alertaPedido">${esc(err.message)}</p>`; return; }
    const p = pct(e), l = e.limpeza;
    corpo.innerHTML = `
      <p class="textoAjuda">Os pedidos (dados e imagens das artes) ficam guardados na nuvem da Cloudflare. No plano grátis cabem <b>${mb(e.limite)}</b>.
        O catálogo de artes fica no tablet e não ocupa este espaço.</p>
      <div class="barraEspaco ${p >= 90 ? 'critico' : p >= 70 ? 'alto' : ''}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="Espaço usado"><i style="width:${Math.max(p, 1)}%"></i></div>
      <p class="numEspaco"><b>${p}% usado</b> · ${mb(e.usado)} de ${mb(e.limite)}</p>
      <p class="textoAjuda">${e.pedidos} pedido${e.pedidos === 1 ? '' : 's'} guardado${e.pedidos === 1 ? '' : 's'}${e.porPedido ? ` · cerca de ${mb(e.porPedido)} por pedido` : ''}
        ${e.porPedido && (e.limite - e.usado) / e.porPedido >= 1 ? ` · ainda cabem uns <b>${Math.floor((e.limite - e.usado) / e.porPedido).toLocaleString('pt-BR')}</b> pedidos` : ''}</p>
      <h4>Liberar espaço</h4>
      <p class="textoAjuda">Apaga só as <b>imagens das artes</b> dos pedidos já <b>entregues</b>. O pedido continua na lista com cliente, camisetas, tamanhos e valores.</p>
      <label class="campoPeq"><span>Pedidos entregues há mais de</span>
        <select id="esMeses">${[1, 3, 6, 12, 24].map(m => `<option value="${m}" ${m === meses ? 'selected' : ''}>${m} ${m === 1 ? 'mês' : 'meses'}</option>`).join('')}</select></label>
      <p class="previaLimpeza">${l.pedidos ? `<b>${l.pedidos} pedido${l.pedidos === 1 ? '' : 's'}</b> · libera <b>${mb(l.bytes)}</b>` : 'Nenhum pedido entregue nesse período com arquivos guardados.'}</p>
      <div class="linhaBotoes">
        <button type="button" class="btn btnClaro" data-fechar>Fechar</button>
        <button type="button" class="btn btnEscuro btnPerigo" id="esLimpar" ${l.pedidos ? '' : 'disabled'}>${icone('lixo', 20)} Apagar arquivos</button>
      </div>`;
    $('#esMeses', j.el).onchange = ev => { meses = +ev.target.value; pintar(); };
    $('#esLimpar', j.el).onclick = async () => {
      if (!(await confirmar(`Apagar as imagens das artes de ${l.pedidos} pedido${l.pedidos === 1 ? '' : 's'} entregue${l.pedidos === 1 ? '' : 's'} há mais de ${meses} ${meses === 1 ? 'mês' : 'meses'}? Os dados dos pedidos continuam. Não dá para desfazer.`, { sim: 'Apagar arquivos', perigo: true }))) return;
      try {
        const r = await (await api('espaco/limpar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ meses }) })).json();
        aviso(`Liberado ${mb(r.bytes)} (${r.pedidos} pedido${r.pedidos === 1 ? '' : 's'}).`, 'ok');
        await pintar(); estadoEspaco(); carregar();
      } catch (err) { aviso(err.message, 'erro'); }
    };
  };
  await pintar();
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
        <div class="segmento segOrigem" id="filtroOrigem" role="group" aria-label="De onde veio o pedido">
          ${ORIGENS.map(([v, n]) => `<button type="button" data-origem="${v}" aria-pressed="${E.origem === v}">${n}</button>`).join('')}
        </div>
        <label class="busca">${icone('busca')}<input type="search" id="busca" placeholder="Nome, telefone ou nº…" value="${esc(E.busca)}"></label>
        <div class="linhaBotoes">
          <button type="button" class="btn btnClaro" id="btnAvisos">${icone('sino', 20)} Avisos <i class="pontoAviso" id="pontoAviso"></i></button>
          <button type="button" class="btn btnClaro" id="btnEspaco" title="Espaço dos pedidos na nuvem">${icone('pasta', 20)} <span id="espacoTxt">Espaço</span></button>
          <button type="button" class="btn btnClaro" id="atualizar">${icone('virar', 20)} Atualizar</button>
          <button type="button" class="btnIcone" id="sair" title="Sair" aria-label="Sair">${icone('sair', 22)}</button>
        </div>
      </header>
      <div class="faixaAvisos" id="faixaAvisos" hidden>
        ${icone('sino', 22)} <span><b>Receba um alerta com som a cada pedido novo</b>, mesmo com esta página fechada (basta o navegador aberto).</span>
        <button type="button" class="btn btnEscuro" id="faixaAtivar">Ativar avisos</button>
        <button type="button" class="btnTexto" id="faixaDepois">Agora não</button>
      </div>
      <div class="faixaEspaco" id="faixaEspaco" hidden></div>
      <main class="painelLista" id="lista"><div class="vazio"><span class="girando"></span></div></main>
    </div>`;
  $$('[data-filtro]').forEach(b => (b.onclick = () => { E.filtro = b.dataset.filtro; $$('[data-filtro]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); pintarLista(); }));
  $$('[data-origem]').forEach(b => (b.onclick = () => { E.origem = b.dataset.origem; $$('[data-origem]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); pintarLista(); }));
  let t;
  $('#busca').oninput = e => { clearTimeout(t); t = setTimeout(() => { E.busca = e.target.value; pintarLista(); }, 200); };
  $('#atualizar').onclick = () => carregar(true);
  $('#sair').onclick = async () => { if (await confirmar('Sair dos pedidos da confecção e voltar para o app da loja? Vai precisar da senha de novo.', { sim: 'Sair' })) voltarLoja(); };
  $('#btnAvisos').onclick = () => janelaAvisos(E.chave, estadoAvisos);
  $('#btnEspaco').onclick = () => janelaEspaco();
  estadoEspaco();
  $('#faixaAtivar').onclick = () => janelaAvisos(E.chave, estadoAvisos);
  $('#faixaDepois').onclick = () => { try { sessionStorage.setItem('faixaAvisos', '0'); } catch { /* ok */ } $('#faixaAvisos').hidden = true; };
  carregar().then(() => abrirDoEndereco());
  setInterval(() => { if (!document.querySelector('dialog[open]')) carregar(); }, 30000);
  renovar(E.chave).then(estadoAvisos);
  // Aviso que chegou pelo navegador com o painel aberto: atualiza na hora; clique no aviso: abre o pedido
  navigator.serviceWorker?.addEventListener('message', e => {
    if (e.data?.tipo === 'pedidoNovo') carregar();
    if (e.data?.tipo === 'abrir') { window.focus(); abrirDoEndereco(e.data.url); }
  });
}

/** Botão "Avisos" com ponto verde (ativo neste aparelho) e faixa convidando a ativar. */
async function estadoAvisos() {
  const s = await situacao();
  const ponto = $('#pontoAviso'); if (ponto) ponto.classList.toggle('ligado', !!s.ativo);
  let depois = false; try { depois = sessionStorage.getItem('faixaAvisos') === '0'; } catch { /* ok */ }
  const faixa = $('#faixaAvisos'); if (faixa) faixa.hidden = !temSuporte() || s.ativo || depois;
}

/** Endereço com ?pedido=ID (veio de um clique no aviso): abre esse pedido. */
function abrirDoEndereco(endereco = location.href) {
  let id = null;
  try { id = new URL(endereco, location.href).searchParams.get('pedido'); } catch { /* ok */ }
  if (!id) return;
  if (endereco === location.href) history.replaceState(null, '', location.pathname + '#confeccao');
  document.querySelectorAll('dialog[open] [data-fechar]').forEach(b => b.click());
  E.novos.delete(id); parar(); pintarLista();
  setTimeout(() => abrir(id), 200);
}

async function carregar(avisar = false) {
  try {
    const { pedidos } = await (await api()).json();
    const primeira = E.primeira;
    const novos = pedidos.filter(p => !E.vistos.has(p.id));
    const novosPed = novos.filter(p => p.tipo !== 'contato'), novosCont = novos.filter(p => p.tipo === 'contato');
    if (!E.primeira && novos.length) novos.forEach(p => E.novos.add(String(p.id)));
    if (!E.primeira && novosPed.length) aviso(`${novosPed.length} pedido${novosPed.length > 1 ? 's' : ''} novo${novosPed.length > 1 ? 's' : ''} chegou${novosPed.length > 1 ? 'ram' : ''}!`, 'ok');
    if (!E.primeira && novosCont.length) aviso(`${novosCont.length === 1 ? `${novosCont[0].nome || 'Um cliente'} quer` : `${novosCont.length} clientes querem`} fazer camiseta com a própria arte: chame no WhatsApp.`, 'ok');
    pedidos.forEach(p => E.vistos.add(p.id));
    E.primeira = false;
    E.pedidos = pedidos;
    const abertos = pedidos.filter(p => p.status !== 'entregue').length;
    document.title = `${abertos ? `(${abertos}) ` : ''}Pedidos · Confecção`;
    pintarLista();
    // Som + aba piscando (depois de atualizar o título, que é o que volta quando para de piscar)
    if (!primeira && novos.length) alertar(novosPed.length ? (novosPed.length > 1 ? `${novosPed.length} PEDIDOS NOVOS` : 'NOVO PEDIDO') : 'NOVO CONTATO');
    if (avisar) aviso('Lista atualizada.');
    return pedidos;
  } catch (e) {
    if (E.chave) aviso(navigator.onLine ? e.message : 'Sem internet.', 'erro');
  }
}

function filtrados() {
  const b = E.busca.trim().toLowerCase();
  return E.pedidos.filter(p =>
    (E.filtro === 'todos' || (E.filtro === 'abertos' ? p.status !== 'entregue' : p.status === E.filtro)) &&
    (E.origem === 'todas' || (p.origem === 'artrock' ? 'artrock' : 'loja') === E.origem) &&
    (!b || `${p.nome} ${p.telefone} ${codigo(p)} ${p.numero} ${p.origem === 'artrock' ? 'art rock artrock' : 'loja'}`.toLowerCase().includes(b)));
}

function pintarLista() {
  const daOrigem = E.pedidos.filter(p => E.origem === 'todas' || (p.origem === 'artrock' ? 'artrock' : 'loja') === E.origem);
  const conta = f => daOrigem.filter(p => f === 'todos' || (f === 'abertos' ? p.status !== 'entregue' : p.status === f)).length;
  $$('[data-conta]').forEach(s => (s.textContent = conta(s.dataset.conta) || ''));
  const lista = filtrados();
  $('#lista').innerHTML = lista.length ? `<div class="gradePedidos">${lista.map(p => {
    const d = new Date(p.data);
    const novo = E.novos.has(String(p.id)) ? ' cartaoNovo' : '';
    if (p.tipo === 'contato') return `<button type="button" class="cartaoPedido contatoCartao st-${esc(p.status)}${novo}" data-id="${esc(p.id)}">
      <span class="cpImg">${icone('whatsapp', 48)}</span>
      <span class="cpInfo">
        <span class="cpTopo"><strong>Contato</strong>${etiqueta(p)}${novo ? '<span class="seloNovo">CHEGOU AGORA</span>' : ''}<span class="chipSituacao st-${esc(p.status)}">${p.status === 'entregue' ? 'Atendido' : 'Chamar'}</span></span>
        <span class="cpNome">${esc(p.nome || 'Sem nome')}</span>
        <small>${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${p.telefone ? ' · ' + esc(p.telefone) : ''}</small>
        <small>Quer fazer camiseta com a própria arte</small>
      </span>
    </button>`;
    return `<button type="button" class="cartaoPedido st-${esc(p.status)}${novo}${p.origem === 'artrock' ? ' cartaoArtrock' : ''}" data-id="${esc(p.id)}">
      <span class="cpImg">${p.miniatura ? `<img src="${esc(p.miniatura)}" alt="">` : icone('camisa', 48)}</span>
      <span class="cpInfo">
        <span class="cpTopo"><strong>Nº ${codigo(p)}</strong>${etiqueta(p)}${novo ? '<span class="seloNovo">CHEGOU AGORA</span>' : ''}<span class="chipSituacao st-${esc(p.status)}">${nomeSituacao(p.status)}</span></span>
        <span class="cpNome">${esc(p.nome || 'Sem nome')}</span>
        <small>${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${p.telefone ? ' · ' + esc(p.telefone) : ''}</small>
        ${p.limpo ? '<small class="seloLimpo">arquivos apagados</small>' : ''}
        ${p.pagamento ? `<small class="seloPago">${icone('check', 14)} Pago na loja</small>` : ''}
        <small>${p.camisetas} ${p.origem === 'artrock' ? `modelo${p.camisetas === 1 ? '' : 's'}` : `camiseta${p.camisetas === 1 ? '' : 's'}`} · ${p.pecas} peça${p.pecas === 1 ? '' : 's'}${p.total ? ` · <b>${dinheiro(p.total)}</b>` : ''}</small>
        ${p.alerta ? `<small class="alertaPedido">${icone('fechar', 14)} Arte com qualidade baixa</small>` : ''}
      </span>
    </button>`;
  }).join('')}</div>`
    : `<div class="vazio">${icone('lista', 48)}<p>${E.pedidos.length ? 'Nenhum pedido neste filtro.' : 'Nenhum pedido ainda. Assim que o tablet da loja ou o site da Art Rock enviar, aparece aqui (a lista atualiza sozinha).'}</p></div>`;
  $$('#lista [data-id]').forEach(b => (b.onclick = () => { if (E.novos.delete(b.dataset.id)) pintarLista(); parar(); abrir(b.dataset.id); }));
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
  if (p.origem === 'artrock') return verPedidoArtrock(p);
  const nomeArq = `pedido-${numeroPedido(p.numero)}`;
  const j = await verPedidoPainel(p, nomeArq);
  return j;
}

function verPedidoPainel(p, nomeArq) {
  const id = String(p.id);
  const nomes = new Set((p.arquivos || []).map(f => f.nome));
  const tem = n => nomes.has(n);
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
    fonteArte: async a => (a.tipo === 'texto' ? a.url : a.arquivos?.previa && tem(a.arquivos.previa) ? urlArquivo(id, a.arquivos.previa) : null),
    extraArte: a => (!p.limpo && (a.arquivos?.original || a.arquivos?.previa))
      ? `<button type="button" class="btnTexto btnArquivo" data-arq="${esc(a.arquivos.original || a.arquivos.previa)}">${icone('baixar', 16)} ${a.arquivos.original ? 'Baixar arquivo original' : 'Baixar imagem'}</button>` : '',
    topo: `${p.limpo ? `<p class="avisoLimpo">${icone('pasta', 18)} As imagens das artes deste pedido foram apagadas em ${new Date(p.limpo).toLocaleDateString('pt-BR')} para liberar espaço. Os dados continuam.</p>` : ''}<div class="situacaoPedido">
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

// ---------- Pedido do site da Art Rock ----------

/** Situação + apagar (mesma barra dos pedidos da loja). */
function barraSituacao(p, j) {
  const id = String(p.id);
  $$('[data-st]', j.el).forEach(b => (b.onclick = async () => {
    try {
      await api(encodeURIComponent(id), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: b.dataset.st }) });
      $$('[data-st]', j.el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const item = E.pedidos.find(x => String(x.id) === id); if (item) item.status = b.dataset.st;
      pintarLista();
      aviso(`Pedido nº ${codigo(p)}: ${nomeSituacao(b.dataset.st)}.`, 'ok');
    } catch (e) { aviso(e.message, 'erro'); }
  }));
  $('#dApagar', j.el).onclick = async () => {
    if (!(await confirmar(`Apagar o pedido nº ${codigo(p)} (Art Rock) da nuvem? Os arquivos também são apagados.`, { sim: 'Apagar', perigo: true }))) return;
    try { await api(encodeURIComponent(id), { method: 'DELETE' }); j.fechar(); await carregar(); aviso('Pedido apagado.'); } catch (e) { aviso(e.message, 'erro'); }
  };
}

/**
 * Pedido feito no site da Art Rock: cliente, modelos com tamanhos, artes de
 * cada modelo e os arquivos enviados (PDF do pedido com as camisetas montadas
 * + artes em alta). A montagem completa está no PDF.
 */
function verPedidoArtrock(p) {
  const id = String(p.id), c = p.cliente || {}, d = new Date(p.data);
  const dig = String(c.telefone || '').replace(/\D/g, '');
  const zap = `https://wa.me/${dig.length <= 11 ? '55' + dig : dig}?text=${encodeURIComponent(`Olá, ${c.nome || ''}! Aqui é da Art Rock, sobre o seu pedido AR-${numeroPedido(p.numero)} feito no site.`)}`;
  const arquivos = p.arquivos || [];
  const pdf = arquivos.find(f => /pedido.*\.pdf$/i.test(f.nome)) || arquivos.find(f => f.tipo === 'application/pdf');
  const pecas = it => Object.values(it.quantidades || {}).reduce((a, n) => a + (+n || 0), 0);
  const kb = b => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const j = janela({ titulo: `${icone('lista')} Pedido nº ${codigo(p)} <span class="etiquetaOrigem origemArtrock">Art Rock</span>`, classe: 'janelaGrande janelaArtrock', html: `
    ${p.limpo ? `<p class="avisoLimpo">${icone('pasta', 18)} Os arquivos deste pedido foram apagados em ${new Date(p.limpo).toLocaleDateString('pt-BR')} para liberar espaço. Os dados continuam.</p>` : ''}
    <div class="situacaoPedido">
      <span>Situação:</span>
      <div class="segmento" id="dSituacao">${SITUACOES.map(([v, n]) => `<button type="button" data-st="${v}" aria-pressed="${p.status === v}">${n}</button>`).join('')}</div>
      <button type="button" class="btn btnClaro btnPerigoTexto" id="dApagar">${icone('lixo', 20)} Apagar</button>
    </div>
    <div class="arCliente">
      <div><b>${esc(c.nome || 'Sem nome')}</b><small>${esc(c.telefone || '—')} · ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · pelo site da Art Rock</small></div>
      <a class="btn btnEscuro" href="${zap}" target="_blank" rel="noopener">${icone('whatsapp', 20)} Chamar no WhatsApp</a>
    </div>
    ${c.obs ? `<div class="obsContato"><b>Observação:</b> ${esc(c.obs)}</div>` : ''}
    <div class="arAcoes">
      ${pdf && !p.limpo ? `<button type="button" class="btn btnEscuro" data-arq="${esc(pdf.nome)}">${icone('baixar', 20)} PDF do pedido (camisetas montadas)</button>` : ''}
      ${arquivos.length && !p.limpo ? `<button type="button" class="btn btnClaro" id="arTudo">${icone('pasta', 20)} Baixar tudo (.zip)</button>` : ''}
    </div>
    <div class="arItens">${(p.itens || []).map((it, i) => `
      <section class="arItem">
        <h3>${i + 1}. ${esc(it.nome || `${it.modelo} ${it.cor}`)} <small>${esc([it.modelo, it.malha, it.cor].filter(Boolean).join(' · '))}</small></h3>
        <p class="arTamanhos">${Object.entries(it.quantidades || {}).map(([t, q]) => `<span><b>${esc(t)}</b> × ${q}</span>`).join('')}<em>${pecas(it)} peça${pecas(it) === 1 ? '' : 's'}</em></p>
        ${(it.artes || []).length ? `<ul class="arArtes">${it.artes.map(a => `<li>
          <span class="arLado">${a.lado === 'Costas' ? 'Costas' : 'Frente'}</span>
          <span>${a.tipo === 'texto' ? `Texto “${esc(a.texto || a.nome)}”` : esc(a.nome || 'Arte')}</span>
          <small>${esc(a.medidas || '')}</small></li>`).join('')}</ul>` : '<p class="textoAjuda">Sem estampa (camiseta lisa).</p>'}
      </section>`).join('')}</div>
    ${arquivos.length && !p.limpo ? `<h3 class="arTitulo">Arquivos enviados</h3>
      <ul class="arArquivos">${arquivos.map(f => `<li><span>${esc(f.nome)}</span><small>${kb(f.tamanho)}</small>
        <button type="button" class="btnTexto btnArquivo" data-arq="${esc(f.nome)}">${icone('baixar', 16)} Baixar</button></li>`).join('')}</ul>` : ''}` });
  $$('[data-arq]', j.el).forEach(b => (b.onclick = async () => {
    try { baixar(await blobArquivo(id, b.dataset.arq), b.dataset.arq); } catch (e) { aviso(e.message, 'erro'); }
  }));
  $('#arTudo', j.el) && ($('#arTudo', j.el).onclick = async () => {
    try {
      const JSZip = await lib('jszip');
      const zip = new JSZip();
      for (const f of arquivos) zip.file(f.nome, await blobArquivo(id, f.nome));
      zip.file('pedido.txt', [`Pedido AR-${numeroPedido(p.numero)} (site Art Rock)`, `${c.nome || ''} · ${c.telefone || ''}`, c.obs ? `Obs.: ${c.obs}` : '',
        ...(p.itens || []).map((it, i) => `${i + 1}. ${[it.modelo, it.malha, it.cor].join(' · ')} — ${Object.entries(it.quantidades || {}).map(([t, q]) => `${t}×${q}`).join(' ')}`)].filter(Boolean).join('\n') + '\n');
      baixar(await zip.generateAsync({ type: 'blob' }), `pedido-AR-${numeroPedido(p.numero)}.zip`);
    } catch (e) { aviso('Não foi possível baixar: ' + e.message, 'erro'); }
  });
  barraSituacao(p, j);
  return j;
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
