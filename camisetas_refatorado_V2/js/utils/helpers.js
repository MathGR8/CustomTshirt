/**
 * @module helpers
 * @description Utilitários gerais reutilizáveis em toda a aplicação.
 *
 * Responsabilidades:
 *  - Carregar imagens de forma assíncrona (com ou sem CORS).
 *  - Converter cor hexadecimal para objeto RGB.
 *  - Limitar valores de largura de estampa dentro dos limites permitidos.
 *  - Gerar IDs únicos para estampas.
 *  - Criar funções com debounce para otimizar eventos frequentes.
 *
 * Dependências: constants.js (MAX_PRINT_WIDTH_CM).
 * Módulos relacionados: stampModule.js, pdfModule.js, previewGeometry.js.
 */

import { MAX_PRINT_WIDTH_CM } from '../core/constants.js';

export const Utils = {
  /**
   * Carrega uma imagem de forma assíncrona e retorna uma Promise.
   * @param {string} src - URL da imagem a ser carregada.
   * @param {boolean} [cors=false] - Se true, define crossOrigin como 'Anonymous'.
   * @returns {Promise<HTMLImageElement>} Promise que resolve com o elemento de imagem.
   */
  loadImage(src, cors = false) {
    return new Promise((resolve, reject) => {
      if (!src) {
        reject(new Error('URL de imagem não fornecida.'));
        return;
      }
      const img = new Image();
      if (cors) img.crossOrigin = "Anonymous";
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error(`Falha ao carregar: ${src}`));
      img.src = src;
    });
  },

  /**
   * Converte uma cor hexadecimal para um objeto com componentes RGB.
   * @param {string} hex - Cor no formato '#RRGGBB'.
   * @returns {{ r: number, g: number, b: number }} Objeto com valores de 0 a 255.
   */
  hexToRgb(hex) {
    if (!hex || hex.length < 7) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  },

  /**
   * Limita o valor de largura da estampa entre 5 cm e MAX_PRINT_WIDTH_CM.
   * @param {number} v - Valor de largura em centímetros.
   * @returns {number} Valor limitado ao intervalo permitido.
   */
  clampCm(v) {
    return Math.max(5, Math.min(v || 20, MAX_PRINT_WIDTH_CM));
  },

  /**
   * Gera um ID único para uma estampa.
   * Utiliza prefixo 'st' + string aleatória em base 36.
   * @returns {string} ID único no formato 'stXXXXXXX'.
   */
  genId() {
    return 'st' + Math.random().toString(36).slice(2, 9);
  },

  /**
   * Cria uma versão com debounce de uma função.
   * Útil para otimizar eventos frequentes como resize e input.
   * @param {Function} fn - Função a ser executada com atraso.
   * @param {number} delay - Tempo de espera em milissegundos.
   * @returns {Function} Nova função que aguarda o delay antes de executar.
   */
  /**
   * Põe botões "−" e "+" em volta de um campo numérico (ou slider).
   * Respeita min/max/step do campo; segurar o botão repete. A cada passo
   * dispara os eventos 'input' e 'change' do campo, como se o usuário digitasse.
   * Se o campo já estiver na página, é trocado pelo conjunto no mesmo lugar.
   * @param {HTMLInputElement} input - Campo a controlar.
   * @returns {HTMLDivElement} O conjunto [− campo +].
   */
  stepper(input) {
    const wrap = document.createElement('div');
    wrap.className = 'stepper' + (input.type === 'range' ? ' stepperRange' : '');
    if (input.parentNode) input.parentNode.replaceChild(wrap, input);

    const passo = dir => {
      const step = parseFloat(input.step) || 1;
      const min  = input.min !== '' ? parseFloat(input.min) : -Infinity;
      const max  = input.max !== '' ? parseFloat(input.max) : Infinity;
      const atual = parseFloat(input.value) || 0;
      // Arredonda para o passo (ex.: 22,4 → 23 ao apertar "+")
      const base = dir > 0 ? Math.floor(atual / step) * step : Math.ceil(atual / step) * step;
      const novo = Math.max(min, Math.min(max, base + dir * step));
      if (novo === atual) return;
      input.value = String(+novo.toFixed(4));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const botao = (txt, dir, rotulo) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'stepBtn';
      b.textContent = txt;
      b.setAttribute('aria-label', rotulo);
      let espera = null, repete = null, ultimoToque = 0;
      const parar = () => { clearTimeout(espera); clearInterval(repete); espera = repete = null; };
      b.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        ultimoToque = Date.now();
        passo(dir);
        espera = setTimeout(() => { repete = setInterval(() => passo(dir), 90); }, 400);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, parar));
      // Teclado (Enter/Espaço) gera só o click. O click que vem logo depois de
      // um toque/clique já foi contado no pointerdown e é ignorado.
      b.addEventListener('click', e => {
        e.stopPropagation();
        if (Date.now() - ultimoToque > 800) passo(dir);
      });
      return b;
    };

    wrap.append(botao('−', -1, 'Diminuir'), input, botao('+', 1, 'Aumentar'));
    return wrap;
  },

  debounce(fn, delay) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }
};
