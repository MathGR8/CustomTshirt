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
    setTimeout(() => { d.close(); d.remove(); resolver(valor); }, 160);
  };
  d.addEventListener('click', e => {
    if (e.target.closest('[data-fechar]')) fecharJanela(null);
    else if (e.target === d && fechar) fecharJanela(null); // toque fora
  });
  d.addEventListener('cancel', e => { e.preventDefault(); if (fechar) fecharJanela(null); });
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
export function pedirSenha(titulo = 'Área do administrador') {
  const j = janela({ titulo: `${icone('cadeado')} ${titulo}`, classe: 'janelaSenha', html: `
    <p class="textoAjuda">Digite a senha para continuar.</p>
    <div class="pontosSenha" aria-live="polite"><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="tecladoSenha">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-n="${n}">${n}</button>`).join('')}
      <button type="button" data-n="x" aria-label="Apagar">${icone('voltar')}</button><button type="button" data-n="0">0</button>
      <button type="button" data-n="ok" class="ok" aria-label="Confirmar">${icone('check')}</button></div>` });
  let valor = '';
  const pontos = $$('.pontosSenha i', j.el);
  const pintar = () => pontos.forEach((p, i) => p.classList.toggle('cheio', i < valor.length));
  j.el.addEventListener('click', e => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    const n = b.dataset.n;
    if (n === 'x') valor = valor.slice(0, -1);
    else if (n === 'ok') return j.fechar(valor);
    else if (valor.length < 6) valor += n;
    pintar();
  });
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
