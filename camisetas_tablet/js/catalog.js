/**
 * @module catalog
 * @description Catálogo de artes guardado no tablet.
 *
 * Importação (área do administrador): PDF, CorelDRAW (.cdr), PNG/JPG/WEBP,
 * SVG e .ZIP (uma pasta compactada). Cada arte vira:
 *   - miniatura (grade da galeria, carrega rápido)
 *   - prévia em alta (camiseta e PDF do pedido)
 * O tema vem da pasta onde o arquivo está (ex.: "Rock/banda.pdf" → tema Rock)
 * ou do tema escolhido na hora de importar.
 *
 * PDF: cada página vira uma arte (recortada em volta do desenho; opcional:
 *      separar várias artes da mesma página).
 * CDR: o navegador não abre arquivos do Corel; usamos a imagem de prévia que
 *      o próprio CorelDRAW grava dentro do arquivo (resolução menor). Para a
 *      melhor qualidade, exporte as artes do Corel em PDF.
 */

import { DB } from './db.js';
import { LIBS, IMAGENS } from './config.js';

// ---------- Bibliotecas (carregadas só quando precisa) ----------

const libs = {};
function script(src) {
  return new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = ok; s.onerror = () => erro(new Error('Sem internet para carregar ' + src.split('/').pop()));
    document.head.appendChild(s);
  });
}
export async function lib(nome) {
  if (!libs[nome]) {
    libs[nome] = (async () => {
      if (nome === 'pdfjs') {
        if (!window.pdfjsLib) await script(LIBS.pdfjs);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfjsWorker;
        return window.pdfjsLib;
      }
      if (nome === 'jszip') { if (!window.JSZip) await script(LIBS.jszip); return window.JSZip; }
      if (nome === 'jspdf') {
        if (!window.jspdf) await script(LIBS.jspdf);
        if (!window.jspdf.jsPDF.API.autoTable) await script(LIBS.autotable);
        return window.jspdf.jsPDF;
      }
      throw new Error('Biblioteca desconhecida: ' + nome);
    })().catch(e => { delete libs[nome]; throw e; });
  }
  return libs[nome];
}

// ---------- Utilidades de imagem ----------

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

