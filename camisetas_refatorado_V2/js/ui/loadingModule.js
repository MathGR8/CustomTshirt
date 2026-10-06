/**
 * @module loadingModule
 * @description Tela de carregamento "Gerando seu PDF": uma Kombi acelerando
 * no centro da tela, com o resto da página escurecido.
 *
 * Uso:
 *   LoadingModule.show('Gerando seu PDF');
 *   ...trabalho...
 *   await LoadingModule.hide();   // espera um tempo mínimo para a animação aparecer
 *
 * A animação usa só transform/opacity (roda lisa mesmo com o PDF sendo montado)
 * e é desligada para quem pede "menos movimento" no sistema.
 */

import { KOMBI_SVG } from './kombiSvg.js';

const TEMPO_MINIMO_MS = 1400; // para a animação não "piscar" quando o PDF é rápido

const HTML = `
  <div class="klBox">
    <div class="klScene">
      <span class="klLine" style="--y:18%; --d:.55s; --w:70px"></span>
      <span class="klLine" style="--y:38%; --d:.42s; --w:110px; --delay:.15s"></span>
      <span class="klLine" style="--y:56%; --d:.5s;  --w:60px;  --delay:.3s"></span>
      <span class="klLine" style="--y:28%; --d:.6s;  --w:90px;  --delay:.4s"></span>
      <span class="klPuff" style="--delay:0s"></span>
      <span class="klPuff" style="--delay:.25s"></span>
      <span class="klPuff" style="--delay:.5s"></span>
      ${KOMBI_SVG}
      <div class="klRoad"></div>
    </div>
    <p class="klTitle" id="klTitle">Gerando seu PDF<span class="klDots"><i>.</i><i>.</i><i>.</i></span></p>
    <p class="klSub" id="klSub">Estamos montando suas camisetas 🎨</p>
  </div>`;

let el = null;
let inicio = 0;

export const LoadingModule = {
  /**
   * Mostra a tela de carregamento.
   * @param {string} [titulo='Gerando seu PDF']
   * @param {string} [sub]
   */
  show(titulo = 'Gerando seu PDF', sub = 'Estamos montando suas camisetas 🎨') {
    if (!el) {
      el = document.createElement('div');
      el.className = 'kombiLoader';
      el.setAttribute('role', 'alert');
      el.setAttribute('aria-live', 'assertive');
      el.innerHTML = HTML;
      document.body.appendChild(el);
    }
    el.querySelector('#klTitle').firstChild.textContent = titulo;
    el.querySelector('#klSub').textContent = sub;
    inicio = Date.now();
    el.classList.remove('saindo');
    el.classList.add('aberto');
    document.body.classList.add('semRolagem');
  },

  /** Esconde a tela (aguardando o tempo mínimo da animação). */
  async hide() {
    if (!el || !el.classList.contains('aberto')) return;
    const falta = TEMPO_MINIMO_MS - (Date.now() - inicio);
    if (falta > 0) await new Promise(r => setTimeout(r, falta));
    el.classList.add('saindo');                       // a Kombi "sai" acelerando
    await new Promise(r => setTimeout(r, 380));
    el.classList.remove('aberto', 'saindo');
    document.body.classList.remove('semRolagem');
  }
};
