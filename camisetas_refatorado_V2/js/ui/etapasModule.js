/**
 * @module etapasModule
 * @description Tela única por etapas (mobile-first), no estilo do app do tablet:
 *   1 Produto → 2 Arte → 3 Tamanhos → 4 Pedido
 *
 * A camiseta fica sempre à vista; embaixo (no celular) ou ao lado (no
 * computador) aparece só a etapa atual, e o rodapé tem Voltar / Avançar.
 * A página não rola: a altura vem da área visível do navegador (--altura),
 * o que também funciona dentro de um iframe na loja.
 *
 * Os outros módulos continuam usando os mesmos ids (category, fabricType,
 * sizeTable, stampsList, orderList…). Aqui:
 *  - os <select> de modelo e malha viram botões grandes (chips);
 *  - SizeModule.showSizeSection / backToConfig passam a trocar de etapa;
 *  - editar um item do pedido abre a etapa "Arte";
 *  - o rodapé mostra um resumo (modelo · cor · artes · peças).
 *
 * Dependências: appState.js, noticeModule.js. Os demais via window._modules.
 */

import { AppState } from '../core/appState.js';
import { NoticeModule } from './noticeModule.js';

const ORDEM = ['produto', 'arte', 'tamanhos', 'pedido'];
const $ = s => document.querySelector(s);
const M = () => window._modules || {};

/** Altura real da área visível (celular com barra do navegador, iframe…). */
function ajustarTela() {
  const ativo = document.activeElement;
  const digitando = ativo && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName) && ativo.type !== 'range';
  if (digitando && EtapasModule._altura && innerHeight < EtapasModule._altura) return; // teclado aberto: não encolhe
  EtapasModule._altura = innerHeight;
  document.documentElement.style.setProperty('--altura', innerHeight + 'px');
}

const pecas = () => {
  const cat = $('#category')?.value;
  return Object.values(AppState.quantities?.[cat] || {}).reduce((s, n) => s + (parseInt(n, 10) || 0), 0);
};
const artesVisiveis = () => AppState.stamps.filter(s => !s.hidden).length;

