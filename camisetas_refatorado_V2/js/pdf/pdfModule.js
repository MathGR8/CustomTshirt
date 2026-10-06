/**
 * @module pdfModule
 * @description Gerencia a geração do PDF do pedido e o processamento de arquivos de estampa.
 *
 * Responsabilidades:
 *  - Detectar o tipo de arquivo de estampa (PNG, JPG, SVG, PDF).
 *  - Normalizar qualquer arquivo de estampa para um dataURL PNG utilizável.
 *  - Rasterizar arquivos SVG para PNG via canvas.
 *  - Converter a primeira página de um PDF para PNG via PDF.js (com fundo transparente para vetores).
 *  - Criar o objeto de estampa completo a partir de um arquivo.
 *  - Aplicar a cor da camiseta na imagem base via canvas (tinting).
 *  - Calcular o retângulo de impressão no PDF.
 *  - Construir o PDF completo do pedido (buildPDF).
 *  - Renderizar 2 páginas por item: visual + detalhes (renderItemPages).
 *  - Gerar e baixar o PDF (gerarPDF).
 *  - Enviar o PDF para o backend via WhatsApp (sendWhatsApp).
 *
 * Dependências: appState.js, constants.js, logger.js, helpers.js,
 *               noticeModule.js, dragModule.js.
 * Módulos relacionados: stampModule.js, orderModule.js.
 *
 * Observação:
 *  Depende das bibliotecas externas jsPDF (window.jspdf) e PDF.js (window.pdfjsLib),
 *  carregadas via CDN no HTML. Não utiliza bundler.
 */

import { AppState } from '../core/appState.js';
import { SHIRT_PRINT_BOX, PDF_BASES, COLOR_BASE_MAP, COLOR_HEX, PDF_LAYOUT } from '../core/constants.js';
import { Logger } from '../core/logger.js';
import { Utils } from '../utils/helpers.js';
import { NoticeModule } from '../ui/noticeModule.js';
import { DragModule } from '../events/dragModule.js';
import { UIModule } from '../ui/uiModule.js';
import { ContactModule } from '../ui/contactModule.js';

