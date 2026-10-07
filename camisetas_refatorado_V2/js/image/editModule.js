/**
 * @module editModule
 * @description Editor de imagem da estampa (janela "Editar").
 *
 * Ferramentas:
 *  - Girar 90° (esq./dir.), girar em ângulo livre e espelhar (horizontal/vertical)
 *  - Fundo: "Remover fundo" apaga a cor das bordas (ex.: o fundo branco de
 *    um PDF) e a "Varinha" apaga a cor clicada; ambos com tolerância e a opção
 *    de apagar só a parte ligada (sem furar o branco de dentro da arte)
 *  - Área selecionada (arrastando sobre a imagem; a seleção pode ser movida e
 *    redimensionada pelas bordas e cantos): recortar, apagar a área, apagar
 *    tudo fora dela; e aparar bordas transparentes
 *  - Cor: preto e branco, inverter, pintar com uma cor única,
 *         brilho / contraste / saturação
 *  - Com uma área selecionada, fundo, varinha e cores valem só dentro dela
 *  - Desfazer, restaurar o original, cancelar e salvar
 *
 * Como funciona: a imagem é desenhada num <canvas>; cada ferramenta cria um
 * novo canvas e o anterior vai para a pilha de "desfazer". Ao salvar, a imagem
 * vira PNG e substitui a da estampa (preview, miniatura e PDF).
 *
 * Escala: girar amplia o canvas (para caber a diagonal) e recortar o reduz.
 * Ao salvar, a largura em cm da estampa é recalculada na mesma proporção
 * (px por cm constante), então a arte mantém o tamanho real na camiseta e
 * não "encolhe" a cada giro. O centro da estampa também é preservado.
 *
 * Dependências: logger.js, noticeModule.js, helpers.js. A estampa é achada
 * pelo id em AppState; StampModule vem de window._modules (evita circular).
 */

import { AppState } from '../core/appState.js';
import { Logger } from '../core/logger.js';
import { NoticeModule } from '../ui/noticeModule.js';
import { Utils } from '../utils/helpers.js';
import { PreviewGeom } from '../preview/previewGeometry.js';

const MAX_UNDO = 10;     // quantos passos de "desfazer" guardar
const MAX_SIDE = 4096;   // lado máximo (px) da imagem em edição

/** Estado do editor aberto (null = fechado). */
let ed = null;

// ---------- Funções de canvas ----------

