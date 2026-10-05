/**
 * @module orderModule
 * @description Gerencia o pedido multi-item da aplicação.
 *
 * Responsabilidades:
 *  - Salvar o item atual (camiseta + estampas + quantidades) no pedido.
 *  - Limpar o pedido completo.
 *  - Resetar o estado da tela após salvar um item.
 *
 * Dependências: appState.js, logger.js, noticeModule.js, sizeModule.js, alignModule.js.
 * Módulos relacionados: pdfModule.js, stampModule.js, uiModule.js.
 */

import { AppState } from '../core/appState.js';
import { Logger } from '../core/logger.js';
import { NoticeModule } from '../ui/noticeModule.js';
import { SizeModule } from './sizeModule.js';
import { AlignModule } from '../preview/alignModule.js';

export const OrderModule = {
  /**
   * Salva o item atual no pedido.
   * Valida que há estampas adicionadas e pelo menos uma quantidade maior que zero.
   * Após salvar, limpa as estampas da tela e reseta as quantidades.
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
      // Deep copy das estampas para preservar o estado no momento do salvamento
      // Cópia leve: descarta o nó DOM e compartilha as imagens (strings imutáveis)
      stamps:     AppState.stamps.map(({ node, ...dados }) => ({ ...dados, rel: dados.rel ? { ...dados.rel } : null })),
      quantities: JSON.parse(JSON.stringify(AppState.quantities[category] || {}))
    };

    AppState.orderItems.push(item);
    Logger.info('STATE', `Item #${AppState.orderItems.length} salvo no pedido.`);
    NoticeModule.show("success", "Modelo #" + AppState.orderItems.length + " salvo no pedido!");

    // Remove as estampas do DOM e limpa o estado
    AppState.stamps.forEach(s => {
      if (s.node && s.node.parentNode) s.node.parentNode.removeChild(s.node);
    });
    AppState.stamps = [];
    AppState.activeStampId = null;
    AlignModule.setHudVisible(false);

    // Reseta as quantidades da categoria atual no estado
    if (AppState.quantities[category]) {
      Object.keys(AppState.quantities[category]).forEach(k => {
        AppState.quantities[category][k] = 0;
      });
    }

    SizeModule.updateSizeTable();
    SizeModule.backToConfig();

    // Atualiza a UI via StampModule (referência lazy para evitar circular)
    const { StampModule } = window._modules || {};
    if (StampModule) StampModule.syncUiState();
  },

  /**
   * Limpa todo o pedido após confirmação do usuário.
   * Atualiza a UI para refletir o estado vazio do pedido.
   */
  clearOrder() {
    if (confirm("Deseja realmente limpar todo o pedido?")) {
      AppState.orderItems = [];
      Logger.info('STATE', 'Pedido limpo pelo usuário.');
      const { StampModule } = window._modules || {};
      if (StampModule) StampModule.syncUiState();
      NoticeModule.show("info", "Pedido limpo.");
    }
  }
};
