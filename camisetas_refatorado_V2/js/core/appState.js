/**
 * @module appState
 * @description Estado centralizado e único da aplicação (Single Source of Truth).
 *
 * Responsabilidades:
 *  - Armazenar o estado global da aplicação (cor selecionada, estampas, pedido, etc.).
 *  - Prover o método auxiliar `getActiveStamp` para acesso rápido à estampa ativa.
 *  - Centralizar variáveis de controle de drag e nudge.
 *
 * Dependências: nenhuma.
 * Módulos relacionados: todos os módulos que leem ou escrevem estado.
 *
 * Observação:
 *  Este objeto é mutável por design — os módulos o importam e modificam suas
 *  propriedades diretamente, mantendo compatibilidade com o comportamento original.
 */

export const AppState = {
  /** Lado atualmente exibido no preview: 'Frente' ou 'Costas'. */
  currentView: "Frente",

  /** Cor da camiseta selecionada pelo usuário. */
  selectedColor: "Preto",

  /**
   * Lista de estampas adicionadas ao preview.
   * Cada estampa é um objeto:
   * { id, node, dataURL, previewDataURL, pdfRenderDataURL, side, name, cm, hidden, rel }
   */
  stamps: [],

  /** ID da estampa atualmente ativa (selecionada para edição). */
  activeStampId: null,

  /** Indica se a área de impressão (shirtBox) deve ser exibida no preview. */
  showShirtBox: true,

  /** Indica se a área de impressão deve aparecer no PDF (modo debug). */
  showPdfShirtBox: false,

  /**
   * Persistência de quantidades por categoria e tamanho.
   * Estrutura: { "Masculina": { "P": 10, "M": 5, ... }, ... }
   */
  quantities: {},

  /**
   * Lista de itens salvos no pedido.
   * Cada item é um snapshot do estado no momento de "Salvar no Pedido".
   */
  orderItems: [],

  /** Índice do item do pedido aberto no editor (null = montando um item novo). */
  editingIndex: null,

  // ---- Controle de Drag ----

  /** Indica se um arrasto está em andamento. */
  isDragging: false,

  /** Deslocamento X do cursor em relação ao canto superior esquerdo da estampa. */
  dragOffsetX: 0,

  /** Deslocamento Y do cursor em relação ao canto superior esquerdo da estampa. */
  dragOffsetY: 0,

  /** Flag para throttle de requestAnimationFrame durante o drag. */
  ticking: false,

  // ---- Controle de Nudge (mover estampa com botões) ----

  /** Referência ao setTimeout de delay inicial do nudge. */
  nudgeDelay: null,

  /** Referência ao setInterval de repetição do nudge. */
  nudgeInterval: null,

  // ---- Métodos Auxiliares ----

  /**
   * Retorna o objeto da estampa atualmente ativa.
   * @returns {Object|null} Estampa ativa ou null se nenhuma estiver selecionada.
   */
  getActiveStamp() {
    return this.stamps.find(s => s.id === this.activeStampId) || null;
  }
};
