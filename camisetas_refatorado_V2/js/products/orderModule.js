/**
 * @module orderModule
 * @description Gerencia o pedido multi-item da aplicação.
 *
 * Responsabilidades:
 *  - Salvar o item atual (camiseta + estampas + quantidades) no pedido.
 *  - Listar os itens já salvos ("Itens do pedido") com Editar, Duplicar e Remover.
 *  - Reabrir um item salvo no editor e, ao salvar, atualizar esse mesmo item.
 *  - O pedido fica só na memória da página: ao recarregar, começa do zero.
 *  - Limpar o pedido completo.
 *
 * Dependências: appState.js, constants.js, logger.js, noticeModule.js,
 *               sizeModule.js, alignModule.js, uiModule.js.
 * Módulos relacionados: pdfModule.js, stampModule.js (via window._modules).
 */

import { AppState } from '../core/appState.js';
import { COLOR_HEX } from '../core/constants.js';
import { Logger } from '../core/logger.js';
import { NoticeModule } from '../ui/noticeModule.js';
import { UIModule } from '../ui/uiModule.js';
import { SizeModule } from './sizeModule.js';
import { AlignModule } from '../preview/alignModule.js';

/** Chave usada por uma versão anterior que guardava o pedido no navegador. */
const OLD_STORAGE_KEY = 'artrock.pedido.v1';

/** Soma das quantidades de um item ({ P: 2, M: 3 } → 5). */
const totalPecas = q => Object.values(q || {}).reduce((s, n) => s + (parseInt(n, 10) || 0), 0);