/** Cria um canvas vazio com o tamanho dado (mínimo 1px). */
function novoCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Copia um canvas. */
function clonar(src) {
  const c = novoCanvas(src.width, src.height);
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

/** Limita um número entre a e b. */
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

/** Converte uma seleção (px fracionários) num retângulo inteiro dentro do canvas. */
function retInteiro(r, W, H) {
  if (!r) return { x: 0, y: 0, w: W, h: H };
  const x = lim(Math.floor(r.x), 0, W - 1), y = lim(Math.floor(r.y), 0, H - 1);
  return { x, y, w: lim(Math.ceil(r.x + r.w) - x, 1, W - x), h: lim(Math.ceil(r.y + r.h) - y, 1, H - y) };
}

/**
 * Aplica uma função a cada pixel visível (alpha > 0), devolvendo um novo canvas.
 * Com `area`, só os pixels dentro dela mudam.
 */
function porPixel(src, fn, area) {
  const c = clonar(src), x = c.getContext('2d');
  const a = retInteiro(area, c.width, c.height);
  const d = x.getImageData(a.x, a.y, a.w, a.h), p = d.data;
  for (let i = 0; i < p.length; i += 4) if (p[i + 3] !== 0) fn(p, i);
  x.putImageData(d, a.x, a.y);
  return c;
}

/** Distância entre a cor do pixel i e a cor c = [r, g, b] (0 a ~441). */
function distCor(p, i, c) {
  const r = p[i] - c[0], g = p[i + 1] - c[1], b = p[i + 2] - c[2];
  return Math.sqrt(r * r + g * g + b * b);
}

/**
 * "Cor para transparência" num pixel de borda: descobre quanto dele é a cor
 * do fundo misturada (antialiasing) e tira essa parte, deixando a borda lisa
 * e sem o "halo" claro em camisetas escuras.
 */
function tirarCorDaBorda(p, i, bg) {
  let al = 0;
  for (let k = 0; k < 3; k++) {
    const v = p[i + k], b = bg[k];
    const r = v > b ? (v - b) / (255 - b || 1) : v < b ? (b - v) / (b || 1) : 0;
    if (r > al) al = r;
  }
  if (al >= 0.98) return;
  if (al <= 0.02) { p[i + 3] = 0; return; }
  for (let k = 0; k < 3; k++) p[i + k] = lim(Math.round((p[i + k] - bg[k]) / al + bg[k]), 0, 255);
  p[i + 3] = Math.round(p[i + 3] * al);
}

/**
 * Deixa transparentes os pixels parecidos com a cor `cor` (distância ≤ tol).
 * @param {number[]} sementes - índices (na área) de onde a "mancha" começa
 *                              quando `ligados` é true (preenchimento por vizinhos)
 * @param {boolean} ligados   - true: só a região ligada às sementes;
 *                              false: todos os pixels dessa cor na área
 * @param {boolean} [passaTransparente] - a mancha atravessa pixels já
 *                              transparentes (fundo com margem transparente)
 * @returns {{canvas: HTMLCanvasElement, n: number}} n = pixels apagados
 */
function apagarParecidos(src, cor, sementes, tol, ligados, area, passaTransparente = false) {
  const c = clonar(src), x = c.getContext('2d');
  const a = retInteiro(area, c.width, c.height), w = a.w, h = a.h;
  const d = x.getImageData(a.x, a.y, w, h), p = d.data;
  const parece = k => p[k * 4 + 3] < 16 ? passaTransparente : distCor(p, k * 4, cor) <= tol;
  const tirar = new Uint8Array(w * h);

  if (ligados) {
    const pilha = new Int32Array(w * h);
    let topo = 0;
    for (const k of sementes) if (!tirar[k] && parece(k)) { tirar[k] = 1; pilha[topo++] = k; }
    while (topo) {
      const k = pilha[--topo], px = k % w;
      const viz = [px > 0 ? k - 1 : -1, px < w - 1 ? k + 1 : -1, k - w, k + w];
      for (const v of viz) if (v >= 0 && v < w * h && !tirar[v] && parece(v)) { tirar[v] = 1; pilha[topo++] = v; }
    }
  } else {
    for (let k = 0; k < w * h; k++) if (parece(k)) tirar[k] = 1;
  }

  // Apagados agora (o que já era transparente não conta)
  const apagou = new Uint8Array(w * h);
  let n = 0;
  for (let k = 0; k < w * h; k++) if (tirar[k] && p[k * 4 + 3]) { p[k * 4 + 3] = 0; apagou[k] = 1; n++; }

  // Suaviza 2 px de contorno em volta do que foi apagado
  const feito = tirar;
  let frente = apagou;
  for (let volta = 0; volta < 2 && n; volta++) {
    const prox = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x0 = 0; x0 < w; x0++) {
      const k = y * w + x0;
      if (feito[k] || !p[k * 4 + 3]) continue;
      let perto = false;
      for (let dy = -1; dy <= 1 && !perto; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x0 + dx;
        if (yy >= 0 && yy < h && xx >= 0 && xx < w && frente[yy * w + xx]) { perto = true; break; }
      }
      if (perto) { prox[k] = 1; tirarCorDaBorda(p, k * 4, cor); }
    }
    for (let k = 0; k < w * h; k++) if (prox[k]) feito[k] = 1;
    frente = prox;
  }

  x.putImageData(d, a.x, a.y);
  return { canvas: c, n };
}

