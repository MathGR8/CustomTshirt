/**
 * @module stampModule
 * @description Gerencia o ciclo de vida completo das estampas na aplicação.
 *
 * Responsabilidades:
 *  - Adicionar estampas ao preview a partir de arquivo ou dataURL.
 *  - Aplicar dimensões em centímetros às estampas no preview.
 *  - Centralizar estampas dentro da área de impressão.
 *  - Atualizar a posição relativa das estampas para uso no PDF.
 *  - Gerenciar a estampa ativa (seleção, highlight, HUD).
 *  - Duplicar e remover estampas.
 *  - Renderizar a lista de estampas no painel direito.
 *  - Delegar alinhamento e nudge para AlignModule.
 *
 * Dependências: appState.js, constants.js, logger.js, helpers.js,
 *               noticeModule.js, previewGeometry.js, alignModule.js,
 *               uiModule.js, dragModule.js, pdfModule.js.
 * Módulos relacionados: uiModule.js, pdfModule.js, orderModule.js.
 */

import { AppState } from '../core/appState.js';
import { MAX_FILE_SIZE_MB, CHEST_PRESET } from '../core/constants.js';
import { Logger } from '../core/logger.js';
import { Utils } from '../utils/helpers.js';
import { NoticeModule } from '../ui/noticeModule.js';
import { UIModule } from '../ui/uiModule.js';
import { PreviewGeom } from '../preview/previewGeometry.js';
import { AlignModule } from '../preview/alignModule.js';
import { DragModule } from '../events/dragModule.js';

