/**
 * @module devModule
 * @description Modo desenvolvedor: ajustar a área de impressão de cada modelo
 * (Masculina, Feminina, Infantil) e lado, direto sobre a camiseta.
 *
 * Como abrir: endereço do site + "?dev" (ex.: …/index.html?dev).
 * Fica ligado nesta aba até fechar; "?dev=0" desliga.
 *
 * - Arraste o quadrado tracejado para mover; o canto (◢) muda o tamanho.
 * - Setas / botões ajustam de 0,5 em 0,5 % (com Shift: 0,1 %).
 * - "Salvar neste navegador" aplica aqui na hora (só para você).
 * - "Baixar calibragem.json" gera o arquivo para publicar para todos:
 *   no GitHub, envie-o para a pasta camisetas_refatorado_V2 (substituindo o
 *   que existe). O Cloudflare publica sozinho em 1–2 minutos.
 *
 * Dependências: calibragem.js, appState.js, previewGeometry.js, noticeModule.js;
 * UIModule e StampModule via window._modules.
 */

import { AppState } from '../core/appState.js';
import { Calibragem } from '../preview/calibragem.js';
import { PreviewGeom } from '../preview/previewGeometry.js';
import { NoticeModule } from './noticeModule.js';

const M = () => window._modules || {};
const CHAVE = 'artrock_dev';
const pct = v => (v * 100).toFixed(1).replace('.', ',');

/** O modo dev foi pedido no endereço (ou já está ligado nesta aba)? */
function pedido() {
  const q = new URLSearchParams(location.search);
  try {
    if (q.get('dev') === '0') { sessionStorage.removeItem(CHAVE); return false; }
    if (q.has('dev')) sessionStorage.setItem(CHAVE, '1');
    return sessionStorage.getItem(CHAVE) === '1';
  } catch { return q.has('dev') && q.get('dev') !== '0'; }
}