/** Operações de edição: cada uma recebe um canvas e devolve outro. */
const Ops = {
  // Gira por qualquer ângulo, ampliando o canvas para nada ser cortado
  girar(src, graus) {
    const r = graus * Math.PI / 180, cs = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r));
    const c = novoCanvas(src.width * cs + src.height * sn, src.width * sn + src.height * cs);
    const x = c.getContext('2d');
    x.translate(c.width / 2, c.height / 2);
    x.rotate(r);
    x.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  },
  // Espelha na horizontal (h = true) ou na vertical
  espelhar(src, h) {
    const c = novoCanvas(src.width, src.height), x = c.getContext('2d');
    x.translate(h ? c.width : 0, h ? 0 : c.height);
    x.scale(h ? -1 : 1, h ? 1 : -1);
    x.drawImage(src, 0, 0);
    return c;
  },
  // Recorta o retângulo r = {x, y, w, h}
  recortar(src, r) {
    const c = novoCanvas(r.w, r.h);
    c.getContext('2d').drawImage(src, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    return c;
  },
  // Remove as bordas totalmente transparentes
  aparar(src) {
    const w = src.width, h = src.height;
    const d = src.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return x1 < 0 ? src : Ops.recortar(src, { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  },
  // Deixa transparente a área r
  apagarArea(src, r) {
    const c = clonar(src), a = retInteiro(r, c.width, c.height);
    c.getContext('2d').clearRect(a.x, a.y, a.w, a.h);
    return c;
  },
  // Mantém só a área r (o resto fica transparente; o tamanho não muda)
  apagarFora(src, r) {
    const c = novoCanvas(src.width, src.height), a = retInteiro(r, c.width, c.height);
    c.getContext('2d').drawImage(src, a.x, a.y, a.w, a.h, a.x, a.y, a.w, a.h);
    return c;
  },
  /**
   * Remove o fundo: a cor mais comum nas bordas (da imagem ou da área).
   * @returns {{canvas, n}|null} null quando as bordas já são transparentes
   */
  removerFundo(src, tol, ligados, area) {
    const a = retInteiro(area, src.width, src.height), w = a.w, h = a.h;
    const p = src.getContext('2d').getImageData(a.x, a.y, w, h).data;
    const borda = [];
    for (let x = 0; x < w; x++) borda.push(x, (h - 1) * w + x);
    for (let y = 1; y < h - 1; y++) borda.push(y * w, y * w + w - 1);
    // Cor do fundo: a mais frequente entre os pixels opacos da borda
    const grupos = new Map();
    let opacos = 0;
    for (const k of borda) {
      const i = k * 4;
      if (p[i + 3] < 200) continue;
      opacos++;
      const chave = (p[i] >> 4) << 8 | (p[i + 1] >> 4) << 4 | (p[i + 2] >> 4);
      const g = grupos.get(chave) || { n: 0, r: 0, g: 0, b: 0 };
      g.n++; g.r += p[i]; g.g += p[i + 1]; g.b += p[i + 2];
      grupos.set(chave, g);
    }
    if (opacos < borda.length / 2) return null;
    const m = [...grupos.values()].reduce((x, y) => (y.n > x.n ? y : x));
    const cor = [m.r / m.n, m.g / m.n, m.b / m.n];
    return apagarParecidos(src, cor, borda, tol, ligados, area, true);
  },
  /** Varinha: apaga a cor do ponto (px, py). null se o ponto já é transparente. */
  varinha(src, px, py, tol, ligados, area) {
    const a = retInteiro(area, src.width, src.height);
    const x = Math.floor(px), y = Math.floor(py);
    if (x < a.x || y < a.y || x >= a.x + a.w || y >= a.y + a.h) return null;
    const i = src.getContext('2d').getImageData(x, y, 1, 1).data;
    if (i[3] < 16) return null;
    return apagarParecidos(src, [i[0], i[1], i[2]], [(y - a.y) * a.w + (x - a.x)], tol, ligados, area);
  },
  pretoBranco: (src, area) => porPixel(src, (p, i) => {
    p[i] = p[i + 1] = p[i + 2] = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
  }, area),
  inverter: (src, area) => porPixel(src, (p, i) => {
    p[i] = 255 - p[i]; p[i + 1] = 255 - p[i + 1]; p[i + 2] = 255 - p[i + 2];
  }, area),
  // Pinta todos os pixels visíveis com uma cor, mantendo a transparência
  pintar(src, hex, area) {
    const { r, g, b } = Utils.hexToRgb(hex);
    return porPixel(src, (p, i) => { p[i] = r; p[i + 1] = g; p[i + 2] = b; }, area);
  },
  // Brilho, contraste e saturação (1 = sem alteração), mesma ordem do filtro CSS da prévia
  ajustar(src, br, ct, sat, area) {
    return porPixel(src, (p, i) => {
      const v = [0, 1, 2].map(k => lim(((p[i + k] * br) - 128) * ct + 128, 0, 255));
      const g = 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2];
      for (let k = 0; k < 3; k++) p[i + k] = lim(g + (v[k] - g) * sat, 0, 255);
    }, area);
  }
};

// ---------- Interface ----------

const HTML = `
<div class="editHead"><div><strong>Editar estampa</strong><span id="editInfo"></span></div>
  <button type="button" data-op="cancel" class="editClose" aria-label="Fechar sem salvar" title="Fechar sem salvar">✕</button></div>
<div class="editBody">
  <div class="editStage"><div class="editWrap" id="editWrap"><canvas id="editCanvas"></canvas><div id="editSel"><i data-h="nw"></i><i data-h="n"></i><i data-h="ne"></i><i data-h="e"></i><i data-h="se"></i><i data-h="s"></i><i data-h="sw"></i><i data-h="w"></i></div></div></div>
  <div class="editTools">
    <fieldset><legend>Fundo</legend>
      <div class="editRow"><button type="button" data-op="fundo" class="editMain">✨ Remover fundo</button>
        <button type="button" data-op="varinha" id="editVarinha" aria-pressed="false" title="Ligue e clique numa cor da imagem para apagá-la (W)">🪄 Varinha</button></div>
      <p class="editHint" id="editVarinhaDica" hidden>Varinha ligada: clique na cor que quer apagar. Clique de novo no botão para desligar.</p>
      <label class="editSlide">Tolerância <input type="range" id="editTol" min="0" max="100" step="1" value="25"><output id="editTolV">25</output></label>
      <label class="editCheck"><input type="checkbox" id="editLigados" checked> Só a parte ligada (não apaga o branco de dentro da arte)</label>
      <label class="editCheck"><input type="checkbox" id="editAparar" checked> Aparar as sobras depois de remover o fundo</label>
      <p class="editHint">"Remover fundo" apaga a cor das bordas (ex.: o branco de um PDF). Sobrou algo? Aumente a tolerância ou use a varinha.</p>
    </fieldset>
    <fieldset><legend>Girar e espelhar</legend>
      <div class="editRow">
        <button type="button" data-op="g-90">⟲ 90°</button><button type="button" data-op="g90">⟳ 90°</button>
        <button type="button" data-op="eh">⇋ Horizontal</button><button type="button" data-op="ev">⇅ Vertical</button>
      </div>
      <div class="editRow"><label>Ângulo <input type="number" id="editAngulo" value="15" min="-360" max="360"> °</label>
        <button type="button" data-op="gl">Girar</button></div>
    </fieldset>
    <fieldset><legend>Área selecionada</legend>
      <p class="editHint">Arraste sobre a imagem para selecionar uma área. Arraste as bordas ou cantos para ajustar, ou o meio para mover. Fundo, varinha e cores passam a valer só dentro dela.</p>
      <div class="editRow"><button type="button" data-op="rec">✂ Recortar</button>
        <button type="button" data-op="apag" title="Delete">Apagar área</button>
        <button type="button" data-op="fora">Apagar fora</button></div>
      <div class="editRow"><button type="button" data-op="apar">Aparar transparência</button>
        <button type="button" data-op="dessel">Tirar seleção</button></div>
    </fieldset>
    <fieldset><legend>Cor</legend>
      <div class="editRow"><button type="button" data-op="pb">Preto e branco</button>
        <button type="button" data-op="inv">Inverter</button></div>
      <div class="editRow"><label>Cor única <input type="color" id="editCor" value="#ffffff"></label>
        <button type="button" data-op="pin">Pintar</button></div>
      <label class="editSlide">Brilho <input type="range" id="editBr" min="0.2" max="2" step="0.05" value="1"></label>
      <label class="editSlide">Contraste <input type="range" id="editCt" min="0.2" max="2" step="0.05" value="1"></label>
      <label class="editSlide">Saturação <input type="range" id="editSa" min="0" max="2" step="0.05" value="1"></label>
      <div class="editRow"><button type="button" data-op="aj">Aplicar ajustes</button></div>
    </fieldset>
  </div>
</div>
<div class="editFoot">
  <button type="button" data-op="undo" class="btn-outline">↶ Desfazer</button>
  <button type="button" data-op="orig" class="btn-outline">Restaurar original</button>
  <span style="flex:1"></span>
  <button type="button" data-op="save" class="btn-dark">Salvar</button>
</div>`;

/** Atalho para achar elementos da janela. */
const $ = id => document.getElementById(id);

/** Cria a janela (uma única vez) e liga os eventos. */
function montar() {
  if (ed && ed.dlg) return ed.dlg;
  const dlg = document.createElement('dialog');
  dlg.className = 'editDlg';
  dlg.innerHTML = HTML;
  document.body.appendChild(dlg);

  dlg.addEventListener('click', e => {
    const op = e.target.closest('[data-op]')?.dataset.op;
    if (op) EditModule._acao(op);
  });
  dlg.addEventListener('cancel', () => { ed.stamp = null; });

  // Prévia ao vivo dos ajustes (filtro CSS; o cálculo real só ocorre em "Aplicar")
  const prev = () => {
    $('editCanvas').style.filter =
      `brightness(${$('editBr').value}) contrast(${$('editCt').value}) saturate(${$('editSa').value})`;
  };
  ['editBr', 'editCt', 'editSa'].forEach(id => $(id).addEventListener('input', prev));

  $('editTol').addEventListener('input', () => { $('editTolV').value = $('editTol').value; });

  // Seleção da área (mouse ou toque):
  //  - arrastar fora da seleção cria uma nova
  //  - arrastar uma borda/canto redimensiona; arrastar o meio move
  //  - com a varinha ligada, o clique apaga a cor do ponto
  const wrap = $('editWrap'), cv = $('editCanvas');
  const pt = e => {
    const r = cv.getBoundingClientRect();
    return { x: lim((e.clientX - r.left) * cv.width / r.width, 0, cv.width),
             y: lim((e.clientY - r.top) * cv.height / r.height, 0, cv.height) };
  };
  wrap.addEventListener('pointerdown', e => {
    const p = pt(e);
    if (ed.varinha) { e.preventDefault(); return usarVarinha(p); }
    const modo = ed.crop ? alvoSelecao(p) : null;
    ed.ini = { p, modo: modo || 'novo', crop: ed.crop ? { ...ed.crop } : null };
    if (!modo) ed.crop = null;
    wrap.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  wrap.addEventListener('pointermove', e => {
    const p = pt(e);
    if (ed.varinha) { wrap.style.cursor = 'cell'; return; }
    if (!ed.ini) { wrap.style.cursor = CURSORES[ed.crop ? alvoSelecao(p) : ''] || 'crosshair'; return; }
    const { p: p0, modo, crop: c0 } = ed.ini;
    if (modo === 'novo') {
      ed.crop = { x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y),
                  w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y) };
    } else if (modo === 'mover') {
      ed.crop = { ...c0,
        x: lim(c0.x + p.x - p0.x, 0, cv.width  - c0.w),
        y: lim(c0.y + p.y - p0.y, 0, cv.height - c0.h) };
    } else {
      // Redimensiona só as bordas indicadas pelo modo (n, s, e, w e cantos)
      const min = 4;
      let l = c0.x, t = c0.y, r = c0.x + c0.w, b = c0.y + c0.h;
      if (modo.includes('w')) l = Math.min(p.x, r - min);
      if (modo.includes('e')) r = Math.max(p.x, l + min);
      if (modo.includes('n')) t = Math.min(p.y, b - min);
      if (modo.includes('s')) b = Math.max(p.y, t + min);
      ed.crop = { x: l, y: t, w: r - l, h: b - t };
    }
    mostrarSelecao();
  });
  const soltar = () => {
    ed.ini = null;
    if (ed.crop && (ed.crop.w < 4 || ed.crop.h < 4)) { ed.crop = null; mostrarSelecao(); }
  };
  wrap.addEventListener('pointerup', soltar);
  wrap.addEventListener('pointercancel', soltar);
  return dlg;
}

/** Cursor do mouse para cada parte da seleção. */
const CURSORES = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
                   nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
                   mover: 'move' };