export const PDFModule = {

  // ----------------------------------------------------------
  //  detectFileType(file)
  //  Retorna o tipo normalizado: 'png', 'jpg', 'svg', 'pdf' ou 'unknown'
  // ----------------------------------------------------------
  /**
   * Detecta o tipo de arquivo de estampa com base na extensão e MIME type.
   * @param {File} file - Arquivo de estampa.
   * @returns {'png'|'jpg'|'svg'|'pdf'|'unknown'} Tipo normalizado do arquivo.
   */
  detectFileType(file) {
    const name = (file.name || '').toLowerCase();
    const ext  = name.split('.').pop() || '';
    const mime = (file.type || '').toLowerCase();

    if (ext === 'png'  || mime === 'image/png')       return 'png';
    if (ext === 'jpg'  || ext === 'jpeg' || mime === 'image/jpeg') return 'jpg';
    if (ext === 'svg'  || mime === 'image/svg+xml')   return 'svg';
    if (ext === 'pdf'  || mime === 'application/pdf') return 'pdf';
    return 'unknown';
  },

  // ----------------------------------------------------------
  //  fileToDataURL(file)
  //  Converte qualquer File em dataURL via FileReader
  // ----------------------------------------------------------
  /**
   * Converte um arquivo para dataURL usando FileReader.
   * @param {File} file - Arquivo a ser convertido.
   * @returns {Promise<string>} Promise que resolve com o dataURL.
   */
  fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
      reader.readAsDataURL(file);
    });
  },

  // ----------------------------------------------------------
  //  rasterizeSvgFile(file, options = {})
  //  Converte SVG para PNG raster via canvas
  //  Retorna { dataURL, width, height }
  // ----------------------------------------------------------
  /**
   * Rasteriza um arquivo SVG para PNG via canvas.
   * Tenta extrair dimensões do SVG; usa fallback de 1000x1000 se necessário.
   * Mantém fundo transparente.
   * @param {File} file - Arquivo SVG.
   * @param {{ scale?: number }} [options={}] - Opções de rasterização.
   * @param {number} [options.scale=2] - Fator de escala para a rasterização.
   * @returns {Promise<{ dataURL: string, width: number, height: number }>}
   */
  async rasterizeSvgFile(file, options = {}) {
    const scale  = options.scale || 2;
    const dataURL = await this.fileToDataURL(file);
    const img    = await Utils.loadImage(dataURL);

    let w = img.naturalWidth  || img.width  || 0;
    let h = img.naturalHeight || img.height || 0;

    // Se não obteve dimensões, tenta extrair do próprio SVG
    if (!w || !h) {
      try {
        const text   = await file.text();
        const parser = new DOMParser();
        const doc    = parser.parseFromString(text, 'image/svg+xml');
        const svgEl  = doc.querySelector('svg');
        if (svgEl) {
          if (svgEl.hasAttribute('width') && svgEl.hasAttribute('height')) {
            w = parseFloat(svgEl.getAttribute('width'))  || 0;
            h = parseFloat(svgEl.getAttribute('height')) || 0;
          }
          if ((!w || !h) && svgEl.hasAttribute('viewBox')) {
            const vb = svgEl.getAttribute('viewBox').split(/[\s,]+/);
            w = parseFloat(vb[2]) || 0;
            h = parseFloat(vb[3]) || 0;
          }
        }
      } catch (e) {
        Logger.warn('IMAGE', 'Não foi possível extrair dimensões do SVG.');
      }
    }

    // Fallback final
    if (!w) w = 1000;
    if (!h) h = 1000;

    const canvasW = Math.round(w * scale);
    const canvasH = Math.round(h * scale);
    const canvas  = document.createElement('canvas');
    canvas.width  = canvasW;
    canvas.height = canvasH;
    // Fundo transparente por padrão
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    return { dataURL: canvas.toDataURL('image/png'), width: canvasW, height: canvasH };
  },

  // ----------------------------------------------------------
  //  convertPdfToImageDataURL(file, options = {})
  //  Converte a primeira página de um PDF para PNG via pdfjsLib
  //  Retorna { dataURL, width, height }
  // ----------------------------------------------------------
  /**
   * Converte a primeira página de um arquivo PDF para PNG via PDF.js.
   * Para vetores (PDF com elementos gráficos), renderiza com fundo transparente.
   * Para PDFs com conteúdo rasterizado, aplica a cor da camiseta como fundo.
   * @param {File} file - Arquivo PDF.
   * @param {{ scale?: number, transparent?: boolean }} [options={}] - Opções de renderização.
   * @param {number} [options.scale=3] - Fator de escala para a renderização.
   * @param {boolean} [options.transparent=false] - Se true, usa fundo transparente.
   * @returns {Promise<{ dataURL: string, width: number, height: number }>}
   */
  async convertPdfToImageDataURL(file, options = {}) {
    if (!window.pdfjsLib) {
      throw new Error(
        'pdfjsLib não está disponível. Inclua a biblioteca PDF.js (pdfjs-dist) no HTML para importar PDFs como estampa.'
      );
    }

    const scale       = options.scale || 3;
    const transparent = options.transparent !== undefined ? options.transparent : false;
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc      = await loadingTask.promise;
    const page        = await pdfDoc.getPage(1);
    const viewport    = page.getViewport({ scale });

    const canvas  = document.createElement("canvas");
    canvas.width  = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx     = canvas.getContext("2d");

    if (!transparent) {
      // Fundo igual à cor da camiseta selecionada
      const bgColor = COLOR_HEX[AppState.selectedColor] || COLOR_HEX[AppState.color] || "#ffffff";
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      // Fundo transparente
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({ canvasContext: ctx, viewport }).promise;
    // Libera a memória do documento PDF.js
    try { await pdfDoc.destroy(); } catch (_) { /* sem problema se falhar */ }

    return { dataURL: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  },

  // ----------------------------------------------------------
  //  normalizeStampFile(file)
  //  Normaliza qualquer arquivo de estampa para um objeto com dataURLs
  // ----------------------------------------------------------
  /**
   * Normaliza qualquer arquivo de estampa para um objeto padronizado com dataURLs.
   * PNG/JPG: usa a própria imagem. SVG: rasteriza com fundo transparente.
   * PDF: converte primeira página — tenta fundo transparente para vetores.
   * @param {File} file - Arquivo de estampa.
   * @returns {Promise<{ name: string, sourceType: string, dataURL: string, previewDataURL: string, pdfRenderDataURL: string, width: number, height: number }>}
   */
  async normalizeStampFile(file) {
    const type = this.detectFileType(file);
    const name = file.name || 'estampa';

    if (type === 'png' || type === 'jpg') {
      const dataURL = await this.fileToDataURL(file);
      const img     = await Utils.loadImage(dataURL);
      return {
        name, sourceType: type,
        dataURL, previewDataURL: dataURL, pdfRenderDataURL: dataURL,
        width: img.naturalWidth || 0, height: img.naturalHeight || 0
      };
    }

    if (type === 'svg') {
      const result = await this.rasterizeSvgFile(file);
      return {
        name, sourceType: 'svg',
        dataURL: result.dataURL, previewDataURL: result.dataURL, pdfRenderDataURL: result.dataURL,
        width: result.width, height: result.height
      };
    }

    if (type === 'pdf') {
      // Tenta renderizar com fundo transparente (ideal para PDFs vetoriais).
      // Se o PDF contiver apenas vetores, o transparente funciona perfeitamente.
      // Se o PDF tiver rasterização com fundo, o transparente revela o fundo padrão do PDF.
      const result = await this.convertPdfToImageDataURL(file, { scale: 3, transparent: true });
      return {
        name, sourceType: 'pdf',
        dataURL: result.dataURL, previewDataURL: result.dataURL, pdfRenderDataURL: result.dataURL,
        width: result.width, height: result.height
      };
    }

    throw new Error('Formato não suportado. Use PNG, JPG, JPEG, SVG ou PDF.');
  },

  // ----------------------------------------------------------
  //  createStampFromFile(file, extra = {})
  //  Cria objeto de estampa completo a partir de um arquivo
  // ----------------------------------------------------------
  /**
   * Cria o objeto de estampa completo (com nó DOM) a partir de um arquivo.
   * @param {File} file - Arquivo de estampa.
   * @param {{ side?: string, cm?: number, name?: string, hidden?: boolean }} [extra={}] - Configurações adicionais.
   * @returns {Promise<Object>} Objeto de estampa com id, dataURL, node, side, name, cm, hidden, rel.
   */
  async createStampFromFile(file, extra = {}) {
    const normalized = await this.normalizeStampFile(file);

    // ID único com Date.now + random (mantém compatibilidade com o original)
    const id    = 'st' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const cmRaw = extra.cm != null ? parseFloat(extra.cm) : 20;
    const cm    = Math.max(5, Math.min(cmRaw || 20, 38));
    const side  = extra.side   || 'Frente';
    const name  = extra.name   || normalized.name;
    const hidden = extra.hidden != null ? !!extra.hidden : false;

    // Cria o nó DOM da estampa (não anexa ao DOM aqui)
    const node = document.createElement('img');
    node.src = normalized.previewDataURL;
    node.alt = name;
    node.classList.add('artOverlay');
    node.style.cssText = 'position:absolute; transform:none; cursor:move; max-width:80%;';
    node.draggable = false;

    // Registra os listeners de drag compatíveis com DragModule
    node.addEventListener('mousedown',  DragModule.startDragGeneric.bind(DragModule));
    node.addEventListener('touchstart', DragModule.startDragTouchGeneric.bind(DragModule), { passive: false });

    Logger.info('IMAGE', `Estampa criada: ${name} (tipo: ${normalized.sourceType})`);

    return {
      id, dataURL: normalized.dataURL,
      previewDataURL: normalized.previewDataURL,
      pdfRenderDataURL: normalized.pdfRenderDataURL,
      width: normalized.width, height: normalized.height,
      side, name, cm, hidden, rel: null, node
    };
  },

  // ----------------------------------------------------------
  //  tintShirtForPDF(baseUrl, targetHex, baseKind)
  //  Aplica cor na camiseta base usando canvas
  // ----------------------------------------------------------
  /**
   * Aplica a cor da camiseta na imagem base via canvas (tinting).
   * Para camisetas escuras (black): usa 'screen'. Para claras (white): usa 'multiply'.
   * @param {string} baseUrl - URL da imagem base da camiseta.
   * @param {string} targetHex - Cor alvo em hexadecimal (#RRGGBB).
   * @param {'black'|'white'} baseKind - Tipo da base (escura ou clara).
   * @returns {Promise<string>} DataURL da imagem com a cor aplicada.
   */
  async tintShirtForPDF(baseUrl, targetHex, baseKind) {
    let base;
    try {
      base = await Utils.loadImage(baseUrl, true);
    } catch (e) {
      Logger.warn('PDF', `CORS falhou para ${baseUrl}, tentando sem CORS.`);
      base = await Utils.loadImage(baseUrl, false);
    }

    const w   = base.naturalWidth;
    const h   = base.naturalHeight;
    const c   = document.createElement('canvas');
    c.width   = w;
    c.height  = h;
    const ctx = c.getContext('2d');

    // Desenha a base para usar sua silhueta como máscara
    ctx.drawImage(base, 0, 0, w, h);

    // Preenche com a cor apenas onde a imagem base tem pixels
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = targetHex;
    ctx.fillRect(0, 0, w, h);

    // Reaplica a textura/detalhes da camiseta sobre a cor
    if (baseKind === 'black') {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.55;
    } else {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.85;
    }
    ctx.drawImage(base, 0, 0, w, h);

    // Restaura estado padrão
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    try {
      return c.toDataURL('image/png');
    } catch (err) {
      Logger.error('PDF', 'Erro Tainted Canvas: imagem sem CORS. Retornando URL original.', err);
      return baseUrl;
    }
  },

  // ----------------------------------------------------------
  //  getPdfShirtRect(ox, oy, drawW, drawH, view)
  //  Calcula o retângulo de área de impressão no PDF
  // ----------------------------------------------------------
  /**
   * Calcula o retângulo da área de impressão no PDF.
   * @param {number} ox - Posição X da camiseta no PDF (mm).
   * @param {number} oy - Posição Y da camiseta no PDF (mm).
   * @param {number} drawW - Largura da camiseta no PDF (mm).
   * @param {number} drawH - Altura da camiseta no PDF (mm).
   * @param {'Frente'|'Costas'} view - Lado da camiseta.
   * @returns {{ x: number, y: number, w: number, h: number }} Retângulo em mm.
   */
  getPdfShirtRect(ox, oy, drawW, drawH, view) {
    const side = (view === 'Costas') ? 'Costas' : 'Frente';
    const b    = SHIRT_PRINT_BOX[side];
    return {
      x: ox + b.x * drawW,
      y: oy + b.y * drawH,
      w: b.w * drawW,
      h: b.h * drawH
    };
  },

  // ----------------------------------------------------------
  //  fitInsideByRatio(boxW, boxH, ratio)
  //  Ajusta dimensões mantendo proporção dentro da caixa
  // ----------------------------------------------------------
  /**
   * Calcula as dimensões de um elemento para caber dentro de uma caixa mantendo o aspect ratio.
   * @param {number} boxW - Largura da caixa.
   * @param {number} boxH - Altura da caixa.
   * @param {number} ratio - Aspect ratio (largura/altura) do elemento.
   * @returns {{ w: number, h: number }} Dimensões ajustadas.
   */
  fitInsideByRatio(boxW, boxH, ratio) {
    let w = boxW, h = w / ratio;
    if (h > boxH) { h = boxH; w = h * ratio; }
    return { w, h };
  },

  // ----------------------------------------------------------
  //  buildPDF(opts = {})
  //  Constrói o PDF completo do pedido
  // ----------------------------------------------------------
  /**
   * Constrói o PDF completo do pedido, iterando sobre todos os itens salvos.
   * Cada item gera 2 páginas: visual (camiseta + estampas) + detalhes (tabelas).
   * @param {{ returnBlob?: boolean, filename?: string }} [opts={}] - Opções de saída.
   * @param {boolean} [opts.returnBlob=false] - Se true, retorna o PDF como Blob.
   * @param {string} [opts.filename='pedido-camiseta.pdf'] - Nome do arquivo PDF.
   * @returns {Promise<Blob|void>} Blob do PDF se returnBlob=true, senão faz download.
   */
  async buildPDF(opts = {}) {
    Logger.info('PDF', 'Iniciando geração do PDF...');
    const options = Object.assign({ returnBlob: false, filename: 'pedido-camiseta.pdf' }, opts);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });

    for (let i = 0; i < AppState.orderItems.length; i++) {
      if (i > 0) pdf.addPage();
      await this.renderItemPages(pdf, AppState.orderItems[i], i + 1);
    }

    Logger.info('PDF', 'PDF gerado com sucesso.');
    if (options.returnBlob) return pdf.output('blob');
    pdf.save(options.filename || 'pedido-camiseta.pdf');
  },

  // ----------------------------------------------------------
  //  _getBaseUrl(baseKind, category, side)
  //  Escolhe a imagem base do PDF. Categorias sem base própria
  //  (Infantil/Juvenil) usam a Masculina, como no preview.
  // ----------------------------------------------------------
  _getBaseUrl(baseKind, category, side) {
    const kinds = PDF_BASES[baseKind] || {};
    const cat   = kinds[category] || kinds.Masculina || {};
    return cat[side] || cat.Frente;
  },

  // ----------------------------------------------------------
  //  _boxToMm(box, bgX, bgY, bgW, bgH)
  //  Converte uma caixa em frações (PDF_LAYOUT) para milímetros na página.
  // ----------------------------------------------------------
  _boxToMm(box, bgX, bgY, bgW, bgH) {
    return { x: bgX + box.x * bgW, y: bgY + box.y * bgH, w: box.w * bgW, h: box.h * bgH };
  },

  // ----------------------------------------------------------
  //  _drawShirtSide(pdf, orderData, side, g)
  //  Desenha uma camiseta (cor + estampas + rótulo) dentro de uma caixa.
  //  g = { x, y, w, h, label } — caixa em mm. A camiseta é encaixada
  //  na caixa mantendo a proporção e fica centralizada nela.
  // ----------------------------------------------------------
  async _drawShirtSide(pdf, orderData, side, g) {
    const baseKind = COLOR_BASE_MAP[orderData.color] || 'white';
    const colorHex = COLOR_HEX[orderData.color] || '#000000';
    const baseUrl  = this._getBaseUrl(baseKind, orderData.category, side);
    const tinted   = await this.tintShirtForPDF(baseUrl, colorHex, baseKind);

    // Tamanho da camiseta mantendo a proporção
    const shirtImg   = await Utils.loadImage(tinted, false);
    const ratioShirt = (shirtImg.naturalWidth || 1000) / (shirtImg.naturalHeight || 1000);
    let drawW = g.w;
    let drawH = drawW / ratioShirt;
    if (drawH > g.h) { drawH = g.h; drawW = drawH * ratioShirt; }
    // Alinhamento dentro da caixa: 'start' (esq./topo), 'end' (dir./base), centro
    // ou um número de 0 (esq./topo) a 1 (dir./base)
    const al = a => (typeof a === 'number' ? Math.max(0, Math.min(1, a)) : a === 'start' ? 0 : a === 'end' ? 1 : 0.5);
    const ox = g.x + (g.w - drawW) * al(g.alignX);
    const oy = g.y + (g.h - drawH) * al(g.alignY);
    pdf.addImage(tinted, 'PNG', ox, oy, drawW, drawH);

    // Estampas visíveis deste lado, posicionadas pela posição relativa (rel)
    const pdfRect = this.getPdfShirtRect(ox, oy, drawW, drawH, side);
    for (const s of orderData.stamps.filter(x => !x.hidden && x.side === side)) {
      if (!s.rel) continue;
      const src = s.pdfRenderDataURL || s.previewDataURL || s.dataURL;
      try {
        const img = await Utils.loadImage(src);
        const fit = this.fitInsideByRatio(s.rel.rw * pdfRect.w, s.rel.rh * pdfRect.h, img.naturalWidth / img.naturalHeight);
        const cx  = pdfRect.x + (s.rel.rx + s.rel.rw / 2) * pdfRect.w;
        const cy  = pdfRect.y + (s.rel.ry + s.rel.rh / 2) * pdfRect.h;
        pdf.addImage(src, 'PNG', cx - fit.w / 2, cy - fit.h / 2, fit.w, fit.h);
      } catch (e) {
        Logger.warn('PDF', `Erro ao renderizar estampa "${s.name}" no PDF: ${e.message}`);
      }
    }

    // Rótulo acima da camiseta
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text(g.label, ox, oy - 2);
  },

  // ----------------------------------------------------------
  //  renderItemPages(pdf, orderData, itemNum)
  //  Renderiza 2 páginas por item: visual + detalhes
  // ----------------------------------------------------------
  /**
   * Renderiza as 2 páginas de um item do pedido no PDF.
   *
   * Layout da página 1 (visual):
   *  - Frente no topo à esquerda.
   *  - Costas abaixo e à direita (quando ambos existem).
   *  - Miniaturas adaptativas conforme quantidade de estampas.
   *
   * Página 2: tabelas de detalhes (propriedades, tamanhos, estampas).
   *
   * @param {Object} pdf - Instância do jsPDF.
   * @param {Object} orderData - Dados do item do pedido.
   * @param {number} itemNum - Número do item (1-based).
   */
  async renderItemPages(pdf, orderData, itemNum) {
    const LAYOUT_BG  = 'https://cdn.awsli.com.br/1274/1274265/arquivos/layout-base-final-3.png';
    const colorHex   = COLOR_HEX[orderData.color] || '#000000';
    const QUAD       = PDF_LAYOUT.THUMBS.area; // área dos quadrados das estampas (ver constants.js)

    const pageW  = pdf.internal.pageSize.getWidth();
    const pageH  = pdf.internal.pageSize.getHeight();
    const margin = 8;

    // ===== Fundo do layout =====
    const layoutImg = await Utils.loadImage(LAYOUT_BG, true);
    let bgW = pageW - 2 * margin;
    let bgH = (bgW / layoutImg.naturalWidth) * layoutImg.naturalHeight;
    if (bgH > pageH - 2 * margin) {
      bgH = pageH - 2 * margin;
      bgW = (bgH / layoutImg.naturalHeight) * layoutImg.naturalWidth;
    }
    const bgX = (pageW - bgW) / 2;
    const bgY = (pageH - bgH) / 2;

    const bgCanvas = document.createElement('canvas');
    bgCanvas.width  = layoutImg.naturalWidth;
    bgCanvas.height = layoutImg.naturalHeight;
    bgCanvas.getContext('2d').drawImage(layoutImg, 0, 0);
    pdf.addImage(bgCanvas.toDataURL('image/png'), 'PNG', bgX, bgY, bgW, bgH);

    // Identificação do item no topo
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    const nome = (orderData.name || '').trim();
    pdf.text('ITEM #' + itemNum + (nome ? ' - ' + nome : '') + ' - ' + orderData.category + ' (' + orderData.color + ')', bgX + 0, bgY + 0);

    const qx = bgX + QUAD.x * bgW;
    const qy = bgY + QUAD.y * bgH;
    const qw = QUAD.w * bgW;
    const qh = QUAD.h * bgH;

    const usedSides = ['Frente', 'Costas'].filter(side =>
      orderData.stamps.some(s => !s.hidden && s.side === side)
    );
    const numSides = usedSides.length || 1;

    // ============================================================
    //  Camisetas: distribuídas dentro de PDF_LAYOUT.SHIRTS.area
    //  - 2 faces → diagonal (Frente no topo-esquerda, Costas embaixo-direita)
    //  - 1 face  → centralizada na área
    // ============================================================
    // Padrão + ajustes da categoria (PDF_LAYOUT.SHIRTS.CATEGORIAS, constants.js)
    const shirtsCfg = { ...PDF_LAYOUT.SHIRTS, ...(PDF_LAYOUT.SHIRTS.CATEGORIAS?.[orderData.category] || {}) };
    const area = this._boxToMm(shirtsCfg.area, bgX, bgY, bgW, bgH);

    if (numSides === 2) {
      const w = shirtsCfg.TWO.w * area.w;
      const h = shirtsCfg.TWO.h * area.h;
      // juntar (0 a 1): aproxima as duas camisetas (útil para as mais estreitas)
      const juntar = Math.max(0, Math.min(1, Number(shirtsCfg.juntar) || 0));
      await this._drawShirtSide(pdf, orderData, 'Frente', {
        x: area.x, y: area.y, w, h, alignX: juntar, alignY: 'start', label: 'FRENTE'
      });
      await this._drawShirtSide(pdf, orderData, 'Costas', {
        x: area.x + area.w - w, y: area.y + area.h - h, w, h, alignX: 1 - juntar, alignY: 'end', label: 'COSTAS'
      });
    } else {
      const side = usedSides[0] || 'Frente';
      const w = shirtsCfg.ONE.w * area.w;
      const h = shirtsCfg.ONE.h * area.h;
      await this._drawShirtSide(pdf, orderData, side, {
        x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h, label: side
      });
    }

    // ============================================================
    //  Miniaturas das estampas: sempre PREENCHEM toda a área
    //  PDF_LAYOUT.THUMBS.area, qualquer que seja a quantidade.
    //  A área é dividida em uma grade de colunas × linhas; escolhe-se a
    //  grade em que cada estampa fica MAIOR (testando todas as opções).
    //  As células esticam para ocupar a área inteira; a última linha,
    //  se incompleta, fica centralizada.
    // ============================================================
    const allVisible = orderData.stamps.filter(s => !s.hidden);
    const rgb        = Utils.hexToRgb(colorHex);

    if (allVisible.length > 0) {
      const n    = allVisible.length;
      const gapG = PDF_LAYOUT.THUMBS.gap * bgW;
      const imgs = [];
      for (const s of allVisible) {
        const src = s.pdfRenderDataURL || s.previewDataURL || s.dataURL;
        try { imgs.push({ s, src, im: await Utils.loadImage(src) }); }
        catch (e) { imgs.push({ s, src, im: null }); }
      }

      // Respiro entre a arte e a moldura (proporcional à célula)
      const respiro = (cw, ch) => Math.min(cw, ch) * 0.08;
      // Arte encaixada na célula mantendo a proporção (largura E altura aproveitadas)
      const encaixar = (cw, ch, r) => {
        const p = respiro(cw, ch);
        const iw = cw - 2 * p, ih = ch - 2 * p;
        const w = Math.min(iw, ih * r);
        return { w, h: w / r, p };
      };
      // Para cada grade possível, mede a menor arte desenhada e fica com a
      // grade em que ela é maior (desempate: maior área total)
      const ocupacao = (cw, ch) => imgs.reduce((acc, { im }) => {
        const r = im ? im.naturalWidth / im.naturalHeight : 1;
        const { w, h } = encaixar(cw, ch, r);
        return { min: Math.min(acc.min, w * h), soma: acc.soma + w * h };
      }, { min: Infinity, soma: 0 });
      let best = null;
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        if (c > 1 && (c - 1) * r >= n) continue; // coluna sobrando: grade inválida
        const cw = (qw - (c - 1) * gapG) / c;
        const ch = (qh - (r - 1) * gapG) / r;
        if (cw <= 0 || ch <= 0) continue;
        const score = ocupacao(cw, ch);
        if (!best || score.min > best.score.min * 1.001 ||
            (score.min > best.score.min * 0.999 && score.soma > best.score.soma)) {
          best = { cols: c, rows: r, cw, ch, score };
        }
      }
      const { cols, rows, cw: thumbW, ch: thumbH } = best;

      for (let i = 0; i < n; i++) {
        const { s, src: stampThumbSrc, im } = imgs[i];
        const row = Math.floor(i / cols);
        // Última linha incompleta: centraliza as células restantes
        const naLinha = row === rows - 1 ? n - row * cols : cols;
        const offX = (cols - naLinha) * (thumbW + gapG) / 2;
        const startX = qx + offX + (i % cols) * (thumbW + gapG);
        const startY = qy + row * (thumbH + gapG);

        try {
          if (!im) throw new Error('imagem não carregou');
          const r  = im.naturalWidth / im.naturalHeight;

          // A moldura acompanha a proporção da arte (altura e largura ajustadas)
          // e fica centralizada na célula
          const { w, h, p } = encaixar(thumbW, thumbH, r);
          const fw = w + 2 * p, fh = h + 2 * p;
          const fx = startX + (thumbW - fw) / 2;
          const fy = startY + (thumbH - fh) / 2;

          // Fundo com a cor da camiseta + moldura preta
          pdf.setFillColor(rgb.r, rgb.g, rgb.b);
          pdf.rect(fx, fy, fw, fh, 'F');
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.5);
          pdf.rect(fx, fy, fw, fh, 'S');

          pdf.addImage(stampThumbSrc, 'PNG', fx + p, fy + p, w, h);
        } catch (e) {
          Logger.warn('PDF', `Erro ao renderizar miniatura "${s.name}" no PDF: ${e.message}`);
        }
      }
    }

    // ===== Página 2 — Detalhes do item =====
    pdf.addPage();
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text('DETALHES DO ITEM #' + itemNum + (nome ? ' - ' + nome.toUpperCase() : ''), 10, 12);
    pdf.setDrawColor(200, 200, 200);
    pdf.line(10, 14, pageW - 10, 14);

    const nonZeroSizes  = Object.entries(orderData.quantities).filter(([sz, qty]) => qty > 0);
    const totalQty      = nonZeroSizes.reduce((sum, [sz, qty]) => sum + qty, 0);
    const usedSidesLabel = usedSides.join(', ') || '—';

    pdf.autoTable({
      startY: 18, margin: { left: 10 }, tableWidth: 100,
      head: [['PROPRIEDADE', 'VALOR']],
      body: [
        ['Categoria',          orderData.category],
        ['Malha',              orderData.fabric],
        ['Cor',                orderData.color],
        ['Lados com estampa',  usedSidesLabel],
        ['Total de Itens',     String(totalQty)]
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255] },
      theme: 'grid'
    });
    const finalY1 = pdf.lastAutoTable.finalY;

    if (nonZeroSizes.length) {
      pdf.autoTable({
        startY: 18, margin: { left: 115 }, tableWidth: 80,
        head: [['TAMANHO', 'QTD']],
        body: nonZeroSizes.map(([sz, qty]) => [sz, String(qty)]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255] },
        theme: 'grid'
      });
    }
    const finalY2  = pdf.lastAutoTable ? pdf.lastAutoTable.finalY : 18;
    let afterMeta  = Math.max(finalY1, finalY2) + 10;

    const stampRows = allVisible.map(s => [s.name || '(sem nome)', s.side, (s.cm || 0).toFixed(0) + ' cm']);
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text('ESTAMPAS', 10, afterMeta - 2);
    pdf.autoTable({
      startY: afterMeta,
      head: [['ESTAMPA', 'LADO', 'LARGURA']],
      body: stampRows.length ? stampRows : [['—', '—', '—']],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255] },
      theme: 'grid'
    });
  },

  // ----------------------------------------------------------
  //  gerarPDF()
  //  Gera e baixa o PDF do pedido atual
  // ----------------------------------------------------------
  /**
   * Gera e faz o download do PDF do pedido atual.
   * Desabilita o botão durante a geração e restaura ao finalizar.
   */
  async gerarPDF() {
    Logger.info('PDF', 'Gerando PDF do pedido...');
    const btnPdf = document.getElementById('btnGerarPdf');
    if (btnPdf) { btnPdf.disabled = true; btnPdf.textContent = '⏳ Gerando...'; }
    let pdfBlob = null;
    try {
      pdfBlob = await this.buildPDF({ returnBlob: true });
      ContactModule.baixarPdf(pdfBlob);
      Logger.info('PDF', 'PDF gerado e baixado com sucesso.');
    } catch (e) {
      Logger.error('PDF', 'Erro ao gerar PDF: ' + e.message, e);
      NoticeModule.show('error', 'Erro ao gerar o PDF: ' + e.message);
    } finally {
      if (btnPdf) {
        btnPdf.disabled = false;
        btnPdf.innerHTML = '📄 Gerar PDF do Pedido';
        UIModule.syncUiState();
      }
    }
    // Pronto: pergunta se o cliente quer falar com o atendimento (WhatsApp)
    if (pdfBlob) ContactModule.open(pdfBlob);
  },

  // ----------------------------------------------------------
  //  sendWhatsApp()
  //  Gera o PDF como blob e envia para o backend
  // ----------------------------------------------------------
  /**
   * Gera o PDF como Blob e envia para o endpoint /api/send-order.
   * Exibe notificação de sucesso ou erro conforme a resposta do servidor.
   */
  async sendWhatsApp() {
    Logger.info('PDF', 'Enviando PDF via WhatsApp...');
    const btnPdf = document.getElementById('btnGerarPdf');
    try {
      if (btnPdf) { btnPdf.disabled = true; btnPdf.textContent = '⏳ Enviando...'; }

      const pdfBlob = await this.buildPDF({ returnBlob: true, filename: 'pedido-camiseta.pdf' });

      const fd = new FormData();
      fd.append('pdf',   pdfBlob, 'pedido-camiseta.pdf');
      fd.append('order', JSON.stringify(AppState.orderItems));

      const resp = await fetch('/api/send-order', { method: 'POST', body: fd });
      const json = await resp.json();

      if (json.ok) {
        NoticeModule.show('success', 'Pedido enviado! O atendimento será notificado via WhatsApp.');
        Logger.info('PDF', 'PDF enviado com sucesso via WhatsApp.');
      } else {
        NoticeModule.show('error', 'Erro no envio: ' + (json.error || JSON.stringify(json)));
        Logger.error('PDF', 'Erro no envio: ' + JSON.stringify(json));
      }
    } catch (err) {
      Logger.error('PDF', 'Erro ao gerar/enviar PDF: ' + err.message, err);
      NoticeModule.show('error', 'Erro ao gerar/enviar PDF: ' + err.message);
    } finally {
      if (btnPdf) {
        btnPdf.disabled = false;
        btnPdf.innerHTML = '📄 Gerar PDF do Pedido';
        UIModule.syncUiState();
      }
    }
  }
};
