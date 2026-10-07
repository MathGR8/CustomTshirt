/**
 * @module artPickerModule
 * @description Janela "Escolha a arte" para PDFs com mais de uma arte.
 *
 * Quando o cliente envia um PDF com várias páginas (o mais comum: uma arte
 * por página, ex.: frente na 1ª e costas na 2ª), ou com várias artes
 * separadas numa página só, o site encontra cada arte e pergunta quais usar.
 * Cada arte escolhida vira uma estampa, já recortada.
 *  - Várias páginas: cada página é UMA arte (tudo o que está desenhado nela),
 *    todas já vêm marcadas e a opção "1ª na Frente, 2ª nas Costas" vem ligada.
 *  - Uma página só: as partes separadas viram artes diferentes.
 *
 * Como as artes são achadas: a página é reduzida, o fundo (transparente ou a
 * cor das bordas, ex.: branco) é ignorado e as partes desenhadas que ficam
 * perto umas das outras (até DISTANCIA_JUNTAR da página) são juntadas numa
 * arte só — assim um logo com o texto embaixo continua sendo uma arte.
 *
 * A estampa guarda a página e o recorte (stamp.pagina, stamp.recorteInicial)
 * para a versão em alta qualidade renderizar só esse pedaço do PDF.
 *
 * Dependências: noticeModule.js. PDFModule vem de window._modules.
 */

const LADO_ANALISE = 360;        // px do lado maior da página reduzida
const DISTANCIA_JUNTAR = 0.03;   // partes a menos de 3% da página viram a mesma arte
const AREA_MINIMA = 0.0015;      // ignora sujeiras menores que 0,15% da página
const MARGEM = 0.01;             // folga em volta de cada arte (1% da página)
const MAX_PAGINAS = 10;

/**
 * Acha as artes separadas numa página.
 * @param {HTMLCanvasElement} canvas - Página renderizada.
 * @returns {{x, y, w, h}[]} Retângulos em frações (0–1) da página.
 */
export function acharArtes(canvas) {
  const k = Math.min(1, LADO_ANALISE / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * k)), h = Math.max(1, Math.round(canvas.height * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(canvas, 0, 0, w, h);
  const p = x.getImageData(0, 0, w, h).data;

  // Cor do fundo: a mais comum nas bordas (quando elas são opacas, ex.: página branca)
  const borda = [];
  for (let i = 0; i < w; i++) borda.push(i, (h - 1) * w + i);
  for (let j = 1; j < h - 1; j++) borda.push(j * w, j * w + w - 1);
  const grupos = new Map();
  let opacos = 0;
  for (const i of borda) {
    const o = i * 4;
    if (p[o + 3] < 200) continue;
    opacos++;
    const chave = (p[o] >> 4) << 8 | (p[o + 1] >> 4) << 4 | (p[o + 2] >> 4);
    const g = grupos.get(chave) || { n: 0, r: 0, g: 0, b: 0 };
    g.n++; g.r += p[o]; g.g += p[o + 1]; g.b += p[o + 2];
    grupos.set(chave, g);
  }
  let fundo = null;
  if (opacos > borda.length / 2) {
    const m = [...grupos.values()].reduce((a, b) => (b.n > a.n ? b : a));
    fundo = [m.r / m.n, m.g / m.n, m.b / m.n];
  }

  // Máscara do que é desenho
  const N = w * h, desenho = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (p[o + 3] < 24) continue;
    if (fundo) {
      const dr = p[o] - fundo[0], dg = p[o + 1] - fundo[1], db = p[o + 2] - fundo[2];
      if (dr * dr + dg * dg + db * db < 60 * 60) continue;
    }
    desenho[i] = 1;
  }

  // "Engorda" o desenho para juntar partes próximas (máximo em caixa, separável)
  const R = Math.max(1, Math.round(DISTANCIA_JUNTAR * Math.max(w, h)));
  const tmp = new Uint8Array(N), junto = new Uint8Array(N);
  for (let j = 0; j < h; j++) {
    let ult = -1e9;
    for (let i = 0; i < w; i++) if (desenho[j * w + i]) { for (let a = Math.max(0, i - R, ult + 1); a <= Math.min(w - 1, i + R); a++) tmp[j * w + a] = 1; ult = Math.min(w - 1, i + R); }
  }
  for (let i = 0; i < w; i++) {
    let ult = -1e9;
    for (let j = 0; j < h; j++) if (tmp[j * w + i]) { for (let b = Math.max(0, j - R, ult + 1); b <= Math.min(h - 1, j + R); b++) junto[b * w + i] = 1; ult = Math.min(h - 1, j + R); }
  }

  // Regiões ligadas; a caixa de cada uma usa só os pixels de desenho (sem a "engorda")
  const rotulo = new Int32Array(N), caixas = [], pilha = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (!junto[s] || rotulo[s]) continue;
    const id = caixas.length + 1, cx = { x0: w, y0: h, x1: -1, y1: -1, n: 0 };
    let topo = 0;
    pilha[topo++] = s; rotulo[s] = id;
    while (topo) {
      const i = pilha[--topo], px = i % w, py = (i - px) / w;
      if (desenho[i]) {
        cx.n++;
        if (px < cx.x0) cx.x0 = px; if (px > cx.x1) cx.x1 = px;
        if (py < cx.y0) cx.y0 = py; if (py > cx.y1) cx.y1 = py;
      }
      if (px > 0 && junto[i - 1] && !rotulo[i - 1]) { rotulo[i - 1] = id; pilha[topo++] = i - 1; }
      if (px < w - 1 && junto[i + 1] && !rotulo[i + 1]) { rotulo[i + 1] = id; pilha[topo++] = i + 1; }
      if (py > 0 && junto[i - w] && !rotulo[i - w]) { rotulo[i - w] = id; pilha[topo++] = i - w; }
      if (py < h - 1 && junto[i + w] && !rotulo[i + w]) { rotulo[i + w] = id; pilha[topo++] = i + w; }
    }
    caixas.push(cx);
  }

  const lim = v => Math.max(0, Math.min(1, v));
  return caixas
    .filter(c => c.n >= AREA_MINIMA * N && c.x1 >= 0)
    .map(c => {
      const x0 = lim(c.x0 / w - MARGEM), y0 = lim(c.y0 / h - MARGEM);
      const x1 = lim((c.x1 + 1) / w + MARGEM), y1 = lim((c.y1 + 1) / h + MARGEM);
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    })
    // Ordem de leitura: de cima para baixo, da esquerda para a direita
    .sort((a, b) => (Math.abs(a.y - b.y) > 0.08 ? a.y - b.y : a.x - b.x));
}

