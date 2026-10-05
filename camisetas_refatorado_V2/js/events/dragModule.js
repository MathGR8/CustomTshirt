/**
 * @module dragModule
 * @description Gerencia o arrasto (drag & drop) das estampas no preview.
 *
 * Responsabilidades:
 *  - Atualizar a posição de uma estampa no DOM durante o arrasto.
 *  - Iniciar o arrasto via mouse (mousedown) ou toque (touchstart).
 *  - Limitar o movimento da estampa dentro da área de impressão da camiseta.
 *
 * Dependências: appState.js, logger.js, previewGeometry.js.
 * Módulos relacionados: stampModule.js (que registra os listeners nos nodes de estampa).
 *
 * Observação:
 *  Os listeners globais de mousemove, touchmove, mouseup e touchend são
 *  registrados em globalEvents.js para manter a separação de responsabilidades.
 */

import { AppState } from '../core/appState.js';
import { Logger } from '../core/logger.js';
import { PreviewGeom } from '../preview/previewGeometry.js';

export const DragModule = {
  /**
   * Atualiza a posição de uma estampa no DOM, limitando-a dentro da área de impressão.
   * @param {Object} s - Objeto da estampa (com propriedade `node`).
   * @param {number} x - Posição X desejada em relação ao canto esquerdo da área de impressão.
   * @param {number} y - Posição Y desejada em relação ao topo da área de impressão.
   */
  updateStampPosition(s, x, y) {
    if (!s || !s.node) return;
    const node      = s.node;
    const shirtRect = PreviewGeom.getRenderedShirtRect();
    if (!shirtRect) return;

    const w = node.offsetWidth;
    const h = node.offsetHeight;
    const previewBox = document.getElementById("preview")?.getBoundingClientRect();
    if (!previewBox) return;

    // Limita o movimento dentro da área de impressão
    const left = Math.max(0, Math.min(x, shirtRect.width  - w));
    const top  = Math.max(0, Math.min(y, shirtRect.height - h));

    node.style.left = (shirtRect.left + left - previewBox.left) + 'px';
    node.style.top  = (shirtRect.top  + top  - previewBox.top)  + 'px';

    // Atualiza a posição relativa para uso no PDF
    const { StampModule } = window._modules || {};
    if (StampModule) StampModule.updateStampRel(s);
  },

  /**
   * Inicia o arrasto de uma estampa via evento de mouse.
   * Registra o deslocamento do cursor em relação ao canto da estampa.
   * @param {MouseEvent} e - Evento mousedown.
   */
  startDragGeneric(e) {
    const node = e.currentTarget;
    AppState.isDragging = true;
    const rect = node.getBoundingClientRect();
    AppState.dragOffsetX = e.clientX - rect.left;
    AppState.dragOffsetY = e.clientY - rect.top;
    const s = AppState.stamps.find(s => s.node === node);
    if (s) {
      const { StampModule } = window._modules || {};
      if (StampModule) StampModule.setActiveStamp(s.id);
    }
    e.preventDefault();
    Logger.info('EVENT', 'Arrasto iniciado (mouse)');
  },

  /**
   * Inicia o arrasto de uma estampa via evento de toque (touch).
   * @param {TouchEvent} ev - Evento touchstart.
   */
  startDragTouchGeneric(ev) {
    const node = ev.currentTarget;
    const t    = ev.touches[0];
    const rect = node.getBoundingClientRect();
    AppState.dragOffsetX = t.clientX - rect.left;
    AppState.dragOffsetY = t.clientY - rect.top;
    AppState.isDragging  = true;
    const s = AppState.stamps.find(s => s.node === node);
    if (s) {
      const { StampModule } = window._modules || {};
      if (StampModule) StampModule.setActiveStamp(s.id);
    }
    ev.preventDefault();
    Logger.info('EVENT', 'Arrasto iniciado (touch)');
  }
};
