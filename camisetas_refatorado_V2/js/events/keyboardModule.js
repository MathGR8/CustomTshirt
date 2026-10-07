/**
 * @module keyboardModule
 * @description Atalhos de teclado da aplicação (e a janela que lista todos eles).
 *
 * Tela principal (fora de campos de texto):
 *   Ctrl+Z / Ctrl+Y (ou Ctrl+Shift+Z) → desfazer / refazer
 *   Delete ou Backspace               → remove a estampa selecionada
 *                                       (ou o item do pedido focado na lista)
 *   Ctrl+D                            → duplica a estampa selecionada
 *   Setas (Shift = passo maior)       → move a estampa selecionada
 *   + / −  (Shift = 5 cm)             → aumenta / diminui a largura da estampa
 *   C                                 → centraliza a estampa na horizontal
 *   E                                 → abre o editor de imagem da estampa
 *   F                                 → troca Frente / Costas
 *   Esc                               → tira a seleção da estampa
 *   Ctrl+S                            → salva o item no pedido
 *   ?                                 → mostra esta lista
 * Editor de imagem:
 *   Ctrl+Z → desfaz a última edição   Ctrl+S ou Ctrl+Enter → salvar   Esc → fechar (confirma se houver alterações)
 *   Delete → apaga a área selecionada  W → liga/desliga a varinha
 *
 * No Mac, Cmd funciona no lugar de Ctrl. Desfazer remover mostra o aviso
 * "Ctrl+Z desfaz", por isso o Delete do teclado não pede confirmação.
 *
 * Dependências: appState.js, noticeModule.js. Demais módulos via window._modules.
 */

import { AppState } from '../core/appState.js';
import { NoticeModule } from '../ui/noticeModule.js';

const ATALHOS = [
  ['Ctrl + Z', 'Desfazer'],
  ['Ctrl + Y  ou  Ctrl + Shift + Z', 'Refazer'],
  ['Delete / Backspace', 'Remover a estampa selecionada (ou o item focado em "Seu pedido")'],
  ['Ctrl + D', 'Duplicar a estampa selecionada'],
  ['← ↑ → ↓', 'Mover a estampa (Shift: passo maior)'],
  ['+ / −', 'Aumentar / diminuir a largura em 1 cm (Shift: 5 cm)'],
  ['C', 'Centralizar a estampa na horizontal'],
  ['E', 'Abrir o editor de imagem da estampa'],
  ['F', 'Trocar Frente / Costas'],
  ['Esc', 'Tirar a seleção da estampa / fechar janelas'],
  ['Ctrl + S', 'Salvar o item no pedido'],
  ['?', 'Mostrar esta lista'],
  ['', 'No editor de imagem'],
  ['Ctrl + Z', 'Desfazer a última edição da imagem'],
  ['Delete', 'Apagar a área selecionada'],
  ['W', 'Ligar / desligar a varinha (apaga a cor clicada)'],
  ['Ctrl + S  ou  Ctrl + Enter', 'Salvar a imagem editada'],
  ['Esc', 'Fechar o editor (pede confirmação se houver alterações)']
];

/** O foco está num campo onde as teclas devem ser digitadas normalmente? */
function digitando(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  return !['checkbox', 'radio', 'button', 'file'].includes(el.type);
}

let dlgAjuda = null;