/**
 * Diz qual parte da seleção está sob o ponto p (coordenadas do canvas):
 * um canto/borda ('nw', 'n', 'e'…), 'mover' (dentro) ou null (fora).
 * A tolerância é em px de tela, maior no toque para facilitar no celular.
 */
function alvoSelecao(p) {
  const c = ed.crop, cv = $('editCanvas');
  if (!c) return null;
  const k = cv.getBoundingClientRect().width / cv.width;          // px de tela por px da imagem
  const tol = (matchMedia('(pointer: coarse)').matches ? 18 : 10) / k;
  const perto = (a, b) => Math.abs(a - b) <= tol;
  const dentroX = p.x >= c.x - tol && p.x <= c.x + c.w + tol;
  const dentroY = p.y >= c.y - tol && p.y <= c.y + c.h + tol;
  if (!dentroX || !dentroY) return null;
  let v = perto(p.y, c.y) ? 'n' : perto(p.y, c.y + c.h) ? 's' : '';
  let h = perto(p.x, c.x) ? 'w' : perto(p.x, c.x + c.w) ? 'e' : '';
  if (v || h) return v + h;
  return 'mover';
}

/** Posiciona o retângulo tracejado do recorte sobre a imagem. */
function mostrarSelecao() {
  const sel = $('editSel'), cv = $('editCanvas'), c = ed.crop;
  if (!c) { sel.style.display = 'none'; return; }
  const k = cv.getBoundingClientRect().width / cv.width;
  Object.assign(sel.style, { display: 'block', left: c.x * k + 'px', top: c.y * k + 'px',
                             width: c.w * k + 'px', height: c.h * k + 'px' });
}