/** Recorta o retângulo r (frações) de um canvas. */
function recortar(canvas, r) {
  const x = Math.round(r.x * canvas.width), y = Math.round(r.y * canvas.height);
  const w = Math.max(1, Math.round(r.w * canvas.width)), h = Math.max(1, Math.round(r.h * canvas.height));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return c;
}

let dlg = null;

/** Monta a janela (uma única vez). */
function montar() {
  if (dlg) return dlg;
  dlg = document.createElement('dialog');
  dlg.className = 'contactDlg pickDlg';
  dlg.innerHTML = `
    <div class="dlgHead"><strong>🎨 Escolha a arte</strong>
      <button type="button" class="dlgClose" data-pick="cancelar" aria-label="Fechar">✕</button></div>
    <div class="dlgBody">
      <p class="pickIntro" id="pickIntro"></p>
      <div class="pickGrid" id="pickGrid" role="group" aria-label="Artes encontradas"></div>
      <label class="pickLados" id="pickLadosBox" hidden>
        <input type="checkbox" id="pickLados" checked>
        <span>Colocar a 1ª arte na <b>Frente</b> e a 2ª nas <b>Costas</b></span>
      </label>
    </div>
    <div class="dlgFoot pickFoot">
      <button type="button" class="btn-outline" data-pick="inteiro" id="pickInteiro">Usar a página inteira</button>
      <span style="flex:1"></span>
      <button type="button" class="btn-outline" data-pick="todas">Selecionar todas</button>
      <button type="button" class="btn-dark" data-pick="ok" id="pickOk" disabled>Adicionar</button>
    </div>`;
  document.body.appendChild(dlg);
  return dlg;
}

