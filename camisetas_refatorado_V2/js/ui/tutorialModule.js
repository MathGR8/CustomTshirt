/**
 * @module tutorialModule
 * @description Boas-vindas e tutorial guiado (só na primeira visita).
 *
 * 1. Tela "Bem-vindo ao personalizador de camisetas da ArtRock" com o que dá
 *    para fazer, e o botão "Prosseguir".
 * 2. Passo a passo: a tela fica escurecida e só a parte explicada aparece
 *    acesa, com um texto curto em destaque, setas (anterior / próximo) e
 *    "Pular tutorial".
 * Quem já viu (ou pulou) não vê de novo; o botão "Ajuda" do topo abre outra vez.
 */

const CHAVE = 'artrock_tutorial_visto_v1';
const LOGO = 'https://cdn.awsli.com.br/400x300/1274/1274265/logo/logo-art-rock-200-5fh0snhoio.png';

/** Passos: elemento destacado, título e texto. */
const PASSOS = [
  { alvo: '#etapas', titulo: 'São 4 etapas', texto: '<b>Produto</b>, <b>Arte</b>, <b>Tamanhos</b> e <b>Pedido</b>. A camiseta fica sempre à vista e você avança pelo botão embaixo.' },
  { alvo: '#setor1', titulo: 'Escolha o modelo', texto: 'Masculina, Feminina ou Infantil, e o tipo de malha.' },
  { alvo: '#seletorCor', titulo: 'Escolha a cor', texto: 'Toque na cor da camiseta. Ela muda na hora.' },
  { alvo: '#btnAvancar', titulo: 'Depois, envie a sua arte', texto: 'Na etapa <b>Arte</b> você manda a imagem do celular (foto, PNG, JPG, SVG ou PDF) ou escreve um texto, e arrasta para posicionar.' },
  { alvo: '#btnAjuda', titulo: 'Precisa de ajuda?', texto: 'Toque aqui para ver estas dicas de novo quando quiser.' }
];

let raiz = null, passo = 0, aoTerminar = null;

function marcarVisto() { try { localStorage.setItem(CHAVE, '1'); } catch { /* sem armazenamento */ } }

function fechar() {
  marcarVisto();
  raiz?.remove(); raiz = null;
  window.removeEventListener('resize', posicionar);
  window.removeEventListener('scroll', posicionar, true);
  document.removeEventListener('keydown', teclas, true);
  aoTerminar?.();
}

function teclas(e) {
  if (!raiz) return;
  if (!raiz.querySelector('.tutCartao')) { // tela de boas-vindas
    if (e.key === 'Escape') { e.preventDefault(); fechar(); }
    return;
  }
  if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); ir(passo + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(passo - 1); }
  else if (e.key === 'Escape') { e.preventDefault(); fechar(); }
}

/** Passos cujo elemento existe e está visível. */
const passosVisiveis = () => PASSOS.filter(p => { const el = document.querySelector(p.alvo); return el && el.offsetParent !== null; });

function posicionar() {
  if (!raiz) return;
  const lista = passosVisiveis(), p = lista[passo];
  const el = p && document.querySelector(p.alvo);
  if (!el) return;
  const r = el.getBoundingClientRect(), m = 8;
  const foco = raiz.querySelector('.tutFoco'), card = raiz.querySelector('.tutCartao');
  Object.assign(foco.style, { left: `${r.left - m}px`, top: `${r.top - m}px`, width: `${r.width + m * 2}px`, height: `${r.height + m * 2}px` });
  // Cartão embaixo do elemento (ou em cima, se não couber); seta apontando para ele
  const vw = window.innerWidth, vh = window.innerHeight;
  const cw = Math.min(360, vw - 24), ch = card.offsetHeight || 220;
  const embaixo = r.bottom + m + 18 + ch <= vh || r.top - m - 18 - ch < 0;
  let top = embaixo ? r.bottom + m + 18 : r.top - m - 18 - ch;
  top = Math.max(12, Math.min(vh - ch - 12, top));
  const left = Math.max(12, Math.min(vw - cw - 12, r.left + r.width / 2 - cw / 2));
  Object.assign(card.style, { left: `${left}px`, top: `${top}px`, width: `${cw}px` });
  card.dataset.lado = embaixo ? 'baixo' : 'cima';
  const seta = card.querySelector('.tutSeta');
  seta.style.left = `${Math.max(18, Math.min(cw - 18, r.left + r.width / 2 - left))}px`;
}

