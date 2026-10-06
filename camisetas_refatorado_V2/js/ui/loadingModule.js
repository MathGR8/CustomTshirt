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

const TEMPO_MINIMO_MS = 1400; // para a animação não "piscar" quando o PDF é rápido

/** Kombi de lado (frente para a direita), duas cores, rodas giratórias. */
const KOMBI_SVG = `
<svg class="klKombi" viewBox="0 0 230 130" aria-hidden="true">
  <!-- sombra -->
  <ellipse class="klShadow" cx="112" cy="122" rx="92" ry="5"/>
  <g class="klBody">
    <!-- carroceria: parte de baixo vermelha, de cima branca -->
    <path d="M30 20 H178 C204 20 214 40 214 62 V96 Q214 104 206 104 H22 Q14 104 14 96 V40 C14 28 20 20 30 20 Z" fill="#ED3051"/>
    <path d="M30 20 H178 C204 20 214 40 214 60 H14 V40 C14 28 20 20 30 20 Z" fill="#fff"/>
    <!-- friso -->
    <rect x="14" y="58" width="200" height="5" fill="#f4c6d0"/>
    <!-- janelas laterais -->
    <rect x="26"  y="28" width="30" height="22" rx="5" fill="#8fd0ec"/>
    <rect x="62"  y="28" width="30" height="22" rx="5" fill="#8fd0ec"/>
    <rect x="98"  y="28" width="30" height="22" rx="5" fill="#8fd0ec"/>
    <rect x="134" y="28" width="30" height="22" rx="5" fill="#8fd0ec"/>
    <!-- para-brisa -->
    <path d="M172 28 H184 C198 28 205 38 206 50 H172 Z" fill="#8fd0ec"/>
    <!-- brilho nos vidros -->
    <path d="M30 46 L44 30" stroke="#fff" stroke-width="3" opacity=".55"/>
    <path d="M176 46 L188 30" stroke="#fff" stroke-width="3" opacity=".55"/>
    <!-- porta e maçaneta -->
    <path d="M134 63 V100 M168 63 V100" stroke="#c4223f" stroke-width="2"/>
    <rect x="156" y="70" width="8" height="3" rx="1.5" fill="#fff"/>
    <!-- farol, pisca e para-choques -->
    <circle cx="208" cy="74" r="5" fill="#ffd54a"/>
    <circle cx="208" cy="74" r="2.2" fill="#fff8d1"/>
    <rect x="200" y="94" width="20" height="7" rx="3.5" fill="#d9d9d9"/>
    <rect x="8"   y="94" width="18" height="7" rx="3.5" fill="#d9d9d9"/>
    <!-- caixas de roda -->
    <path d="M36 104 a20 20 0 0 1 40 0 Z" fill="#7a1024"/>
    <path d="M150 104 a20 20 0 0 1 40 0 Z" fill="#7a1024"/>
  </g>
  <!-- rodas -->
  <g class="klWheel" style="transform-origin:56px 106px">
    <circle cx="56" cy="106" r="15" fill="#1d1d1d"/>
    <circle cx="56" cy="106" r="7" fill="#e6e6e6"/>
    <path d="M56 99 V113 M49 106 H63" stroke="#888" stroke-width="2"/>
  </g>
  <g class="klWheel" style="transform-origin:170px 106px">
    <circle cx="170" cy="106" r="15" fill="#1d1d1d"/>
    <circle cx="170" cy="106" r="7" fill="#e6e6e6"/>
    <path d="M170 99 V113 M163 106 H177" stroke="#888" stroke-width="2"/>
  </g>
</svg>`;

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
