/**
 * @module ui
 * @description Peças de interface reaproveitadas: avisos, janelas, folha de
 * ajuda, confirmação, teclado de senha e dica animada (coach).
 */

import { icone } from './icons.js';

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/** Escapa texto para colocar em HTML. */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Número com vírgula: 24.5 → "24,5". */
export const num = v => String(Math.round(v * 10) / 10).replace('.', ',');

// ---------- Aviso rápido ----------
let tAviso = null;
export function aviso(texto, tipo = 'info') {
  let el = $('#aviso');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aviso'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.className = 'aviso ' + tipo;
  el.innerHTML = `${icone(tipo === 'erro' ? 'fechar' : 'check', 20)}<span>${esc(texto)}</span>`;
  el.classList.add('visivel');
  clearTimeout(tAviso);
  tAviso = setTimeout(() => el.classList.remove('visivel'), 3200);
}

// ---------- Janela (modal) ----------
/**
 * Abre uma janela.
 * @param {{titulo?: string, html: string, classe?: string, fechar?: boolean}} o
 * @returns {{el: HTMLDialogElement, fechar: Function, aoFechar: Promise}}
 */
export function janela({ titulo = '', html, classe = '', fechar = true }) {
  const d = document.createElement('dialog');
  d.className = 'janela ' + classe;
  d.innerHTML = `
    ${titulo || fechar ? `<header class="janelaTopo"><h2>${titulo}</h2>
      ${fechar ? `<button type="button" class="btnIcone" data-fechar aria-label="Fechar">${icone('fechar')}</button>` : ''}</header>` : ''}
    <div class="janelaCorpo">${html}</div>`;
  document.body.appendChild(d);
  let resolver;
  const aoFechar = new Promise(r => (resolver = r));
  const fecharJanela = valor => {
    if (!d.isConnected) return;
    d.classList.add('saindo');
    setTimeout(() => {
      const t = d.querySelector('.btnTeclado'); // botão Pronto volta para a página
      if (t) { try { t.hidePopover?.(); } catch { /* ok */ } t.hidden = true; document.body.appendChild(t); }
      d.close(); d.remove(); resolver(valor);
    }, 160);
  };
  // Toque fora fecha só se o dedo começou E terminou fora da janela, e não logo
  // depois do teclado abrir/fechar (a tela muda de tamanho no meio do toque)
  let comecouFora = false;
  d.addEventListener('pointerdown', e => { comecouFora = e.target === d && !tecladoMexeu(); });
  d.addEventListener('click', e => {
    if (e.target.closest('[data-fechar]')) fecharJanela(null);
    else if (e.target === d && fechar && comecouFora && !tecladoMexeu()) fecharJanela(null); // toque fora
  });
  // Voltar do Android / Esc: com o teclado aberto, só baixa o teclado
  d.addEventListener('cancel', e => {
    e.preventDefault();
    if (campoDeTexto(document.activeElement) && d.contains(document.activeElement)) { document.activeElement.blur(); return; }
    if (fechar && !tecladoMexeu()) fecharJanela(null);
  });
  d.showModal();
  return { el: d, fechar: fecharJanela, aoFechar };
}

/** Pergunta sim/não. @returns {Promise<boolean>} */
export function confirmar(texto, { sim = 'Sim', nao = 'Cancelar', perigo = false, titulo = '' } = {}) {
  const j = janela({ titulo, classe: 'janelaPequena', html: `
    <p class="textoConfirmar">${esc(texto)}</p>
    <div class="linhaBotoes">
      <button type="button" class="btn btnClaro" data-r="0">${esc(nao)}</button>
      <button type="button" class="btn ${perigo ? 'btnPerigo' : 'btnEscuro'}" data-r="1">${esc(sim)}</button>
    </div>` });
  j.el.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) j.fechar(b.dataset.r === '1'); });
  return j.aoFechar.then(v => !!v);
}

/**
 * Folha de ajuda (sobe de baixo): dicas curtas com ícone.
 * @param {string} titulo
 * @param {Array<[string, string, string]>} dicas - [ícone, título, texto]
 */
export function ajuda(titulo, dicas) {
  janela({ titulo: `${icone('ajuda')} ${titulo}`, classe: 'janelaAjuda', html: `
    <ul class="listaDicas">${dicas.map(([ic, t, d]) => `
      <li><span class="dicaIcone">${icone(ic, 28)}</span><div><strong>${t}</strong><p>${d}</p></div></li>`).join('')}
    </ul>
    <button type="button" class="btn btnEscuro btnLargo" data-fechar>Entendi</button>` });
}

