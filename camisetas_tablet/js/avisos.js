/**
 * @module avisos
 * @description Avisos de pedido novo no computador/celular do gestor.
 *
 * - Notificação do navegador (Web Push): chega mesmo com a página fechada,
 *   bastando o Chrome/Edge estar aberto. Ativada uma vez por aparelho em
 *   "🔔 Avisos" no painel da confecção. Grátis (ver worker/push.js).
 * - Com o painel aberto: som próprio (repete até alguém mexer no painel),
 *   título da aba piscando e o pedido novo destacado.
 */

import { $, esc, aviso, janela } from './ui.js';
import { icone } from './icons.js';

const API = 'api/pedidos/notificacoes';
const ler = k => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ok */ } };

export const temSuporte = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
export const somLigado = () => ler('avisoSom') !== '0';

const deB64u = s => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '==='.slice((t.length + 3) % 4)), c => c.charCodeAt(0)); };
const igual = (a, b) => a && b && a.byteLength === b.byteLength && new Uint8Array(a).every((x, i) => x === b[i]);

/** "Windows · Chrome", "Android · Chrome", "iPhone · Safari"… */
export function nomeAparelho() {
  const u = navigator.userAgent;
  const so = /Windows/.test(u) ? 'Windows' : /Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iPhone/iPad' : /Mac OS X/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'Aparelho';
  const nav = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'navegador';
  return `${so} · ${nav}`;
}

async function chamar(chave, caminho = '', opc = {}) {
  const r = await fetch(`${API}${caminho}`, { ...opc, cache: 'no-store', headers: { 'x-chave': chave, ...(opc.body ? { 'content-type': 'application/json' } : {}), ...(opc.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.erro || `erro ${r.status}`), { dados: d });
  return d;
}

async function registro() {
  const reg = await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

/** Permissão de notificação: 'granted' | 'denied' | 'default' (a API de permissões é a mais confiável). */
async function permissao() {
  try { const q = (await navigator.permissions.query({ name: 'notifications' })).state; return q === 'prompt' ? 'default' : q; }
  catch { return Notification.permission; }
}

/** Situação deste aparelho: { suporte, permissao, ativo, id } */
export async function situacao(lista) {
  if (!temSuporte()) return { suporte: false };
  const perm = await permissao();
  let sub = null;
  try { sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription(); } catch { /* ok */ }
  const id = ler('avisoAparelho');
  return { suporte: true, permissao: perm, ativo: perm === 'granted' && !!sub && (!lista || lista.some(a => a.id === id)), id };
}

/** Ativa os avisos neste aparelho (pede a permissão do navegador). */
export async function ativar(chave, nome) {
  if (!temSuporte()) throw new Error('Este navegador não recebe notificações. Use o Chrome ou o Edge atualizado.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied'
    ? 'As notificações estão bloqueadas para este site. Clique no cadeado ao lado do endereço → Notificações → Permitir, e tente de novo.'
    : 'É preciso clicar em "Permitir" para receber os avisos.');
  const { chave: publica } = await chamar(chave);
  const reg = await registro();
  let sub = await reg.pushManager.getSubscription();
  if (sub && !igual(sub.options?.applicationServerKey, deB64u(publica))) { await sub.unsubscribe().catch(() => {}); sub = null; }
  sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deB64u(publica) });
  const d = await chamar(chave, '', { method: 'POST', body: JSON.stringify({ ...sub.toJSON(), nome: nome || nomeAparelho() }) });
  gravar('avisoAparelho', d.id);
  return d;
}

/** Para de receber neste aparelho. */
export async function desativar(chave) {
  const id = ler('avisoAparelho');
  try { await (await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription())?.unsubscribe(); } catch { /* ok */ }
  gravar('avisoAparelho', null);
  if (id) await chamar(chave, '/' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {});
}

/** Ao abrir o painel: se já estava ativo, renova o cadastro (o navegador às vezes troca o endereço). */
export async function renovar(chave) {
  try {
    if (!temSuporte() || (await permissao()) !== 'granted' || !ler('avisoAparelho')) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!(await reg?.pushManager.getSubscription())) return;
    await ativar(chave, ler('avisoNome') || nomeAparelho());
  } catch { /* tenta na próxima vez */ }
}

