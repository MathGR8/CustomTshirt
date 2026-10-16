/**
 * @module textoModule
 * @description Textos na camiseta (nome, frase, número).
 *
 * Responsabilidades:
 *  - Janela de texto: escrever, escolher a fonte, a cor, o contorno e o tamanho.
 *  - Transformar o texto numa imagem PNG transparente em alta resolução e
 *    colocar na camiseta como uma estampa (arrastar, tamanho, lado, PDF…).
 *  - Editar um texto já colocado (botão "Editar" da lista de estampas).
 *
 * As fontes vêm do Google Fonts (index.html).
 * Dependências: appState.js, noticeModule.js, pdfModule.js e stampModule.js (via window._modules).
 */

import { AppState } from '../core/appState.js';
import { NoticeModule } from '../ui/noticeModule.js';
import { Logger } from '../core/logger.js';

/** Fontes disponíveis (família do Google Fonts + peso). */
export const FONTES = [
  { id: 'Montserrat', nome: 'Moderna', peso: 800 },
  { id: 'Bebas Neue', nome: 'Alta', peso: 400 },
  { id: 'Anton', nome: 'Impacto', peso: 400 },
  { id: 'Oswald', nome: 'Condensada', peso: 700 },
  { id: 'Bangers', nome: 'Gibi', peso: 400 },
  { id: 'Permanent Marker', nome: 'Marcador', peso: 400 },
  { id: 'Pacifico', nome: 'Surf', peso: 400 },
  { id: 'Lobster', nome: 'Retrô', peso: 400 },
  { id: 'Dancing Script', nome: 'Manuscrita', peso: 700 },
  { id: 'Righteous', nome: 'Anos 70', peso: 400 },
  { id: 'Black Ops One', nome: 'Militar', peso: 400 },
  { id: 'Rye', nome: 'Velho Oeste', peso: 400 },
  { id: 'UnifrakturMaguntia', nome: 'Gótica', peso: 400 },
  { id: 'Metal Mania', nome: 'Metal', peso: 400 },
  { id: 'Creepster', nome: 'Terror', peso: 400 }
];

/** Cores das letras e do contorno. */
export const CORES_TEXTO = [
  ['Branco', '#ffffff'], ['Preto', '#111111'], ['Cinza', '#8c8c8c'], ['Vermelho', '#ED3051'],
  ['Vermelho escuro', '#b1001a'], ['Laranja', '#f57c00'], ['Amarelo', '#fbc02d'], ['Verde', '#2e7d32'],
  ['Azul', '#1565c0'], ['Azul claro', '#4fc3f7'], ['Roxo', '#7b1fa2'], ['Rosa', '#ec407a'], ['Dourado', '#c9a24a']
];

/** Tamanhos rápidos (largura do texto na camiseta, em cm). */
const TAMANHOS = [['Pequeno', 8], ['Médio', 15], ['Grande', 24], ['Enorme', 32]];

const fonte = id => FONTES.find(f => f.id === id) || FONTES[0];
const css = (f, px) => `${f.peso} ${px}px "${f.id}"`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Desenha o texto numa imagem PNG transparente (alta resolução). */
export async function desenharTexto(t) {
  const f = fonte(t.fonte);
  const linhas = String(t.texto || '').replace(/\r/g, '').split('\n').map(l => l.trimEnd());
  try { await document.fonts.load(css(f, 100), linhas.join(' ') || 'Aa'); } catch { /* usa a fonte reserva */ }
  const px = 320, alt = Math.round(px * 1.18);
  const medir = document.createElement('canvas').getContext('2d');
  medir.font = css(f, px);
  const larguras = linhas.map(l => medir.measureText(l || ' ').width);
  const borda = t.contorno ? Math.round(px * 0.09) : 0;
  const folga = Math.round(px * 0.2) + borda;
  const c = document.createElement('canvas');
  c.width = Math.ceil(Math.max(...larguras, px * 0.5) + folga * 2);
  c.height = Math.ceil(alt * linhas.length + folga * 2);
  const x = c.getContext('2d');
  x.font = css(f, px); x.textBaseline = 'middle'; x.lineJoin = 'round'; x.textAlign = 'center';
  linhas.forEach((l, i) => {
    const y = folga + alt * i + alt / 2;
    if (borda) { x.strokeStyle = t.corContorno || '#111111'; x.lineWidth = borda * 2; x.strokeText(l, c.width / 2, y); }
    x.fillStyle = t.cor || '#ffffff';
    x.fillText(l, c.width / 2, y);
  });
  const r = aparar(c);
  return { url: r.toDataURL('image/png'), w: r.width, h: r.height };
}