/** Reduz para caber em `max` px no lado maior (nunca amplia). */
function reduzir(src, max) {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  if (k === 1) return src;
  const c = canvas(src.width * k, src.height * k);
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Recorta as bordas transparentes (com uma pequena folga). */
function aparar(src, folga = 0.01) {
  const w = src.width, h = src.height;
  const d = src.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 10) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null; // página vazia
  const m = Math.round(Math.max(w, h) * folga);
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
  x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
  const c = canvas(x1 - x0 + 1, y1 - y0 + 1);
  c.getContext('2d').drawImage(src, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

/** Recorta um retângulo em frações (0–1). */
function recortar(src, r) {
  const c = canvas(r.w * src.width, r.h * src.height);
  c.getContext('2d').drawImage(src, r.x * src.width, r.y * src.height, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

/**
 * Remove o fundo de cor única ligado às bordas (ex.: fundo branco de um JPG
 * ou da prévia do Corel). Não mexe no branco de dentro da arte.
 */
function removerFundo(src, tol = 48) {
  const w = src.width, h = src.height;
  const x = src.getContext('2d', { willReadFrequently: true });
  const img = x.getImageData(0, 0, w, h), p = img.data;
  const borda = [];
  for (let i = 0; i < w; i++) borda.push(i, (h - 1) * w + i);
  for (let j = 1; j < h - 1; j++) borda.push(j * w, j * w + w - 1);
  let opacos = 0;
  const grupos = new Map();
  for (const k of borda) {
    const i = k * 4;
    if (p[i + 3] < 200) continue;
    opacos++;
    const chave = (p[i] >> 4) << 8 | (p[i + 1] >> 4) << 4 | (p[i + 2] >> 4);
    const g = grupos.get(chave) || { n: 0, r: 0, g: 0, b: 0 };
    g.n++; g.r += p[i]; g.g += p[i + 1]; g.b += p[i + 2];
    grupos.set(chave, g);
  }
  if (opacos < borda.length * 0.6) return false; // bordas já transparentes
  const m = [...grupos.values()].reduce((a, b) => (b.n > a.n ? b : a));
  if (m.n < opacos * 0.6) return false;           // borda sem uma cor dominante (foto): não mexe
  const cor = [m.r / m.n, m.g / m.n, m.b / m.n];
  const dist = i => Math.hypot(p[i] - cor[0], p[i + 1] - cor[1], p[i + 2] - cor[2]);
  const tirar = new Uint8Array(w * h), pilha = new Int32Array(w * h);
  let topo = 0;
  const empilha = k => { if (!tirar[k] && (p[k * 4 + 3] < 16 || dist(k * 4) <= tol)) { tirar[k] = 1; pilha[topo++] = k; } };
  borda.forEach(empilha);
  while (topo) {
    const k = pilha[--topo], px = k % w;
    if (px > 0) empilha(k - 1);
    if (px < w - 1) empilha(k + 1);
    if (k >= w) empilha(k - w);
    if (k < w * (h - 1)) empilha(k + w);
  }
  for (let k = 0; k < w * h; k++) {
    if (tirar[k]) { p[k * 4 + 3] = 0; continue; }
    // Contorno: tira a parte da cor do fundo misturada na borda (sem "halo")
    const px = k % w;
    const vizinho = (px > 0 && tirar[k - 1]) || (px < w - 1 && tirar[k + 1]) || (k >= w && tirar[k - w]) || (k < w * (h - 1) && tirar[k + w]);
    if (!vizinho) continue;
    const i = k * 4;
    let al = 0;
    for (let c = 0; c < 3; c++) {
      const v = p[i + c], b = cor[c];
      al = Math.max(al, v > b ? (v - b) / (255 - b || 1) : v < b ? (b - v) / (b || 1) : 0);
    }
    if (al < 0.98) {
      if (al < 0.02) { p[i + 3] = 0; continue; }
      for (let c = 0; c < 3; c++) p[i + c] = Math.max(0, Math.min(255, Math.round((p[i + c] - cor[c]) / al + cor[c])));
      p[i + 3] = Math.round(p[i + 3] * al);
    }
  }
  x.putImageData(img, 0, 0);
  return true;
}

/**
 * Acha artes separadas numa página (partes desenhadas a mais de 3% da
 * página umas das outras viram artes diferentes).
 * @returns {{x, y, w, h}[]} retângulos em frações
 */
function acharArtes(src) {
  const k = Math.min(1, 360 / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * k)), h = Math.max(1, Math.round(src.height * k));
  const c = canvas(w, h);
  c.getContext('2d').drawImage(src, 0, 0, w, h);
  const p = c.getContext('2d').getImageData(0, 0, w, h).data;
  const N = w * h, des = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (p[i * 4 + 3] >= 24) des[i] = 1;
  const R = Math.max(1, Math.round(0.03 * Math.max(w, h)));
  const tmp = new Uint8Array(N), junto = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (des[y * w + x]) for (let a = Math.max(0, x - R); a <= Math.min(w - 1, x + R); a++) tmp[y * w + a] = 1;
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (tmp[y * w + x]) for (let b = Math.max(0, y - R); b <= Math.min(h - 1, y + R); b++) junto[b * w + x] = 1;
  const rot = new Int32Array(N), pilha = new Int32Array(N), caixas = [];
  for (let s = 0; s < N; s++) {
    if (!junto[s] || rot[s]) continue;
    const id = caixas.length + 1, cx = { x0: w, y0: h, x1: -1, y1: -1, n: 0 };
    let topo = 0; pilha[topo++] = s; rot[s] = id;
    while (topo) {
      const i = pilha[--topo], px = i % w, py = (i - px) / w;
      if (des[i]) { cx.n++; cx.x0 = Math.min(cx.x0, px); cx.x1 = Math.max(cx.x1, px); cx.y0 = Math.min(cx.y0, py); cx.y1 = Math.max(cx.y1, py); }
      for (const v of [px > 0 ? i - 1 : -1, px < w - 1 ? i + 1 : -1, i - w, i + w]) if (v >= 0 && v < N && junto[v] && !rot[v]) { rot[v] = id; pilha[topo++] = v; }
    }
    caixas.push(cx);
  }
  const lim = v => Math.max(0, Math.min(1, v));
  return caixas.filter(c => c.n >= 0.0015 * N && c.x1 >= 0).map(c => {
    const x0 = lim(c.x0 / w - 0.01), y0 = lim(c.y0 / h - 0.01), x1 = lim((c.x1 + 1) / w + 0.01), y1 = lim((c.y1 + 1) / h + 0.01);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }).sort((a, b) => (Math.abs(a.y - b.y) > 0.08 ? a.y - b.y : a.x - b.x));
}

/** Canvas → Blob (WEBP com transparência; PNG se o aparelho não gerar WEBP). */
function paraBlob(c, qualidade = 0.9) {
  return new Promise(ok => c.toBlob(b => {
    if (b && b.type === 'image/webp') return ok(b);
    c.toBlob(ok, 'image/png');
  }, 'image/webp', qualidade));
}

async function bitmapDeBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i); i.onerror = () => erro(new Error('Imagem inválida'));
      i.src = url;
    });
    let w = img.naturalWidth || 1200, h = img.naturalHeight || 1200;
    if (blob.type === 'image/svg+xml' || /svg/.test(blob.type)) { const k = IMAGENS.previa / Math.max(w, h); w *= k; h *= k; }
    const c = canvas(w, h);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

