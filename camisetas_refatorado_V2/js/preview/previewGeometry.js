/**
 * @module previewGeometry
 * @description Cálculos geométricos do preview da camiseta.
 *
 * Responsabilidades:
 *  - Calcular o retângulo renderizado da imagem base da camiseta no preview.
 *  - Calcular o retângulo da área de impressão (shirt box) no preview.
 *  - Calcular a escala de pixels por centímetro no preview.
 *  - Calcular a posição relativa de uma estampa em relação à área de impressão.
 *
 * Dependências: appState.js, constants.js.
 * Módulos relacionados: stampModule.js, uiModule.js, pdfModule.js.
 *
 * Observação:
 *  Todos os retângulos retornados usam coordenadas absolutas da viewport
 *  (getBoundingClientRect), exceto getPreviewRelRect que retorna valores
 *  normalizados de 0 a 1 relativos à área de impressão.
 */

import { AppState } from '../core/appState.js';
import { SHIRT_PRINT_BOX, AREA_IMPRESSAO } from '../core/constants.js';

/** Arredonda para 1 casa decimal. */
const um = v => Math.round(v * 10) / 10;

export const PreviewGeom = {
  /**
   * Área máxima de impressão (cm) da categoria (padrão: a selecionada na tela).
   * @returns {{w:number, h:number, nome:string, infantil?:{w,h,nome,escala}}}
   */
  area(categoria) {
    const cat = categoria || document.getElementById('category')?.value || 'Masculina';
    const a = AREA_IMPRESSAO[cat] || AREA_IMPRESSAO.Masculina;
    if (!a.infantil) return a;
    // Fator para reduzir a arte juvenil até caber na área infantil
    const escala = Math.min(a.infantil.w / a.w, a.infantil.h / a.h);
    return { ...a, infantil: { ...a.infantil, escala } };
  },

  /** Proporção altura/largura da arte da estampa (null se ainda não dá para saber). */
  proporcao(s) {
    if (s?.width && s?.height) return s.height / s.width;
    const n = s?.node;
    return n?.naturalWidth ? n.naturalHeight / n.naturalWidth : null;
  },

  /**
   * Maior largura (cm) que a estampa pode ter sem passar da largura nem da
   * altura máxima da área de impressão.
   * @param {Object|number} s - Estampa, ou direto a proporção altura/largura.
   */
  maxCm(s, categoria) {
    const a = this.area(categoria);
    const p = typeof s === 'number' ? s : this.proporcao(s);
    return Math.floor(Math.min(a.w, p ? a.h / p : a.w) * 10) / 10;
  },

  /**
   * Medidas da estampa para mostrar (largura × altura em cm). Em
   * Infantil/Juvenil traz também a medida reduzida das peças infantis.
   * @returns {{w, h, infantil?: {w, h}}}
   */
  medidas(s, categoria) {
    const w = s.cm ?? 20, h = w * (this.proporcao(s) || 1), a = this.area(categoria);
    const m = { w: um(w), h: um(h) };
    if (a.infantil) m.infantil = { w: um(w * a.infantil.escala), h: um(h * a.infantil.escala) };
    return m;
  },

  /**
   * Calcula o retângulo da imagem base da camiseta como renderizada no preview.
   * Leva em conta o padding CSS e o aspect ratio da imagem (object-fit: contain).
   * @returns {{ left: number, top: number, width: number, height: number }|null}
   *   Retângulo em coordenadas absolutas da viewport, ou null se a imagem não estiver disponível.
   */
  getRenderedBaseRect() {
    const previewEl = document.getElementById("preview");
    const base = document.getElementById("baseShirtImg");
    if (!previewEl || !base || !base.naturalWidth || !base.naturalHeight) return null;

    const prev = previewEl.getBoundingClientRect();
    const cs   = window.getComputedStyle(base);
    const padL = parseFloat(cs.paddingLeft)   || 0;
    const padR = parseFloat(cs.paddingRight)  || 0;
    const padT = parseFloat(cs.paddingTop)    || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;

    const innerW = prev.width  - (padL + padR);
    const innerH = prev.height - (padT + padB);
    const nw = base.naturalWidth;
    const nh = base.naturalHeight;

    const scaleX = innerW / nw;
    const scaleY = innerH / nh;
    const scale  = Math.min(scaleX, scaleY);

    const drawW   = nw * scale;
    const drawH   = nh * scale;
    const offsetX = (innerW - drawW) / 2 + padL;
    const offsetY = (innerH - drawH) / 2 + padT;

    return {
      left:   prev.left + offsetX,
      top:    prev.top  + offsetY,
      width:  drawW,
      height: drawH
    };
  },

  /**
   * Calcula o retângulo da área de impressão da camiseta no preview.
   * Aplica as coordenadas relativas de SHIRT_PRINT_BOX sobre o retângulo base.
   * @returns {{ left: number, top: number, width: number, height: number }|null}
   *   Retângulo em coordenadas absolutas da viewport, ou null se não disponível.
   */
  getRenderedShirtRect() {
    const baseRect = this.getRenderedBaseRect();
    if (!baseRect) return null;
    const view = AppState.currentView || "Frente";
    const box  = SHIRT_PRINT_BOX[view] || { x: 0, y: 0, w: 1, h: 1 };
    const a    = this.area();
    const width = box.w * baseRect.width;
    return {
      left:   baseRect.left + box.x * baseRect.width,
      top:    baseRect.top  + box.y * baseRect.height,
      width,
      height: width * a.h / a.w // altura na proporção da área máxima (ex.: 38 × 42 cm)
    };
  },

  /**
   * Calcula quantos pixels equivalem a 1 centímetro no preview.
   * Baseado na largura da área de impressão e na largura máxima de impressão.
   * @returns {number|null} Pixels por centímetro, ou null se não disponível.
   */
  getPxPerCmPreview() {
    const rect = this.getRenderedShirtRect();
    if (!rect || rect.width <= 0) return null;
    return rect.width / this.area().w;
  },

  /**
   * Calcula a posição relativa de uma estampa em relação à área de impressão.
   * Retorna valores normalizados de 0 a 1 (rx, ry, rw, rh).
   * Utilizado para reposicionar a estampa no PDF com precisão.
   * @param {HTMLElement|null} node - Elemento DOM da estampa.
   * @returns {{ rx: number, ry: number, rw: number, rh: number }|null}
   *   Posição relativa normalizada, ou null se não disponível.
   */
  getPreviewRelRect(node) {
    if (!node) return null;
    const prevTransform = node.style.transform || "";
    node.style.transform = "none";
    const shirtRect = this.getRenderedShirtRect();
    const stampRect = node.getBoundingClientRect();
    node.style.transform = prevTransform;
    if (!shirtRect || !shirtRect.width || !shirtRect.height) return null;

    const rx = (stampRect.left - shirtRect.left) / shirtRect.width;
    const ry = (stampRect.top  - shirtRect.top)  / shirtRect.height;
    const rw = stampRect.width  / shirtRect.width;
    const rh = stampRect.height / shirtRect.height;

    const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
    const rx1 = clamp(rx);
    const ry1 = clamp(ry);
    return {
      rx: rx1,
      ry: ry1,
      rw: clamp(rx + rw) - rx1,
      rh: clamp(ry + rh) - ry1
    };
  }
};