function ir(n) {
  const lista = passosVisiveis();
  if (n >= lista.length) return fechar();
  passo = Math.max(0, n);
  const p = lista[passo];
  const el = document.querySelector(p.alvo);
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const card = raiz.querySelector('.tutCartao');
  card.querySelector('.tutConta').textContent = `Passo ${passo + 1} de ${lista.length}`;
  card.querySelector('.tutTitulo').textContent = p.titulo;
  card.querySelector('.tutTexto').innerHTML = p.texto;
  card.querySelector('[data-tut="ant"]').disabled = passo === 0;
  card.querySelector('[data-tut="prox"]').innerHTML = passo === lista.length - 1 ? 'Começar ✓' : 'Próximo ›';
  card.querySelector('.tutPontos').innerHTML = lista.map((_, i) => `<i class="${i === passo ? 'ativo' : ''}"></i>`).join('');
  requestAnimationFrame(() => { posicionar(); setTimeout(posicionar, 250); });
}

function iniciarPassos() {
  raiz?.remove();
  raiz = document.createElement('div');
  raiz.className = 'tutorial';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  raiz.innerHTML = `
    <div class="tutFoco"></div>
    <div class="tutCartao" role="document">
      <span class="tutSeta" aria-hidden="true"></span>
      <div class="tutTopo"><span class="tutConta"></span><button type="button" class="tutPular" data-tut="pular">Pular tutorial ✕</button></div>
      <strong class="tutTitulo"></strong>
      <p class="tutTexto"></p>
      <div class="tutPontos" aria-hidden="true"></div>
      <div class="tutNav">
        <button type="button" class="tutBtn" data-tut="ant" aria-label="Passo anterior">‹ Voltar</button>
        <button type="button" class="tutBtn tutBtnPrincipal" data-tut="prox" aria-label="Próximo passo">Próximo ›</button>
      </div>
    </div>`;
  document.body.appendChild(raiz);
  raiz.querySelector('[data-tut="pular"]').onclick = fechar;
  raiz.querySelector('[data-tut="ant"]').onclick = () => ir(passo - 1);
  raiz.querySelector('[data-tut="prox"]').onclick = () => ir(passo + 1);
  window.addEventListener('resize', posicionar);
  window.addEventListener('scroll', posicionar, true);
  document.addEventListener('keydown', teclas, true);
  ir(0);
  raiz.querySelector('[data-tut="prox"]').focus();
}

function boasVindas() {
  raiz?.remove();
  raiz = document.createElement('div');
  raiz.className = 'tutorial tutBoasVindas';
  raiz.innerHTML = `
    <div class="bvCaixa" role="dialog" aria-modal="true" aria-labelledby="bvTitulo">
      <div class="bvTopo"><img src="${LOGO}" alt="ArtRock"></div>
      <h2 id="bvTitulo">Monte a sua camiseta ArtRock</h2>
      <p class="bvSub">Em 4 etapas, aqui mesmo no celular:</p>
      <ol class="bvLista bvEtapas">
        <li><span>1</span><div><b>Produto</b><small>Modelo, malha e cor</small></div></li>
        <li><span>2</span><div><b>Arte</b><small>Envie a sua imagem ou escreva um texto</small></div></li>
        <li><span>3</span><div><b>Tamanhos</b><small>Quantas peças de cada tamanho</small></div></li>
        <li><span>4</span><div><b>Pedido</b><small>Envie para o atendimento pelo WhatsApp</small></div></li>
      </ol>
      <button type="button" class="btn-dark bvProsseguir" data-bv="ir">Começar ›</button>
      <button type="button" class="bvPular" data-bv="pular">Já conheço, pular as dicas</button>
    </div>`;
  document.body.appendChild(raiz);
  raiz.querySelector('[data-bv="ir"]').onclick = iniciarPassos;
  raiz.querySelector('[data-bv="pular"]').onclick = fechar;
  raiz.querySelector('[data-bv="ir"]').focus();
  document.addEventListener('keydown', teclas, true);
}

export const TutorialModule = {
  /** Mostra as boas-vindas + tutorial só para quem ainda não viu. */
  iniciarSeNovo() {
    let visto = false;
    try { visto = localStorage.getItem(CHAVE) === '1'; } catch { /* ok */ }
    if (!visto) setTimeout(() => this.abrir(), 600);
  },
  /** Abre as boas-vindas e o tutorial (botão Ajuda). */
  abrir(depois) { aoTerminar = depois || null; passo = 0; boasVindas(); },
  /** Vai direto para o passo a passo. */
  passos() { passo = 0; iniciarPassos(); }
};