// ---------- Leitores por tipo ----------

/** PDF → um canvas por página (fundo transparente). */
async function lerPdf(file, aoPagina) {
  const pdfjs = await lib('pdfjs');
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  try {
    const paginas = [];
    for (let n = 1; n <= Math.min(doc.numPages, 60); n++) {
      const page = await doc.getPage(n);
      const v1 = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: IMAGENS.previa * 1.25 / Math.max(v1.width, v1.height) });
      const c = canvas(viewport.width, viewport.height);
      // background transparente: sem isso o PDF.js pinta a página de branco
      await page.render({ canvasContext: c.getContext('2d'), viewport, background: 'rgba(0,0,0,0)' }).promise;
      paginas.push(c);
      aoPagina?.(n, doc.numPages);
    }
    return paginas;
  } finally { try { await doc.destroy(); } catch { /* ok */ } }
}

/** CorelDRAW: prévia gravada no arquivo (X4+ é um ZIP; versões antigas, RIFF com BMP). */
async function lerCdr(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] === 0x50 && buf[1] === 0x4b) { // "PK" = ZIP (CorelDRAW X4 em diante)
    const JSZip = await lib('jszip');
    const zip = await JSZip.loadAsync(buf);
    const imgs = Object.values(zip.files).filter(f => !f.dir && /\.(png|jpe?g|bmp)$/i.test(f.name));
    const prev = imgs.filter(f => /preview|thumbnail/i.test(f.name));
    const lista = (prev.length ? prev : imgs);
    if (!lista.length) throw new Error('arquivo do Corel sem imagem de prévia');
    // A maior prévia disponível
    let melhor = null, maior = -1;
    for (const f of lista) {
      const b = await f.async('blob');
      if (b.size > maior) { maior = b.size; melhor = new Blob([b], { type: /png$/i.test(f.name) ? 'image/png' : /bmp$/i.test(f.name) ? 'image/bmp' : 'image/jpeg' }); }
    }
    return bitmapDeBlob(melhor);
  }
  // RIFF (CorelDRAW antigo): bloco "DISP" com um bitmap do Windows (DIB)
  const txt = new TextDecoder('latin1').decode(buf.subarray(0, Math.min(buf.length, 4 * 1024 * 1024)));
  const pos = txt.indexOf('DISP');
  if (pos < 0) throw new Error('não achei a prévia dentro do arquivo do Corel');
  const dv = new DataView(buf.buffer, buf.byteOffset);
  const tam = dv.getUint32(pos + 4, true);
  let ini = pos + 8;
  if (dv.getUint32(ini, true) !== 40 && dv.getUint32(ini + 4, true) === 40) ini += 4;
  if (dv.getUint32(ini, true) !== 40) throw new Error('prévia do Corel em formato desconhecido');
  const bits = dv.getUint16(ini + 14, true), usadas = dv.getUint32(ini + 32, true);
  const paleta = (usadas || (bits <= 8 ? 1 << bits : 0)) * 4;
  const dib = buf.subarray(ini, Math.min(buf.length, pos + 8 + tam));
  const bmp = new Uint8Array(14 + dib.length), bv = new DataView(bmp.buffer);
  bmp[0] = 0x42; bmp[1] = 0x4d; bv.setUint32(2, bmp.length, true); bv.setUint32(10, 14 + 40 + paleta, true);
  bmp.set(dib, 14);
  return bitmapDeBlob(new Blob([bmp], { type: 'image/bmp' }));
}