export const DevModule = {
  ativo: false,

  /** Carrega a calibragem publicada e, se for o caso, abre o painel. */
  async init() {
    this.ativo = pedido();
    await Calibragem.carregar({ dev: this.ativo });
    if (this.ativo) this._montar();
    this.reaplicar();
  },

  /** Modelo e lado na tela agora. */
  _atual() {
    return { cat: document.getElementById('category')?.value || 'Masculina', lado: AppState.currentView || 'Frente' };
  },

  /** Área atual em frações da imagem (ajustada ou a automática). */
  _areaAtual() {
    const base = PreviewGeom.getRenderedBaseRect(), r = PreviewGeom.getRenderedShirtRect();
    if (!base || !r) return null;
    return { x: (r.left - base.left) / base.width, y: (r.top - base.top) / base.height, w: r.width / base.width };
  },

  /** Redesenha a área e reposiciona as estampas do lado atual pela posição relativa. */
  reaplicar() {
    const { UIModule, StampModule } = M();
    UIModule?.updateShirtBoxOverlay();
    if (StampModule) AppState.stamps.forEach(s => {
      if (s.side !== AppState.currentView) return;
      if (s.rel) s.pendingRel = { ...s.rel };
      StampModule.applyStampCmToNode(s);
    });
    if (this.ativo) this._atualizarPainel();
  },

  /** Muda a área do modelo/lado atual (no rascunho). */
  mudar(fn) {
    const a = this._areaAtual();
    if (!a) return;
    const n = fn({ ...a });
    n.w = Math.max(0.05, Math.min(1, n.w));
    n.x = Math.max(-0.2, Math.min(1, n.x));
    n.y = Math.max(-0.2, Math.min(1, n.y));
    const { cat, lado } = this._atual();
    Calibragem.definir(cat, lado, n);
    this.reaplicar();
  },

  mover(dx, dy) { this.mudar(a => ({ ...a, x: a.x + dx, y: a.y + dy })); },
  /** Muda a largura mantendo o centro. */
  largura(dw) { this.mudar(a => ({ ...a, x: a.x - dw / 2, w: a.w + dw })); },
  centralizar() { this.mudar(a => ({ ...a, x: 0.5 - a.w / 2 })); },

  automatico() {
    const { cat, lado } = this._atual();
    Calibragem.definir(cat, lado, null);
    this.reaplicar();
  },

  salvar() {
    if (Calibragem.salvarLocal()) NoticeModule.show('success', 'Salvo neste navegador. Para valer para todos, baixe o calibragem.json e publique.');
    else NoticeModule.show('error', 'Não foi possível salvar neste navegador.');
    this._atualizarPainel();
  },

  descartar() {
    if (!confirm('Descartar os ajustes não publicados e voltar ao que está no site?')) return;
    Calibragem.descartarLocal();
    this.reaplicar();
  },

  baixar() {
    const blob = new Blob([Calibragem.arquivo()], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'calibragem.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },

  async copiar() {
    try { await navigator.clipboard.writeText(Calibragem.arquivo()); NoticeModule.show('success', 'Conteúdo do calibragem.json copiado.'); }
    catch { NoticeModule.show('error', 'Não foi possível copiar. Use "Baixar".'); }
  },

  sair() {
    try { sessionStorage.removeItem(CHAVE); } catch { /* ok */ }
    location.href = location.pathname;
  },

  // ---------------------------------------------------------------- painel

  _montar() {
    document.body.classList.add('modoDev');
    AppState.showShirtBox = true;
    const p = document.createElement('aside');
    p.id = 'devPainel';
    p.innerHTML = `
      <header data-dev="recolher"><b>🛠 Modo dev</b><button type="button" data-dev="recolher" title="Abrir / recolher">▾</button></header>
      <div class="devCorpo">
        <p class="devQual" id="devQual"></p>
        <div class="devGrade">
          <button type="button" data-dev="cima" title="Subir">▲</button>
          <button type="button" data-dev="esq" title="Esquerda">◀</button>
          <button type="button" data-dev="centro" title="Centralizar na horizontal">↔</button>
          <button type="button" data-dev="dir" title="Direita">▶</button>
          <button type="button" data-dev="baixo" title="Descer">▼</button>
        </div>
        <div class="devLinha"><span>Tamanho</span>
          <button type="button" data-dev="menor">−</button><output id="devW"></output><button type="button" data-dev="maior">+</button>
        </div>
        <p class="devNums" id="devNums"></p>
        <p class="devDica">Arraste o quadrado para mover e o canto ◢ para mudar o tamanho. Shift = ajuste fino.</p>
        <div class="devAcoes">
          <button type="button" data-dev="salvar" class="devPrim">Salvar neste navegador</button>
          <button type="button" data-dev="baixar">Baixar calibragem.json</button>
          <button type="button" data-dev="copiar">Copiar</button>
          <button type="button" data-dev="auto">Automático (este lado)</button>
          <button type="button" data-dev="descartar">Descartar ajustes</button>
          <button type="button" data-dev="sair">Sair</button>
        </div>
        <p class="devStatus" id="devStatus"></p>
      </div>`;
    // Celular: começa recolhido (só o botão), para não cobrir a tela
    if (matchMedia('(max-width: 640px)').matches) p.classList.add('recolhido');
    document.body.appendChild(p);

    const passo = e => (e.shiftKey ? 0.001 : 0.005);
    const acoes = {
      cima: e => this.mover(0, -passo(e)), baixo: e => this.mover(0, passo(e)),
      esq: e => this.mover(-passo(e), 0), dir: e => this.mover(passo(e), 0),
      centro: () => this.centralizar(), menor: e => this.largura(-passo(e)), maior: e => this.largura(passo(e)),
      salvar: () => this.salvar(), baixar: () => this.baixar(), copiar: () => this.copiar(),
      auto: () => this.automatico(), descartar: () => this.descartar(), sair: () => this.sair(),
      recolher: () => p.classList.toggle('recolhido')
    };
    p.addEventListener('click', e => { const b = e.target.closest('[data-dev]'); if (b) acoes[b.dataset.dev]?.(e); });

    this._arrastar();
    // Troca de modelo, cor ou lado: atualiza o painel
    ['change', 'click'].forEach(ev => document.addEventListener(ev, () => setTimeout(() => this._atualizarPainel(), 50), true));
    addEventListener('beforeunload', e => { if (Calibragem.temRascunho() && this._naoSalvo) { e.preventDefault(); e.returnValue = ''; } });
  },

  _atualizarPainel() {
    const { cat, lado } = this._atual();
    const a = this._areaAtual();
    const el = id => document.getElementById(id);
    if (!el('devQual')) return;
    const ajustada = !!Calibragem.area(cat, lado);
    el('devQual').innerHTML = `${cat.replace('Infantil/Juvenil', 'Infantil')} · ${lado} · <i>${ajustada ? 'ajustada' : 'automática'}</i>`;
    if (a) {
      el('devW').textContent = pct(a.w) + '%';
      const px = PreviewGeom.getPxPerCmPreview(), ar = PreviewGeom.area(cat);
      el('devNums').textContent = `x ${pct(a.x)}% · y ${pct(a.y)}% · largura ${pct(a.w)}% da imagem (${ar.w} × ${ar.h} cm${px ? `, ${px.toFixed(1)} px/cm` : ''})`;
    }
    let salvo = null;
    try { salvo = localStorage.getItem('artrock_calibragem_dev'); } catch { /* ok */ }
    const atual = JSON.stringify(Calibragem.areas());
    this._naoSalvo = salvo !== atual && Calibragem.temRascunho();
    el('devStatus').textContent = !Calibragem.temRascunho() ? 'Igual ao publicado no site.'
      : this._naoSalvo ? '● Alterações não salvas.' : '✓ Salvo neste navegador · ainda não publicado.';
  },

  /** Arrastar o quadrado (mover) e o canto (tamanho). */
  _arrastar() {
    let ini = null;
    const prev = () => document.getElementById('preview');
    document.addEventListener('pointerdown', e => {
      const box = e.target.closest?.('#shirtBoxOverlay');
      if (!box) return;
      const a = this._areaAtual(), base = PreviewGeom.getRenderedBaseRect();
      if (!a || !base) return;
      e.preventDefault(); e.stopPropagation();
      ini = { x: e.clientX, y: e.clientY, a, base, canto: !!e.target.closest('.devCanto') };
      box.setPointerCapture?.(e.pointerId);
    }, true);
    document.addEventListener('pointermove', e => {
      if (!ini) return;
      e.preventDefault();
      const dx = (e.clientX - ini.x) / ini.base.width, dy = (e.clientY - ini.y) / ini.base.height;
      const { cat, lado } = this._atual();
      const n = ini.canto
        ? { x: ini.a.x, y: ini.a.y, w: Math.max(0.05, ini.a.w + dx) }
        : { x: ini.a.x + dx, y: ini.a.y + dy, w: ini.a.w };
      Calibragem.definir(cat, lado, n);
      M().UIModule?.updateShirtBoxOverlay();
      this._atualizarPainel();
    }, true);
    const fim = () => { if (ini) { ini = null; this.reaplicar(); } };
    document.addEventListener('pointerup', fim, true);
    document.addEventListener('pointercancel', fim, true);
    // Canto de redimensionar dentro do quadrado (recriado quando o rótulo muda)
    new MutationObserver(() => {
      const box = document.getElementById('shirtBoxOverlay');
      if (box && !box.querySelector('.devCanto')) box.insertAdjacentHTML('beforeend', '<i class="devCanto">◢</i>');
    }).observe(prev() || document.body, { childList: true, subtree: true });
    // Setas do teclado movem a área (fora de campos de texto)
    document.addEventListener('keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (!d || AppState.activeStampId) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const s = e.shiftKey ? 0.001 : 0.005;
      this.mover(d[0] * s, d[1] * s);
    }, true);
  }
};
