/**
 * @module noticeModule
 * @description Gerencia as notificações e avisos visuais exibidos ao usuário.
 *
 * Responsabilidades:
 *  - Exibir mensagens de feedback (sucesso, erro, informação) no elemento #uiNotice.
 *  - Ocultar automaticamente mensagens não críticas após um intervalo.
 *  - Marcar campos de formulário com erro visual (classe 'field-error').
 *
 * Dependências: logger.js.
 * Módulos relacionados: stampModule.js, orderModule.js, pdfModule.js.
 */

import { Logger } from '../core/logger.js';

export const NoticeModule = {
  /** Referência ao timer de auto-ocultação da notificação. */
  _timer: null,

  /**
   * Exibe uma mensagem de notificação para o usuário.
   * Mensagens do tipo 'error' permanecem visíveis até serem fechadas manualmente.
   * @param {'info'|'success'|'error'} type - Tipo da notificação.
   * @param {string} msg - Texto da mensagem a ser exibida.
   */
  show(type, msg) {
    const el = document.getElementById('uiNotice');
    if (!el) {
      Logger.warn('UI', 'Elemento #uiNotice não encontrado.');
      return;
    }
    el.className = 'notice ' + (type || 'info');
    el.textContent = msg;
    el.style.display = 'flex';
    clearTimeout(this._timer);
    // Erros permanecem visíveis; outros tipos somem após 4,5 segundos
    if (type !== 'error') {
      this._timer = setTimeout(() => this.clear(), 4500);
    }
    Logger.info('UI', `Notificação [${type}]: ${msg}`);
  },

  /**
   * Oculta a notificação atual e limpa seu conteúdo.
   */
  clear() {
    const el = document.getElementById('uiNotice');
    if (!el) return;
    el.style.display = 'none';
    el.textContent = '';
  },

  /**
   * Adiciona ou remove a classe de erro visual em um elemento de formulário.
   * @param {HTMLElement|null} el - Elemento a ser marcado.
   * @param {boolean} [on=true] - true para adicionar o erro, false para remover.
   */
  markError(el, on = true) {
    if (!el) return;
    el.classList.toggle('field-error', !!on);
  }
};
