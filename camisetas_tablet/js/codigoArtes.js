/**
 * @module codigoArtes
 * @description PDF de catálogo com código em cima de cada arte.
 *
 * Formato (ex.: exportado do CorelDRAW): cada página tem uma ou mais artes
 * sobre um fundo de cor única, e em cima de cada arte um selo claro com o
 * código (ex.: "COD: ROCK-1").
 *
 *  - Acha os selos (retângulos brancos com texto dentro).
 *  - Cada selo define a área da sua arte (a coluna/linha da página onde ele está);
 *    a arte é recortada em volta do desenho, sem o selo e sem linhas de corte.
 *  - O fundo da página é a cor da camiseta: vira transparente ("cor para
 *    transparência"), então a arte fica igual sobre a camiseta dessa cor.
 *  - O código do selo é lido por OCR (Tesseract, carregado só na importação).
 */

const TESS = {
  script: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  worker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  core: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
  lang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'
};

function tela(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

// ---------- Selos ----------

/**
 * Acha os selos de código na página.
 * @param {HTMLCanvasElement} pag
 * @returns {null | {k: number, a: {w,h,p}, selos: {x0,y0,x1,y1}[]}} coordenadas da imagem de análise
 */
function acharSelos(pag) {
  const k = Math.min(1, 1400 / pag.width);
  const w = Math.round(pag.width * k), h = Math.round(pag.height * k);
  const c = tela(w, h), x = c.getContext('2d', { willReadFrequently: true });
  // Cópia com a transparência real (para achar a arte) e outra com o transparente
  // contando como branco (para achar os selos)
  x.drawImage(pag, 0, 0, w, h);
  const pr = x.getImageData(0, 0, w, h).data;
  x.globalCompositeOperation = 'destination-over';
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  const p = x.getImageData(0, 0, w, h).data, N = w * h;
  // Selo = retângulo branco com margem branca em volta do texto. Pode ser desenho
  // vetorial (branco puro) ou fazer parte da imagem JPG (branco com "chuviscos")
  const branco = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (p[i * 4] > 225 && p[i * 4 + 1] > 225 && p[i * 4 + 2] > 225) branco[i] = 1;
  let nb = 0; for (let i = 0; i < N; i++) nb += branco[i];
  if (nb > N * 0.5) return null; // página quase toda branca: não é este formato
  const b = (x, y) => branco[y * w + x] === 1;
  // Trechos brancos de cada linha (largura possível de um selo)
  const trechos = [];
  for (let y = 0; y < h; y++) {
    const l = [];
    for (let x = 0; x < w;) {
      if (!b(x, y)) { x++; continue; }
      const ini = x;
      // segue o branco, pulando falhas de até 2 px (ruído do JPG)
      while (x < w && (b(x, y) || (x + 2 < w && (b(x + 1, y) || b(x + 2, y))))) x++;
      while (x > ini && !b(x - 1, y)) x--;
      if (x - ini >= w * 0.03 && x - ini <= w * 0.45) l.push([ini, x - 1]);
    }
    trechos.push(l);
  }
  const igual = (l, a, z) => l.some(([c, d]) => Math.abs(c - a) <= 2 && Math.abs(d - z) <= 2);
  let cands = [];
  for (let y = 0; y < h - 2; y++) for (const [a, z] of trechos[y]) {
    if (y > 0 && igual(trechos[y - 1], a, z)) continue;  // não é o topo
    if (!igual(trechos[y + 1], a, z)) continue;           // topo com pelo menos 2 linhas brancas
    // Faixa branca de cima, linhas do texto, faixa branca de baixo. (O texto pode
    // encostar nas laterais do selo quando o código é comprido: GAME-100, FILME-102.)
    const fracao = r => { let n = 0; for (let xx = a; xx <= z; xx++) n += branco[r * w + xx]; return n / (z - a + 1); };
    let y1 = -1, viuTexto = false, falhas = 0;
    for (let yy = y + 1; yy < h && yy - y < h * 0.15; yy++) {
      const f = fracao(yy);
      if (f >= 0.85) { if (viuTexto) { y1 = yy; falhas = 0; } }
      else if (y1 >= 0) { if (f < 0.3 || ++falhas > 4) break; } // faixa de baixo com ruído do JPG
      else viuTexto = true;
    }
    if (y1 < 0) continue;
    const bw = z - a + 1, bh = y1 - y + 1;
    if (bh < h * 0.012 || bh > h * 0.14) continue;
    const asp = bw / bh;
    if (asp < 1.6 || asp > 12) continue;
    // Dentro, um pouco de texto
    let tinta = 0; for (let yy2 = y; yy2 <= y1; yy2++) for (let xx = a; xx <= z; xx++) tinta += 1 - branco[yy2 * w + xx];
    const t = tinta / (bw * bh);
    if (t < 0.03 || t > 0.55) continue;
    // Em volta (em cima e dos lados) é o fundo, não uma parte branca da arte
    // (embaixo a arte pode encostar no selo)
    let anel = 0, escuro = 0;
    for (let xx = a - 3; xx <= z + 3; xx++) { const yy2 = y - 3; if (xx >= 0 && xx < w && yy2 >= 0) { anel++; escuro += 1 - branco[yy2 * w + xx]; } }
    for (let yy2 = y; yy2 <= y1; yy2++) for (const xx of [a - 3, z + 3]) if (xx >= 0 && xx < w) { anel++; escuro += 1 - branco[yy2 * w + xx]; }
    if (anel && escuro / anel < 0.6) continue;
    cands.push({ x0: a, y0: y, x1: z, y1 });
  }
  // Sem repetidos (um dentro do outro): fica o maior
  cands.sort((m, n) => (n.x1 - n.x0) * (n.y1 - n.y0) - (m.x1 - m.x0) * (m.y1 - m.y0));
  const selos = [];
  for (const c of cands) if (!selos.some(s => c.x0 < s.x1 && c.x1 > s.x0 && c.y0 < s.y1 && c.y1 > s.y0)) selos.push(c);
  // Selos da mesma página têm a mesma altura (a dos maiores): descarta os menores,
  // que são pedaços brancos da arte
  if (selos.length > 1) {
    const maior = Math.max(...selos.map(s => s.y1 - s.y0));
    for (let i = selos.length - 1; i >= 0; i--) if (selos[i].y1 - selos[i].y0 < maior * 0.8) selos.splice(i, 1);
  }
  if (!selos.length) return null;
  return { k, a: { w, h, p: pr }, selos };
}

/** Divide a página em áreas (uma por selo): linhas e colunas pela posição dos selos. */
function areas(selos, w, h) {
  const ord = [...selos].sort((a, b) => a.y0 - b.y0);
  const linhas = [];
  for (const s of ord) {
    const l = linhas.find(l => Math.abs(l[0].y0 - s.y0) < h * 0.1);
    if (l) l.push(s); else linhas.push([s]);
  }
  const my = linhas[0][0].y0; // distância da borda de cima até os primeiros selos
  const out = [];
  linhas.forEach((l, li) => {
    l.sort((a, b) => a.x0 - b.x0);
    const top = li === 0 ? 0 : Math.max(0, l[0].y0 - my);
    const bot = li === linhas.length - 1 ? h : Math.max(top + 1, linhas[li + 1][0].y0 - my);
    const mx = l[0].x0; // distância da borda esquerda até o primeiro selo da linha
    l.forEach((s, ci) => {
      const esq = ci === 0 ? 0 : Math.max(0, s.x0 - mx);
      const dir = ci === l.length - 1 ? w : Math.max(esq + 1, l[ci + 1].x0 - mx);
      out.push({ selo: s, x0: esq, y0: top, x1: dir, y1: bot });
    });
  });
  return out;
}

/** Cor de fundo da área (a mais comum na borda dela). */
function corFundo(p, w, r, tudo = false) {
  const grupos = new Map();
  const conta = (x, y) => {
    const i = (y * w + x) * 4;
    const ch = (p[i] >> 3) << 10 | (p[i + 1] >> 3) << 5 | (p[i + 2] >> 3);
    const g = grupos.get(ch) || { n: 0, r: 0, g: 0, b: 0 };
    g.n++; g.r += p[i]; g.g += p[i + 1]; g.b += p[i + 2];
    grupos.set(ch, g);
  };
  if (tudo) { for (let y = r.y0; y < r.y1; y += 2) for (let x = r.x0; x < r.x1; x += 2) if (p[(y * w + x) * 4 + 3] > 200) conta(x, y); }
  else {
    for (let x = r.x0; x < r.x1; x++) { conta(x, r.y0); conta(x, r.y1 - 1); }
    for (let y = r.y0; y < r.y1; y++) { conta(r.x0, y); conta(r.x1 - 1, y); }
  }
  if (!grupos.size) return [0, 0, 0];
  const m = [...grupos.values()].reduce((a, b) => (b.n > a.n ? b : a));
  return [m.r / m.n, m.g / m.n, m.b / m.n];
}

/** É fundo? (perto da cor do fundo; num fundo escuro, tudo que for ainda mais escuro também) */
function ehFundo(r, g, b, fundo) {
  if (Math.hypot(r - fundo[0], g - fundo[1], b - fundo[2]) <= 40) return true;
  return lum(fundo) < 80 && r <= fundo[0] + 12 && g <= fundo[1] + 12 && b <= fundo[2] + 12;
}
const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

/** Retângulo do desenho dentro da área (sem o selo, sem linhas finas de corte). */
function caixaDaArte(a, r, selos, fundo) {
  const { w, p } = a;
  const W = r.x1 - r.x0, H = r.y1 - r.y0, N = W * H;
  const des = new Uint8Array(N);
  const margem = Math.round(Math.min(a.w, a.h) * 0.008);
  const dentroSelo = (x, y) => selos.some(s => x >= s.x0 - 2 && x <= s.x1 + 2 && y >= s.y0 - 2 && y <= s.y1 + 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = x + r.x0, Y = y + r.y0, i = (Y * w + X) * 4;
    if (dentroSelo(X, Y)) continue;
    if (X < margem || Y < margem || X >= a.w - margem || Y >= a.h - margem) continue; // moldura da página
    if (p[i + 3] >= 60 && !ehFundo(p[i], p[i + 1], p[i + 2], fundo)) des[y * W + x] = 1; // quase transparente = fundo
  }
  const rot = new Uint8Array(N), pilha = new Int32Array(N);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let s = 0; s < N; s++) {
    if (!des[s] || rot[s]) continue;
    let topo = 0, n = 0, a0 = W, b0 = H, a1 = -1, b1 = -1;
    pilha[topo++] = s; rot[s] = 1;
    while (topo) {
      const i = pilha[--topo], px = i % W, py = (i - px) / W;
      n++; if (px < a0) a0 = px; if (px > a1) a1 = px; if (py < b0) b0 = py; if (py > b1) b1 = py;
      // 8 vizinhos com folga de 2 px (junta pedaços próximos do desenho)
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const qx = px + dx, qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
        const q = qy * W + qx;
        if (des[q] && !rot[q]) { rot[q] = 1; pilha[topo++] = q; }
      }
    }
    const bw = a1 - a0 + 1, bh = b1 - b0 + 1;
    if (n < 25) continue;                                        // sujeira / pontinhos do pontilhado
    const fino = Math.max(4, Math.round(a.w * 0.006));
    if ((bw <= fino && bh > bw * 3) || (bh <= fino && bw > bh * 3)) continue; // linha de corte (tracejado/pontilhado)
    x0 = Math.min(x0, a0); y0 = Math.min(y0, b0); x1 = Math.max(x1, a1); y1 = Math.max(y1, b1);
  }
  if (x1 < 0) return null;
  const m = 3;
  return { x0: Math.max(r.x0, r.x0 + x0 - m), y0: Math.max(r.y0, r.y0 + y0 - m), x1: Math.min(r.x1, r.x0 + x1 + 1 + m), y1: Math.min(r.y1, r.y0 + y1 + 1 + m) };
}