/** Redesenha a imagem de trabalho na tela e zera os ajustes ao vivo. */
function desenhar() {
  const cv = $('editCanvas'), w = ed.work;
  cv.width = w.width; cv.height = w.height;
  cv.getContext('2d').drawImage(w, 0, 0);
  cv.style.filter = '';
  $('editBr').value = $('editCt').value = $('editSa').value = 1;
  $('editInfo').textContent = ` — ${w.width} × ${w.height} px`;
  mostrarSelecao();
}

/**
 * Guarda o canvas atual para "desfazer" e passa a trabalhar no novo.
 * A seleção continua quando o tamanho da imagem não muda (dá para apagar e
 * depois pintar a mesma área).
 */
function aplicar(novo, manterGiro = false) {
  const mesmoTamanho = novo.width === ed.work.width && novo.height === ed.work.height;
  ed.undo.push(ed.work);
  if (ed.undo.length > MAX_UNDO) ed.undo.shift();
  ed.work = novo;
  if (!mesmoTamanho || manterGiro) ed.crop = null;
  if (!manterGiro) ed.giro = null; // outra ferramenta: o próximo giro parte da imagem atual
  desenhar();
}

/** Tolerância da tela (0–100) em distância de cor. */
const tolerancia = () => +$('editTol').value * 2.2;

