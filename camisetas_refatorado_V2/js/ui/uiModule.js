/**
 * @module uiModule
 * @description Gerencia toda a interface visual da aplicação.
 *
 * Responsabilidades:
 *  - Renderizar as opções de cores disponíveis conforme categoria e tipo de malha.
 *  - Atualizar a imagem base da camiseta no preview.
 *  - Gerenciar a troca de vista (Frente/Costas).
 *  - Exibir/ocultar a área de impressão (shirtBoxOverlay).
 *  - Gerenciar os sub-locais de estampa e o slider de tamanho.
 *  - Sincronizar o estado da UI com o estado da aplicação (botões, badges).
 *
 * Dependências: appState.js, constants.js, logger.js, previewGeometry.js.
 * Módulos relacionados: stampModule.js, sizeModule.js.
 *
 * Observação:
 *  StampModule é importado de forma lazy (dentro dos métodos) para evitar
 *  dependência circular, já que stampModule.js também importa uiModule.js.
 */

import { AppState } from '../core/appState.js';
import { BASE_IMAGES, CHEST_PRESET } from '../core/constants.js';
import { Logger } from '../core/logger.js';
import { Utils } from '../utils/helpers.js';
import { PreviewGeom } from '../preview/previewGeometry.js';

export const UIModule = {
  /**
   * Atualiza as opções de cor disponíveis com base na categoria e tipo de malha selecionados.
   * Filtra apenas as cores que possuem imagens disponíveis para a categoria atual.
   * Mantém a cor atual se ela ainda for válida; caso contrário, seleciona a primeira opção.
   */
  updateColorOptions() {
    const fabricType = document.getElementById("fabricType")?.value;
    const category   = document.getElementById("category")?.value;
    const container  = document.getElementById("colorOptionsContainer");
    if (!container) return;
    container.innerHTML = "";

    let options = fabricType === "100% algodão"
      ? [
          { value: "Preto",   color: "#000000", label: "Preto" },
          { value: "Branco",  color: "#FFFFFF", label: "Branco" },
          { value: "Marinho", color: "#001f3f", label: "Marinho" }
        ]
      : [
          { value: "Preta Jaguar",    color: "#000000", label: "Preta" },
          { value: "Marinho Índigo",  color: "#003366", label: "Azul Marinho" },
          { value: "Cinza Mescla",    color: "#cccccc", label: "Cinza Claro" },
          { value: "Cinza Grafite",   color: "#333333", label: "Cinza Escuro" }
        ];

    // Filtra apenas cores com imagem disponível para a categoria selecionada
    options = options.filter(opt => {
      const imgs = BASE_IMAGES?.[category]?.[opt.value];
      return imgs && ((imgs.Frente && imgs.Frente.trim()) || (imgs.Costas && imgs.Costas.trim()));
    });

    if (!options.length) {
      container.style.display = "none";
      AppState.selectedColor = "";
      this.updateBasePreview();
      return;
    }
    container.style.display = "flex";

    // Mantém a cor atual se ainda existir nas opções disponíveis
    const currentColorStillValid = options.some(o => o.value === AppState.selectedColor);
    if (!currentColorStillValid) AppState.selectedColor = options[0].value;

    options.forEach(opt => {
      const div    = document.createElement("div");
      div.className = "colorOption" + (opt.value === AppState.selectedColor ? " selected" : "");
      div.dataset.value = opt.value;

      const circle = document.createElement("div");
      circle.className = "colorCircle";
      circle.style.backgroundColor = opt.color;

      const lbl = document.createElement("span");
      lbl.className = "colorLabel";
      lbl.textContent = opt.label;

      div.append(circle, lbl);
      // Acessibilidade: cada cor é um "radio" que também funciona pelo teclado
      div.setAttribute("role", "radio");
      div.tabIndex = 0;
      div.setAttribute("aria-label", opt.label);
      div.setAttribute("aria-checked", String(opt.value === AppState.selectedColor));
      div.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); div.click(); }
      });
      div.addEventListener("click", function () {
        AppState.selectedColor = this.dataset.value;
        container.querySelectorAll(".colorOption").forEach(el => {
          el.classList.remove("selected");
          el.setAttribute("aria-checked", "false");
        });
        this.classList.add("selected");
        this.setAttribute("aria-checked", "true");
        Logger.info('STATE', `Cor alterada para ${AppState.selectedColor}`);
        UIModule.updateBasePreview();
      });
      container.appendChild(div);
    });

    this.updateBasePreview();
    Logger.info('UI', `Opções de cor atualizadas para categoria "${category}"`);
  },

  /**
   * Popula o select de sub-localização conforme o local principal selecionado.
   * Frente: Frontal, Peito, Livre. Costas: Costas, Livre.
   */
  populateSubLocations() {
    const mainLoc = document.getElementById("stampLocation")?.value;
    const sub = document.getElementById("subLocation");
    if (!sub) return;
    sub.innerHTML = "";
    const opts = (mainLoc === "Frente") ? ["Frontal", "Peito", "Livre"] : ["Costas", "Livre"];
    opts.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt;
      o.text  = opt;
      sub.append(o);
    });
  },

  /**
   * Atualiza o tamanho padrão da estampa conforme a sub-localização selecionada.
   * Peito: 10 cm (no peito, à direita) | Frontal: 22 cm | Costas: 28 cm | Livre: exibe slider.
   */
  updateStampSizeDefault() {
    const subLoc = document.getElementById("subLocation")?.value;
    const input  = document.getElementById("stampSize");
    const slider = document.getElementById("stampSizeContainer");
    if (!input || !slider) return;

    if (subLoc === "Livre") {
      slider.style.display = "flex";
      if (!input.value || input.value === "0") input.value = 20;
    } else {
      slider.style.display = "none";
      if      (subLoc === "Peito")   input.value = CHEST_PRESET.cm;
      else if (subLoc === "Frontal") input.value = 22;
      else if (subLoc === "Costas")  input.value = 28;
    }
    this.updateStampSize();

    // Pré-posicionamento "Peito": leva a estampa ativa para o peito
    const { StampModule } = window._modules || {};
    const ativa = AppState.getActiveStamp();
    if (subLoc === "Peito" && ativa && StampModule) StampModule.applySubLocationPreset(ativa, subLoc);
  },

  /**
   * Aplica o tamanho atual do slider à estampa ativa (se estiver no lado visível).
   * Atualiza o texto do label com o valor em centímetros.
   */
  updateStampSize() {
    // Importação lazy para evitar dependência circular com stampModule
    const { StampModule } = window._modules || {};
    const s     = AppState.getActiveStamp();
    const input = document.getElementById("stampSize");
    if (!input) return;
    const cm = Utils.clampCm(parseFloat(input.value || "20"));
    const labelEl = document.getElementById("stampSizeValue");
    if (labelEl) labelEl.textContent = cm.toFixed(0) + " cm";
    if (s && s.side === AppState.currentView && StampModule) {
      s.cm = cm;
      StampModule.applyStampCmToNode(s);
    }
  },

  /**
   * Chamado quando o local da estampa muda.
   * Atualiza sub-locais, preview, tamanho padrão e overlay da área de impressão.
   */
  stampLocationChanged() {
    this.populateSubLocations();
    this.updateBasePreview();
    this.updateStampSizeDefault();
    this.updateShirtBoxOverlay();
    Logger.info('UI', `Local da estampa alterado para ${document.getElementById("stampLocation")?.value}`);
  },

  /**
   * Alterna a vista entre Frente e Costas.
   * Atualiza o select de localização, o badge de lado e reposiciona as estampas.
   */
  toggleView() {
    const { StampModule } = window._modules || {};
    AppState.currentView = (AppState.currentView === "Frente") ? "Costas" : "Frente";
    const locEl = document.getElementById("stampLocation");
    if (locEl) locEl.value = AppState.currentView;
    this.stampLocationChanged();
    if (StampModule) {
      AppState.stamps.forEach(s => StampModule.refreshStampSideInPreview(s));
    }
    this._updateSideBadge();
    Logger.info('UI', `Vista alternada para ${AppState.currentView}`);
  },

  /**
   * Atualiza o badge que indica o lado atual (Frente/Costas) no preview.
   * @private
   */
  _updateSideBadge() {
    const badge = document.getElementById("currentSideBadge");
    if (badge) badge.textContent = AppState.currentView;
  },

  /**
   * Ativa ou desativa a exibição da área de impressão no preview.
   * @param {boolean} checked - true para exibir, false para ocultar.
   */
  toggleShirtBox(checked) {
    AppState.showShirtBox = !!checked;
    this.updateShirtBoxOverlay();
  },

  /**
   * Garante que o elemento #shirtBoxOverlay existe no DOM.
   * Cria-o dinamicamente se não existir.
   * @returns {HTMLElement} Elemento overlay da área de impressão.
   */
  ensureShirtBoxEl() {
    const preview = document.getElementById("preview");
    let el = document.getElementById("shirtBoxOverlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "shirtBoxOverlay";
      el.style.cssText = "position:absolute; border:2px dashed #36C5C4; border-radius:4px; pointer-events:none; z-index:5;";
      if (preview) preview.appendChild(el);
    }
    return el;
  },

  /**
   * Atualiza a posição e visibilidade do overlay da área de impressão.
   * Calcula a posição com base no retângulo renderizado da camiseta.
   */
  updateShirtBoxOverlay() {
    const el = this.ensureShirtBoxEl();
    if (!AppState.showShirtBox) { el.style.display = "none"; return; }
    const rect = PreviewGeom.getRenderedShirtRect();
    if (!rect) { el.style.display = "none"; return; }
    const previewBox = document.getElementById("preview")?.getBoundingClientRect();
    if (!previewBox) return;
    el.style.left    = (rect.left - previewBox.left) + "px";
    el.style.top     = (rect.top  - previewBox.top)  + "px";
    el.style.width   = rect.width  + "px";
    el.style.height  = rect.height + "px";
    el.style.display = "block";
  },

  /**
   * Atualiza a imagem base da camiseta exibida no preview.
   * Renderiza a imagem da cor/categoria/lado selecionados.
   * Após o carregamento, reaplica o overlay e as estampas do lado atual.
   */
  updateBasePreview() {
    const { StampModule } = window._modules || {};
    const mainLoc = document.getElementById("stampLocation")?.value || "Frente";
    AppState.currentView = mainLoc;
    this._updateSideBadge();

    if (!AppState.selectedColor) AppState.selectedColor = "Preto";
    const category = document.getElementById("category")?.value;
    const imgData  = BASE_IMAGES?.[category]?.[AppState.selectedColor]?.[mainLoc];

    const preview = document.getElementById("preview");
    if (!preview) return;

    preview.innerHTML = imgData
      ? `<img src="${imgData}" alt="Camiseta ${category} ${AppState.selectedColor} ${mainLoc}">`
      : `<div style="width:100%;height:100%;background:#ccc;display:flex;align-items:center;justify-content:center;color:#888;font-size:13px;">Imagem não disponível</div>`;

    const baseImgEl = preview.querySelector("img");
    if (baseImgEl) {
      baseImgEl.id = "baseShirtImg";
      baseImgEl.draggable = false;
      baseImgEl.style.userSelect = "none";

      if (category === "Feminina") {
        baseImgEl.classList.add("feminine-shirt");
      } else {
        baseImgEl.classList.remove("feminine-shirt");
      }

      baseImgEl.addEventListener("load", () => {
        this.updateShirtBoxOverlay();
        if (StampModule) {
          AppState.stamps.forEach(s => {
            if (s.side === AppState.currentView) StampModule.applyStampCmToNode(s);
          });
          AppState.stamps.forEach(s => StampModule.refreshStampSideInPreview(s));
        }
        Logger.info('UI', `Imagem base carregada: ${category} ${AppState.selectedColor} ${mainLoc}`);
      });
    }

    this.updateShirtBoxOverlay();

    // Reanexa as estampas visíveis do lado atual
    AppState.stamps
      .filter(s => s.side === AppState.currentView && !s.hidden)
      .forEach(s => {
        if (!s.node.parentNode) preview.appendChild(s.node);
      });
  },

  /**
   * Sincroniza o estado dos elementos de UI com o estado da aplicação.
   * Atualiza: botão de PDF, botão de limpar, badge de contagem de estampas.
   */
  syncUiState() {
    const btnPdf = document.getElementById('btnGerarPdf');
    if (btnPdf) btnPdf.disabled = AppState.orderItems.length === 0;

    const btnClear = document.getElementById('btnClearAll');
    if (btnClear) btnClear.style.display = AppState.stamps.length ? 'flex' : 'none';

    const badge = document.getElementById('stampsCountBadge');
    if (badge) badge.textContent = String(AppState.stamps.filter(s => !s.hidden).length);

    const countEl = document.getElementById("orderCount");
    if (countEl) countEl.textContent = AppState.orderItems.length;
  }
};
