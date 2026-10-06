/**
 * @module historyModule
 * @description Desfazer / refazer (Ctrl+Z / Ctrl+Y) de tudo que o cliente muda
 * na tela: produto, cor, lado, estampas (posição, tamanho, lado, visibilidade,
 * adicionar/remover/duplicar/editar), quantidades e itens do pedido.
 *
 * Como funciona:
 *  - Depois de cada alteração, o módulo que alterou chama HistoryModule.commit(chave).
 *  - commit guarda uma "foto" (snapshot) do estado. Fotos com a mesma chave
 *    tiradas em sequência rápida (segurar o "+", arrastar, setas) viram UM passo.
 *  - Desfazer volta para a foto anterior; refazer avança de novo.
 *  - As imagens não são copiadas (strings imutáveis), então as fotos são leves.
 *
 * Dependências: appState.js. Os demais módulos vêm de window._modules.
 */

import { AppState } from './appState.js';

const MAX_PASSOS = 60;         // quantos passos de desfazer guardar
const JUNTAR_MS  = 800;        // alterações com a mesma chave dentro deste tempo = 1 passo

let pilha = [];                // fotos; a última é o estado atual
let refazer = [];
let ultimaChave = null, ultimoTempo = 0;
let restaurando = false;

const $ = id => document.getElementById(id);

/** Copia as estampas sem o nó DOM e sem controles internos. */
function copiarEstampas(stamps) {
  return stamps.map(({ node, pendingRel, _relWait, ...d }) => {
    const rel = pendingRel || d.rel;
    return { ...d, rel: rel ? { ...rel } : null };
  });
}

/** Foto do estado atual. */
function foto() {
  return {
    category:     $('category')?.value,
    fabric:       $('fabricType')?.value,
    color:        AppState.selectedColor,
    view:         AppState.currentView,
    quantities:   JSON.parse(JSON.stringify(AppState.quantities)),
    stamps:       copiarEstampas(AppState.stamps),
    active:       AppState.stamps.findIndex(s => s.id === AppState.activeStampId),
    orderItems:   AppState.orderItems.map(i => ({ ...i })),
    editingIndex: AppState.editingIndex
  };
}

/** Aplica uma foto na tela. */
function aplicar(f) {
  const { StampModule, UIModule, SizeModule, OrderModule } = window._modules || {};
  if (!StampModule) return;
  restaurando = true;
  try {
    AppState.stamps.forEach(s => s.node?.parentNode?.removeChild(s.node));

    if ($('category'))   $('category').value   = f.category;
    if ($('fabricType')) $('fabricType').value = f.fabric;
    if ($('stampLocation')) $('stampLocation').value = f.view;
    AppState.selectedColor = f.color;
    AppState.currentView   = f.view;
    AppState.quantities    = JSON.parse(JSON.stringify(f.quantities));
    AppState.orderItems    = f.orderItems.map(i => ({ ...i }));
    AppState.editingIndex  = f.editingIndex;
    AppState.stamps        = f.stamps.map(d => StampModule.restoreStamp(d));

    UIModule.populateSubLocations();
    UIModule.updateColorOptions();          // redesenha a camiseta e reanexa as estampas
    SizeModule.updateSizeTable();
    StampModule.setActiveStamp(AppState.stamps[f.active]?.id || null);
    OrderModule._refresh();
  } finally {
    restaurando = false;
  }
}

export const HistoryModule = {
  /** Guarda o estado inicial (chamado uma vez, na inicialização). */
  init() {
    pilha = [foto()];
    refazer = [];
    this._atualizarBotoes();
  },

  /**
   * Registra o estado atual depois de uma alteração.
   * @param {string} [chave] - Tipo da alteração; repetições rápidas da mesma
   *                           chave se juntam num único passo de desfazer.
   */
  commit(chave = '') {
    if (restaurando || !pilha.length) return;
    const agora = Date.now();
    const juntar = chave && chave === ultimaChave && agora - ultimoTempo < JUNTAR_MS && pilha.length > 1;
    if (juntar) pilha[pilha.length - 1] = foto();
    else {
      pilha.push(foto());
      if (pilha.length > MAX_PASSOS) pilha.shift();
    }
    refazer = [];
    ultimaChave = chave;
    ultimoTempo = agora;
    this._atualizarBotoes();
  },

  /** Volta um passo. @returns {boolean} se havia o que desfazer */
  undo() {
    if (pilha.length < 2) return false;
    refazer.push(pilha.pop());
    aplicar(pilha[pilha.length - 1]);
    ultimaChave = null;
    this._atualizarBotoes();
    return true;
  },

  /** Avança um passo desfeito. @returns {boolean} se havia o que refazer */
  redo() {
    if (!refazer.length) return false;
    const f = refazer.pop();
    pilha.push(f);
    aplicar(f);
    ultimaChave = null;
    this._atualizarBotoes();
    return true;
  },

  /** Habilita/desabilita os botões de desfazer e refazer do cabeçalho. @private */
  _atualizarBotoes() {
    const u = $('btnUndo'), r = $('btnRedo');
    if (u) u.disabled = pilha.length < 2;
    if (r) r.disabled = !refazer.length;
  }
};
