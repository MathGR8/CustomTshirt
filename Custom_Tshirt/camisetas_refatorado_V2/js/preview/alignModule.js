/**
 * @module alignModule
 * @description Gerencia o HUD de alinhamento e o sistema de nudge (mover estampa com botões).
 *
 * Responsabilidades:
 *  - Exibir ou ocultar o HUD de alinhamento no preview.
 *  - Iniciar e parar o nudge (movimento contínuo com delay inicial e repetição).
 *
 * Dependências: appState.js, logger.js.
 * Módulos relacionados: stampModule.js (que delega para alignModule via startNudge/stopNudge).
 *
 * Observação:
 *  StampModule é referenciado via window._modules para evitar dependência circular.
 */

import { AppState } from '../core/appState.js';
import { Logger } from '../core/logger.js';

export const AlignModule = {
  /**
   * Exibe ou oculta o HUD de alinhamento no preview.
   * @param {boolean} show - true para exibir, false para ocultar.
   */
  setHudVisible(show) {
    const hud = document.getElementById('alignHud');
    if (hud) hud.style.display = show ? 'flex' : 'none';
  },

  /**
   * Inicia o movimento contínuo da estampa ativa em uma direção.
   * Executa um movimento imediato e, após 200ms, inicia repetição a cada 30ms.
   * @param {string} mode - Direção do movimento: 'moveUp', 'moveDown', 'moveLeft', 'moveRight'.
   */
  startNudge(mode) {
    const { StampModule } = window._modules || {};
    if (!StampModule) return;
    this.stopNudge();
    StampModule.alignStamp(mode);
    AppState.nudgeDelay = setTimeout(() => {
      AppState.nudgeInterval = setInterval(() => StampModule.alignStamp(mode), 30);
    }, 200);
    Logger.info('EVENT', `Nudge iniciado: ${mode}`);
  },

  /**
   * Para o movimento contínuo da estampa ativa.
   * Limpa o delay inicial e o intervalo de repetição.
   */
  stopNudge() {
    if (AppState.nudgeDelay) {
      clearTimeout(AppState.nudgeDelay);
      AppState.nudgeDelay = null;
    }
    if (AppState.nudgeInterval) {
      clearInterval(AppState.nudgeInterval);
      AppState.nudgeInterval = null;
    }
  }
};