export const StampModule = {
  /**
   * Processa o arquivo selecionado pelo usuário e adiciona a estampa ao preview.
   * Valida o arquivo (tamanho, formato) antes de processar.
   * Delega a normalização e criação do objeto de estampa para PDFModule.
   */
  async updateStampPreview() {
    const { PDFModule } = window._modules || {};
    if (!PDFModule) {
      Logger.error('IMAGE', 'PDFModule não disponível para criar estampa.');
      return;
    }

    const input = document.getElementById("stampFile");
    if (!input || !input.files.length) {
      NoticeModule.show('error', 'Selecione um arquivo de estampa para adicionar.');
      NoticeModule.markError(input, true);
      return;
    }

    NoticeModule.markError(input, false);
    NoticeModule.clear();

    const file = input.files[0];

    // Validação de tamanho do arquivo
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      NoticeModule.show('error', `Arquivo muito grande. O limite é ${MAX_FILE_SIZE_MB} MB.`);
      Logger.warn('IMAGE', `Arquivo rejeitado: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      return;
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'svg', 'pdf'].includes(ext)) {
      NoticeModule.show('error', 'Formato não suportado. Use PNG, JPG/JPEG, SVG ou PDF.');
      Logger.warn('IMAGE', `Formato rejeitado: .${ext}`);
      return;
    }

    try {
      Logger.info('IMAGE', `Processando estampa: ${file.name}`);
      const side = document.getElementById('stampLocation')?.value || 'Frente';
      const cm   = Utils.clampCm(parseFloat(document.getElementById('stampSize')?.value || '20'));

      // PDF com várias páginas ou várias artes: o cliente escolhe quais usar
      let escolhas = null;
      const { ArtPickerModule } = window._modules || {};
      if (ext === 'pdf' && ArtPickerModule) {
        try {
          escolhas = await ArtPickerModule.talvezEscolher(file);
        } catch (e) {
          Logger.warn('IMAGE', 'Não foi possível procurar várias artes no PDF: ' + e.message);
        }
        if (escolhas === 'cancelar') { input.value = ''; return; }
      }

      if (escolhas) {
        for (const o of escolhas) {
          const url = o.canvas.toDataURL('image/png');
          const normalized = { name: o.nome, sourceType: 'pdf', dataURL: url, previewDataURL: url,
                               pdfRenderDataURL: url, width: o.canvas.width, height: o.canvas.height };
          const stamp = await PDFModule.createStampFromFile(file, { side: o.lado || side, cm, name: o.nome, normalized });
          // Página e pedaço do PDF (para a versão em alta qualidade)
          stamp.pagina = o.pagina;
          stamp.recorteInicial = o.recorte;
          await this._colocarNova(stamp, file);
        }
        input.value = '';
        const frenteCostas = escolhas.some(o => o.lado === 'Costas');
        NoticeModule.show('success', frenteCostas
          ? 'Artes adicionadas: a 1ª na Frente e a 2ª nas Costas (toque em "Frente / Costas" para ver).'
          : escolhas.length > 1
            ? `${escolhas.length} artes adicionadas. Elas ficam uma sobre a outra: arraste cada uma para o lugar ou mude o lado.`
            : `Arte "${escolhas[0].nome}" adicionada com sucesso.`);
        return;
      }

      const stamp = await PDFModule.createStampFromFile(file, { side, cm, name: file.name });
      await this._colocarNova(stamp, file);
      input.value = '';

      NoticeModule.show('success', `Estampa "${file.name}" adicionada com sucesso.`);
      Logger.info('IMAGE', `Estampa adicionada: ${file.name} (${stamp.cm} cm, lado: ${side})`);

    } catch (err) {
      Logger.error('IMAGE', 'Erro ao importar estampa: ' + err.message, err);
      NoticeModule.show('error', 'Erro ao importar a estampa: ' + err.message);
    }
  },

  /**
   * Coloca no preview uma estampa recém-criada a partir de um arquivo.
   * @private
   */
  async _colocarNova(stamp, file) {
    stamp.cm = Utils.clampCm(stamp.cm, PreviewGeom.maxCm(stamp)); // dentro da área máxima
    // Arquivo original enviado pelo cliente (só em memória): vai junto no envio ao atendimento
    stamp.file = file;
    // Espera a imagem decodificar: sem isso a altura é 0 ao centralizar
    await stamp.node.decode().catch(() => {});

    if (stamp.side === AppState.currentView) {
      document.getElementById("preview")?.appendChild(stamp.node);
      this.applyStampCmToNode(stamp);
      this.centerNodeInsideShirtBox(stamp.node);
      this.applySubLocationPreset(stamp, document.getElementById('subLocation')?.value);
      this.updateStampRel(stamp);
    } else {
      // Lado que não está na tela (ex.: arte das costas): fica centralizada na
      // área de impressão e é posicionada quando esse lado for exibido
      const a = PreviewGeom.area(), p = PreviewGeom.proporcao(stamp) || 1;
      const rw = Math.min(1, stamp.cm / a.w), rh = Math.min(1, stamp.cm * p / a.h);
      stamp.rel = { rx: (1 - rw) / 2, ry: (1 - rh) / 2, rw, rh };
      stamp.pendingRel = { ...stamp.rel };
    }

    AppState.stamps.push(stamp);
    this.setActiveStamp(stamp.id);
    UIModule.syncUiState();
    window._modules?.HistoryModule?.commit('add-' + stamp.id);
  },

  /**
   * Adiciona uma estampa ao preview diretamente a partir de um dataURL.
   * Utilizado internamente para duplicação de estampas.
   * @param {string} dataURL - Data URL da imagem da estampa.
   * @param {string} [name='Estampa'] - Nome da estampa.
   * @param {string} [side='Frente'] - Lado da camiseta ('Frente' ou 'Costas').
   * @param {number} [cm=20] - Largura da estampa em centímetros.
   */
  addStampFromDataURL(dataURL, name = 'Estampa', side = 'Frente', cm = 20, rel = null) {
    const preview = document.getElementById("preview");
    const img = this.createStampNode(dataURL, name);

    if (side === AppState.currentView && preview) preview.appendChild(img);

    const sObj = {
      id: Utils.genId(), node: img, dataURL,
      previewDataURL: dataURL, pdfRenderDataURL: dataURL,
      side, name, cm: Utils.clampCm(cm), hidden: false, rel: null
    };
    this.applyStampCmToNode(sObj);
    this.centerNodeInsideShirtBox(img);
    this.updateStampRel(sObj);
    // Estampa criada no lado oculto não tem como ser medida: herda a posição da original
    if (!sObj.rel && rel) sObj.rel = { ...rel };

    AppState.stamps.push(sObj);
    this.setActiveStamp(sObj.id);
    UIModule.syncUiState();
    window._modules?.HistoryModule?.commit('add-' + sObj.id);
    NoticeModule.show('success', `Estampa "${name}" adicionada com sucesso.`);
    Logger.info('IMAGE', `Estampa adicionada via dataURL: ${name}`);
  },

  /**
   * Cria o nó <img> arrastável de uma estampa (não anexa ao DOM).
   * @param {string} src - URL/dataURL da imagem.
   * @param {string} [name] - Texto alternativo.
   * @returns {HTMLImageElement}
   */
  createStampNode(src, name = 'Estampa') {
    const img = document.createElement("img");
    img.src = src;
    img.alt = name;
    img.classList.add("artOverlay");
    img.style.cssText = "position:absolute; transform:none; cursor:move; max-width:80%;";
    img.draggable = false;
    img.addEventListener("mousedown",  DragModule.startDragGeneric.bind(DragModule));
    img.addEventListener("touchstart", DragModule.startDragTouchGeneric.bind(DragModule), { passive: false });
    return img;
  },

  /**
   * Recria uma estampa a partir dos dados salvos num item do pedido.
   * A posição salva (rel) é aplicada quando a camiseta do lado dela for exibida.
   * @param {Object} dados - Estampa salva (sem nó DOM).
   * @returns {Object} Estampa pronta para AppState.stamps.
   */
  restoreStamp(dados) {
    const s = {
      ...dados,
      id: Utils.genId(),
      _relWait: false,
      rel: dados.rel ? { ...dados.rel } : null,
      pendingRel: dados.rel ? { ...dados.rel } : null
    };
    s.node = this.createStampNode(s.previewDataURL || s.dataURL, s.name);
    if (s.hidden) s.node.style.display = 'none';
    // Ao terminar de carregar a imagem, aplica tamanho e a posição salva
    s.node.addEventListener('load', () => {
      if (s.node.parentNode) this.applyStampCmToNode(s);
    }, { once: true });
    return s;
  },

  /**
   * Aplica a largura em centímetros ao nó DOM da estampa, convertendo para pixels.
   * Se houver posição pendente (estampa restaurada de um item), posiciona por ela.
   * @param {Object} s - Objeto da estampa.
   * @param {{manterCentro?: boolean}} [opc] - manterCentro: o cliente mudou o
   *   tamanho; a estampa cresce/diminui a partir do centro e continua dentro
   *   da área de impressão (antes crescia para a direita e para baixo).
   */
  applyStampCmToNode(s, opc = {}) {
    const pxPerCm = PreviewGeom.getPxPerCmPreview();
    if (!pxPerCm || !s.node) return;
    const n = s.node;
    const pronta = opc.manterCentro && !s.pendingRel && n.parentNode && n.complete && n.naturalWidth && n.offsetWidth && n.style.left;
    const antes = pronta && { cx: parseFloat(n.style.left) + n.offsetWidth / 2, cy: parseFloat(n.style.top) + n.offsetHeight / 2 };
    // Nunca passa da área máxima da camiseta (largura e altura)
    const cm = s.cm = Utils.clampCm(s.cm ?? 20, PreviewGeom.maxCm(s));
    n.style.width  = (cm * pxPerCm) + 'px';
    const info = document.querySelector(`#stampsList .stampItem[data-id="${s.id}"] .stampSizeInfo`);
    if (info) info.innerHTML = _textoMedidas(s);
    n.style.height = 'auto';
    if (antes) {
      const shirt = PreviewGeom.getRenderedShirtRect();
      const prev  = document.getElementById('preview')?.getBoundingClientRect();
      if (shirt && prev) {
        const bx = shirt.left - prev.left, by = shirt.top - prev.top;
        const w = n.offsetWidth, h = n.offsetHeight;
        const caber = (v, a, b) => (b < a ? a : Math.max(a, Math.min(b, v)));
        n.style.left = caber(antes.cx - w / 2, bx, bx + shirt.width  - w) + 'px';
        n.style.top  = caber(antes.cy - h / 2, by, by + shirt.height - h) + 'px';
      }
    }
    if (s.pendingRel) {
      // Ainda não dá para posicionar (lado oculto ou imagem carregando): mantém o rel salvo
      if (!this._placeFromRel(s, s.pendingRel)) return;
      s.pendingRel = null;
    }
    this.updateStampRel(s);
  },

  /**
   * Posiciona o nó pela posição relativa (0..1) à área de impressão.
   * @returns {boolean} true se conseguiu posicionar.
   * @private
   */
  _placeFromRel(s, rel) {
    if (s.side !== AppState.currentView || !s.node.parentNode) return false;
    if (!s.node.complete || !s.node.naturalWidth) return false;
    const shirt = PreviewGeom.getRenderedShirtRect();
    const prev  = document.getElementById("preview")?.getBoundingClientRect();
    if (!shirt || !prev) return false;
    s.node.style.left = (shirt.left - prev.left + rel.rx * shirt.width)  + 'px';
    s.node.style.top  = (shirt.top  - prev.top  + rel.ry * shirt.height) + 'px';
    return true;
  },

  /**
   * Reduz as estampas que passaram da área máxima (ex.: trocou de Masculina
   * 38 × 42 cm para Feminina 30 × 35 cm) e avisa o cliente.
   */
  limitarEstampas() {
    const a = PreviewGeom.area();
    const reduzidas = [];
    AppState.stamps.forEach(s => {
      const max = PreviewGeom.maxCm(s);
      if ((s.cm ?? 20) > max) {
        s.cm = max;
        reduzidas.push(s.name || 'Estampa');
        if (s.side === AppState.currentView) this.applyStampCmToNode(s, { manterCentro: true });
      }
    });
    this.renderStampsList();
    if (reduzidas.length) {
      NoticeModule.show('info', `${reduzidas.length > 1 ? 'Estampas reduzidas' : `Estampa "${reduzidas[0]}" reduzida`} para caber na área máxima da camiseta ${a.nome} (${a.w} × ${a.h} cm).`);
    }
  },

  /**
   * Aplica o pré-posicionamento escolhido em "Tamanho rápido".
   * Peito: 10 cm, no lado direito da visualização e um pouco abaixo do topo
   * da área de impressão (valores em CHEST_PRESET, constants.js).
   * Só vale para estampas da Frente que estão visíveis na tela.
   */
  applySubLocationPreset(s, subLoc) {
    if (subLoc !== 'Peito' || !s || !s.node) return;
    if (s.side !== 'Frente' || s.side !== AppState.currentView) return;
    const shirt = PreviewGeom.getRenderedShirtRect();
    if (!shirt) return;
    s.cm = CHEST_PRESET.cm;
    this.applyStampCmToNode(s);
    const w = s.node.offsetWidth;
    DragModule.updateStampPosition(s, CHEST_PRESET.centerX * shirt.width - w / 2, CHEST_PRESET.top * shirt.height);
  },

  /**
   * Centraliza um nó DOM dentro da área de impressão da camiseta.
   * @param {HTMLElement} node - Elemento DOM da estampa.
   */
  centerNodeInsideShirtBox(node) {
    const shirtRect  = PreviewGeom.getRenderedShirtRect();
    const previewBox = document.getElementById("preview")?.getBoundingClientRect();
    if (!shirtRect || !previewBox) return;
    const r    = node.getBoundingClientRect();
    const left = (shirtRect.left - previewBox.left) + (shirtRect.width  - r.width)  / 2;
    const top  = (shirtRect.top  - previewBox.top)  + (shirtRect.height - r.height) / 2;
    node.style.left = left + 'px';
    node.style.top  = top  + 'px';
  },

  /**
   * Atualiza a posição relativa de uma estampa em relação à área de impressão.
   * Só atualiza se a estampa estiver no lado atualmente visível.
   * @param {Object} s - Objeto da estampa.
   */
  updateStampRel(s) {
    if (!s || !s.node) return;
    if (s.side !== AppState.currentView || !s.node.parentNode) return;
    if (s.pendingRel) return;
    // Sem a imagem carregada a altura é 0 e o rel ficaria errado: mede ao carregar
    if (!s.node.complete || !s.node.naturalWidth) {
      if (!s._relWait) {
        s._relWait = true;
        s.node.addEventListener('load', () => { s._relWait = false; this.updateStampRel(s); }, { once: true });
      }
      return;
    }
    const rel = PreviewGeom.getPreviewRelRect(s.node);
    if (rel) s.rel = rel;
  },

  /**
   * Define a estampa ativa, atualizando o highlight visual e o HUD.
   * @param {string|null} id - ID da estampa a ser ativada, ou null para desativar.
   */
  setActiveStamp(id) {
    AppState.activeStampId = id;
    AppState.stamps.forEach(s => {
      if (s.node) s.node.classList.toggle('active', s.id === id);
    });
    AlignModule.setHudVisible(!!AppState.getActiveStamp());
    this.renderStampsList();
  },

  /**
   * Duplica uma estampa existente, criando uma cópia com o mesmo dataURL e configurações.
   * @param {string} id - ID da estampa a ser duplicada.
   */
  duplicateStamp(id) {
    const s = AppState.stamps.find(x => x.id === id);
    if (!s) return;
    Logger.info('IMAGE', `Duplicando estampa: ${s.name}`);
    this.addStampFromDataURL(s.dataURL, (s.name || 'Estampa') + ' (cópia)', s.side, s.cm, s.rel);
    // A cópia usa a mesma arte: mantém a referência ao arquivo original
    const copia = AppState.stamps[AppState.stamps.length - 1];
    if (copia) {
      copia.file = s.file; copia.original = s.original; copia.edicoes = s.edicoes;
      copia.pagina = s.pagina; copia.recorteInicial = s.recorteInicial;
      copia.width = s.width; copia.height = s.height;
      window._modules?.HistoryModule?.commit('add-' + copia.id); // mesma chave: junta com o passo da cópia
    }
  },

  /**
   * Remove uma estampa após confirmação do usuário.
   * Remove o nó DOM e o objeto do array de estampas.
   * @param {string} id - ID da estampa a ser removida.
   */
  removeStamp(id, confirmar = true) {
    if (confirmar && !confirm('Remover esta estampa?')) return;
    const idx = AppState.stamps.findIndex(x => x.id === id);
    if (idx < 0) return;
    const s = AppState.stamps[idx];
    if (s.node && s.node.parentNode) s.node.parentNode.removeChild(s.node);
    AppState.stamps.splice(idx, 1);
    Logger.info('IMAGE', `Estampa removida: ${s.name}`);

    const newActive = AppState.stamps.find(x => !x.hidden)?.id || null;
    this.setActiveStamp(newActive);
    AlignModule.setHudVisible(!!AppState.activeStampId);
    this.syncUiState();
    window._modules?.HistoryModule?.commit('remove-' + id);
  },

  /**
   * Sincroniza o estado da UI com o estado atual das estampas e do pedido.
   * Atualiza: contador de itens no cabeçalho, botão de PDF, lista de estampas.
   */
  syncUiState() {
    const countEl = document.getElementById("orderCount");
    if (countEl) countEl.textContent = AppState.orderItems.length;

    const btnPdf = document.getElementById("btnGerarPdf");
    if (btnPdf) btnPdf.disabled = AppState.orderItems.length === 0;

    this.renderStampsList();
  },

  /**
   * Remove todas as estampas após confirmação do usuário.
   */
  clearAllStamps() {
    if (!AppState.stamps.length) return;
    if (!confirm('Remover todas as estampas?')) return;
    AppState.stamps.forEach(s => {
      if (s.node && s.node.parentNode) s.node.parentNode.removeChild(s.node);
    });
    AppState.stamps = [];
    AppState.activeStampId = null;
    AlignModule.setHudVisible(false);
    this.syncUiState();
    window._modules?.HistoryModule?.commit('clear');
    NoticeModule.show('info', 'Todas as estampas foram removidas.');
    Logger.info('IMAGE', 'Todas as estampas foram removidas.');
  },

  /**
   * Atualiza a visibilidade de uma estampa no preview conforme o lado atual.
   * Adiciona ou remove o nó DOM do preview e reaplica as dimensões em cm.
   * @param {Object} s - Objeto da estampa.
   */
  refreshStampSideInPreview(s) {
    const preview = document.getElementById("preview");
    if (!preview) return;
    if (s.side === AppState.currentView && !s.hidden) {
      if (!s.node.parentNode) preview.appendChild(s.node);
      this.applyStampCmToNode(s);
    } else {
      if (s.node.parentNode) s.node.parentNode.removeChild(s.node);
    }
  },

  /**
   * Renderiza a lista de estampas no painel direito da interface.
   * Exibe miniaturas, controles de lado, largura, visibilidade, duplicar e remover.
   */
  renderStampsList() {
    const list = document.getElementById('stampsList');
    if (!list) return;
    list.innerHTML = '';

    if (!AppState.stamps.length) {
      list.innerHTML = '<p style="font-size:12px;color:#aaa;text-align:center;padding:20px 0;">Nenhuma estampa adicionada.</p>';
      UIModule.syncUiState();
      return;
    }

    AppState.stamps.forEach(s => {
      const item = document.createElement('div');
      item.className = 'stampItem' + (s.id === AppState.activeStampId ? ' active' : '');
      item.dataset.id = s.id;

      const thumb = document.createElement('img');
      thumb.className = 'stampThumb';
      thumb.src = s.previewDataURL || s.dataURL;
      thumb.alt = s.name || 'Estampa';

      // Metadados da estampa
      const meta = document.createElement('div');
      meta.className = 'stampMeta';

      const sideSelect = document.createElement('select');
      ['Frente', 'Costas'].forEach(v => {
        const o = document.createElement('option');
        o.value = v; o.text = v; sideSelect.append(o);
      });
      sideSelect.value = s.side;
      sideSelect.onchange = () => {
        s.side = sideSelect.value;
        this.refreshStampSideInPreview(s);
        window._modules?.HistoryModule?.commit('side-' + s.id);
      };

      const maxCm = PreviewGeom.maxCm(s);
      const cmInput = document.createElement('input');
      cmInput.type  = 'number';
      cmInput.min   = 5;
      cmInput.max   = maxCm;
      cmInput.step  = 1;
      cmInput.value = (s.cm ?? 20);
      cmInput.inputMode = 'decimal';
      cmInput.onchange = () => {
        const pedido = parseFloat(cmInput.value || '20');
        const max = PreviewGeom.maxCm(s);
        s.cm = Utils.clampCm(pedido, max);
        if (pedido > max) {
          const a = PreviewGeom.area();
          NoticeModule.show('info', `O máximo para esta arte é ${String(max).replace('.', ',')} cm de largura (área da camiseta ${a.nome}: ${a.w} × ${a.h} cm).`);
        }
        cmInput.value = s.cm;
        if (s.side === AppState.currentView) this.applyStampCmToNode(s, { manterCentro: true });
        medidas.innerHTML = _textoMedidas(s);
        window._modules?.HistoryModule?.commit('cm-' + s.id);
      };

      // Tamanho final (largura × altura) e, no Infantil/Juvenil, a medida infantil
      const medidas = document.createElement('div');
      medidas.className = 'stampSizeInfo';
      medidas.innerHTML = _textoMedidas(s);

      const visToggle = document.createElement('input');
      visToggle.type    = 'checkbox';
      visToggle.checked = !s.hidden;
      visToggle.onchange = () => {
        s.hidden = !visToggle.checked;
        // Reanexa ou remove o nó do preview (antes a estampa não reaparecia)
        this.refreshStampSideInPreview(s);
        s.node.style.display = s.hidden ? 'none' : 'block';
        UIModule.syncUiState();
        window._modules?.HistoryModule?.commit('vis-' + s.id);
      };

      meta.append(
        _labelWrap('Lado:', sideSelect),
        _labelWrap('Largura (cm):', Utils.stepper(cmInput)),
        _labelWrap('Visível', visToggle)
      );

      // Botões de ação
      const btns = document.createElement('div');
      btns.className = 'stampRowBtns';
      const dupBtn = _mkBtn('Duplicar', () => this.duplicateStamp(s.id));
      const editBtn = _mkBtn('Editar', () => window._modules.EditModule.open(s.id));
      const delBtn = _mkBtn('Remover',  () => this.removeStamp(s.id));
      delBtn.classList.add('btn-danger');
      btns.append(dupBtn, editBtn, delBtn);

      item.append(thumb, meta, medidas, btns);
      item.onclick = e => {
        if (
          e.target.tagName !== 'BUTTON' &&
          e.target.type    !== 'checkbox' &&
          e.target.tagName !== 'SELECT' &&
          e.target.tagName !== 'INPUT'
        ) {
          this.setActiveStamp(s.id);
        }
      };
      list.appendChild(item);
    });

    UIModule.syncUiState();
  },

  /**
   * Alinha ou move a estampa ativa conforme o modo especificado.
   * Modos de alinhamento: centerX, centerY, centerBoth, left, right, top, bottom.
   * Modos de movimento: moveLeft, moveRight, moveUp, moveDown.
   * @param {string} mode - Modo de alinhamento ou movimento.
   */
  alignStamp(mode, step = 5) {
    const s = AppState.getActiveStamp();
    if (!s) return;
    const node      = s.node;
    const shirtRect = PreviewGeom.getRenderedShirtRect();
    if (!shirtRect) return;

    const w    = node.offsetWidth;
    const h    = node.offsetHeight;
    const curX = node.getBoundingClientRect().left - shirtRect.left;
    const curY = node.getBoundingClientRect().top  - shirtRect.top;
    const maxX = shirtRect.width  - w;
    const maxY = shirtRect.height - h;

    let tx = curX, ty = curY;
    switch (mode) {
      case 'centerX':    tx = maxX / 2; break;
      case 'centerY':    ty = maxY / 2; break;
      case 'centerBoth': tx = maxX / 2; ty = maxY / 2; break;
      case 'left':       tx = 0; break;
      case 'right':      tx = maxX; break;
      case 'top':        ty = 0; break;
      case 'bottom':     ty = maxY; break;
      case 'moveLeft':   tx -= step; break;
      case 'moveRight':  tx += step; break;
      case 'moveUp':     ty -= step; break;
      case 'moveDown':   ty += step; break;
    }
    DragModule.updateStampPosition(s, tx, ty);
  },

  /**
   * Delega o início do nudge para AlignModule.
   * @param {string} mode - Direção do movimento.
   */
  startNudge(mode) {
    AlignModule.startNudge(mode);
  },

  /**
   * Delega a parada do nudge para AlignModule.
   */
  stopNudge() {
    AlignModule.stopNudge();
  }
};

// ============================================================
//  HELPERS PRIVADOS DO MÓDULO
//  Não são exportados pois são usados apenas internamente.
// ============================================================

/**
 * Cria um elemento label com texto e um nó filho (input, select, etc).
 * @param {string} txt - Texto do label.
 * @param {HTMLElement} node - Elemento filho.
 * @returns {HTMLLabelElement}
 */
function _labelWrap(txt, node) {
  const w    = document.createElement('label');
  w.className = 'labelWrap';
  const span = document.createElement('span');
  span.textContent = txt;
  w.append(span, node);
  return w;
}

/**
 * Cria um botão com texto e handler de clique.
 * @param {string} t - Texto do botão.
 * @param {Function} fn - Função chamada ao clicar.
 * @returns {HTMLButtonElement}
 */
function _mkBtn(t, fn) {
  const b = document.createElement('button');
  b.textContent = t;
  b.onclick = e => { e.stopPropagation(); fn(); };
  return b;
}

/** Texto das medidas da estampa: "25 × 28,6 cm" (+ infantil, quando houver). */
function _textoMedidas(s) {
  const m = PreviewGeom.medidas(s), a = PreviewGeom.area();
  const f = v => String(v).replace('.', ',');
  const max = `máx. ${a.w} × ${a.h} cm`;
  if (!m.infantil) return `📐 ${f(m.w)} × ${f(m.h)} cm <span>(${max})</span>`;
  return `📐 <b>${a.nome}:</b> ${f(m.w)} × ${f(m.h)} cm <span>(${max})</span><br>` +
         `📐 <b>${a.infantil.nome}:</b> ${f(m.infantil.w)} × ${f(m.infantil.h)} cm <span>(reduzida automaticamente)</span>`;
}
