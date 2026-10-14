/**
 * @module shirt
 * @description Desenho das camisetas (vetor) e área de impressão.
 *
 * As camisetas são desenhadas em SVG (viewBox 0 0 1000 1100), então funcionam
 * sem internet, em qualquer cor e com a área de impressão exata em cm.
 *
 * Área de impressão: um retângulo centralizado (largura = AREAS[corte].w
 * unidades do desenho) que vale a largura máxima do modelo em cm; a altura
 * sai da proporção da área (ex.: 38 × 42 cm).
 */

import { CORES, MODELOS } from './config.js';

export const VB = { w: 1000, h: 1100 };

/** Formas de cada corte. */
const CORTES = {
  tradicional: {
    corpo: 'M 390 72 C 425 140, 575 140, 610 72 L 690 96 L 868 166 C 915 245, 950 335, 972 418 L 830 470 C 812 425, 798 385, 790 342 C 794 560, 800 800, 806 1040 C 605 1056, 395 1056, 194 1040 C 200 800, 206 560, 210 342 C 202 385, 188 425, 170 470 L 28 418 C 50 335, 85 245, 132 166 L 310 96 Z',
    golaFrente: 'M 390 72 C 425 140, 575 140, 610 72',
    golaCostas: 'M 390 72 C 430 94, 570 94, 610 72',
    interna:    'M 390 72 C 430 54, 570 54, 610 72 C 575 124, 425 124, 390 72 Z',
    costuras:   ['M 310 96 C 300 190, 250 280, 210 342', 'M 690 96 C 700 190, 750 280, 790 342',
                 'M 40 383 L 180 435', 'M 960 383 L 820 435', 'M 196 1005 C 400 1021, 600 1021, 804 1005'],
    // Área de impressão: largura no desenho e topo (Frente / Costas)
    area: { w: 410, topo: { Frente: 185, Costas: 150 } }
  },
  feminino: {
    corpo: 'M 400 82 C 432 150, 568 150, 600 82 L 676 100 L 812 160 C 852 214, 880 268, 898 322 L 792 372 C 782 348, 772 328, 764 306 C 738 470, 722 560, 744 700 C 762 820, 768 930, 774 1040 C 600 1058, 400 1058, 226 1040 C 232 930, 238 820, 256 700 C 278 560, 262 470, 236 306 C 228 328, 218 348, 208 372 L 102 322 C 120 268, 148 214, 188 160 L 324 100 Z',
    golaFrente: 'M 400 82 C 432 150, 568 150, 600 82',
    golaCostas: 'M 400 82 C 435 100, 565 100, 600 82',
    interna:    'M 400 82 C 435 64, 565 64, 600 82 C 568 132, 432 132, 400 82 Z',
    costuras:   ['M 324 100 C 300 180, 262 250, 236 306', 'M 676 100 C 700 180, 738 250, 764 306',
                 'M 112 296 L 214 344', 'M 888 296 L 786 344', 'M 228 1006 C 400 1022, 600 1022, 772 1006'],
    area: { w: 320, topo: { Frente: 200, Costas: 165 } }
  }
};
CORTES.infantil = CORTES.tradicional; // mesma forma; a área (30 cm) é que muda a escala

export const modelo = id => MODELOS.find(m => m.id === id) || MODELOS[0];

/**
 * Área de impressão no desenho (unidades do viewBox) e escala.
 * @returns {{x, y, w, h, upc: number, cm: {w, h}}} upc = unidades por cm
 */
export function areaImpressao(modeloId, lado) {
  const m = modelo(modeloId), f = CORTES[m.corte] || CORTES.tradicional;
  const upc = f.area.w / m.area.w;
  const w = f.area.w, h = m.area.h * upc;
  return { x: (VB.w - w) / 2, y: f.area.topo[lado] ?? f.area.topo.Frente, w, h, upc, cm: { w: m.area.w, h: m.area.h } };
}

