/**
 * @module textoVetor
 * @description Textos da camiseta em VETOR (SVG) para a produção.
 *
 * Cada letra vira uma curva (contorno da fonte), então o arquivo abre no
 * CorelDRAW, Illustrator ou Inkscape sem precisar da fonte instalada e pode
 * ser ampliado sem perder qualidade. O SVG já sai no tamanho da camiseta (cm).
 *
 * Usa opentype.js (vendor/) e as fontes .woff (fontes/), guardadas no próprio
 * app: funciona sem internet. Fontes: licença SIL Open Font License (fontes/OFL.txt).
 */

import { FONTES, desenharTexto } from './texto.js';

/** Arquivo .woff de cada fonte (pasta fontes/). */
const ARQ = {
  'Montserrat': 'montserrat', 'Bebas Neue': 'bebas-neue', 'Anton': 'anton', 'Oswald': 'oswald',
  'Bangers': 'bangers', 'Permanent Marker': 'permanent-marker', 'Pacifico': 'pacifico',
  'Lobster': 'lobster', 'Dancing Script': 'dancing-script', 'Righteous': 'righteous',
  'Black Ops One': 'black-ops-one', 'Rye': 'rye', 'UnifrakturMaguntia': 'unifrakturmaguntia'
};
const BASE = new URL('../', import.meta.url).href;

let opentype = null;
const fontes = new Map();

function carregarOpentype() {
  if (window.opentype) return Promise.resolve(window.opentype);
  return (opentype ||= new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = BASE + 'vendor/opentype.min.js';
    s.onload = () => ok(window.opentype);
    s.onerror = () => { opentype = null; erro(new Error('não foi possível carregar o gerador de vetor')); };
    document.head.appendChild(s);
  }));
}

async function carregarFonte(id) {
  const arq = ARQ[id] || ARQ[FONTES[0].id];
  if (!fontes.has(arq)) {
    fontes.set(arq, (async () => {
      const ot = await carregarOpentype();
      const r = await fetch(`${BASE}fontes/${arq}.woff`);
      if (!r.ok) throw new Error(`fonte ${id} indisponível`);
      return ot.parse(await r.arrayBuffer());
    })().catch(e => { fontes.delete(arq); throw e; }));
  }
  return fontes.get(arq);
}

const n = v => +v.toFixed(2);

/**
 * Texto em SVG vetorial (letras em curvas).
 * @param {{texto, fonte, cor, contorno, corContorno, alinhar?, cm?}} t
 * @returns {Promise<string>} conteúdo do arquivo .svg
 */
export async function textoSVG(t) {
  const font = await carregarFonte(t.fonte);
  const linhas = String(t.texto || '').replace(/\r/g, '').split('\n').map(l => l.trimEnd());
  const tam = 200, alt = tam * 1.18;
  const borda = t.contorno ? tam * 0.09 : 0;
  const larguras = linhas.map(l => font.getAdvanceWidth(l, tam, { kerning: true }));
  const maior = Math.max(...larguras, 1);
  const alinhar = t.alinhar || 'center';
  // Linha de base no meio de cada linha (igual à prévia em PNG)
  const k = tam / font.unitsPerEm;
  const meio = (font.ascender + font.descender) / 2 * k;
  const caminhos = [];
  const caixa = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  linhas.forEach((l, i) => {
    if (!l.trim()) return;
    const x = alinhar === 'left' ? 0 : alinhar === 'right' ? maior - larguras[i] : (maior - larguras[i]) / 2;
    const y = alt * i + alt / 2 + meio;
    const p = font.getPath(l, x, y, tam, { kerning: true });
    const b = p.getBoundingBox();
    if (b.x2 > b.x1) {
      caixa.x0 = Math.min(caixa.x0, b.x1); caixa.y0 = Math.min(caixa.y0, b.y1);
      caixa.x1 = Math.max(caixa.x1, b.x2); caixa.y1 = Math.max(caixa.y1, b.y2);
    }
    caminhos.push(p.toPathData(2));
  });
  if (!caminhos.length || caixa.x1 < caixa.x0) throw new Error('texto vazio');
  const m = borda + 2;
  const vx = caixa.x0 - m, vy = caixa.y0 - m, vw = caixa.x1 - caixa.x0 + m * 2, vh = caixa.y1 - caixa.y0 + m * 2;
  // Tamanho real na camiseta (a largura em cm é a da arte inteira)
  const dim = t.cm ? ` width="${n(t.cm)}cm" height="${n(t.cm * vh / vw)}cm"` : '';
  const d = caminhos.join(' ');
  // Contorno: a mesma letra engrossada por baixo (funciona em qualquer programa)
  const contorno = borda ? `\n  <path d="${d}" fill="${t.corContorno || '#111111'}" stroke="${t.corContorno || '#111111'}" stroke-width="${n(borda * 2)}" stroke-linejoin="round"/>` : '';
  const titulo = String(t.texto || '').replace(/[<&>"]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(vx)} ${n(vy)} ${n(vw)} ${n(vh)}"${dim}>
  <title>${titulo}</title>${contorno}
  <path d="${d}" fill="${t.cor || '#ffffff'}"/>
</svg>
`;
}

/**
 * Texto em PNG de alta resolução (300 dpi no tamanho da camiseta).
 * @returns {Promise<Blob>}
 */
export async function textoPNG(t) {
  const alvo = Math.round((t.cm || 25) / 2.54 * 300);
  const r = await desenharTexto(t, { largura: alvo });
  return (await fetch(r.url)).blob();
}

/**
 * Arquivos de produção de um texto: [{nome, blob}] (SVG vetorial + PNG 300 dpi).
 * Se o vetor falhar, vai só o PNG.
 */
export async function arquivosTexto(t, base) {
  const lista = [];
  try { lista.push({ nome: `${base}.svg`, blob: new Blob([await textoSVG(t)], { type: 'image/svg+xml' }) }); }
  catch (e) { console.warn('Texto em vetor:', e); }
  try { lista.push({ nome: `${base}.png`, blob: await textoPNG(t) }); }
  catch { if (t.url) lista.push({ nome: `${base}.png`, blob: await (await fetch(t.url)).blob() }); }
  return lista;
}