/** Teclado de senha numérica. @returns {Promise<string|null>} */
export function pedirSenha(titulo = 'Acesso da equipe', ajuda = 'Digite a senha para continuar.') {
  const j = janela({ titulo: `${icone('cadeado')} ${titulo}`, classe: 'janelaSenha', html: `
    <p class="textoAjuda">${ajuda}</p>
    <div class="pontosSenha" aria-live="polite"></div>
    <div class="tecladoSenha">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-n="${n}">${n}</button>`).join('')}
      <button type="button" data-n="x" aria-label="Apagar">${icone('voltar')}</button><button type="button" data-n="0">0</button>
      <button type="button" data-n="ok" class="ok" aria-label="Confirmar">${icone('check')}</button></div>
    <form class="senhaLetras" hidden><input type="password" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" placeholder="Senha" aria-label="Senha">
      <button type="submit" class="btn btnEscuro">${icone('check', 20)} Entrar</button></form>
    <button type="button" class="btnTexto senhaAbc">Senha com letras? Toque aqui</button>` });
  let valor = '';
  const pintar = () => {
    $('.pontosSenha', j.el).innerHTML = Array.from({ length: Math.max(6, Math.min(valor.length, 16)) }, (_, i) => `<i class="${i < valor.length ? 'cheio' : ''}"></i>`).join('');
  };
  pintar();
  const fechar = v => { document.removeEventListener('keydown', teclas, true); j.fechar(v); };
  j.aoFechar.then(() => document.removeEventListener('keydown', teclas, true));
  j.el.addEventListener('click', e => {
    if (e.target.closest('.senhaAbc')) {
      const f = $('.senhaLetras', j.el); f.hidden = false;
      $('.tecladoSenha', j.el).hidden = $('.pontosSenha', j.el).hidden = e.target.closest('.senhaAbc').hidden = true;
      $('input', f).focus();
      return;
    }
    const b = e.target.closest('[data-n]');
    if (!b) return;
    const n = b.dataset.n;
    if (n === 'x') valor = valor.slice(0, -1);
    else if (n === 'ok') return fechar(valor);
    else if (valor.length < 32) valor += n;
    pintar();
  });
  $('.senhaLetras', j.el).onsubmit = e => { e.preventDefault(); fechar($('.senhaLetras input', j.el).value.trim()); };
  // No computador: dá para digitar a senha direto no teclado
  function teclas(e) {
    if (!$('.senhaLetras', j.el).hidden || !j.el.isConnected) return;
    if (e.key === 'Enter') { e.preventDefault(); fechar(valor); }
    else if (e.key === 'Backspace') { e.preventDefault(); valor = valor.slice(0, -1); pintar(); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && valor.length < 32) { e.preventDefault(); valor += e.key; pintar(); }
  }
  document.addEventListener('keydown', teclas, true);
  return j.aoFechar;
}

/**
 * Dica animada sobre a tela (ex.: "arraste com um dedo").
 * @param {Array<{icone: string, titulo: string, texto: string, anim?: string}>} passos
 */
export function coach(passos) {
  return new Promise(ok => {
    const el = document.createElement('div');
    el.className = 'coach';
    let i = 0;
    const mostrar = () => {
      const p = passos[i];
      el.innerHTML = `
        <div class="coachCaixa" role="dialog" aria-modal="true" aria-label="${esc(p.titulo)}">
          <div class="coachAnim ${p.anim || ''}">${icone(p.icone, 56)}</div>
          <h3>${p.titulo}</h3><p>${p.texto}</p>
          <div class="coachPontos">${passos.map((_, k) => `<i class="${k === i ? 'ativo' : ''}"></i>`).join('')}</div>
          <button type="button" class="btn btnEscuro btnLargo" data-prox>${i < passos.length - 1 ? 'Próxima dica' : 'Entendi, vamos lá!'}</button>
          ${passos.length > 1 && i < passos.length - 1 ? '<button type="button" class="btnTexto" data-pular>Pular dicas</button>' : ''}
        </div>`;
    };
    el.addEventListener('click', e => {
      if (e.target.closest('[data-prox]')) { if (++i < passos.length) return mostrar(); }
      else if (!e.target.closest('[data-pular]')) return;
      el.classList.add('saindo');
      setTimeout(() => { el.remove(); ok(); }, 200);
    });
    mostrar();
    document.body.appendChild(el);
  });
}

/** Barra de progresso numa janela (importação, exportação). */
export function progressoJanela(titulo) {
  const j = janela({ titulo, fechar: false, classe: 'janelaPequena', html: `
    <p class="textoAjuda" data-txt>Preparando…</p>
    <div class="barra"><i data-barra></i></div>
    <div class="linhaBotoes"><button type="button" class="btn btnClaro" data-cancelar>Interromper</button></div>` });
  const sinal = { cancelado: false };
  $('[data-cancelar]', j.el).onclick = () => { sinal.cancelado = true; $('[data-txt]', j.el).textContent = 'Interrompendo…'; };
  return {
    sinal,
    atualizar(fracao, texto) {
      $('[data-barra]', j.el).style.width = Math.round(fracao * 100) + '%';
      if (texto != null) $('[data-txt]', j.el).textContent = texto;
    },
    fechar: () => j.fechar()
  };
}

// ---------- Teclado da tela (tablet) ----------
/**
 * Com o app em tela cheia o Android esconde a barra de navegação, e não há como
 * baixar o teclado. Mostra um botão "Fechar teclado" logo acima do teclado e faz
 * o Enter dos campos de uma linha passar para o próximo campo (ou fechar o teclado).
 */
/** Campo que abre o teclado virtual. */
const campoDeTexto = el => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|range|file|button|submit|color)$/i.test(el.type)));

/** O teclado virtual abriu/fechou há pouco? (a tela muda de tamanho) */
let ultimoTeclado = 0;
const tecladoMexeu = () => Date.now() - ultimoTeclado < 700;
window.visualViewport?.addEventListener('resize', () => { ultimoTeclado = Date.now(); });

export function ajudarTeclado() {
  const ehCampo = campoDeTexto;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btnTeclado';
  btn.innerHTML = `${icone('check', 20)}<span>Pronto</span>`;
  btn.hidden = true;
  const popover = 'popover' in HTMLElement.prototype; // camada de cima: fica sobre as janelas abertas
  if (popover) btn.popover = 'manual';
  document.body.appendChild(btn);
  // Com uma janela aberta, o botão precisa ficar DENTRO dela: fora, o navegador
  // trata o toque como "fora da janela" (e a janela fechava em vez de só baixar o teclado)
  const lugar = () => [...document.querySelectorAll('dialog[open]')].filter(x => x.isConnected && !x.classList.contains('saindo')).pop() || document.body;
  const mostrar = sim => {
    const alvo = sim ? lugar() : btn.parentElement;
    if (sim && alvo !== btn.parentElement) {
      try { if (popover && btn.matches(':popover-open')) btn.hidePopover(); } catch { /* ok */ }
      btn.hidden = true;
      alvo.appendChild(btn);
    }
    if (sim === !btn.hidden && (!popover || sim === btn.matches(':popover-open'))) return;
    btn.hidden = !sim;
    if (!popover) return;
    try { if (btn.matches(':popover-open')) btn.hidePopover(); if (sim) btn.showPopover(); } catch { /* ok */ }
  };
  const vv = window.visualViewport;
  const toque = matchMedia('(pointer: coarse)');
  /** Teclado aberto? (a área visível encolhe bem em relação à tela) */
  const tecladoAberto = () => {
    const deitado = matchMedia('(orientation: landscape)').matches;
    const altTela = deitado ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
    return (vv ? vv.height : window.innerHeight) < altTela * 0.72;
  };
  let campoAtivo = false;
  const atualizar = () => mostrar(campoAtivo && toque.matches && tecladoAberto());
  const posicionar = () => {
    atualizar();
    if (btn.hidden) return;
    const base = vv ? vv.offsetTop + vv.height : window.innerHeight;
    btn.style.top = `${Math.max(8, base - btn.offsetHeight - 10)}px`;
    btn.style.left = `${(vv ? vv.offsetLeft + vv.width : window.innerWidth) - btn.offsetWidth - 12}px`;
  };
  let tEsconder = null;
  document.addEventListener('focusin', e => {
    if (!ehCampo(e.target)) return;
    clearTimeout(tEsconder);
    campoAtivo = true;
    // Mostra de novo para ficar por cima de uma janela que acabou de abrir
    if (popover && btn.matches(':popover-open')) { btn.hidePopover(); btn.hidden = true; }
    posicionar();
    setTimeout(posicionar, 350); // depois que o teclado termina de abrir
  });
  document.addEventListener('focusout', () => { tEsconder = setTimeout(() => { if (!ehCampo(document.activeElement)) { campoAtivo = false; mostrar(false); } }, 120); });
  vv?.addEventListener('resize', posicionar);
  vv?.addEventListener('scroll', posicionar);
  // Botão Pronto: só baixa o teclado (nunca fecha a janela que está aberta)
  btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); ultimoTeclado = Date.now(); });
  btn.addEventListener('click', e => { e.stopPropagation(); ultimoTeclado = Date.now(); document.activeElement?.blur(); campoAtivo = false; mostrar(false); });
  // Enter: próximo campo ou fecha o teclado (textarea continua quebrando linha)
  document.addEventListener('keydown', e => {
    const el = e.target;
    if (e.key !== 'Enter' || e.defaultPrevented || el.tagName !== 'INPUT' || !ehCampo(el) || el.form) return;
    setTimeout(() => {
      if (document.activeElement !== el) return; // outro código já tratou (ex.: fechou a janela)
      const raiz = el.closest('dialog, section, main') || document;
      const campos = $$('input, textarea', raiz).filter(c => ehCampo(c) && !c.disabled && c.offsetParent !== null);
      const prox = campos[campos.indexOf(el) + 1];
      if (el.enterKeyHint === 'next' && prox) prox.focus(); else el.blur();
    }, 0);
  });
}