export const KeyboardModule = {
  /** Liga os atalhos e registra no histórico as trocas dos seletores de produto. */
  init() {
    document.addEventListener('keydown', e => this._onKey(e));

    // Categoria, malha e local: o "onchange" do HTML roda antes deste
    ['category', 'fabricType', 'stampLocation'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () =>
        window._modules?.HistoryModule?.commit('produto-' + id));
    });
  },

  /** Abre a janela com a lista de atalhos. */
  showHelp() {
    if (!dlgAjuda) {
      dlgAjuda = document.createElement('dialog');
      dlgAjuda.className = 'contactDlg shortcutsDlg';
      const linhas = ATALHOS.map(([k, d]) => k
        ? `<tr><td><kbd>${k.split('  ou  ').join('</kbd> ou <kbd>')}</kbd></td><td>${d}</td></tr>`
        : `<tr><th colspan="2">${d}</th></tr>`).join('');
      dlgAjuda.innerHTML = `
        <div class="dlgHead"><strong>⌨ Atalhos de teclado</strong>
          <button type="button" class="dlgClose" aria-label="Fechar">✕</button></div>
        <div class="dlgBody"><table class="shortcutsTable">${linhas}</table>
          <p class="dlgHint">No Mac, use Cmd no lugar de Ctrl.</p></div>`;
      dlgAjuda.querySelector('.dlgClose').onclick = () => dlgAjuda.close();
      document.body.appendChild(dlgAjuda);
    }
    if (!dlgAjuda.open) dlgAjuda.showModal();
  },

  /** @private */
  _onKey(e) {
    const m = window._modules || {};
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    const kl = k.length === 1 ? k.toLowerCase() : k;

    // ---- Editor de imagem aberto ----
    if (document.querySelector('.editDlg[open]')) {
      if (mod && kl === 'z' && !e.shiftKey) { e.preventDefault(); m.EditModule?._acao('undo'); }
      else if (mod && (kl === 's' || k === 'Enter')) { e.preventDefault(); m.EditModule?._acao('save'); }
      else if (!mod && !e.altKey && !digitando(document.activeElement)) {
        if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); m.EditModule?._acao('apag'); }
        else if (kl === 'w') { e.preventDefault(); m.EditModule?._acao('varinha'); }
      }
      return;
    }
    // Outras janelas abertas (WhatsApp, atalhos): só o Esc nativo
    if (document.querySelector('dialog[open]')) return;

    const alvo = document.activeElement;
    const emCampo = digitando(alvo);

    // ---- Salvar item (funciona até dentro de um campo) ----
    if (mod && kl === 's') {
      e.preventDefault();
      if (emCampo) alvo.blur(); // confirma o valor digitado antes de salvar
      m.OrderModule?.saveItem();
      return;
    }
    if (emCampo) return; // Ctrl+Z, setas etc. funcionam normalmente dentro dos campos

    // ---- Desfazer / refazer ----
    if (mod && kl === 'z') {
      e.preventDefault();
      const ok = e.shiftKey ? m.HistoryModule?.redo() : m.HistoryModule?.undo();
      NoticeModule.show('info', ok ? (e.shiftKey ? 'Refeito.' : 'Desfeito. (Ctrl+Y refaz)') : 'Nada para ' + (e.shiftKey ? 'refazer.' : 'desfazer.'));
      return;
    }
    if (mod && kl === 'y') {
      e.preventDefault();
      NoticeModule.show('info', m.HistoryModule?.redo() ? 'Refeito.' : 'Nada para refazer.');
      return;
    }
    if (mod && kl === 'd') {
      e.preventDefault(); // no navegador, Ctrl+D seria "adicionar aos favoritos"
      const ativa = AppState.getActiveStamp();
      if (ativa) m.StampModule?.duplicateStamp(ativa.id);
      return;
    }
    if (mod || e.altKey) return; // não interfere em outros atalhos do navegador

    // ---- Item do pedido focado na lista ----
    const card = alvo?.closest?.('.orderCard');
    if (card && (k === 'Delete' || k === 'Backspace')) {
      e.preventDefault();
      m.OrderModule?.removeItem(+card.dataset.index, false);
      NoticeModule.show('info', 'Item removido do pedido. (Ctrl+Z desfaz)');
      return;
    }
    if (card && k === 'Enter') {
      e.preventDefault();
      m.OrderModule?.editItem(+card.dataset.index);
      return;
    }

    if (k === '?') { e.preventDefault(); this.showHelp(); return; }
    if (kl === 'f') { e.preventDefault(); m.UIModule?.toggleView(); return; }

    // ---- Daqui para baixo, precisa de uma estampa selecionada ----
    const s = AppState.getActiveStamp();
    if (!s) return;

    switch (k) {
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        m.StampModule?.removeStamp(s.id, false);
        NoticeModule.show('info', `Estampa "${s.name || ''}" removida. (Ctrl+Z desfaz)`);
        return;
      case 'Escape':
        m.StampModule?.setActiveStamp(null);
        return;
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
        e.preventDefault();
        if (s.side !== AppState.currentView || s.hidden) return;
        const modo = { ArrowLeft: 'moveLeft', ArrowRight: 'moveRight', ArrowUp: 'moveUp', ArrowDown: 'moveDown' }[k];
        m.StampModule?.alignStamp(modo, e.shiftKey ? 20 : 3);
        return;
      }
      case '+': case '=': case '-': case '_': {
        e.preventDefault();
        const passo = (k === '+' || k === '=') ? 1 : -1;
        s.cm = Math.max(5, Math.min(38, Math.round((s.cm ?? 20) + passo * (e.shiftKey ? 5 : 1))));
        if (s.side === AppState.currentView) m.StampModule?.applyStampCmToNode(s);
        const campo = document.querySelector('#stampsList .stampItem.active input[type="number"]');
        if (campo) campo.value = s.cm;
        m.HistoryModule?.commit('cm-' + s.id);
        return;
      }
    }
    if (kl === 'c') { e.preventDefault(); m.StampModule?.alignStamp('centerX'); return; }
    if (kl === 'e') { e.preventDefault(); m.EditModule?.open(s.id); return; }
  }
};
