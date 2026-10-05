/**
 * @module editModule
 * @description Editor de imagem da estampa (janela "Editar").
 *
 * Ferramentas:
 *  - Girar 90° (esq./dir.), girar em ângulo livre e espelhar (horizontal/vertical)
 *  - Recortar (arrastando sobre a imagem) e aparar bordas transparentes
 *  - Cor: preto e branco, inverter, pintar com uma cor única,
 *         brilho / contraste / saturação
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

/** Aplica uma função a cada pixel visível (alpha > 0), devolvendo um novo canvas. */
function porPixel(src, fn) {
  const c = clonar(src), x = c.getContext('2d');
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) if (p[i + 3] !== 0) fn(p, i);
  x.putImageData(d, 0, 0);
  return c;
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
  pretoBranco: src => porPixel(src, (p, i) => {
    p[i] = p[i + 1] = p[i + 2] = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
  }),
  inverter: src => porPixel(src, (p, i) => {
    p[i] = 255 - p[i]; p[i + 1] = 255 - p[i + 1]; p[i + 2] = 255 - p[i + 2];
  }),
  // Pinta todos os pixels visíveis com uma cor, mantendo a transparência
  pintar(src, hex) {
    const { r, g, b } = Utils.hexToRgb(hex);
    return porPixel(src, (p, i) => { p[i] = r; p[i + 1] = g; p[i + 2] = b; });
  },
  // Brilho, contraste e saturação (1 = sem alteração), mesma ordem do filtro CSS da prévia
  ajustar(src, br, ct, sat) {
    return porPixel(src, (p, i) => {
      const v = [0, 1, 2].map(k => lim(((p[i + k] * br) - 128) * ct + 128, 0, 255));
      const g = 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2];
      for (let k = 0; k < 3; k++) p[i + k] = lim(g + (v[k] - g) * sat, 0, 255);
    });
  }
};

// ---------- Interface ----------

const HTML = `
<div class="editHead"><strong>Editar estampa</strong><span id="editInfo"></span></div>
<div class="editBody">
  <div class="editStage"><div class="editWrap" id="editWrap"><canvas id="editCanvas"></canvas><div id="editSel"></div></div></div>
  <div class="editTools">
    <fieldset><legend>Girar e espelhar</legend>
      <div class="editRow">
        <button type="button" data-op="g-90">⟲ 90°</button><button type="button" data-op="g90">⟳ 90°</button>
        <button type="button" data-op="eh">⇋ Horizontal</button><button type="button" data-op="ev">⇅ Vertical</button>
      </div>
      <div class="editRow"><label>Ângulo <input type="number" id="editAngulo" value="15" min="-360" max="360"> °</label>
        <button type="button" data-op="gl">Girar</button></div>
    </fieldset>
    <fieldset><legend>Recorte</legend>
      <p class="editHint">Arraste sobre a imagem para escolher a área.</p>
      <div class="editRow"><button type="button" data-op="rec">Aplicar corte</button>
        <button type="button" data-op="apar">Aparar transparência</button></div>
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
  <button type="button" data-op="cancel" class="btn-outline">Cancelar</button>
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

  // Seleção do recorte arrastando (mouse ou toque)
  const wrap = $('editWrap'), cv = $('editCanvas');
  const pt = e => {
    const r = cv.getBoundingClientRect();
    return { x: lim((e.clientX - r.left) * cv.width / r.width, 0, cv.width),
             y: lim((e.clientY - r.top) * cv.height / r.height, 0, cv.height) };
  };
  wrap.addEventListener('pointerdown', e => { ed.ini = pt(e); ed.crop = null; wrap.setPointerCapture(e.pointerId); });
  wrap.addEventListener('pointermove', e => {
    if (!ed.ini) return;
    const p = pt(e);
    ed.crop = { x: Math.min(ed.ini.x, p.x), y: Math.min(ed.ini.y, p.y),
                w: Math.abs(p.x - ed.ini.x), h: Math.abs(p.y - ed.ini.y) };
    mostrarSelecao();
  });
  wrap.addEventListener('pointerup', () => {
    ed.ini = null;
    if (ed.crop && (ed.crop.w < 4 || ed.crop.h < 4)) { ed.crop = null; mostrarSelecao(); }
  });
  return dlg;
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

/** Guarda o canvas atual para "desfazer" e passa a trabalhar no novo. */
function aplicar(novo, manterGiro = false) {
  ed.undo.push(ed.work);
  if (ed.undo.length > MAX_UNDO) ed.undo.shift();
  ed.work = novo;
  ed.crop = null;
  if (!manterGiro) ed.giro = null; // outra ferramenta: o próximo giro parte da imagem atual
  desenhar();
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
        if (!ed.crop) return NoticeModule.show('info', 'Arraste sobre a imagem para escolher a área do corte.');
        return aplicar(Ops.recortar(w, ed.crop));
      case 'apar': return aplicar(Ops.aparar(w));
      case 'pb':   return aplicar(Ops.pretoBranco(w));
      case 'inv':  return aplicar(Ops.inverter(w));
      case 'pin':  return aplicar(Ops.pintar(w, $('editCor').value));
      case 'aj':   return aplicar(Ops.ajustar(w, +$('editBr').value, +$('editCt').value, +$('editSa').value));
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