/** Liga/desliga a varinha. */
function alternarVarinha(liga = !ed.varinha) {
  ed.varinha = liga;
  $('editVarinha').setAttribute('aria-pressed', String(liga));
  $('editVarinhaDica').hidden = !liga;
  $('editWrap').style.cursor = liga ? 'cell' : 'crosshair';
}

/** Apaga a cor do ponto clicado (respeitando a seleção, se houver). */
function usarVarinha(p) {
  const r = Ops.varinha(ed.work, p.x, p.y, tolerancia(), $('editLigados').checked, ed.crop);
  if (!r) return NoticeModule.show('info', ed.crop ? 'Clique numa cor dentro da área selecionada.' : 'Esse ponto já está transparente.');
  aplicar(r.canvas);
}

/**
 * Gira somando ao ângulo dos giros consecutivos anteriores, sempre a partir da
 * imagem de antes do primeiro giro. Assim 15° + 15° = um único giro de 30°,
 * sem acumular bordas transparentes (que fariam a arte encolher).
 */
function girar(graus) {
  if (!ed.giro) ed.giro = { base: ed.work, angulo: 0 };
  ed.giro.angulo = ((ed.giro.angulo + graus) % 360 + 360) % 360;
  const a = ed.giro.angulo;
  // Múltiplos de 90° (ou 0°) não precisam de margem extra
  aplicar(a === 0 ? clonar(ed.giro.base) : Ops.girar(ed.giro.base, a), true);
}