// ---------- Importação ----------

const EXT_OK = /\.(pdf|cdr|png|jpe?g|webp|svg|zip)$/i;

/** Deixa o nome do arquivo mais apresentável: "banda_rock-01.pdf" → "Banda rock 01". */
export function nomeBonito(arquivo) {
  const n = arquivo.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return n ? n[0].toUpperCase() + n.slice(1) : 'Arte';
}

/** Tema pela pasta: "Artes/Rock/banda.pdf" → "Rock" (null se o arquivo está na raiz). */
function temaDoCaminho(caminho) {
  const partes = caminho.split(/[\\/]/).filter(Boolean);
  if (partes.length < 2) return null;
  // Ignora a pasta raiz escolhida quando há subpastas (ex.: "Artes/Rock/x.pdf" → Rock)
  return partes[partes.length - 2];
}

/** Abre arquivos .zip e devolve a lista de {file, caminho}. */
async function expandir(lista) {
  const saida = [];
  for (const item of lista) {
    if (/\.zip$/i.test(item.caminho)) {
      const JSZip = await lib('jszip');
      const zip = await JSZip.loadAsync(item.file);
      for (const f of Object.values(zip.files)) {
        if (f.dir || !EXT_OK.test(f.name) || /\.zip$/i.test(f.name) || /(^|\/)(__MACOSX|\.)/.test(f.name)) continue;
        const blob = await f.async('blob');
        saida.push({ file: new File([blob], f.name.split('/').pop()), caminho: f.name });
      }
    } else if (EXT_OK.test(item.caminho)) {
      saida.push(item);
    }
  }
  return saida;
}

/**
 * Importa arquivos para o catálogo.
 * @param {Array<{file: File, caminho: string}>} lista
 * @param {{temaPadrao: string, separar: boolean, removerFundo: boolean}} opc
 * @param {(info: {feitos, total, arquivo}) => void} progresso
 * @param {{cancelado: boolean}} sinal
 * @returns {Promise<{importadas: number, avisos: string[]}>}
 */
export async function importar(lista, opc, progresso, sinal = {}) {
  const arquivos = await expandir(lista);
  const avisos = [];
  let importadas = 0;
  const existentes = new Map((await DB.artesResumo()).map(a => [a.id, a]));
  let ordem = existentes.size;

  for (let i = 0; i < arquivos.length; i++) {
    if (sinal.cancelado) { avisos.push('Importação interrompida.'); break; }
    const { file, caminho } = arquivos[i];
    progresso?.({ feitos: i, total: arquivos.length, arquivo: caminho });
    const tema = (temaDoCaminho(caminho) || opc.temaPadrao || 'Diversos').trim();
    const ext = (caminho.split('.').pop() || '').toLowerCase();
    try {
      let paginas, baixaRes = false;
      if (ext === 'pdf') paginas = await lerPdf(file);
      else if (ext === 'cdr') { paginas = [await lerCdr(file)]; baixaRes = Math.max(paginas[0].width, paginas[0].height) < 900; }
      else paginas = [await bitmapDeBlob(file.type ? file : new Blob([file], { type: ext === 'svg' ? 'image/svg+xml' : 'image/' + ext.replace('jpg', 'jpeg') }))];

      const novos = [];
      for (let pg = 0; pg < paginas.length; pg++) {
        let c = paginas[pg];
        // Fundo de cor única (JPG, prévia do Corel, PDF com fundo pintado)
        if (opc.removerFundo && ext !== 'png' && ext !== 'svg') removerFundo(c);
        const partes = opc.separar ? acharArtes(c) : [];
        const pedacos = partes.length > 1 ? partes.map(r => recortar(c, r)) : [c];
        for (let pt = 0; pt < pedacos.length; pt++) {
          const arte = aparar(pedacos[pt]);
          if (!arte) continue; // página em branco
          const previa = reduzir(arte, IMAGENS.previa);
          const mini = reduzir(arte, IMAGENS.miniatura);
          const id = `${tema}/${caminho}#${pg + 1}#${pt + 1}`;
          const sufixo = (paginas.length > 1 ? ` · pág. ${pg + 1}` : '') + (pedacos.length > 1 ? ` · ${pt + 1}` : '');
          const antigo = existentes.get(id);
          novos.push({
            id, tema, arquivo: caminho, pagina: pg + 1, parte: pt + 1, tipo: ext,
            nome: antigo?.nome || nomeBonito(caminho) + sufixo,
            oculto: antigo?.oculto || false,
            w: previa.width, h: previa.height, baixaRes,
            ordem: antigo?.ordem ?? ordem++,
            criado: antigo?.criado || Date.now(),
            miniatura: await paraBlob(mini, 0.85),
            previa: await paraBlob(previa, 0.92)
          });
        }
      }
      if (!novos.length) { avisos.push(`${caminho}: nada desenhado (página em branco).`); continue; }
      await DB.salvarVarios('artes', novos);
      importadas += novos.length;
      if (baixaRes) avisos.push(`${caminho}: prévia do Corel em baixa resolução — para melhor qualidade, exporte em PDF.`);
    } catch (e) {
      avisos.push(`${caminho}: ${e.message}`);
    }
  }
  progresso?.({ feitos: arquivos.length, total: arquivos.length, arquivo: '' });
  return { importadas, avisos, total: arquivos.length };
}

