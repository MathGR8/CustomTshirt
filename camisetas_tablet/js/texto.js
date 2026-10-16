/**
 * @module texto
 * @description Textos na camiseta: fontes, cores, contorno e o editor (janela).
 *
 * O texto vira uma imagem PNG em alta resolução (com transparência) e é tratado
 * na camiseta como qualquer outra arte: arrastar, mudar o tamanho, desfazer.
 * As fontes vêm do Google Fonts (index.html) e ficam guardadas para usar offline.
 */

import { janela, esc, aviso } from './ui.js';
import { icone } from './icons.js';

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
  { id: 'UnifrakturMaguntia', nome: 'Gótica', peso: 400 }
];

/** Cores para o texto e o contorno. */
export const CORES_TEXTO = [
  ['Branco', '#ffffff'], ['Preto', '#111111'], ['Cinza', '#8c8c8c'], ['Vermelho', '#d32f2f'],
  ['Laranja', '#f57c00'], ['Amarelo', '#fbc02d'], ['Verde', '#2e7d32'], ['Azul', '#1565c0'],
  ['Azul claro', '#4fc3f7'], ['Roxo', '#7b1fa2'], ['Rosa', '#ec407a'], ['Dourado', '#c9a24a']
];

/** Tamanhos rápidos (largura do texto na camiseta, em cm). */
export const TAMANHOS_TEXTO = [['P', 'Pequeno', 8], ['M', 'Médio', 15], ['G', 'Grande', 24], ['GG', 'Enorme', 32]];

const fonte = id => FONTES.find(f => f.id === id) || FONTES[0];
const css = (f, px) => `${f.peso} ${px}px "${f.id}"`;

/** Garante que a fonte carregou antes de desenhar no canvas. */
async function carregarFonte(f, texto) {
  try { await document.fonts.load(css(f, 100), texto || 'Aa'); } catch { /* usa a fonte reserva */ }
}

/**
 * Desenha o texto numa imagem PNG transparente.
 * @param {{texto: string, fonte: string, cor: string, contorno: boolean, corContorno: string, alinhar?: string}} t
 * @param {{largura?: number}} [opc] - largura desejada em px (exportar em alta resolução)
 * @returns {Promise<{url: string, w: number, h: number}>}
 */
export async function desenharTexto(t, opc = {}) {
  const f = fonte(t.fonte);
  const linhas = String(t.texto || '').replace(/\r/g, '').split('\n').map(l => l.trimEnd());
  await carregarFonte(f, linhas.join(' '));
  const medir = document.createElement('canvas').getContext('2d');
  medir.font = css(f, 100);
  const base = Math.max(...linhas.map(l => medir.measureText(l || ' ').width), 50);
  // Prévia: letras de 320 px. Exportar: o tamanho pedido (máx. 9000 px de largura)
  let px = opc.largura ? Math.round(100 * opc.largura / base) : 320;
  px = Math.max(120, Math.min(px, Math.floor(100 * 9000 / (base * 1.5)), 2400));
  const alt = Math.round(px * 1.18);
  medir.font = css(f, px);
  const larguras = linhas.map(l => medir.measureText(l || ' ').width);
  const borda = t.contorno ? Math.round(px * 0.09) : 0;
  const folga = Math.round(px * 0.18) + borda;
  const c = document.createElement('canvas');
  c.width = Math.ceil(Math.max(...larguras, px * 0.5) + folga * 2);
  c.height = Math.ceil(alt * linhas.length + folga * 2);
  const x = c.getContext('2d');
  x.font = css(f, px);
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  const alinhar = t.alinhar || 'center';
  x.textAlign = alinhar;
  const px0 = alinhar === 'left' ? folga : alinhar === 'right' ? c.width - folga : c.width / 2;
  linhas.forEach((l, i) => {
    const y = folga + alt * i + alt / 2;
    if (borda) { x.strokeStyle = t.corContorno || '#111111'; x.lineWidth = borda * 2; x.strokeText(l, px0, y); }
    x.fillStyle = t.cor || '#ffffff';
    x.fillText(l, px0, y);
  });
  // Recorta as sobras (letras com acentos/descendentes já ficam dentro)
  const recorte = aparar(c);
  return { url: recorte.toDataURL('image/png'), w: recorte.width, h: recorte.height };
}