// ---------- Alerta com o painel aberto ----------

let audio = null;
function tocar() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t0 = audio.currentTime + 0.02;
    [[880, 0], [1175, 0.18], [1568, 0.36], [1175, 0.7], [1568, 0.88]].forEach(([f, d]) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.32);
      o.connect(g).connect(audio.destination); o.start(t0 + d); o.stop(t0 + d + 0.35);
    });
  } catch { /* sem áudio */ }
}
// O navegador só libera o som depois de um clique na página
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch { /* ok */ }
}, { once: true, capture: true }));

let alarme = null;
/** Som + título piscando até alguém mexer no painel. */
export function alertar(texto = 'NOVO PEDIDO') {
  parar();
  const original = document.title;
  let n = 0, toques = 0;
  if (somLigado()) { tocar(); toques = 1; }
  const pisca = setInterval(() => {
    n++;
    document.title = n % 2 ? `🔔 ${texto}!` : original;
    if (somLigado() && n % 20 === 0 && toques < 5) { tocar(); toques++; } // repete o som a cada 20 s (até 5 vezes)
  }, 1000);
  const fim = () => {
    clearInterval(pisca); document.title = original; alarme = null;
    ['pointerdown', 'keydown'].forEach(ev => document.removeEventListener(ev, quandoMexer, true));
  };
  const quandoMexer = () => { if (document.visibilityState === 'visible') fim(); };
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, quandoMexer, true));
  alarme = { fim };
}
export function parar() { alarme?.fim(); }

// ---------- Janela "Avisos de pedido" ----------

