/**
 * @module main
 * @description Ponto de entrada da aplicação. Orquestra a inicialização de todos os módulos.
 *
 * Responsabilidades:
 *  - Importar todos os módulos da aplicação.
 *  - Expor os módulos necessários no escopo global (window) para compatibilidade
 *    com os atributos on* do HTML (onclick, onchange, etc.).
 *  - Registrar os event listeners globais via globalEvents.js.
 *  - Inicializar a aplicação no evento DOMContentLoaded.
 *
 * Dependências: todos os módulos da aplicação.
 * Módulos relacionados: todos.
 *
 * Observação:
 *  A exposição via window é necessária porque o HTML utiliza atributos inline
 *  como onclick="UIModule.toggleView()" e onclick="StampModule.clearAllStamps()".
 *  Isso mantém 100% de compatibilidade com o HTML original sem alterá-lo.
 *
 *  O objeto window._modules é utilizado para resolver dependências circulares:
 *  módulos que precisam de outros módulos os acessam via window._modules
 *  em vez de importação direta, evitando erros de referência circular.
 */

import { AppState }         from './core/appState.js';
import { UIModule }        from './ui/uiModule.js';
import { NoticeModule }    from './ui/noticeModule.js';
import { StampModule }     from './image/stampModule.js';
import { EditModule }      from './image/editModule.js';
import { SizeModule }      from './products/sizeModule.js';
import { OrderModule }     from './products/orderModule.js';
import { PDFModule }       from './pdf/pdfModule.js';
import { AlignModule }     from './preview/alignModule.js';
import { PreviewGeom }     from './preview/previewGeometry.js';
import { DragModule }      from './events/dragModule.js';
import { registerGlobalEvents, initConfigurator } from './events/globalEvents.js';

// ============================================================
//  REGISTRO CENTRAL DE MÓDULOS
//  Utilizado para resolver dependências circulares.
//  Módulos que precisam de outros módulos os acessam via window._modules.
// ============================================================
window._modules = {
  UIModule,
  NoticeModule,
  StampModule,
  EditModule,
  SizeModule,
  OrderModule,
  PDFModule,
  AlignModule,
  PreviewGeom,
  DragModule
};

// ============================================================
//  EXPOSIÇÃO GLOBAL
//  Necessária para compatibilidade com atributos on* do HTML.
//  Ex: onclick="UIModule.toggleView()", onclick="PDFModule.gerarPDF()"
// ============================================================
window.UIModule         = UIModule;
window.StampModule      = StampModule;
window.EditModule       = EditModule;
window.SizeModule       = SizeModule;
window.PDFModule        = PDFModule;
window.OrderModule      = OrderModule;
window.AlignModule      = AlignModule;
window.NoticeModule     = NoticeModule;
window.PreviewGeom      = PreviewGeom;
window.DragModule       = DragModule;

// ValidationModule exposto para compatibilidade (lógica inline no HTML original)
window.ValidationModule = {
  /**
   * Valida o estado da aplicação antes de gerar o PDF.
   * Verifica se há estampas visíveis e quantidades definidas.
   * @returns {boolean} true se válido, false caso contrário.
   */
  validateBeforePdf() {
    NoticeModule.clear();
    if (!window._modules.StampModule || !AppState.stamps.some(s => !s.hidden)) {
      NoticeModule.show('error', 'Adicione pelo menos 1 estampa visível antes de gerar o PDF.');
      return false;
    }
    const total = SizeModule.collectSizes().reduce((sum, s) => sum + (parseInt(s.qty || 0, 10) || 0), 0);
    if (total <= 0) {
      NoticeModule.show('error', 'Defina as quantidades: ao menos 1 tamanho com quantidade maior que zero.');
      return false;
    }
    return true;
  }
};

// ============================================================
//  INICIALIZAÇÃO
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  // Registra todos os event listeners globais (drag, resize, nudge)
  registerGlobalEvents(window._modules);
  // Inicializa a aplicação (popula UI, configura estado inicial)
  initConfigurator();
  // Carrega o pedido salvo no navegador e desenha "Itens do pedido"
  OrderModule.init();
});