// ---------- Leitura para a galeria ----------

const urls = new Map(); // id+tipo → object URL (reaproveita)

/** URL da miniatura ou da prévia de uma arte (criada sob demanda). */
export async function urlDa(id, tipo = 'miniatura') {
  const chave = id + '|' + tipo;
  if (urls.has(chave)) return urls.get(chave);
  const a = await DB.pegar('artes', id);
  if (!a || !a[tipo]) return null;
  const u = URL.createObjectURL(a[tipo]);
  urls.set(chave, u);
  return u;
}

/** Esquece as URLs (depois de apagar/reimportar). */
export function limparUrls() {
  urls.forEach(u => URL.revokeObjectURL(u));
  urls.clear();
}

// ---------- Cópia de segurança (levar o catálogo para outro tablet) ----------

export async function exportarCatalogo(progresso) {
  const JSZip = await lib('jszip');
  const zip = new JSZip();
  const lista = await DB.todos('artes');
  const meta = [];
  lista.forEach((a, i) => {
    const { miniatura, previa, ...m } = a;
    const base = 'arte-' + String(i + 1).padStart(5, '0');
    m._mini = `imagens/${base}-mini.${miniatura.type.split('/')[1]}`;
    m._previa = `imagens/${base}.${previa.type.split('/')[1]}`;
    zip.file(m._mini, miniatura); zip.file(m._previa, previa);
    meta.push(m);
  });
  zip.file('catalogo.json', JSON.stringify({ versao: 1, criado: new Date().toISOString(), artes: meta }, null, 1));
  return zip.generateAsync({ type: 'blob', compression: 'STORE' }, m => progresso?.(m.percent));
}

export async function importarCatalogo(file) {
  const JSZip = await lib('jszip');
  const zip = await JSZip.loadAsync(file);
  const json = zip.file('catalogo.json');
  if (!json) throw new Error('Este arquivo não é uma cópia do catálogo.');
  const { artes } = JSON.parse(await json.async('string'));
  const tipo = n => (/webp$/.test(n) ? 'image/webp' : 'image/png');
  const lote = [];
  for (const m of artes) {
    const { _mini, _previa, ...a } = m;
    a.miniatura = new Blob([await zip.file(_mini).async('blob')], { type: tipo(_mini) });
    a.previa = new Blob([await zip.file(_previa).async('blob')], { type: tipo(_previa) });
    lote.push(a);
    if (lote.length >= 50) await DB.salvarVarios('artes', lote.splice(0));
  }
  if (lote.length) await DB.salvarVarios('artes', lote);
  limparUrls();
  return artes.length;
}