function aparar(src) {
  const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return src;
  const m = 8;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
  const c = document.createElement('canvas');
  c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
  c.getContext('2d').drawImage(src, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

/** Descrição curta do texto (pedido/PDF). */
export function descreverTexto(a) {
  const cor = CORES_TEXTO.find(c => c[1] === a.cor)?.[0] || a.cor;
  const cc = a.contorno ? `, contorno ${(CORES_TEXTO.find(c => c[1] === a.corContorno)?.[0] || a.corContorno).toLowerCase()}` : '';
  return `Fonte ${fonte(a.fonte).nome} (${a.fonte}) · ${cor.toLowerCase()}${cc}`;
}

/**
 * Editor de texto (janela).
 * @param {Object} inicial - texto existente (para editar) ou {}
 * @param {string} fundo - cor da camiseta (hex) para a prévia
 * @returns {Promise<null | {texto, fonte, cor, contorno, corContorno, alinhar, cmSugerido}>}
 */
export function editorTexto(inicial = {}, fundo = '#191919') {
  const escura = parseInt(fundo.slice(1, 3), 16) < 128;
  const t = {
    texto: inicial.texto || '', fonte: inicial.fonte || FONTES[0].id,
    cor: inicial.cor || (escura ? '#ffffff' : '#111111'),
    contorno: !!inicial.contorno, corContorno: inicial.corContorno || (escura ? '#111111' : '#ffffff'),
    alinhar: inicial.alinhar || 'center', cmSugerido: null
  };
  const editando = !!inicial.texto;
  const j = janela({ titulo: `${icone('editar')} ${editando ? 'Editar texto' : 'Adicionar texto'}`, classe: 'janelaTexto', html: `
    <div class="editorTexto">
      <div class="textoPrevia" style="--fundo:${fundo}"><div id="previaTexto" class="previaTexto">Digite seu texto</div></div>
      <div class="textoCampos">
        <label class="campoTexto"><span>Seu texto <small>(Enter = nova linha)</small></span>
          <textarea id="txtTexto" rows="2" maxlength="80" placeholder="Ex.: Família Silva 2026" autocapitalize="sentences">${esc(t.texto)}</textarea></label>
        <div class="rotuloLinha"><b>Fonte</b></div>
        <div class="gradeFontes" id="gradeFontes">${FONTES.map(f => `
          <button type="button" class="botaoFonte" data-fonte="${esc(f.id)}" aria-pressed="${f.id === t.fonte}" style="font-family:'${f.id}';font-weight:${f.peso}">
            <span class="amostra">Aa</span><small>${f.nome}</small></button>`).join('')}</div>
        <div class="rotuloLinha"><b>Cor das letras</b></div>
        <div class="coresTexto" data-alvo="cor">${CORES_TEXTO.map(([n, h]) => `<button type="button" class="corTexto" data-hex="${h}" style="--c:${h}" aria-pressed="${h === t.cor}" aria-label="${n}" title="${n}"></button>`).join('')}</div>
        <label class="checkLinha"><input type="checkbox" id="chkContorno" ${t.contorno ? 'checked' : ''}> <b>Contorno</b> (borda em volta das letras)</label>
        <div class="coresTexto" data-alvo="corContorno" ${t.contorno ? '' : 'hidden'}>${CORES_TEXTO.map(([n, h]) => `<button type="button" class="corTexto" data-hex="${h}" style="--c:${h}" aria-pressed="${h === t.corContorno}" aria-label="Contorno ${n}" title="${n}"></button>`).join('')}</div>
        ${editando ? '' : `<div class="rotuloLinha"><b>Tamanho</b> <small>(dá para ajustar depois)</small></div>
        <div class="chipsPos">${TAMANHOS_TEXTO.map(([k, n, cm]) => `<button type="button" class="chipPos" data-tam="${cm}" aria-pressed="${cm === 15}">${n}<small> ${cm} cm</small></button>`).join('')}</div>`}
        <button type="button" class="btn btnEscuro btnGrande btnLargo" id="okTexto">${icone('check')} ${editando ? 'Salvar texto' : 'Colocar na camiseta'}</button>
      </div>
    </div>` });
  t.cmSugerido = editando ? null : 15;
  const $ = s => j.el.querySelector(s);
  const previa = () => {
    const p = $('#previaTexto'), f = fonte(t.fonte);
    p.textContent = t.texto || 'Digite seu texto';
    p.style.fontFamily = `"${f.id}"`;
    p.style.fontWeight = f.peso;
    p.style.color = t.cor;
    p.style.opacity = t.texto ? 1 : 0.4;
    p.style.webkitTextStroke = t.contorno ? `0.06em ${t.corContorno}` : '0';
    p.style.paintOrder = 'stroke fill';
  };
  $('#txtTexto').oninput = e => { t.texto = e.target.value; previa(); };
  $('#gradeFontes').onclick = e => {
    const b = e.target.closest('[data-fonte]'); if (!b) return;
    t.fonte = b.dataset.fonte;
    j.el.querySelectorAll('[data-fonte]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    previa();
  };
  j.el.querySelectorAll('.coresTexto').forEach(g => (g.onclick = e => {
    const b = e.target.closest('[data-hex]'); if (!b) return;
    t[g.dataset.alvo] = b.dataset.hex;
    g.querySelectorAll('[data-hex]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    previa();
  }));
  $('#chkContorno').onchange = e => { t.contorno = e.target.checked; $('[data-alvo="corContorno"]').hidden = !t.contorno; previa(); };
  j.el.querySelectorAll('[data-tam]').forEach(b => (b.onclick = () => {
    t.cmSugerido = +b.dataset.tam;
    j.el.querySelectorAll('[data-tam]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $('#okTexto').onclick = () => {
    if (!t.texto.trim()) { aviso('Digite o texto primeiro.', 'erro'); $('#txtTexto').focus(); return; }
    j.fechar({ ...t, texto: t.texto.trim() });
  };
  previa();
  setTimeout(() => $('#txtTexto').focus(), 200);
  return j.aoFechar;
}
