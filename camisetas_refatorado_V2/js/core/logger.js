/**
 * @module logger
 * @description Sistema centralizado e padronizado de logs para depuração.
 *
 * Responsabilidades:
 *  - Emitir mensagens de log categorizadas por prefixo (ex: [INIT], [UI], [PDF]).
 *  - Facilitar a rastreabilidade de eventos, erros e mudanças de estado.
 *  - Evitar poluição do console com mensagens repetidas ou sem contexto.
 *
 * Dependências: nenhuma.
 * Módulos relacionados: todos os módulos da aplicação.
 *
 * Uso:
 *   import { Logger } from '../core/logger.js';
 *   Logger.info('UI', 'Cor alterada para Preto');
 *   Logger.error('PDF', 'Falha ao carregar imagem base');
 */

// Prefixos suportados e seus respectivos estilos de console
const PREFIXES = {
  INIT:   { style: 'color: #4CAF50; font-weight: bold;' },
  UI:     { style: 'color: #2196F3; font-weight: bold;' },
  IMAGE:  { style: 'color: #FF9800; font-weight: bold;' },
  PDF:    { style: 'color: #9C27B0; font-weight: bold;' },
  EVENT:  { style: 'color: #00BCD4; font-weight: bold;' },
  STATE:  { style: 'color: #607D8B; font-weight: bold;' },
  ERROR:  { style: 'color: #F44336; font-weight: bold;' },
  WARN:   { style: 'color: #FF5722; font-weight: bold;' }
};

export const Logger = {
  /**
   * Emite uma mensagem informativa no console.
   * @param {string} prefix - Categoria do log (ex: 'UI', 'PDF', 'IMAGE').
   * @param {string} message - Mensagem descritiva.
   */
  info(prefix, message) {
    const p = (prefix || 'INFO').toUpperCase();
    const style = PREFIXES[p]?.style || 'color: #333; font-weight: bold;';
    console.log(`%c[${p}]%c ${message}`, style, 'color: inherit;');
  },

  /**
   * Emite uma mensagem de aviso no console.
   * @param {string} prefix - Categoria do log.
   * @param {string} message - Mensagem de aviso.
   */
  warn(prefix, message) {
    const p = (prefix || 'WARN').toUpperCase();
    console.warn(`[${p}] ${message}`);
  },

  /**
   * Emite uma mensagem de erro no console.
   * @param {string} prefix - Categoria do log.
   * @param {string} message - Mensagem de erro.
   * @param {Error|null} [err=null] - Objeto de erro opcional para stack trace.
   */
  error(prefix, message, err = null) {
    const p = (prefix || 'ERROR').toUpperCase();
    console.error(`[${p}] ${message}`, err || '');
  }
};