function aparar(src) {
  const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return src;
  const m = 10;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
  const c = document.createElement('canvas');
  c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
  c.getContext('2d').drawImage(src, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

let dlg = null;

/** Janela do texto. @returns {Promise<null|Object>} */
function janelaTexto(inicial = {}) {
  const corCamiseta = { Branco: '#fff', 'Cinza Mescla': '#c7c7c7' }[AppState.selectedColor] || '#1b1b1b';
  const clara = corCamiseta !== '#1b1b1b';
  const t = {
    texto: inicial.texto || '', fonte: inicial.fonte || FONTES[0].id,
    cor: inicial.cor || (clara ? '#111111' : '#ffffff'),
    contorno: !!inicial.contorno, corContorno: inicial.corContorno || (clara ? '#ffffff' : '#111111'),
    cm: inicial.texto ? null : 15
  };
  const editando = !!inicial.texto;
  dlg?.remove();
  dlg = document.createElement('dialog');
  dlg.className = 'contactDlg textoDlg';
  const cores = alvo => CORES_TEXTO.map(([n, h]) => `<button type="button" class="txtCor" data-alvo="${alvo}" data-hex="${h}" style="--c:${h}" aria-pressed="${h === t[alvo]}" title="${n}" aria-label="${n}"></button>`).join('');
  dlg.innerHTML = `
    <div class="dlgHead"><strong>${editando ? '✏️ Editar texto' : 'Aa Adicionar texto'}</strong>
      <button type="button" class="dlgClose" data-fechar aria-label="Fechar">✕</button></div>
    <div class="dlgBody textoCorpo">
      <div class="txtPrevia" style="--fundo:${corCamiseta}"><div id="txtPreviaTexto">Digite seu texto</div></div>
      <label class="dlgLabel" for="txtCampo">Seu texto <span>(Enter = nova linha)</span></label>
      <textarea id="txtCampo" rows="2" maxlength="80" placeholder="Ex.: ArtRock 2026">${esc(t.texto)}</textarea>
      <span class="dlgLabel">Fonte</span>
      <div class="txtFontes">${FONTES.map(f => `<button type="button" class="txtFonte" data-fonte="${esc(f.id)}" aria-pressed="${f.id === t.fonte}" style="font-family:'${f.id}';font-weight:${f.peso}"><span>Aa</span><small>${f.nome}</small></button>`).join('')}</div>
      <span class="dlgLabel">Cor das letras</span>
      <div class="txtCores">${cores('cor')}</div>
      <label class="txtCheck"><input type="checkbox" id="txtContorno" ${t.contorno ? 'checked' : ''}> Contorno (borda em volta das letras)</label>
      <div class="txtCores" id="txtCoresContorno" ${t.contorno ? '' : 'hidden'}>${cores('corContorno')}</div>
      ${editando ? '' : `<span class="dlgLabel">Tamanho <span>(dá para ajustar depois)</span></span>
      <div class="txtTamanhos">${TAMANHOS.map(([n, cm]) => `<button type="button" data-cm="${cm}" aria-pressed="${cm === 15}">${n}<small>${cm} cm</small></button>`).join('')}</div>`}
      <button type="button" class="btn-dark txtOk" id="txtOk">${editando ? '✓ Salvar texto' : '✓ Colocar na camiseta'}</button>
    </div>`;
  document.body.appendChild(dlg);
  const caixa = dlg;
  const $ = s => caixa.querySelector(s);
  const previa = () => {
    const p = $('#txtPreviaTexto'), f = fonte(t.fonte);
    p.textContent = t.texto || 'Digite seu texto';
    p.style.fontFamily = `"${f.id}"`; p.style.fontWeight = f.peso; p.style.color = t.cor;
    p.style.opacity = t.texto ? 1 : 0.45;
    p.style.webkitTextStroke = t.contorno ? `0.06em ${t.corContorno}` : '0';
    p.style.paintOrder = 'stroke fill';
  };
  return new Promise(ok => {
    let resultado = null;
    $('#txtCampo').oninput = e => { t.texto = e.target.value; previa(); };
    dlg.querySelectorAll('[data-fonte]').forEach(b => (b.onclick = () => {
      t.fonte = b.dataset.fonte;
      dlg.querySelectorAll('[data-fonte]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      previa();
    }));
    dlg.querySelectorAll('.txtCor').forEach(b => (b.onclick = () => {
      t[b.dataset.alvo] = b.dataset.hex;
      dlg.querySelectorAll(`.txtCor[data-alvo="${b.dataset.alvo}"]`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      previa();
    }));
    $('#txtContorno').onchange = e => { t.contorno = e.target.checked; $('#txtCoresContorno').hidden = !t.contorno; previa(); };
    dlg.querySelectorAll('[data-cm]').forEach(b => (b.onclick = () => {
      t.cm = +b.dataset.cm;
      dlg.querySelectorAll('[data-cm]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }));
    $('#txtOk').onclick = () => {
      if (!t.texto.trim()) { NoticeModule.show('error', 'Digite o texto primeiro.'); $('#txtCampo').focus(); return; }
      resultado = { ...t, texto: t.texto.trim() };
      dlg.close();
    };
    dlg.querySelector('[data-fechar]').onclick = () => dlg.close();
    caixa.addEventListener('close', () => { ok(resultado); caixa.remove(); if (dlg === caixa) dlg = null; }, { once: true });
    previa();
    dlg.showModal();
    setTimeout(() => $('#txtCampo')?.focus(), 80);
  });
}

const nomeDoTexto = txt => `Texto "${txt.replace(/\s+/g, ' ').slice(0, 24)}${txt.length > 24 ? '…' : ''}"`;

export const TextoModule = {
  /** Abre a janela e coloca um texto novo na camiseta (no lado que está na tela). */
  async adicionar() {
    const r = await janelaTexto();
    if (!r) return;
    const { PDFModule, StampModule } = window._modules || {};
    try {
      const img = await desenharTexto(r);
      const normalized = { name: nomeDoTexto(r.texto), sourceType: 'texto', dataURL: img.url, previewDataURL: img.url, pdfRenderDataURL: img.url, width: img.w, height: img.h };
      const stamp = await PDFModule.createStampFromFile(null, { side: AppState.currentView || 'Frente', cm: r.cm || 15, name: normalized.name, normalized });
      Object.assign(stamp, { tipo: 'texto', texto: r.texto, fonte: r.fonte, cor: r.cor, contorno: r.contorno, corContorno: r.corContorno });
      await StampModule._colocarNova(stamp, null);
      NoticeModule.show('success', 'Texto colocado. Arraste para mudar o lugar e ajuste o tamanho na lista de estampas.');
    } catch (e) {
      Logger.error('IMAGE', 'Erro ao criar texto: ' + e.message, e);
      NoticeModule.show('error', 'Não foi possível criar o texto: ' + e.message);
    }
  },

  /** Edita um texto já colocado (mantém lado, tamanho e posição). */
  async editar(id) {
    const s = AppState.stamps.find(x => x.id === id);
    if (!s || s.tipo !== 'texto') return;
    const r = await janelaTexto(s);
    if (!r) return;
    const img = await desenharTexto(r);
    Object.assign(s, {
      texto: r.texto, fonte: r.fonte, cor: r.cor, contorno: r.contorno, corContorno: r.corContorno,
      name: nomeDoTexto(r.texto), dataURL: img.url, previewDataURL: img.url, pdfRenderDataURL: img.url, width: img.w, height: img.h
    });
    const { StampModule, HistoryModule } = window._modules || {};
    s.node.src = img.url;
    s.node.alt = s.name;
    await s.node.decode().catch(() => {});
    StampModule.applyStampCmToNode(s, { manterCentro: true });
    StampModule.renderStampsList();
    HistoryModule?.commit('texto-' + s.id);
    NoticeModule.show('success', 'Texto atualizado.');
  }
};
