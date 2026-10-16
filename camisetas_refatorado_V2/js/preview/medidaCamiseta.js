/**
 * @module medidaCamiseta
 * @description Área de impressão em escala real sobre a camiseta do exemplo.
 *
 * A camiseta do preview representa um tamanho de verdade (CAMISETA_EXEMPLO,
 * ex.: masculina G = 55 cm de largura). O app mede a silhueta da imagem da
 * camiseta (largura do corpo e altura) e desenha a área de impressão
 * (ex.: 38 × 42 cm) na mesma proporção — assim o quadrado tracejado mostra de
 * forma fiel quanto da camiseta a estampa ocupa.
 *
 * Se a imagem não puder ser medida (sem CORS), usa SHIRT_PRINT_BOX (constants.js).
 *
 * Dependências: constants.js (AREA_IMPRESSAO, SHIRT_PRINT_BOX, CAMISETA_EXEMPLO, TOPO_AREA_CM).
 */

import { AREA_IMPRESSAO, SHIRT_PRINT_BOX, CAMISETA_EXEMPLO, TOPO_AREA_CM } from '../core/constants.js';

const cache = new Map();   // src → medida | null (falhou) | Promise

/**
 * Mede a silhueta da camiseta na imagem.
 * @param {HTMLImageElement} img - imagem carregada (precisa permitir leitura: CORS ou data URL)
 * @returns {{topo, base, esq, dir, corpoEsq, corpoDir}|null} frações (0–1) da imagem
 */
export function medirSilhueta(img) {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return null;
  const k = Math.min(1, 500 / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * k)), h = Math.max(1, Math.round(nh * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  let d;
  try { d = ctx.getImageData(0, 0, w, h).data; } catch { return null; } // sem CORS
  // Fundo transparente (PNG) ou de cor única (cor dos cantos)
  const px = (x, y) => (y * w + x) * 4;
  const cantos = [px(1, 1), px(w - 2, 1), px(1, h - 2), px(w - 2, h - 2)];
  const transparente = cantos.every(i => d[i + 3] < 30);
  const fundo = cantos.reduce((s, i) => [s[0] + d[i] / 4, s[1] + d[i + 1] / 4, s[2] + d[i + 2] / 4], [0, 0, 0]);
  const eCamiseta = (x, y) => {
    const i = px(x, y);
    if (transparente) return d[i + 3] > 60;
    return d[i + 3] > 60 && Math.abs(d[i] - fundo[0]) + Math.abs(d[i + 1] - fundo[1]) + Math.abs(d[i + 2] - fundo[2]) > 45;
  };
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (eCamiseta(x, y)) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0 || (x1 - x0) < w * 0.2 || (y1 - y0) < h * 0.2) return null;
  // Largura do corpo: linha a 62% da altura (abaixo das mangas), a partir do centro
  const yc = Math.round(y0 + (y1 - y0) * 0.62), xc = Math.round((x0 + x1) / 2);
  const ate = (dir) => {
    let x = xc, buraco = 0;
    while (x + dir >= 0 && x + dir < w) {
      x += dir;
      if (eCamiseta(x, yc)) buraco = 0; else if (++buraco > 3) return x - dir * buraco;
    }
    return x;
  };
  if (!eCamiseta(xc, yc)) return null;
  const ce = ate(-1), cd = ate(1);
  return { topo: y0 / h, base: (y1 + 1) / h, esq: x0 / w, dir: (x1 + 1) / w, corpoEsq: ce / w, corpoDir: (cd + 1) / w };
}

/** Mede (uma vez por imagem) a partir do endereço. */
export function medirUrl(src) {
  if (!src) return Promise.resolve(null);
  if (cache.has(src)) return Promise.resolve(cache.get(src));
  const p = new Promise(ok => {
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => ok(medirSilhueta(img));
    img.onerror = () => ok(null);
    img.src = src;
  }).then(m => { cache.set(src, m); return m; });
  cache.set(src, p);
  return p;
}

/** Medida já calculada (ou undefined, se ainda não terminou). */
export function medidaPronta(src) {
  const m = cache.get(src);
  return m instanceof Promise ? undefined : m;
}

/**
 * Área de impressão em frações da imagem {x, y, w, h}.
 * @param {string} categoria
 * @param {'Frente'|'Costas'} lado
 * @param {Object|null} medida - resultado de medirSilhueta (null → valores fixos)
 * @param {number} aspecto - largura / altura da imagem
 */
export function areaNaImagem(categoria, lado, medida, aspecto) {
  const a = AREA_IMPRESSAO[categoria] || AREA_IMPRESSAO.Masculina;
  const ex = CAMISETA_EXEMPLO[categoria] || CAMISETA_EXEMPLO.Masculina;
  if (!medida || !aspecto) {
    const b = SHIRT_PRINT_BOX[lado] || SHIRT_PRINT_BOX.Frente;
    return { x: b.x, y: b.y, w: b.w, h: b.w * aspecto * a.h / a.w, fixo: true };
  }
  // cm → fração da largura e da altura da imagem
  const porCmX = (medida.corpoDir - medida.corpoEsq) / ex.largura;
  const porCmY = porCmX * aspecto;
  const w = a.w * porCmX, h = a.h * porCmY;
  const centro = (medida.corpoEsq + medida.corpoDir) / 2;
  const topoCm = (TOPO_AREA_CM[categoria] || TOPO_AREA_CM.Masculina)[lado] ?? 8;
  let y = medida.topo + topoCm * porCmY;
  y = Math.min(y, medida.base - h - 2 * porCmY); // não passa da barra
  return { x: centro - w / 2, y, w, h };
}

/** Texto da camiseta do exemplo: "G · 55 × 74 cm". */
export function textoExemplo(categoria) {
  const ex = CAMISETA_EXEMPLO[categoria] || CAMISETA_EXEMPLO.Masculina;
  return { tamanho: ex.tamanho, largura: ex.largura, altura: ex.altura };
}