/** Carrega uma imagem (URL) num canvas, limitando o lado maior a MAX_SIDE. */
async function carregarCanvas(url) {
  const img = await Utils.loadImage(url);
  const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const c = novoCanvas(img.naturalWidth * k, img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export const EditModule = {
  /**
   * Abre o editor para a estampa indicada.
   * @param {string} id - ID da estampa em AppState.stamps.
   */
  async open(id) {
    const stamp = AppState.stamps.find(s => s.id === id);
    if (!stamp) return;
    try {
      const dlg = montar();
      const work = await carregarCanvas(stamp.pdfRenderDataURL || stamp.dataURL);
      // larguraInicial: referência para manter a escala (px por cm) ao salvar
      ed = { ...(ed || {}), dlg, stamp, work, undo: [], crop: null, ini: null, giro: null,
             larguraInicial: work.width, alturaInicial: work.height };
      // Se a última edição salva foi um giro, continua a partir da imagem sem giro
      // (girar 15° hoje e 15° amanhã = um giro de 30°, sem bordas extras acumuladas)
      const r = stamp.rotacao;
      if (r && r.resultado === (stamp.pdfRenderDataURL || stamp.dataURL)) {
        ed.giro = { base: await carregarCanvas(r.base), angulo: r.angulo };
      }
      alternarVarinha(false);
      desenhar();
      if (!dlg.open) dlg.showModal();
    } catch (err) {
      Logger.error('IMAGE', 'Não foi possível abrir o editor: ' + err.message, err);
      NoticeModule.show('error', 'Não foi possível abrir a imagem para edição.');
    }
  },

  /** Trata o clique de cada botão da janela. @private */
  async _acao(op) {
    if (!ed || !ed.stamp) return;
    const w = ed.work;
    switch (op) {
      case 'g-90': return girar(-90);
      case 'g90':  return girar(90);
      case 'gl':   return girar(lim(parseFloat($('editAngulo').value) || 0, -360, 360));
      case 'eh':   return aplicar(Ops.espelhar(w, true));
      case 'ev':   return aplicar(Ops.espelhar(w, false));
      case 'rec':
      case 'apag':
      case 'fora':
        if (!ed.crop) return NoticeModule.show('info', 'Primeiro arraste sobre a imagem para selecionar a área.');
        return aplicar(op === 'rec' ? Ops.recortar(w, ed.crop) : op === 'apag' ? Ops.apagarArea(w, ed.crop) : Ops.apagarFora(w, ed.crop));
      case 'dessel': ed.crop = null; return mostrarSelecao();
      case 'apar': return aplicar(Ops.aparar(w));
      case 'fundo': {
        const r = Ops.removerFundo(w, tolerancia(), $('editLigados').checked, ed.crop);
        if (!r) return NoticeModule.show('info', 'O fundo já está transparente. Para apagar uma cor da arte, use a 🪄 varinha.');
        if (!r.n) return NoticeModule.show('info', 'Nenhum fundo encontrado. Tente aumentar a tolerância.');
        return aplicar($('editAparar').checked && !ed.crop ? Ops.aparar(r.canvas) : r.canvas);
      }
      case 'varinha': return alternarVarinha();
      case 'pb':   return aplicar(Ops.pretoBranco(w, ed.crop));
      case 'inv':  return aplicar(Ops.inverter(w, ed.crop));
      case 'pin':  return aplicar(Ops.pintar(w, $('editCor').value, ed.crop));
      case 'aj':   return aplicar(Ops.ajustar(w, +$('editBr').value, +$('editCt').value, +$('editSa').value, ed.crop));
      case 'undo': if (ed.undo.length) { ed.work = ed.undo.pop(); ed.crop = null; ed.giro = null; desenhar(); } return;
      case 'orig': {
        // Volta à imagem original (a de antes da primeira edição salva)
        const o = ed.stamp.original;
        const url = o ? o.pdfRenderDataURL : ed.stamp.pdfRenderDataURL;
        return aplicar(await carregarCanvas(url || ed.stamp.dataURL));
      }
      case 'cancel': ed.stamp = null; return ed.dlg.close();
      case 'save':   return this._salvar();
    }
  },

  /** Grava a imagem editada na estampa e atualiza preview, lista e PDF. @private */
  _salvar() {
    const s = ed.stamp;
    const url = ed.work.toDataURL('image/png');
    // Guarda a imagem original na 1ª edição (para "Restaurar original")
    if (!s.original) s.original = { dataURL: s.dataURL, previewDataURL: s.previewDataURL, pdfRenderDataURL: s.pdfRenderDataURL };
    s.dataURL = s.previewDataURL = s.pdfRenderDataURL = url;
    s.width = ed.work.width; s.height = ed.work.height;
    // Lembra a imagem de antes do giro para a próxima edição continuar o mesmo giro
    s.rotacao = ed.giro && ed.giro.angulo
      ? { base: ed.giro.base.toDataURL('image/png'), angulo: ed.giro.angulo, resultado: url }
      : null;

    // Mantém a escala da arte: a largura em cm acompanha a largura em px.
    // (Antes a largura em cm ficava igual e a arte girada encolhia.)
    const fx = ed.work.width  / ed.larguraInicial;
    const fy = ed.work.height / ed.alturaInicial;
    const cmAntes = s.cm ?? 20;
    const cmIdeal = cmAntes * fx;
    s.cm = Math.round(Utils.clampCm(cmIdeal) * 10) / 10;
    const limitada = cmIdeal > s.cm + 0.5;
    const k = s.cm / cmIdeal; // < 1 só quando a largura foi limitada

    // Posição relativa (PDF) mantendo o centro — vale também para estampas do lado oculto
    if (s.rel) {
      const cx = s.rel.rx + s.rel.rw / 2, cy = s.rel.ry + s.rel.rh / 2;
      const rw = s.rel.rw * fx * k, rh = s.rel.rh * fy * k;
      s.rel = { rx: cx - rw / 2, ry: cy - rh / 2, rw, rh };
    }

    const { StampModule, DragModule } = window._modules || {};
    // Centro atual da estampa no preview (para recentralizar depois de trocar a imagem)
    const centro = s.node.parentNode && s.node.offsetWidth
      ? { x: s.node.offsetLeft + s.node.offsetWidth / 2, y: s.node.offsetTop + s.node.offsetHeight / 2 }
      : null;
    s.node.addEventListener('load', () => {
      if (!StampModule) return;
      StampModule.applyStampCmToNode(s);
      if (centro && s.node.parentNode && DragModule) {
        const shirt = PreviewGeom.getRenderedShirtRect();
        const prev  = document.getElementById('preview')?.getBoundingClientRect();
        if (shirt && prev) {
          DragModule.updateStampPosition(s,
            centro.x - s.node.offsetWidth  / 2 - (shirt.left - prev.left),
            centro.y - s.node.offsetHeight / 2 - (shirt.top  - prev.top));
        }
      }
      StampModule.updateStampRel(s);
      window._modules?.HistoryModule?.commit('editar-' + s.id);
    }, { once: true });
    s.node.src = url;

    ed.stamp = null;
    ed.dlg.close();
    StampModule?.renderStampsList();
    if (limitada) {
      NoticeModule.show('info', `Estampa editada. Ela ficou maior que a área de impressão e foi limitada a ${s.cm} cm de largura.`);
    } else {
      NoticeModule.show('success', 'Estampa editada com sucesso.');
    }
    Logger.info('IMAGE', `Estampa editada: ${s.name} (${s.width}×${s.height}px, ${cmAntes} → ${s.cm} cm)`);
  }
};