export const ArtPickerModule = {
  /**
   * Se o PDF tiver mais de uma arte, pergunta quais usar.
   * @param {File} file - PDF enviado.
   * @returns {Promise<null | 'cancelar' | Array<{pagina, recorte, canvas, nome, lado}>>}
   *   lado = 'Frente' / 'Costas' quando o cliente pediu "1ª na Frente e 2ª nas Costas".
   *   null = só uma arte (segue o fluxo normal, página inteira);
   *   'cancelar' = o cliente fechou a janela; lista = artes escolhidas.
   */
  async talvezEscolher(file) {
    const { PDFModule } = window._modules || {};
    if (!PDFModule) return null;
    const { total, paginas } = await PDFModule.renderizarPaginas(file, { scale: 3, max: MAX_PAGINAS });

    const opcoes = [];
    paginas.forEach((pg, i) => {
      let artes = acharArtes(pg);
      // Várias páginas: a página inteira é uma arte (recortada em volta do desenho)
      if (paginas.length > 1 && artes.length > 1) {
        const x0 = Math.min(...artes.map(r => r.x)), y0 = Math.min(...artes.map(r => r.y));
        const x1 = Math.max(...artes.map(r => r.x + r.w)), y1 = Math.max(...artes.map(r => r.y + r.h));
        artes = [{ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }];
      }
      artes.forEach((r, j) => opcoes.push({
        pagina: i + 1, recorte: r, pg,
        rotulo: paginas.length > 1
          ? `Página ${i + 1}` + (artes.length > 1 ? ` · arte ${j + 1}` : '')
          : `Arte ${j + 1}`
      }));
    });
    if (opcoes.length <= 1) return null;

    const res = await this._janela(file, opcoes, total);
    if (!res || res === 'cancelar') return res;
    // "1ª na Frente e 2ª nas Costas": só com exatamente duas artes escolhidas
    const lados = res.frenteCostas && res.escolhidas.length === 2 ? ['Frente', 'Costas'] : [];
    return res.escolhidas.map((o, i) => ({
      pagina: o.pagina, recorte: o.recorte, canvas: recortar(o.pg, o.recorte), lado: lados[i] || null,
      nome: file.name.replace(/\.pdf$/i, '') + ` (${o.rotulo.toLowerCase()})`
    }));
  },

  /** Mostra a janela e espera a escolha. @private */
  _janela(file, opcoes, totalPaginas) {
    const d = montar();
    const grid = d.querySelector('#pickGrid'), ok = d.querySelector('#pickOk');
    const varias = new Set(opcoes.map(o => o.pagina)).size > 1;
    d.querySelector('#pickIntro').innerHTML =
      `Encontramos <b>${opcoes.length} artes</b> em "${file.name.replace(/</g, '&lt;')}"` +
      (totalPaginas > MAX_PAGINAS ? ` (mostrando as ${MAX_PAGINAS} primeiras páginas de ${totalPaginas})` : '') +
      '. Toque nas que quer usar — pode escolher mais de uma. Cada uma vira uma estampa.';
    d.querySelector('#pickInteiro').textContent = varias ? 'Usar a página 1 inteira' : 'Usar a página inteira';

    grid.innerHTML = '';
    // Várias páginas: normalmente o cliente quer todas (ex.: frente e costas)
    const marcadas = new Set(varias ? opcoes.map((_, i) => i) : []);
    const ladosBox = d.querySelector('#pickLadosBox'), lados = d.querySelector('#pickLados');
    lados.checked = true;
    const atualizar = () => {
      ok.disabled = !marcadas.size;
      ok.textContent = marcadas.size > 1 ? `Adicionar ${marcadas.size} artes` : 'Adicionar arte';
      ladosBox.hidden = marcadas.size !== 2; // só faz sentido com duas artes
      grid.querySelectorAll('.pickCard').forEach((b, i) => b.setAttribute('aria-pressed', String(marcadas.has(i))));
    };
    opcoes.forEach((o, i) => {
      const mini = recortar(o.pg, o.recorte);
      const k = Math.min(1, 240 / Math.max(mini.width, mini.height));
      const t = document.createElement('canvas');
      t.width = Math.max(1, Math.round(mini.width * k)); t.height = Math.max(1, Math.round(mini.height * k));
      t.getContext('2d').drawImage(mini, 0, 0, t.width, t.height);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pickCard';
      b.innerHTML = `<span class="pickThumb"><img alt="" src="${t.toDataURL('image/png')}"></span><span class="pickNome">${o.rotulo}</span><span class="pickCheck" aria-hidden="true">✓</span>`;
      b.onclick = () => { marcadas.has(i) ? marcadas.delete(i) : marcadas.add(i); atualizar(); };
      grid.appendChild(b);
    });
    atualizar();

    return new Promise(resolve => {
      const fim = v => { d.onclick = null; d.oncancel = null; if (d.open) d.close(); resolve(v); };
      d.onclick = e => {
        const act = e.target.closest('[data-pick]')?.dataset.pick;
        if (act === 'cancelar') fim('cancelar');
        else if (act === 'inteiro') fim(null);
        else if (act === 'todas') { opcoes.forEach((_, i) => marcadas.add(i)); atualizar(); }
        else if (act === 'ok' && marcadas.size) {
          fim({ escolhidas: [...marcadas].sort((a, b) => a - b).map(i => opcoes[i]), frenteCostas: lados.checked });
        }
      };
      d.oncancel = e => { e.preventDefault(); fim('cancelar'); };
      d.showModal();
    });
  }
};
