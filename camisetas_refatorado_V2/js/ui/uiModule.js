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
import { BASE_IMAGES, CHEST_PRESET, MODELO_FOTOS, SILHUETA_LOJA } from '../core/constants.js';
import { Logger } from '../core/logger.js';
import { Utils } from '../utils/helpers.js';
import { PreviewGeom } from '../preview/previewGeometry.js';
import { medirUrl, medidaPronta, registrarMedida, textoExemplo } from '../preview/medidaCamiseta.js';

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
        window._modules?.HistoryModule?.commit('cor');
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
  updateStampSizeDefault(applyToActive = true) {
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
    // Trocar Frente/Costas só atualiza o slider: não redimensiona a estampa ativa
    if (!applyToActive) {
      const labelEl = document.getElementById("stampSizeValue");
      if (labelEl) labelEl.textContent = Utils.clampCm(parseFloat(input.value || "20")).toFixed(0) + " cm";
      return;
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
    const max = s ? PreviewGeom.maxCm(s) : PreviewGeom.area().w;
    const cm = Utils.clampCm(parseFloat(input.value || "20"), max);
    const labelEl = document.getElementById("stampSizeValue");
    if (labelEl) labelEl.textContent = cm.toFixed(0) + " cm";
    if (s && s.side === AppState.currentView && StampModule) {
      s.cm = cm;
      StampModule.applyStampCmToNode(s, { manterCentro: true });
      // Mantém o campo "Largura (cm)" da lista igual ao slider
      const campo = document.querySelector('#stampsList .stampItem.active input[type="number"]');
      if (campo) campo.value = cm;
      window._modules?.HistoryModule?.commit('cm-' + s.id);
    }
  },

  /**
   * Chamado quando o local da estampa muda.
   * Atualiza sub-locais, preview, tamanho padrão e overlay da área de impressão.
   */
  stampLocationChanged() {
    this.populateSubLocations();
    this.updateBasePreview();
    this.updateStampSizeDefault(false);
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
    window._modules?.HistoryModule?.commit('vista');
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
   * Contorno vermelho na estampa selecionada (desligado por padrão, para não
   * poluir o preview). A escolha fica guardada no navegador.
   * @param {boolean} [ligado] - sem valor: usa a escolha guardada.
   */
  toggleContornoArte(ligado) {
    if (ligado === undefined) {
      try { ligado = localStorage.getItem('artrock_contorno_arte') === '1'; } catch { ligado = false; }
    } else {
      try { localStorage.setItem('artrock_contorno_arte', ligado ? '1' : '0'); } catch { /* sem armazenamento */ }
    }
    document.body.classList.toggle('contornoArte', !!ligado);
    const chk = document.getElementById('chkContornoArte');
    if (chk) chk.checked = !!ligado;
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
    // Etiqueta com a área máxima (Infantil/Juvenil: as duas medidas)
    const a = PreviewGeom.area();
    this.atualizarExemplo();
    this.atualizarLimite();
    const txt = a.infantil
      ? `Máx. ${a.nome} ${a.w}×${a.h} cm · ${a.infantil.nome} ${a.infantil.w}×${a.infantil.h} cm`
      : `Área máx. ${a.w} × ${a.h} cm`;
    if (el.dataset.txt !== txt) { el.dataset.txt = txt; el.innerHTML = `<span class="shirtBoxLabel">${txt}</span>`; }
  },

  /** Mostra o tamanho e as medidas da camiseta do exemplo (escala do preview). */
  atualizarExemplo() {
    const el = document.getElementById('infoExemplo');
    if (!el) return;
    const cat = document.getElementById('category')?.value || 'Masculina';
    const ex = textoExemplo(cat), a = PreviewGeom.area(cat);
    el.innerHTML = `👕 Camiseta do exemplo: <b>tamanho ${ex.tamanho}</b> (${ex.largura} × ${ex.altura} cm) · área máxima de estampa <b>${a.w} × ${a.h} cm</b>`;
  },

  /**
   * Deixa a área de impressão VERMELHA quando alguma estampa encosta nas bordas
   * (o cliente vê que chegou ao limite).
   */
  atualizarLimite() {
    const el = document.getElementById('shirtBoxOverlay');
    const rect = PreviewGeom.getRenderedShirtRect();
    if (!el || !rect) return;
    const tol = 1.5;
    const noLimite = AppState.stamps.some(s => {
      if (s.hidden || s.side !== AppState.currentView || !s.node?.parentNode || !s.node.offsetWidth) return false;
      const r = s.node.getBoundingClientRect();
      return r.left <= rect.left + tol || r.top <= rect.top + tol ||
             r.right >= rect.left + rect.width - tol || r.bottom >= rect.top + rect.height - tol;
    });
    el.classList.toggle('noLimite', noLimite);
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
    // "No modelo": foto de uma pessoa vestindo (se houver para esta cor e lado)
    const foto = this.fotoModelo(category, AppState.selectedColor, mainLoc);
    const comModelo = AppState.vista === 'modelo' && !!foto;
    const imgData  = comModelo ? foto.url : BASE_IMAGES?.[category]?.[AppState.selectedColor]?.[mainLoc];
    if (comModelo) registrarMedida(foto.url, foto.medida);
    // Imagens da loja que o navegador não consegue medir: silhueta medida à mão
    const silhueta = !comModelo && SILHUETA_LOJA[category]?.[mainLoc];
    if (silhueta && imgData) registrarMedida(imgData, silhueta);
    const caixa = document.getElementById('previewContainer');
    caixa?.classList.toggle('modoModelo', comModelo);
    caixa?.classList.toggle('tecidoClaro', comModelo && /Branc/.test(AppState.selectedColor));
    this._atualizarVista(category, mainLoc);
    // Posição das estampas antes da troca de imagem: o primeiro reposicionamento
    // (antes do enquadramento) recalcula s.rel sobre a área errada.
    const relAntes = new Map(AppState.stamps.filter(s => s.rel).map(s => [s.id, { ...s.rel }]));

    const preview = document.getElementById("preview");
    if (!preview) return;

    preview.innerHTML = imgData
      ? `<img src="${imgData}" alt="${comModelo ? 'Modelo vestindo a camiseta' : 'Camiseta'} ${category} ${AppState.selectedColor} ${mainLoc}">`
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
        // Mede a camiseta para a área de impressão ficar em escala real
        medirUrl(baseImgEl.currentSrc || baseImgEl.src).then(m => {
          if (!m || document.getElementById('baseShirtImg') !== baseImgEl) return;
          this.enquadrarCamiseta(m);
          this.updateShirtBoxOverlay();
          AppState.stamps.forEach(s => {
            if (s.side !== AppState.currentView || !StampModule) return;
            const rel = relAntes.get(s.id) || s.rel;
            if (rel) s.pendingRel = { ...rel };
            StampModule.applyStampCmToNode(s);
          });
        });
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
   * Foto com modelo para a categoria/cor/lado (null se ainda não há).
   * @returns {{url: string, medida: Object}|null}
   */
  fotoModelo(categoria, cor, lado) {
    const f = MODELO_FOTOS?.[categoria]?.[cor]?.[lado];
    if (!f) return null;
    const url = new URL(f.src, document.baseURI).href;
    return { url, medida: { topo: f.topo, base: f.base, corpoEsq: f.corpoEsq, corpoDir: f.corpoDir, esq: f.quadro.x0, dir: f.quadro.x1, quadro: f.quadro, foto: true } };
  },

  /** Troca entre a camiseta sozinha e a foto com modelo. */
  setVista(v) {
    AppState.vista = v === 'modelo' ? 'modelo' : 'camiseta';
    try { localStorage.setItem('artrock_vista', AppState.vista); } catch { /* ok */ }
    this.updateBasePreview();
  },

  /** Botões "Camiseta | No modelo" e o aviso quando a cor/lado ainda não tem foto. @private */
  _atualizarVista(categoria, lado) {
    const temFoto = !!this.fotoModelo(categoria, AppState.selectedColor, lado);
    document.querySelectorAll('[data-vista]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vista === AppState.vista)));
    const aviso = document.getElementById('vistaAviso');
    if (aviso) {
      aviso.hidden = !(AppState.vista === 'modelo' && !temFoto);
      aviso.textContent = `Sem foto no modelo em ${AppState.selectedColor}${lado === 'Costas' ? ' (costas)' : ''} ainda`;
    }
  },

  /**
   * Enquadra a camiseta na caixa do preview: amplia e centraliza a silhueta
   * medida na foto (as fotos têm margens diferentes, e a caixa muda de formato
   * do celular para o computador). Antes era um zoom fixo só na feminina, que
   * cortava a camiseta fora da caixa antiga. As estampas e a área de impressão
   * são calculadas sobre a imagem já enquadrada (getBoundingClientRect), então
   * a escala real em cm continua certa.
   * @param {Object} [medida] - Silhueta (medirSilhueta); sem ela usa a já medida.
   * @returns {boolean} true se enquadrou.
   */
  enquadrarCamiseta(medida) {
    const img = document.getElementById('baseShirtImg');
    const m = medida || (img && medidaPronta(img.currentSrc || img.src));
    if (!img || !m || !img.naturalWidth) return false;
    const W = img.offsetWidth, H = img.offsetHeight;
    if (!W || !H) return false;
    const cs = getComputedStyle(img);
    const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
    const iw = W - pl - pr, ih = H - pt - pb;
    const s0 = Math.min(iw / img.naturalWidth, ih / img.naturalHeight);
    const dw = img.naturalWidth * s0, dh = img.naturalHeight * s0;
    const ox = pl + (iw - dw) / 2, oy = pt + (ih - dh) / 2;
    // Silhueta da camiseta como aparece sem zoom (na foto com modelo: o quadro cabeça → barra)
    const q = m.quadro || { x0: m.esq, x1: m.dir, y0: m.topo, y1: m.base };
    const sx0 = ox + q.x0 * dw, sx1 = ox + q.x1 * dw, sy0 = oy + q.y0 * dh, sy1 = oy + q.y1 * dh;
    const sw = sx1 - sx0, sh = sy1 - sy0;
    if (sw <= 0 || sh <= 0) return false;
    const margem = m.quadro ? 0.01 : 0.05;
    const k = Math.max(1, Math.min(m.quadro ? 3 : 1.8, (W * (1 - 2 * margem)) / sw, (H * (1 - 2 * margem)) / sh));
    const tx = -k * ((sx0 + sx1) / 2 - W / 2), ty = -k * ((sy0 + sy1) / 2 - H / 2);
    img.style.transformOrigin = 'center center';
    img.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${k.toFixed(4)})`;
    return true;
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