/** Fundo (cor da camiseta) vira transparente sem perder os tons: igual sobre a camiseta dessa cor. */
function corParaTransparente(c, fundo) {
  const x = c.getContext('2d', { willReadFrequently: true });
  const img = x.getImageData(0, 0, c.width, c.height), p = img.data;
  const escuro = lum(fundo) < 80; // fundo escuro: o que é ainda mais escuro também some
  for (let i = 0; i < p.length; i += 4) {
    let al = 0;
    for (let k = 0; k < 3; k++) {
      const v = p[i + k], b = fundo[k];
      al = Math.max(al, v > b ? (v - b) / (255 - b || 1) : v < b && !escuro ? (b - v) / (b || 1) : 0);
    }
    if (al < 0.06) { p[i + 3] = 0; continue; } // ruído do JPG no fundo
    if (al < 1) for (let k = 0; k < 3; k++) p[i + k] = Math.max(0, Math.min(255, Math.round((p[i + k] - fundo[k]) / al + fundo[k])));
    p[i + 3] = Math.round(p[i + 3] * Math.min(1, al));
  }
  x.putImageData(img, 0, 0);
}

/** Selo pronto para o OCR: texto preto em fundo branco, ampliado. */
function imagemDoSelo(pag, s, k) {
  const X0 = s.x0 / k + 2, Y0 = s.y0 / k + 2, W = (s.x1 - s.x0 + 1) / k - 4, H = (s.y1 - s.y0 + 1) / k - 4;
  const z = Math.max(1, 80 / H);
  const c = tela(W * z + 40, H * z + 40), x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingQuality = 'high';
  x.drawImage(pag, X0, Y0, W, H, 20, 20, W * z, H * z);
  const img = x.getImageData(0, 0, c.width, c.height), p = img.data;
  for (let i = 0; i < p.length; i += 4) {
    const escuro = 255 - Math.min(p[i], p[i + 1], p[i + 2]) > 70 || Math.max(p[i], p[i + 1], p[i + 2]) - Math.min(p[i], p[i + 1], p[i + 2]) > 70;
    p[i] = p[i + 1] = p[i + 2] = escuro ? 0 : 255; p[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

/**
 * Separa as artes de uma página com selos de código.
 * @param {HTMLCanvasElement} pag - página renderizada
 * @returns {null | Array<{arte: HTMLCanvasElement, selo: HTMLCanvasElement, fundo: number[]}>}
 */
export function separarPorCodigo(pag) {
  const r = acharSelos(pag);
  if (!r) return null;
  const { k, a, selos } = r;
  const lista = [];
  for (const ar of areas(selos, a.w, a.h)) {
    // Fundo = cor que mais aparece na área (o fundo da imagem da arte, que pode
    // ser um "quase preto" diferente do preto da página)
    const fundo = corFundo(a.p, a.w, ar, true);
    const cx = caixaDaArte(a, ar, selos, fundo);
    if (!cx) continue;
    const X0 = Math.floor(cx.x0 / k), Y0 = Math.floor(cx.y0 / k), X1 = Math.ceil(cx.x1 / k), Y1 = Math.ceil(cx.y1 / k);
    const arte = tela(X1 - X0, Y1 - Y0);
    const ctx = arte.getContext('2d');
    ctx.drawImage(pag, X0, Y0, arte.width, arte.height, 0, 0, arte.width, arte.height);
    // Selos que caem dentro do recorte (a arte começa ao lado do selo): pinta com o fundo
    ctx.fillStyle = `rgb(${fundo.map(Math.round).join(',')})`;
    for (const s of selos) ctx.fillRect((s.x0 - 5) / k - X0, (s.y0 - 5) / k - Y0, (s.x1 - s.x0 + 11) / k, (s.y1 - s.y0 + 11) / k);
    corParaTransparente(arte, fundo);
    lista.push({ arte, selo: imagemDoSelo(pag, ar.selo, k), fundo });
  }
  return lista.length ? lista : null;
}

// ---------- Leitura do código (OCR) ----------

let ocr = null;
function carregarScript(src) {
  return new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = ok; s.onerror = () => erro(new Error('sem internet para ler os códigos'));
    document.head.appendChild(s);
  });
}

async function leitor() {
  if (!ocr) {
    ocr = (async () => {
      if (!window.Tesseract) await carregarScript(TESS.script);
      const w = await window.Tesseract.createWorker('eng', 1, { workerPath: TESS.worker, corePath: TESS.core, langPath: TESS.lang });
      await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_:. ', tessedit_pageseg_mode: '7' });
      return w;
    })().catch(e => { ocr = null; throw e; });
  }
  return ocr;
}

/** Limpa o texto lido: "COD: ROCK-1" → "ROCK-1". */
export function limparCodigo(txt) {
  let t = String(txt || '').toUpperCase().replace(/\s+/g, '');
  t = t.replace(/^C[O0]D(IGO)?[:.;]?/, '').replace(/^[:.\-_]+|[:.\-_]+$/g, '');
  if (!t) return '';
  // Depois do último hífen costuma ser número: O→0, I/L→1, S→5, B→8
  const m = t.match(/^(.*[-_])([A-Z0-9]+)$/);
  if (m && /\d/.test(m[2])) t = m[1].replace(/0/g, 'O') + m[2].replace(/O/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5').replace(/B/g, '8');
  return t;
}

/** Lê o código do selo. @returns {Promise<{codigo: string, confianca: number}>} */
export async function lerCodigo(selo) {
  const w = await leitor();
  const { data } = await w.recognize(selo);
  return { codigo: limparCodigo(data.text), confianca: data.confidence || 0 };
}

/** Fecha o leitor de códigos (libera a memória ao terminar a importação). */
export async function encerrarOcr() {
  if (!ocr) return;
  try { (await ocr).terminate(); } catch { /* ok */ }
  ocr = null;
}

/**
 * Completa códigos que não deu para ler, pela sequência (ROCK-4 → ROCK-5).
 * @param {Array<{codigo: string}>} itens - na ordem das páginas
 * @returns {number} quantos foram deduzidos
 */
export function completarSequencia(itens) {
  let deduzidos = 0;
  itens.forEach((it, i) => {
    if (it.codigo) return;
    const ant = itens.slice(0, i).reverse().find(x => x.codigo && /\d+$/.test(x.codigo));
    const prox = itens.slice(i + 1).find(x => x.codigo && /\d+$/.test(x.codigo));
    const base = ant || prox;
    if (!base) return;
    const [, pre, num] = base.codigo.match(/^(.*?)(\d+)$/);
    const n = ant ? +num + (i - itens.indexOf(ant)) : +num - (itens.indexOf(prox) - i);
    if (n < 0) return;
    it.codigo = pre + n; it.deduzido = true; deduzidos++;
  });
  return deduzidos;
}
