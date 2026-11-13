/**
 * @module balcao
 * @description Loja / Balcão: o caixa recebe o pagamento dos pedidos do tablet.
 *
 * Fluxo: o cliente fecha o pedido no tablet → aparece aqui em "A receber" (com
 * som) → o caixa cobra na maquininha, escolhe a forma de pagamento e confirma →
 * só então o pedido vai para a confecção. Depois fica no histórico ("Pagos"),
 * com a situação da produção; em "Para retirar" estão os prontos, e o balcão
 * marca como entregue quando o cliente busca.
 *
 * Entra com a senha da loja (inicial 111111; troca em "Senha" aqui mesmo).
 * Abre pelo endereço do app + #loja, ou no tablet com 5 toques no nome da loja (senha da loja).
 */

import { $, $$, esc, aviso, confirmar, ajudarTeclado, janela } from './ui.js';
import { icone } from './icons.js';
import { verPedido } from './admin.js';
import { pdfPedido, baixar, numeroPedido, totalPecas } from './order.js';
import { dinheiro } from './precos.js';
import { CORES } from './config.js';
import { janelaAvisos, situacao, renovar, alertar, parar, temSuporte } from './avisos.js';

const API = 'api/pedidos';
export const SENHA_LOJA_INICIAL = '111111';
const FORMAS = [['credito', 'Crédito'], ['debito', 'Débito'], ['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['outro', 'Outro']];
const nomeForma = f => (FORMAS.find(x => x[0] === f) || [f, f || '—'])[1];
const SITUACAO = { novo: 'Na fila da confecção', producao: 'Em produção', pronto: 'Pronto para retirar', entregue: 'Entregue', cancelado: 'Cancelado' };
const ABAS = [['receber', 'A receber'], ['retirar', 'Para retirar'], ['pagos', 'Pagos'], ['cancelados', 'Cancelados']];
const PERIODOS = [['hoje', 'Hoje'], ['7', '7 dias'], ['30', '30 dias'], ['tudo', 'Tudo']];

const E = { chave: '', pedidos: [], aba: 'receber', periodo: 'hoje', busca: '', vistos: new Set(), primeira: true, novos: new Set() };

const ler = k => { try { return localStorage.getItem(k) || sessionStorage.getItem(k) || ''; } catch { return ''; } };
const gravar = (k, v, lembrar = true) => { try { (lembrar ? localStorage : sessionStorage).setItem(k, v); } catch { /* ok */ } };
const hora = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dia = t => new Date(t).toLocaleDateString('pt-BR');
const quando = t => (dia(t) === dia(Date.now()) ? `hoje ${hora(t)}` : `${dia(t)} ${hora(t)}`);
const haQuanto = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : quando(t); };
/** "180,06" ou "180.06" ou "1.234,50" → número */
const lerValor = v => { const s = String(v || '').trim().replace(/[^\d.,]/g, ''); return +(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0; };
const valorTexto = v => (+v || 0).toFixed(2).replace('.', ',');

// ---------- Acesso ----------

async function api(caminho = '', opc = {}) {
  const r = await fetch(`${API}${caminho ? '/' + caminho : ''}`, { cache: 'no-store', ...opc, headers: { 'x-chave': E.chave, ...(opc.body && typeof opc.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(opc.headers || {}) } });
  if (r.status === 401) { sair(); throw new Error('Senha da loja errada.'); }
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.erro || `erro ${r.status}`); }
  return r;
}

function esquecer() {
  try { localStorage.removeItem('chaveLoja'); sessionStorage.removeItem('chaveLoja'); } catch { /* ok */ }
  E.chave = '';
}
function sair() { esquecer(); telaEntrar(); }
function voltarLoja() {
  esquecer();
  history.replaceState(null, '', location.pathname);
  location.reload();
}

function telaEntrar(msg = '') {
  document.body.innerHTML = `
    <main class="painelEntrar">
      <form class="caixaEntrar" id="formEntrar">
        <span class="marcaIcone grande">${icone('dinheiro', 34)}</span>
        <h1>Loja / Balcão</h1>
        <p class="textoAjuda">Receber os pedidos do tablet. Use a <b>senha da loja</b> (a inicial é <b>${SENHA_LOJA_INICIAL}</b>; troque depois em "Senha").</p>
        <label class="campoPeq"><span>Senha da loja</span><input id="chave" type="password" autocomplete="off" required minlength="6"></label>
        <label class="checkLinha"><input type="checkbox" id="mostrar"> Mostrar a senha</label>
        <label class="checkLinha"><input type="checkbox" id="lembrar" ${matchMedia('(pointer: coarse)').matches ? '' : 'checked'}> Lembrar neste aparelho</label>
        ${msg ? `<p class="alertaPedido">${esc(msg)}</p>` : ''}
        <button type="submit" class="btn btnEscuro btnGrande btnLargo">${icone('check')} Entrar</button>
        <button type="button" class="btnTexto" id="esqueci">${icone('cadeado', 18)} Esqueci a senha</button>
        <button type="button" class="btnTexto" id="voltarLoja">${icone('voltar', 18)} Voltar para o app do tablet</button>
      </form>
    </main>`;
  $('#chave').focus();
  $('#voltarLoja').onclick = voltarLoja;
  $('#esqueci').onclick = async () => {
    const nova = await (await import('./recuperar.js')).janelaRecuperar('loja');
    if (nova) { $('#chave').value = nova; aviso('Senha da loja trocada.', 'ok'); }
  };
  $('#mostrar').onchange = e => { $('#chave').type = e.target.checked ? 'text' : 'password'; };
  $('#formEntrar').onsubmit = async e => {
    e.preventDefault();
    const chave = $('#chave').value.trim();
    try {
      const r = await fetch(`${API}/chave`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chave }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 429) return telaEntrar('Muitas tentativas com a senha errada. Espere 15 minutos e tente de novo.');
      if (!r.ok) return telaEntrar(r.status === 401 ? 'Senha errada.' : d.erro || 'Servidor indisponível.');
      if (d.papel !== 'loja') return telaEntrar('Esta é a senha da confecção. Aqui é a senha da loja (balcão).');
      E.chave = chave;
      gravar('chaveLoja', chave, $('#lembrar').checked);
      iniciarPainel();
    } catch { telaEntrar('Sem conexão com o servidor.'); }
  };
}

