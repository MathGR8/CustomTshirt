/**
 * @module globalEvents
 * @description Registra todos os event listeners globais da aplicação.
 *
 * Responsabilidades:
 *  - Listeners de mousemove e touchmove para o drag de estampas.
 *  - Listeners de mouseup e touchend para encerrar o drag.
 *  - Listeners de mouseup, touchend, touchcancel e blur para encerrar o nudge.
 *  - ResizeObserver para recalcular o overlay e as dimensões das estampas ao redimensionar.
 *  - Função initConfigurator que inicializa toda a aplicação no DOMContentLoaded.
 *
 * Dependências: appState.js, logger.js, helpers.js, previewGeometry.js,
 *               uiModule.js, stampModule.js, sizeModule.js, alignModule.js,
 *               dragModule.js.
 * Módulos relacionados: main.js (que chama registerGlobalEvents).
 */

import { AppState } from '../core/appState.js';
import { Logger } from '../core/logger.js';
import { Utils } from '../utils/helpers.js';
import { PreviewGeom } from '../preview/previewGeometry.js';
import { UIModule } from '../ui/uiModule.js';
import { SizeModule } from '../products/sizeModule.js';
import { AlignModule } from '../preview/alignModule.js';
import { DragModule } from './dragModule.js';

/**
 * Registra todos os event listeners globais da aplicação.
 * Deve ser chamado uma única vez, após o DOM estar pronto.
 * @param {Object} modules - Referência ao objeto window._modules com todos os módulos.
 */
export function registerGlobalEvents(modules) {
  const { StampModule } = modules;

  // ---- Drag via Mouse ----

  document.addEventListener("mousemove", e => {
    if (!AppState.isDragging) return;
    const s = AppState.getActiveStamp();
    if (!s) return;
    const shirtRect = PreviewGeom.getRenderedShirtRect();
    if (!shirtRect) return;
    const targetX = e.clientX - shirtRect.left - AppState.dragOffsetX;
    const targetY = e.clientY - shirtRect.top  - AppState.dragOffsetY;
    if (!AppState.ticking) {
      requestAnimationFrame(() => {
        DragModule.updateStampPosition(s, targetX, targetY);
        AppState.ticking = false;
      });
      AppState.ticking = true;
    }
  });

  document.addEventListener("mouseup", () => {
    AppState.isDragging = false;
    AlignModule.stopNudge();
  });

  // ---- Drag via Touch ----

  document.addEventListener("touchmove", ev => {
    if (!AppState.isDragging) return;
    const s = AppState.getActiveStamp();
    if (!s) return;
    const t = ev.touches[0];
    const shirtRect = PreviewGeom.getRenderedShirtRect();
    if (!shirtRect) return;
    const targetX = t.clientX - shirtRect.left - AppState.dragOffsetX;
    const targetY = t.clientY - shirtRect.top  - AppState.dragOffsetY;
    if (!AppState.ticking) {
      requestAnimationFrame(() => {
        DragModule.updateStampPosition(s, targetX, targetY);
        AppState.ticking = false;
      });
      AppState.ticking = true;
    }
  }, { passive: false });

  document.addEventListener("touchend", () => {
    AppState.isDragging = false;
    AlignModule.stopNudge();
  });

  // ---- Nudge: parar ao soltar qualquer tecla/toque ----

  // Toque cancelado (ex.: ligação): encerra também o arrasto, que antes ficava preso
  document.addEventListener('touchcancel', () => { AppState.isDragging = false; AlignModule.stopNudge(); }, { passive: true });
  window.addEventListener('blur',          () => AlignModule.stopNudge());

  // ---- ResizeObserver: recalcula overlay e dimensões ao redimensionar ----

  const _resizeObs = new ResizeObserver(Utils.debounce(() => {
    UIModule.updateShirtBoxOverlay();
    AppState.stamps.forEach(s => {
      if (s.side === AppState.currentView) StampModule.applyStampCmToNode(s);
    });
  }, 80));

  const previewContainer = document.getElementById('previewContainer');
  _resizeObs.observe(previewContainer || document.body);

  Logger.info('EVENT', 'Listeners globais registrados.');
}

/**
 * Inicializa toda a aplicação.
 * Deve ser chamada no evento DOMContentLoaded.
 * Configura o estado inicial, popula a UI e registra o slider de tamanho.
 */
export function initConfigurator() {
  Logger.info('INIT', 'Inicializando aplicação...');

  if (!AppState.selectedColor) AppState.selectedColor = "Preto";

  const stampSizeInput = document.getElementById("stampSize");
  if (stampSizeInput) {
    if (!stampSizeInput.value || stampSizeInput.value === "0") stampSizeInput.value = 22;
    stampSizeInput.addEventListener("input", Utils.debounce(() => UIModule.updateStampSize(), 40));
  }

  UIModule.updateColorOptions();
  UIModule.populateSubLocations();
  UIModule.updateStampSizeDefault();
  UIModule.stampLocationChanged();
  SizeModule.updateSizeTable();
  UIModule.toggleShirtBox(true);
  AlignModule.setHudVisible(false);

  // StampModule disponível via window._modules
  const { StampModule } = window._modules || {};
  if (StampModule) {
    StampModule.renderStampsList();
  }

  UIModule.syncUiState();
  Logger.info('INIT', 'Aplicação inicializada com sucesso.');
}