export const EtapasModule = {
  atual: 'produto',
  _altura: 0,

  init() {
    ajustarTela();
    addEventListener('resize', ajustarTela);
    addEventListener('orientationchange', () => setTimeout(ajustarTela, 300));
    document.addEventListener('focusout', () => setTimeout(ajustarTela, 350));

    // Modelo e malha: botões grandes no lugar do <select>
    document.querySelectorAll('[data-chips]').forEach(box => this._chips(box));

    // Etapas no topo
    document.querySelectorAll('#etapas [data-ir]').forEach(b => (b.onclick = () => this.ir(b.dataset.ir)));

    const { SizeModule, OrderModule, HistoryModule, StampModule } = M();
    // A lista de artes muda (envio terminou, removeu, desfez…): atualiza o resumo e o layout
    if (StampModule) { const r = StampModule.renderStampsList.bind(StampModule); StampModule.renderStampsList = (...a) => { const x = r(...a); this.resumo(); return x; }; }
    if (SizeModule) {
      SizeModule.showSizeSection = () => this.ir('tamanhos');
      SizeModule.backToConfig = () => this.ir('produto');
    }
    if (OrderModule) {
      const editar = OrderModule.editItem.bind(OrderModule);
      OrderModule.editItem = (...a) => { const r = editar(...a); if (AppState.editingIndex != null) this.ir('arte'); return r; };
    }
    if (HistoryModule) {
      ['undo', 'redo'].forEach(f => { const o = HistoryModule[f].bind(HistoryModule); HistoryModule[f] = (...a) => { const r = o(...a); this.sincronizar(); return r; }; });
    }
    // Resumo do rodapé sempre em dia (quantidades, artes, cor…)
    ['input', 'change', 'click'].forEach(ev => document.addEventListener(ev, () => queueMicrotask(() => this.resumo()), true));

    this.ir('produto', { inicio: true });
  },

  /** Botões a partir das opções de um <select> (o select continua sendo a fonte da verdade). */
  _chips(box) {
    const sel = document.getElementById(box.dataset.chips);
    if (!sel) return;
    box.innerHTML = [...sel.options].map(o => `<button type="button" class="chip" role="radio" data-v="${o.value}">${o.textContent.replace(/\s*\/\s*Juvenil/, '')}</button>`).join('');
    box.querySelectorAll('[data-v]').forEach(b => (b.onclick = () => {
      if (sel.value === b.dataset.v) return;
      sel.value = b.dataset.v;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      this.sincronizar();
    }));
    this.sincronizar();
  },

  /** Marca os chips conforme os selects (depois de desfazer, editar item…). */
  sincronizar() {
    document.querySelectorAll('[data-chips]').forEach(box => {
      const v = document.getElementById(box.dataset.chips)?.value;
      box.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === v)));
    });
    this.resumo();
  },

  ir(etapa, { inicio = false } = {}) {
    if (!ORDEM.includes(etapa)) return;
    this.atual = etapa;
    const app = $('#overallContainer');
    app.dataset.etapa = etapa;
    document.querySelectorAll('.etapa').forEach(e => (e.hidden = e.dataset.etapa !== etapa));
    const i = ORDEM.indexOf(etapa);
    document.querySelectorAll('#etapas [data-ir]').forEach(b => {
      const j = ORDEM.indexOf(b.dataset.ir);
      b.classList.toggle('feita', j < i);
      if (j === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    if (etapa === 'tamanhos') M().SizeModule?.updateSizeTable();
    if (etapa === 'pedido') M().OrderModule?.renderOrderList();
    const painel = $('#painel'); if (painel) painel.scrollTop = 0;
    this.sincronizar();
    if (!inicio) M().AlignModule && AppState.activeStampId && etapa !== 'arte' && M().AlignModule.setHudVisible(false);
  },

  avancar() {
    const i = ORDEM.indexOf(this.atual);
    if (this.atual === 'arte' && !artesVisiveis()) {
      NoticeModule.show('error', 'Envie a sua arte ou escreva um texto antes de continuar.');
      $('#enviaEstampa')?.classList.add('chamar'); setTimeout(() => $('#enviaEstampa')?.classList.remove('chamar'), 900);
      return;
    }
    if (i < ORDEM.length - 1) this.ir(ORDEM[i + 1]);
  },

  voltar() {
    const i = ORDEM.indexOf(this.atual);
    if (this.atual === 'pedido') return this.ir(artesVisiveis() ? 'tamanhos' : 'produto');
    if (i > 0) this.ir(ORDEM[i - 1]);
  },

  /** "Salvar no pedido" (etapa Tamanhos): salva e mostra o pedido. */
  salvar() {
    const ok = M().OrderModule?.saveItem();
    if (ok) this.ir('pedido');
  },

  /** Depois de salvar: começa outro modelo do zero. */
  novoModelo() { this.ir('produto'); },

  /** Rodapé: "Masculina · Preto · 2 artes · 12 peças". */
  resumo() {
    const el = $('#resumo'); if (!el) return;
    const cat = $('#category')?.value || '';
    const n = artesVisiveis(), p = pecas(), itens = AppState.orderItems.length;
    $('#overallContainer')?.classList.toggle('temArte', AppState.stamps.length > 0);
    if (this.atual === 'pedido') {
      el.textContent = itens ? `${itens} modelo${itens > 1 ? 's' : ''} no pedido` : 'Nenhum modelo salvo';
      return;
    }
    el.textContent = [cat.replace('Infantil/Juvenil', 'Infantil'), AppState.selectedColor,
      n ? `${n} arte${n > 1 ? 's' : ''}` : '', p ? `${p} peça${p > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  }
};