// ---------- Tela principal ----------

function iniciarPainel() {
  document.body.innerHTML = `
    <div class="painel painelBalcao">
      <header class="painelTopo">
        <div class="painelMarca"><span class="marcaIcone">${icone('dinheiro', 22)}</span><strong>Loja / Balcão</strong></div>
        <div class="segmento" id="abas" role="tablist">
          ${ABAS.map(([v, n]) => `<button type="button" data-aba="${v}" aria-pressed="${E.aba === v}">${n} <small data-conta="${v}"></small></button>`).join('')}
        </div>
        <label class="busca">${icone('busca')}<input type="search" id="busca" placeholder="Nome, telefone ou nº…" value="${esc(E.busca)}"></label>
        <div class="linhaBotoes">
          <button type="button" class="btn btnClaro" id="btnAvisos">${icone('sino', 20)} Avisos <i class="pontoAviso" id="pontoAviso"></i></button>
          <button type="button" class="btn btnClaro" id="btnSenha">${icone('cadeado', 20)} Senha</button>
          <button type="button" class="btn btnClaro" id="atualizar">${icone('virar', 20)} Atualizar</button>
          <button type="button" class="btnIcone" id="sair" title="Sair" aria-label="Sair">${icone('sair', 22)}</button>
        </div>
      </header>
      <div class="faixaAvisos" id="faixaAvisos" hidden>
        ${icone('sino', 22)} <span><b>Receba um alerta com som a cada pedido fechado no tablet</b>, mesmo com esta página fechada (basta o navegador aberto).</span>
        <button type="button" class="btn btnEscuro" id="faixaAtivar">Ativar avisos</button>
        <button type="button" class="btnTexto" id="faixaDepois">Agora não</button>
      </div>
      <section class="caixaDia" id="caixaDia"></section>
      <div class="filtroPeriodo" id="filtroPeriodo" hidden>
        <div class="segmento" role="group" aria-label="Período">${PERIODOS.map(([v, n]) => `<button type="button" data-periodo="${v}" aria-pressed="${E.periodo === v}">${n}</button>`).join('')}</div>
        <button type="button" class="btn btnClaro" id="btnCsv">${icone('baixar', 20)} Planilha (CSV)</button>
      </div>
      <main class="painelLista" id="lista"><div class="vazio"><span class="girando"></span></div></main>
    </div>`;
  $$('[data-aba]').forEach(b => (b.onclick = () => { E.aba = b.dataset.aba; $$('[data-aba]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); pintar(); }));
  $$('[data-periodo]').forEach(b => (b.onclick = () => { E.periodo = b.dataset.periodo; $$('[data-periodo]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); pintar(); }));
  let t;
  $('#busca').oninput = e => { clearTimeout(t); t = setTimeout(() => { E.busca = e.target.value; pintar(); }, 200); };
  $('#atualizar').onclick = () => carregar(true);
  $('#btnSenha').onclick = trocarSenha;
  $('#btnCsv').onclick = planilha;
  $('#sair').onclick = async () => { if (await confirmar('Sair do balcão? Vai precisar da senha da loja de novo.', { sim: 'Sair' })) voltarLoja(); };
  $('#btnAvisos').onclick = () => janelaAvisos(E.chave, estadoAvisos);
  $('#faixaAtivar').onclick = () => janelaAvisos(E.chave, estadoAvisos);
  $('#faixaDepois').onclick = () => { try { sessionStorage.setItem('faixaAvisosLoja', '0'); } catch { /* ok */ } $('#faixaAvisos').hidden = true; };
  carregar().then(() => abrirDoEndereco());
  setInterval(() => { if (!document.querySelector('dialog[open]')) carregar(); }, 15000);
  renovar(E.chave).then(estadoAvisos);
  navigator.serviceWorker?.addEventListener('message', e => {
    if (e.data?.tipo === 'pedidoNovo') carregar();
    if (e.data?.tipo === 'abrir') { window.focus(); abrirDoEndereco(e.data.url); }
  });
}

async function estadoAvisos() {
  const s = await situacao();
  $('#pontoAviso')?.classList.toggle('ligado', !!s.ativo);
  let depois = false; try { depois = sessionStorage.getItem('faixaAvisosLoja') === '0'; } catch { /* ok */ }
  const f = $('#faixaAvisos'); if (f) f.hidden = !temSuporte() || s.ativo || depois;
}

function abrirDoEndereco(endereco = location.href) {
  let id = null;
  try { id = new URL(endereco, location.href).searchParams.get('pedido'); } catch { /* ok */ }
  if (!id) return;
  if (endereco === location.href) history.replaceState(null, '', location.pathname + '#loja');
  document.querySelectorAll('dialog[open] [data-fechar]').forEach(b => b.click());
  E.novos.delete(id); parar();
  setTimeout(() => abrir(id), 200);
}

const aReceber = p => !p.pago && p.status !== 'cancelado';

async function carregar(avisar = false) {
  try {
    const { pedidos } = await (await api()).json();
    const novos = pedidos.filter(p => aReceber(p) && !E.vistos.has(p.id));
    if (!E.primeira && novos.length) {
      novos.forEach(p => E.novos.add(String(p.id)));
      aviso(`${novos.length > 1 ? `${novos.length} pedidos novos` : `Pedido nº ${numeroPedido(novos[0].numero)}`} para receber!`, 'ok');
    }
    pedidos.forEach(p => E.vistos.add(p.id));
    const primeira = E.primeira;
    E.primeira = false;
    E.pedidos = pedidos;
    const n = pedidos.filter(aReceber).length;
    document.title = `${n ? `(${n}) ` : ''}Loja / Balcão`;
    pintar();
    if (!primeira && novos.length) alertar(novos.length > 1 ? `${novos.length} PEDIDOS PARA RECEBER` : 'PEDIDO PARA RECEBER');
    if (avisar) aviso('Lista atualizada.');
  } catch (e) {
    if (E.chave) aviso(navigator.onLine ? e.message : 'Sem internet.', 'erro');
  }
}

/** Data de corte do período (pagos e cancelados). */
function desde() {
  if (E.periodo === 'tudo') return 0;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (E.periodo !== 'hoje') d.setDate(d.getDate() - (+E.periodo - 1));
  return d.getTime();
}
const naAba = (p, aba) => ({
  receber: aReceber(p),
  retirar: !!p.pago && p.status === 'pronto',
  pagos: !!p.pago,
  cancelados: !p.pago && p.status === 'cancelado'
}[aba]);
function filtrados() {
  const b = E.busca.trim().toLowerCase(), corte = ['pagos', 'cancelados'].includes(E.aba) ? desde() : 0;
  return E.pedidos.filter(p => naAba(p, E.aba)
    && (!corte || (p.pago || p.recebido) >= corte)
    && (!b || `${p.nome} ${p.telefone} ${numeroPedido(p.numero)} ${p.numero}`.toLowerCase().includes(b)));
}

/** Caixa do dia: quanto entrou hoje e em que forma. */
function pintarCaixa() {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const pagos = E.pedidos.filter(p => p.pago && p.pago >= hoje.getTime() && p.pagamento);
  const total = pagos.reduce((s, p) => s + (+p.pagamento.valor || 0), 0);
  const por = FORMAS.map(([f, n]) => [n, pagos.filter(p => p.pagamento.forma === f).reduce((s, p) => s + (+p.pagamento.valor || 0), 0)]).filter(([, v]) => v);
  const receber = E.pedidos.filter(aReceber);
  $('#caixaDia').innerHTML = `
    <div class="cxBloco"><span>Recebido hoje</span><b>${dinheiro(total)}</b><small>${pagos.length} pedido${pagos.length === 1 ? '' : 's'}</small></div>
    ${por.map(([n, v]) => `<div class="cxBloco cxForma"><span>${n}</span><b>${dinheiro(v)}</b></div>`).join('')}
    <div class="cxBloco ${receber.length ? 'cxAlerta' : ''}"><span>Esperando pagamento</span><b>${receber.length}</b><small>${dinheiro(receber.reduce((s, p) => s + (+p.total || 0), 0))}</small></div>`;
}

function pintar() {
  pintarCaixa();
  $$('[data-conta]').forEach(s => (s.textContent = E.pedidos.filter(p => naAba(p, s.dataset.conta)).length || ''));
  $('#filtroPeriodo').hidden = !['pagos', 'cancelados'].includes(E.aba);
  const lista = filtrados();
  const vazio = {
    receber: 'Nenhum pedido esperando pagamento. Quando um cliente fechar um pedido no tablet, ele aparece aqui na hora (com som).',
    retirar: 'Nenhum pedido pronto esperando o cliente.',
    pagos: 'Nenhum pedido pago neste período.',
    cancelados: 'Nenhum pedido cancelado neste período.'
  }[E.aba];
  $('#lista').innerHTML = lista.length ? `<div class="gradePedidos">${lista.map(cartao).join('')}</div>` : `<div class="vazio">${icone('dinheiro', 48)}<p>${vazio}</p></div>`;
  $$('#lista [data-id]').forEach(b => (b.onclick = () => { if (E.novos.delete(b.dataset.id)) pintar(); parar(); abrir(b.dataset.id); }));
}

function cartao(p) {
  const novo = E.novos.has(String(p.id)) ? ' cartaoNovo' : '';
  const pg = p.pagamento;
  const chip = p.pago ? `<span class="chipSituacao st-${esc(p.status)}">${esc(SITUACAO[p.status] || p.status)}</span>`
    : p.status === 'cancelado' ? '<span class="chipSituacao st-cancelado">Cancelado</span>' : '<span class="chipSituacao st-receber">A receber</span>';
  return `<button type="button" class="cartaoPedido cartaoBalcao ${p.pago ? `st-${esc(p.status)}` : p.status === 'cancelado' ? 'st-cancelado' : 'st-receber'}${novo}" data-id="${esc(p.id)}">
    <span class="cpImg">${p.miniatura ? `<img src="${esc(p.miniatura)}" alt="">` : icone('camisa', 48)}</span>
    <span class="cpInfo">
      <span class="cpTopo"><strong>Nº ${numeroPedido(p.numero)}</strong>${novo ? '<span class="seloNovo">CHEGOU AGORA</span>' : ''}${chip}</span>
      <span class="cpNome">${esc(p.nome || 'Sem nome')}</span>
      <small>${p.pago ? `Pago ${quando(p.pago)}` : `Pedido ${haQuanto(p.recebido)}`}${p.telefone ? ' · ' + esc(p.telefone) : ''}</small>
      <small>${p.camisetas} camiseta${p.camisetas === 1 ? '' : 's'} · ${p.pecas} peça${p.pecas === 1 ? '' : 's'}</small>
      ${p.texto ? `<small class="seloSemTroca">${icone('editar', 14)} Com texto · sem troca</small>` : ''}
      <span class="cpValor">${pg ? `<b>${dinheiro(pg.valor)}</b> <small>${nomeForma(pg.forma)}${pg.parcelas > 1 ? ` ${pg.parcelas}x` : ''}</small>` : `<b>${p.total ? dinheiro(p.total) : 'Sem preço'}</b>`}</span>
    </span>
  </button>`;
}

// ---------- Pedido ----------

const urls = new Map();
async function urlArquivo(id, nome) {
  const k = id + '|' + nome;
  if (!urls.has(k)) urls.set(k, URL.createObjectURL(await (await api(`${encodeURIComponent(id)}/arquivos/${encodeURIComponent(nome)}`)).blob()));
  return urls.get(k);
}

async function pegar(id) { return (await api(encodeURIComponent(id))).json(); }

async function abrir(id) {
  let p;
  try { p = await pegar(id); } catch (e) { return aviso(e.message, 'erro'); }
  p.id = id;
  if (!p.pago && p.status !== 'cancelado') return receber(p);
  return detalhe(p);
}

const temTexto = p => (p.itens || []).some(it => (it.artes || []).some(a => a.tipo === 'texto'));
const nomeCor = c => CORES[c]?.nome || c;
function resumoItens(p) {
  return `<ul class="rcItens">${(p.itens || []).map((it, i) => `<li>
    <img src="${Object.values(it.imagens || {})[0] || ''}" alt="">
    <span><b>Camiseta ${i + 1} <i class="rcDesc">${esc(it.modelo)} · ${esc(nomeCor(it.cor))}${it.modo === 'pronta' ? ' · pronta' : ''}</i></b>
      <small>${Object.entries(it.quantidades || {}).filter(([, q]) => q > 0).map(([t, q]) => `${esc(t)} ×${q}`).join(' · ')} — ${totalPecas(it)} peça${totalPecas(it) === 1 ? '' : 's'}</small>
      ${(it.artes || []).filter(a => a.tipo === 'texto').map(a => `<small class="seloSemTroca">${icone('editar', 14)} Texto: “${esc(a.texto)}”</small>`).join('')}</span>
    ${it.valor?.total ? `<em>${dinheiro(it.valor.total)}</em>` : ''}
  </li>`).join('')}</ul>`;
}

/** Ver o pedido completo (camisetas grandes, artes, PDF). */
function verCompleto(p) {
  const id = String(p.id);
  const nomes = new Set((p.arquivos || []).map(f => f.nome));
  return verPedido(p, {
    pdf: async () => { try { baixar(await pdfPedido(p, p.loja || 'Pedido'), `pedido-${numeroPedido(p.numero)}.pdf`); } catch (e) { aviso('Não foi possível gerar o PDF: ' + e.message, 'erro'); } },
    fonteArte: async a => (a.tipo === 'texto' ? a.url : a.arquivos?.previa && nomes.has(a.arquivos.previa) ? urlArquivo(id, a.arquivos.previa) : null),
    topo: `<p class="faixaPagamento ${p.pago ? 'pago' : ''}">${p.pago ? `${icone('check', 18)} Pago ${quando(p.pago)} · ${dinheiro(p.pagamento?.valor)} · ${nomeForma(p.pagamento?.forma)}` : `${icone('dinheiro', 18)} Aguardando pagamento no balcão`}</p>`
  });
}

/**
 * Receber o pagamento (ou corrigir um já registrado, com corrigir = true).
 * Ao confirmar a 1ª vez, o pedido vai para a confecção.
 */
function receber(p, corrigir = false) {
  const id = String(p.id), pg = p.pagamento || {};
  const c = p.cliente || {};
  let forma = pg.forma || '';
  const j = janela({ titulo: `${icone('dinheiro')} ${corrigir ? 'Corrigir pagamento' : 'Receber'} · pedido nº ${numeroPedido(p.numero)}`, classe: 'janelaReceber', html: `
    <div class="rcCorpo">
      <div class="rcPedido">
        <div class="rcCliente"><b>${esc(c.nome || 'Sem nome')}</b><small>${c.telefone ? esc(c.telefone) + ' · ' : ''}pedido ${quando(p.recebido || Date.parse(p.data))}</small>
          ${c.obs ? `<p class="pedidoObs">${icone('editar', 16)} ${esc(c.obs)}</p>` : ''}</div>
        ${resumoItens(p)}
        <p class="rcTotal"><span>Total do pedido</span><b>${p.total ? dinheiro(p.total) : 'sem preço no tablet'}</b></p>
        ${temTexto(p) ? `<p class="avisoSemTroca">${icone('editar', 18)} <span><b>Pedido com texto personalizado: não tem troca.</b> O cliente foi avisado no tablet${p.cliente?.cienteSemTroca ? ' e marcou que está ciente' : ''}; reforce na hora de receber.</span></p>` : ''}
        <button type="button" class="btnTexto" id="rcVer">${icone('olho', 18)} Ver o pedido completo</button>
      </div>
      <form class="rcForm" id="rcForm" novalidate>
        <label class="campoPeq"><span>Valor cobrado (R$)</span>
          <input id="rcValor" inputmode="decimal" autocomplete="off" value="${esc(valorTexto(pg.valor || p.total || ''))}" placeholder="0,00"></label>
        <div class="rotuloLinha"><b>Forma de pagamento</b></div>
        <div class="formasPag" role="group" aria-label="Forma de pagamento">${FORMAS.map(([f, n]) => `<button type="button" data-forma="${f}" aria-pressed="${f === forma}">${icone(f === 'dinheiro' ? 'dinheiro' : f === 'pix' ? 'celular' : f === 'outro' ? 'mais' : 'cartao', 26)}<span>${n}</span></button>`).join('')}</div>
        <label class="campoPeq" id="rcParcelasL" hidden><span>Parcelas</span>
          <select id="rcParcelas">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${(pg.parcelas || 1) === i + 1 ? 'selected' : ''}>${i + 1}x${i ? '' : ' (à vista)'}</option>`).join('')}</select></label>
        <div id="rcDinheiro" hidden>
          <label class="campoPeq"><span>Valor recebido em dinheiro (R$) <small>(opcional, para o troco)</small></span>
            <input id="rcRecebido" inputmode="decimal" autocomplete="off" value="${pg.recebido ? esc(valorTexto(pg.recebido)) : ''}" placeholder="0,00"></label>
          <p class="rcTroco" id="rcTroco"></p>
        </div>
        <label class="campoPeq"><span>Atendente</span><input id="rcAtendente" maxlength="60" autocomplete="off" value="${esc(pg.atendente || ler('atendenteLoja'))}" placeholder="Seu nome"></label>
        <label class="campoPeq"><span>Observação <small>(opcional)</small></span><input id="rcObs" maxlength="300" autocomplete="off" value="${esc(pg.obs || '')}" placeholder="Ex.: desconto de 10%, parte em Pix"></label>
        <p class="textoAjuda">${corrigir ? 'Corrige só o registro; o pedido continua na confecção.' : `Cobre o cliente <b>na maquininha</b> (ou Pix/dinheiro) e só depois confirme aqui. <b>Ao confirmar, o pedido vai para a confecção.</b>`}</p>
        <p class="alertaPedido" id="rcErro" hidden></p>
        <button type="submit" class="btn btnEscuro btnGrande btnLargo" id="rcOk">${icone('check')} ${corrigir ? 'Salvar correção' : 'Pagamento recebido · enviar para a confecção'}</button>
        ${corrigir ? '' : `<button type="button" class="btnTexto btnPerigoTexto" id="rcCancelar">${icone('fechar', 18)} Cliente desistiu: cancelar pedido</button>`}
      </form>
    </div>` });
  const el = j.el;
  const pintarForma = () => {
    $('#rcErro', el).hidden = true;
    $$('[data-forma]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.forma === forma)));
    $('#rcParcelasL', el).hidden = forma !== 'credito';
    $('#rcDinheiro', el).hidden = forma !== 'dinheiro';
    troco();
  };
  const troco = () => {
    const v = lerValor($('#rcValor', el).value), r = lerValor($('#rcRecebido', el).value);
    $('#rcTroco', el).innerHTML = forma === 'dinheiro' && r ? (r >= v ? `Troco: <b>${dinheiro(r - v)}</b>` : `<span class="alertaPedido">Faltam ${dinheiro(v - r)}</span>`) : '';
  };
  $$('[data-forma]', el).forEach(b => (b.onclick = () => { forma = b.dataset.forma; pintarForma(); }));
  $('#rcValor', el).oninput = troco; $('#rcRecebido', el).oninput = troco;
  $('#rcVer', el).onclick = () => verCompleto(p);
  pintarForma();
  setTimeout(() => (forma ? $('#rcAtendente', el) : $('#rcValor', el)).focus(), 200);
  $('#rcCancelar', el) && ($('#rcCancelar', el).onclick = async () => {
    if (!(await confirmar(`Cancelar o pedido nº ${numeroPedido(p.numero)} de ${c.nome || 'sem nome'}? Ele não vai para a confecção (dá para reabrir depois em "Cancelados").`, { sim: 'Cancelar pedido', nao: 'Voltar', perigo: true }))) return;
    try { await api(`${encodeURIComponent(id)}/cancelar`, { method: 'POST', body: '{}' }); j.fechar(); aviso('Pedido cancelado.'); carregar(); } catch (e) { aviso(e.message, 'erro'); }
  });
  $('#rcForm', el).onsubmit = async e => {
    e.preventDefault();
    const erro = m => { $('#rcErro', el).hidden = false; $('#rcErro', el).textContent = m; };
    const valor = lerValor($('#rcValor', el).value), recebido = lerValor($('#rcRecebido', el).value);
    if (!(valor > 0)) return erro('Informe o valor cobrado.');
    if (!forma) return erro('Escolha a forma de pagamento.');
    if (forma === 'dinheiro' && recebido && recebido < valor) return erro('O valor recebido em dinheiro é menor que o valor cobrado.');
    const atendente = $('#rcAtendente', el).value.trim();
    if (!corrigir && !(await confirmar(`Confirmar ${dinheiro(valor)} no ${nomeForma(forma).toLowerCase()}${forma === 'credito' && +$('#rcParcelas', el).value > 1 ? ` em ${$('#rcParcelas', el).value}x` : ''} e enviar o pedido nº ${numeroPedido(p.numero)} para a confecção?`, { sim: 'Confirmar', titulo: 'Pagamento recebido?' }))) return;
    const b = $('#rcOk', el); b.disabled = true;
    try {
      await api(`${encodeURIComponent(id)}/pagamento`, { method: 'POST', body: JSON.stringify({ forma, valor, parcelas: +$('#rcParcelas', el).value, recebido: forma === 'dinheiro' ? recebido || null : null, atendente, obs: $('#rcObs', el).value.trim() }) });
      if (atendente) gravar('atendenteLoja', atendente);
      j.fechar();
      aviso(corrigir ? 'Pagamento corrigido.' : `Pedido nº ${numeroPedido(p.numero)} pago e enviado para a confecção.`, 'ok');
      await carregar();
    } catch (err) { b.disabled = false; erro(err.message); }
  };
  return j;
}

/** Pedido pago (histórico) ou cancelado. */
function detalhe(p) {
  const id = String(p.id), pg = p.pagamento || {}, c = p.cliente || {};
  const cancelado = !p.pago && p.status === 'cancelado';
  const j = janela({ titulo: `${icone('lista')} Pedido nº ${numeroPedido(p.numero)}`, classe: 'janelaReceber', html: `
    <div class="rcCorpo">
      <div class="rcPedido">
        <div class="rcCliente"><b>${esc(c.nome || 'Sem nome')}</b><small>${c.telefone ? esc(c.telefone) + ' · ' : ''}pedido ${quando(p.recebido || Date.parse(p.data))}</small>
          ${c.obs ? `<p class="pedidoObs">${icone('editar', 16)} ${esc(c.obs)}</p>` : ''}</div>
        ${resumoItens(p)}
        ${temTexto(p) ? `<p class="avisoSemTroca">${icone('editar', 18)} <span><b>Com texto personalizado: não tem troca.</b></span></p>` : ''}
        <button type="button" class="btnTexto" id="dtVer">${icone('olho', 18)} Ver o pedido completo</button>
      </div>
      <div class="rcForm">
        ${cancelado ? `<p class="faixaPagamento">${icone('fechar', 18)} Pedido cancelado (não foi pago nem enviado para a confecção).</p>
          <button type="button" class="btn btnEscuro btnGrande btnLargo" id="dtReabrir">${icone('virar')} Reabrir para receber</button>` : `
        <p class="faixaPagamento pago">${icone('check', 18)} ${p.pagamento ? `Pago ${quando(p.pago)}` : 'Pedido de antes do balcão (sem registro de pagamento)'}</p>
        <dl class="dadosPagamento">${!p.pagamento ? '' : `
          <dt>Valor</dt><dd><b>${dinheiro(pg.valor)}</b>${p.total && Math.abs(p.total - pg.valor) > 0.009 ? ` <small>(pedido: ${dinheiro(p.total)})</small>` : ''}</dd>
          <dt>Forma</dt><dd>${nomeForma(pg.forma)}${pg.parcelas > 1 ? ` em ${pg.parcelas}x` : pg.forma === 'credito' ? ' à vista' : ''}</dd>
          ${pg.recebido ? `<dt>Recebido</dt><dd>${dinheiro(pg.recebido)} · troco ${dinheiro(pg.recebido - pg.valor)}</dd>` : ''}
          ${pg.atendente ? `<dt>Atendente</dt><dd>${esc(pg.atendente)}</dd>` : ''}
          ${pg.obs ? `<dt>Observação</dt><dd>${esc(pg.obs)}</dd>` : ''}
          ${pg.corrigido ? `<dt>Corrigido</dt><dd>${quando(pg.corrigido)}</dd>` : ''}`}
          <dt>Produção</dt><dd><span class="chipSituacao st-${esc(p.status)}">${esc(SITUACAO[p.status] || p.status)}</span></dd>
        </dl>
        ${p.status === 'entregue'
          ? `<button type="button" class="btn btnClaro btnLargo" id="dtDesfazer">${icone('desfazer', 20)} Desfazer entrega</button>`
          : `<button type="button" class="btn btnEscuro btnGrande btnLargo" id="dtEntregar">${icone('check')} Cliente retirou · marcar como entregue</button>
             ${p.status !== 'pronto' ? '<p class="textoAjuda">A confecção ainda não marcou como pronto. Confira a camiseta antes de entregar.</p>' : ''}`}
        <button type="button" class="btnTexto" id="dtCorrigir">${icone('editar', 18)} ${p.pagamento ? 'Corrigir pagamento' : 'Registrar como foi pago'}</button>`}
      </div>
    </div>` });
  const el = j.el;
  $('#dtVer', el).onclick = () => verCompleto(p);
  const mudar = async (status, msg) => {
    try { await api(encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ status }) }); j.fechar(); aviso(msg, 'ok'); carregar(); } catch (e) { aviso(e.message, 'erro'); }
  };
  $('#dtEntregar', el) && ($('#dtEntregar', el).onclick = () => mudar('entregue', `Pedido nº ${numeroPedido(p.numero)} entregue.`));
  $('#dtDesfazer', el) && ($('#dtDesfazer', el).onclick = () => mudar('pronto', 'Entrega desfeita (voltou para "pronto").'));
  $('#dtCorrigir', el) && ($('#dtCorrigir', el).onclick = () => { j.fechar(); receber(p, true); });
  $('#dtReabrir', el) && ($('#dtReabrir', el).onclick = async () => {
    try { await api(`${encodeURIComponent(id)}/cancelar`, { method: 'POST', body: JSON.stringify({ desfazer: true }) }); j.fechar(); p.status = 'novo'; await carregar(); receber(p); } catch (e) { aviso(e.message, 'erro'); }
  });
  return j;
}

// ---------- Senha e planilha ----------

function trocarSenha() {
  const j = janela({ titulo: `${icone('cadeado')} Senha da loja`, classe: 'janelaPequena', html: `
    <form id="tsForm" class="formConfig">
      <p class="textoAjuda">Senha usada para entrar no balcão. Precisa ter pelo menos 6 caracteres e ser diferente da senha da confecção.</p>
      <label class="campoPeq"><span>Senha atual</span><input id="tsAtual" type="password" autocomplete="current-password" required></label>
      <label class="campoPeq"><span>Nova senha</span><input id="tsNova" type="password" autocomplete="new-password" minlength="6" required></label>
      <label class="campoPeq"><span>Repita a nova senha</span><input id="tsNova2" type="password" autocomplete="new-password" minlength="6" required></label>
      <p class="alertaPedido" id="tsErro" hidden></p>
      <div class="linhaBotoes"><button type="button" class="btn btnClaro" data-fechar>Cancelar</button><button type="submit" class="btn btnEscuro">${icone('check', 20)} Trocar</button></div>
    </form>` });
  $('#tsForm', j.el).onsubmit = async e => {
    e.preventDefault();
    const erro = m => { $('#tsErro', j.el).hidden = false; $('#tsErro', j.el).textContent = m; };
    const atual = $('#tsAtual', j.el).value, nova = $('#tsNova', j.el).value;
    if (nova.length < 6) return erro('A nova senha precisa ter pelo menos 6 caracteres.');
    if (nova !== $('#tsNova2', j.el).value) return erro('As duas senhas novas não são iguais.');
    try {
      const r = await fetch(`${API}/chave-loja`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chave: atual, nova }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return erro(d.erro || `erro ${r.status}`);
      E.chave = nova;
      const lembrada = (() => { try { return !!localStorage.getItem('chaveLoja'); } catch { return false; } })();
      gravar('chaveLoja', nova, lembrada);
      j.fechar(); aviso('Senha da loja trocada.', 'ok');
    } catch { erro('Sem conexão com o servidor.'); }
  };
}

/** Pedidos pagos do período em planilha (abre no Excel). */
function planilha() {
  const linhas = filtrados().filter(p => p.pago || p.status === 'cancelado');
  if (!linhas.length) return aviso('Nada neste período.');
  const cel = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const num = v => (v == null || v === '' ? '' : (+v).toFixed(2).replace('.', ','));
  const csv = [['Pedido', 'Cliente', 'Telefone', 'Pedido em', 'Pago em', 'Forma', 'Parcelas', 'Valor cobrado', 'Total do pedido', 'Peças', 'Atendente', 'Observação', 'Situação'].map(cel).join(';'),
    ...linhas.map(p => [numeroPedido(p.numero), p.nome, p.telefone, quando(p.recebido), p.pago ? quando(p.pago) : '', p.pagamento ? nomeForma(p.pagamento.forma) : '',
      p.pagamento?.parcelas || '', num(p.pagamento?.valor), num(p.total), p.pecas, p.pagamento?.atendente || '', p.pagamento?.obs || '', p.pago ? SITUACAO[p.status] : 'Cancelado'].map(cel).join(';'))].join('\r\n');
  baixar(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `balcao-${E.aba}-${new Date().toISOString().slice(0, 10)}.csv`);
}

// ---------- Início ----------

/** Abre o balcão (chamado pelo app quando o endereço tem #loja ou a senha da loja está lembrada). */
export function iniciar() {
  document.body.className = 'paginaPainel paginaBalcao';
  document.title = 'Loja / Balcão';
  ajudarTeclado();
  E.chave = ler('chaveLoja');
  if (E.chave) iniciarPainel(); else telaEntrar();
}