export const OrderModule = {
  /** Desenha a lista (vazia) na inicialização. O pedido não é guardado no navegador. */
  init() {
    // Remove o que uma versão anterior possa ter deixado salvo no navegador
    try { localStorage.removeItem(OLD_STORAGE_KEY); } catch { /* sem acesso ao storage */ }
    this._refresh();
  },

  /**
   * Salva o item atual no pedido — ou, se um item estiver em edição, atualiza esse item.
   * Valida que há estampas adicionadas e pelo menos uma quantidade maior que zero.
   * Depois limpa o editor para o próximo item.
   */
  saveItem() {
    const total = SizeModule.collectSizes().reduce((sum, s) => sum + (parseInt(s.qty || 0, 10) || 0), 0);
    if (total === 0 || AppState.stamps.length === 0) {
      NoticeModule.show("error", "Adicione estampas e quantidades antes de salvar.");
      Logger.warn('STATE', 'Tentativa de salvar item sem estampas ou quantidades.');
      return;
    }

    const category = document.getElementById("category")?.value;
    const item = {
      category: category,
      fabric:   document.getElementById("fabricType")?.value,
      color:    AppState.selectedColor,
      // Cópia leve: descarta o nó DOM e os controles internos e compartilha as
      // imagens (strings imutáveis). Posição ainda não aplicada (lado oculto) vale como rel.
      stamps: AppState.stamps.map(({ node, pendingRel, _relWait, ...dados }) => {
        const rel = pendingRel || dados.rel;
        return { ...dados, rel: rel ? { ...rel } : null };
      }),
      quantities: JSON.parse(JSON.stringify(AppState.quantities[category] || {}))
    };

    const idx = AppState.editingIndex;
    if (idx != null && AppState.orderItems[idx]) {
      AppState.orderItems[idx] = item;
      Logger.info('STATE', `Item #${idx + 1} atualizado no pedido.`);
      NoticeModule.show("success", `Modelo #${idx + 1} atualizado no pedido!`);
    } else {
      AppState.orderItems.push(item);
      Logger.info('STATE', `Item #${AppState.orderItems.length} salvo no pedido.`);
      NoticeModule.show("success", "Modelo #" + AppState.orderItems.length + " salvo no pedido!");
    }

    AppState.editingIndex = null;
    this._resetEditor(category);
    this._refresh();
  },

  /**
   * Reabre um item salvo no editor (camiseta, estampas com posição/tamanho e quantidades).
   * @param {number} index - Posição do item em AppState.orderItems.
   */
  editItem(index) {
    const item = AppState.orderItems[index];
    if (!item) return;
    if (AppState.editingIndex === index) return;
    if (AppState.stamps.length &&
        !confirm('Abrir este item no editor? O que está no editor e não foi salvo será descartado.')) return;

    const { StampModule } = window._modules || {};
    if (!StampModule) return;

    this._resetEditor(document.getElementById("category")?.value);
    AppState.editingIndex = index;

    // Produto
    const catEl = document.getElementById("category");
    const fabEl = document.getElementById("fabricType");
    if (catEl) catEl.value = item.category;
    if (fabEl) fabEl.value = item.fabric;
    AppState.selectedColor = item.color;
    AppState.quantities[item.category] = JSON.parse(JSON.stringify(item.quantities || {}));

    // Estampas (cópias: o item salvo só muda quando o usuário salvar)
    AppState.stamps = (item.stamps || []).map(d => StampModule.restoreStamp(d));
    const primeira = AppState.stamps.find(s => !s.hidden) || AppState.stamps[0];

    // Mostra o lado da primeira estampa visível
    const lado = primeira?.side === 'Costas' ? 'Costas' : 'Frente';
    const locEl = document.getElementById("stampLocation");
    if (locEl) locEl.value = lado;
    AppState.currentView = lado;
    UIModule.populateSubLocations();
    UIModule.updateColorOptions();   // redesenha a camiseta e reanexa as estampas do lado atual

    SizeModule.updateSizeTable();
    SizeModule.backToConfig();
    StampModule.setActiveStamp(primeira?.id || null);

    this._refresh();
    NoticeModule.show('info', `Editando o Modelo #${index + 1}. Altere o que quiser e clique em "Salvar alterações".`);
    Logger.info('STATE', `Item #${index + 1} aberto para edição.`);
    document.getElementById('overallContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  /** Cancela a edição de um item: descarta as mudanças e limpa o editor. */
  cancelEdit() {
    if (AppState.editingIndex == null) return;
    if (!confirm('Cancelar a edição? As alterações não salvas serão descartadas.')) return;
    const n = AppState.editingIndex + 1;
    AppState.editingIndex = null;
    this._resetEditor(document.getElementById("category")?.value);
    this._refresh();
    NoticeModule.show('info', `Edição do Modelo #${n} cancelada.`);
  },

  /** Cria uma cópia de um item logo depois dele. */
  duplicateItem(index) {
    const item = AppState.orderItems[index];
    if (!item) return;
    // Cópia sem JSON: preserva o arquivo original (File) de cada arte
    const copia = {
      ...item,
      stamps: item.stamps.map(st => ({ ...st, rel: st.rel ? { ...st.rel } : null })),
      quantities: { ...item.quantities }
    };
    AppState.orderItems.splice(index + 1, 0, copia);
    if (AppState.editingIndex != null && AppState.editingIndex > index) AppState.editingIndex++;
    this._refresh();
    NoticeModule.show('success', `Modelo #${index + 1} duplicado.`);
  },

  /** Remove um item do pedido. */
  removeItem(index) {
    if (!AppState.orderItems[index]) return;
    if (!confirm(`Remover o Modelo #${index + 1} do pedido?`)) return;
    AppState.orderItems.splice(index, 1);
    if (AppState.editingIndex === index) {
      // O conteúdo continua no editor e pode ser salvo como item novo
      AppState.editingIndex = null;
      NoticeModule.show('info', 'Item removido. O que está no editor pode ser salvo como um novo item.');
    } else if (AppState.editingIndex != null && AppState.editingIndex > index) {
      AppState.editingIndex--;
    }
    this._refresh();
  },

  /**
   * Limpa todo o pedido após confirmação do usuário.
   * Atualiza a UI para refletir o estado vazio do pedido.
   */
  clearOrder() {
    if (confirm("Deseja realmente limpar todo o pedido?")) {
      AppState.orderItems = [];
      AppState.editingIndex = null;
      Logger.info('STATE', 'Pedido limpo pelo usuário.');
        this._refresh();
      NoticeModule.show("info", "Pedido limpo.");
    }
  },

  /** Desenha a lista "Itens do pedido". */
  renderOrderList() {
    const list = document.getElementById('orderList');
    if (!list) return;
    list.innerHTML = '';

    if (!AppState.orderItems.length) {
      list.innerHTML = '<p class="orderEmpty">Nenhum item salvo ainda. Monte sua camiseta e clique em "Salvar no Pedido".</p>';
      return;
    }

    AppState.orderItems.forEach((item, i) => {
      const editando = AppState.editingIndex === i;
      const card = document.createElement('div');
      card.className = 'orderCard' + (editando ? ' editing' : '');

      // Miniatura: primeira estampa visível sobre a cor da camiseta
      const thumb = document.createElement('div');
      thumb.className = 'orderThumb';
      thumb.style.background = COLOR_HEX[item.color] || '#ccc';
      const est = (item.stamps || []).find(s => !s.hidden) || (item.stamps || [])[0];
      if (est) {
        const img = document.createElement('img');
        img.src = est.previewDataURL || est.dataURL;
        img.alt = est.name || 'Estampa';
        thumb.appendChild(img);
      }

      const info = document.createElement('div');
      info.className = 'orderInfo';
      const nEst = (item.stamps || []).filter(s => !s.hidden).length;
      const titulo = document.createElement('strong');
      titulo.textContent = `Modelo #${i + 1}` + (editando ? ' • em edição' : '');
      info.appendChild(titulo);
      [
        `${item.category} • ${item.fabric}`,
        `Cor: ${item.color}`,
        `${nEst} estampa(s) • ${totalPecas(item.quantities)} peça(s)`
      ].forEach(t => {
        const d = document.createElement('span');
        d.textContent = t;
        info.appendChild(d);
      });

      const btns = document.createElement('div');
      btns.className = 'orderBtns';
      btns.append(
        _btn(editando ? 'Em edição' : '✏️ Editar', () => this.editItem(i), '', editando),
        _btn('Duplicar', () => this.duplicateItem(i), 'btn-outline'),
        _btn('Remover', () => this.removeItem(i), 'btn-danger')
      );

      card.append(thumb, info, btns);
      list.appendChild(card);
    });
  },

  /** Atualiza botões do rodapé conforme o modo (novo item × editando). @private */
  _updateEditingUi() {
    const idx = AppState.editingIndex;
    const btnSave   = document.getElementById('btnSaveItem');
    const btnCancel = document.getElementById('btnCancelEdit');
    if (btnSave) btnSave.textContent = idx != null ? `💾 Salvar alterações do Modelo #${idx + 1}` : '➕ Salvar no Pedido';
    if (btnCancel) btnCancel.style.display = idx != null ? '' : 'none';
  },

  /** Redesenha lista, rodapé e contadores. @private */
  _refresh() {
    this.renderOrderList();
    this._updateEditingUi();
    const { StampModule } = window._modules || {};
    if (StampModule) StampModule.syncUiState();
    else UIModule.syncUiState();
  },

  /** Remove as estampas do editor e zera as quantidades da categoria. @private */
  _resetEditor(category) {
    AppState.stamps.forEach(s => {
      if (s.node && s.node.parentNode) s.node.parentNode.removeChild(s.node);
    });
    AppState.stamps = [];
    AppState.activeStampId = null;
    AlignModule.setHudVisible(false);

    if (category && AppState.quantities[category]) {
      Object.keys(AppState.quantities[category]).forEach(k => { AppState.quantities[category][k] = 0; });
    }
    SizeModule.updateSizeTable();
    SizeModule.backToConfig();
  },
};

/** Cria um botão com texto, ação e classe opcional. */
function _btn(texto, fn, cls = '', disabled = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = texto;
  if (cls) b.className = cls;
  b.disabled = disabled;
  b.onclick = e => { e.stopPropagation(); fn(); };
  return b;
}