/** Clareia (+) ou escurece (−) uma cor hex. */
function tom(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

let seq = 0;

/**
 * SVG da camiseta (sem a tag <svg>): defs + desenho.
 * @param {{modelo: string, lado: 'Frente'|'Costas', cor: string}} o
 */
export function camisetaSVG({ modelo: modeloId, lado = 'Frente', cor = 'Branco' }) {
  const m = modelo(modeloId), f = CORTES[m.corte] || CORTES.tradicional;
  const c = CORES[cor] || CORES.Branco, hex = c.hex;
  const escura = parseInt(hex.slice(1, 3), 16) < 90;
  const id = 'cm' + (++seq);
  const linha = escura ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.13)';
  const contorno = escura ? tom(hex, -0.35) : 'rgba(0,0,0,.22)';
  const frente = lado !== 'Costas';
  // Nas costas a gola é mais alta: troca o recorte da frente pelo das costas
  const corpo = frente ? f.corpo : f.corpo.replace(f.golaFrente.slice(2), f.golaCostas.slice(2));
  return `
  <defs>
    <clipPath id="${id}c"><path d="${corpo}"/></clipPath>
    <linearGradient id="${id}g" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".22"/>
      <stop offset=".16" stop-color="#000" stop-opacity="0"/>
      <stop offset=".5" stop-color="#fff" stop-opacity=".05"/>
      <stop offset=".84" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".22"/>
    </linearGradient>
    <linearGradient id="${id}v" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".06"/>
      <stop offset=".75" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".12"/>
    </linearGradient>
    ${c.mescla ? `<filter id="${id}m" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="${escura ? 0.22 : 0.3}"/></feComponentTransfer>
    </filter>` : ''}
  </defs>
  <g class="camisa">
    ${frente ? `<path d="${f.interna}" fill="${tom(hex, escura ? 0.12 : -0.18)}"/>` : ''}
    <path d="${corpo}" fill="${hex}"/>
    <g clip-path="url(#${id}c)">
      ${c.mescla ? `<rect width="1000" height="1100" filter="url(#${id}m)"/>` : ''}
      <rect width="1000" height="1100" fill="url(#${id}g)"/>
      <rect width="1000" height="1100" fill="url(#${id}v)"/>
      ${f.costuras.map(d => `<path d="${d}" fill="none" stroke="${linha}" stroke-width="3" stroke-dasharray="${d.includes('C') ? '0' : '8 6'}"/>`).join('')}
    </g>
    <path d="${frente ? f.golaFrente : f.golaCostas}" fill="none" stroke="${tom(hex, escura ? 0.1 : -0.1)}" stroke-width="18" stroke-linecap="round"/>
    <path d="${frente ? f.golaFrente : f.golaCostas}" fill="none" stroke="${linha}" stroke-width="2" transform="translate(0 11)"/>
    <path d="${corpo}" fill="none" stroke="${contorno}" stroke-width="3"/>
  </g>`;
}

/** SVG completo (para usar como imagem). */
export function camisetaSVGCompleto(o, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB.w} ${VB.h}">${camisetaSVG(o)}${extra}</svg>`;
}

/** Carrega uma imagem (URL ou blob URL). */
export function carregarImagem(src) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => ok(img);
    img.onerror = () => erro(new Error('Não foi possível carregar a imagem.'));
    img.src = src;
  });
}

/**
 * Desenha a camiseta com as artes num canvas (para o resumo e o PDF).
 * @param {{modelo, lado, cor, artes: Array<{img: HTMLImageElement, cx, cy, wu, hu}>}} o
 *        cx, cy = centro da arte e wu, hu = tamanho, em unidades do desenho
 * @param {number} largura - largura do canvas em px
 */
export async function renderizar(o, largura = 900) {
  const k = largura / VB.w;
  const c = document.createElement('canvas');
  c.width = largura; c.height = Math.round(VB.h * k);
  const x = c.getContext('2d');
  const svg = camisetaSVGCompleto(o);
  const img = await carregarImagem('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  x.drawImage(img, 0, 0, c.width, c.height);
  for (const a of o.artes || []) {
    x.drawImage(a.img, (a.cx - a.wu / 2) * k, (a.cy - a.hu / 2) * k, a.wu * k, a.hu * k);
  }
  return c;
}