const quando = t => (t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export async function janelaAvisos(chave, aoMudar = () => {}) {
  const j = janela({ titulo: `${icone('sino')} Avisos de pedido`, classe: 'janelaPequena janelaAvisos', html: '<div class="vazio"><span class="girando"></span></div>' });
  const corpo = j.el.querySelector('.janelaCorpo') || j.el;
  const alvo = () => $('#avisosConteudo', j.el) || corpo;
  const pintar = async lista => {
    if (!lista) { try { lista = (await chamar(chave)).aparelhos; } catch (e) { alvo().innerHTML = `<p class="alertaPedido">${esc(e.message)}</p>`; return; } }
    const s = await situacao(lista);
    const html = `
      <div id="avisosConteudo">
      <p class="textoAjuda">A cada pedido novo da loja aparece um <b>alerta com som</b> no canto da tela (Windows) ou na barra de notificações (celular),
        <b>mesmo com esta página fechada</b> — basta o Chrome/Edge estar aberto. Clicando no alerta, abre o pedido. Grátis.</p>
      <div class="estadoAviso ${s.ativo ? 'ligado' : ''}">
        ${!s.suporte ? `${icone('fechar', 20)} Este navegador não recebe notificações. Use o <b>Chrome</b> ou o <b>Edge</b>.`
        : s.ativo ? `${icone('check', 20)} <span><b>Este aparelho recebe os avisos.</b></span>`
        : s.permissao === 'denied' ? `${icone('fechar', 20)} <span>As notificações estão <b>bloqueadas</b> neste navegador. Clique no <b>cadeado</b> ao lado do endereço → <b>Notificações</b> → <b>Permitir</b> e depois em "Ativar".</span>`
        : `${icone('sino', 20)} <span>Este aparelho <b>ainda não</b> recebe os avisos.</span>`}
      </div>
      ${s.suporte ? `<label class="campoPeq"><span>Nome deste aparelho</span><input id="avNome" maxlength="60" value="${esc(ler('avisoNome') || nomeAparelho())}"></label>` : ''}
      <div class="linhaBotoes">
        ${s.suporte ? (s.ativo
          ? `<button type="button" class="btn btnClaro" id="avDesativar">${icone('fechar', 20)} Parar neste aparelho</button>`
          : `<button type="button" class="btn btnEscuro" id="avAtivar">${icone('sino', 20)} Ativar neste aparelho</button>`) : ''}
        <button type="button" class="btn btnClaro" id="avTeste" ${lista.length ? '' : 'disabled'}>${icone('check', 20)} Enviar aviso de teste</button>
      </div>
      <label class="checkLinha"><input type="checkbox" id="avSom" ${somLigado() ? 'checked' : ''}> Com esta página aberta: tocar som e piscar a aba até alguém clicar</label>
      <h4>Aparelhos que recebem os avisos</h4>
      ${lista.length ? `<ul class="listaAparelhos">${lista.map(a => `<li>
          <span><b>${esc(a.nome)}</b>${a.id === s.id ? ' <small class="seloNovo">este</small>' : ''}<br>
          <small>${a.erro ? `<span class="alertaPedido">Falhou: ${esc(a.erro)}</span>` : a.ultimo ? `Último aviso entregue: ${quando(a.ultimo)}` : `Cadastrado em ${quando(a.criado)}`}</small></span>
          <button type="button" class="btnIcone btnPerigoTexto" data-tirar="${esc(a.id)}" title="Parar de avisar este aparelho" aria-label="Remover">${icone('lixo', 20)}</button>
        </li>`).join('')}</ul>` : '<p class="textoAjuda">Nenhum ainda. Ative aqui no computador do gestor (e, se quiser, em outros aparelhos).</p>'}
      <details class="dicasAviso"><summary>O aviso não aparece?</summary><ul>
        <li>No Windows: desligue o <b>"Não perturbe"</b> / Assistente de foco (ícone de notificações perto do relógio).</li>
        <li>Em Configurações do Windows → Sistema → Notificações, deixe o <b>Chrome</b>/<b>Edge</b> ligado.</li>
        <li>O navegador precisa estar aberto (pode ser em outra aba, como o WhatsApp Web).
          No Chrome, em Configurações → Sistema, deixe ligado "Continuar executando apps em segundo plano".</li>
        <li>Use o botão <b>Enviar aviso de teste</b> para conferir.</li>
      </ul></details>
      </div>`;
    if ($('#avisosConteudo', j.el)) $('#avisosConteudo', j.el).outerHTML = html; else corpo.innerHTML = html;
    ligar(s);
  };
  const ligar = s => {
    const el = j.el;
    $('#avNome', el)?.addEventListener('change', e => gravar('avisoNome', e.target.value.trim() || null));
    $('#avSom', el).onchange = e => gravar('avisoSom', e.target.checked ? null : '0');
    $('#avAtivar', el) && ($('#avAtivar', el).onclick = async e => {
      e.target.disabled = true;
      try {
        const nome = $('#avNome', el).value.trim() || nomeAparelho(); gravar('avisoNome', nome);
        const d = await ativar(chave, nome);
        aviso('Avisos ativados neste aparelho. Mandando um teste…', 'ok');
        await chamar(chave, '/teste', { method: 'POST' }).catch(() => {});
        await pintar(d.aparelhos); aoMudar();
      } catch (err) { aviso(err.message, 'erro'); e.target.disabled = false; }
    });
    $('#avDesativar', el) && ($('#avDesativar', el).onclick = async () => { await desativar(chave); aviso('Este aparelho não recebe mais os avisos.'); await pintar(); aoMudar(); });
    $('#avTeste', el).onclick = async e => {
      e.target.disabled = true;
      try {
        const d = await chamar(chave, '/teste', { method: 'POST' });
        aviso(`Aviso de teste enviado para ${d.enviados} aparelho${d.enviados === 1 ? '' : 's'}.${d.falhas?.length ? ' Falhou: ' + d.falhas.join('; ') : ''}`, d.falhas?.length ? 'erro' : 'ok');
        await pintar(d.aparelhos);
      } catch (err) { aviso(`Não foi: ${err.message}`, 'erro'); await pintar(err.dados?.aparelhos); }
    };
    el.querySelectorAll('[data-tirar]').forEach(b => (b.onclick = async () => {
      try {
        const d = await chamar(chave, '/' + encodeURIComponent(b.dataset.tirar), { method: 'DELETE' });
        if (b.dataset.tirar === s.id) await desativar(chave);
        await pintar(d.aparelhos); aoMudar();
      } catch (err) { aviso(err.message, 'erro'); }
    }));
  };
  await pintar();
  return j;
}

/** Para a tela de Configurações do tablet: aparelhos cadastrados e teste. */
export const listarAparelhos = chave => chamar(chave);
export const testarAparelhos = chave => chamar(chave, '/teste', { method: 'POST' });
