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
  { alvo: '#setor1', titulo: 'Escolha o modelo', texto: 'Masculina, Feminina ou Infantil/Juvenil, e o tipo de malha.' },
  { alvo: '#seletorCor', titulo: 'Escolha a cor', texto: 'Toque na cor da camiseta. O preview muda na hora.' },
  { alvo: '#enviaEstampa', titulo: 'Coloque sua arte ou um texto', texto: 'Envie sua arte (PNG, JPG, SVG ou PDF) ou toque em <b>Adicionar texto</b> para escrever um nome, frase ou número.' },
  { alvo: '#previewContainer', titulo: 'Posicione na camiseta', texto: 'Arraste a estampa para mudar o lugar. O tracejado é a área máxima de impressão: fica <b>vermelho</b> quando a estampa encosta no limite. Use <b>Frente / Costas</b> para virar a camiseta.' },
  { alvo: '#rightPanel', titulo: 'Suas estampas', texto: 'Mude o lado, a largura em cm, edite, duplique ou remova cada estampa ou texto.' },
  { alvo: '#btnTabelaMedidas', titulo: 'Tabela de medidas', texto: 'Confira as medidas de cada tamanho antes de escolher.' },
  { alvo: '#btnDefineQuantities', titulo: 'Quantidades', texto: 'Diga quantas camisetas de cada tamanho você quer.' },
  { alvo: '#btnSaveItem', titulo: 'Salve no pedido', texto: 'Salve este modelo. Dá para montar vários modelos no mesmo pedido.' },
  { alvo: '#btnGerarPdf', titulo: 'Gere o PDF', texto: 'Gere o PDF do pedido e envie para o atendimento da ArtRock pelo WhatsApp.' },
  { alvo: '#btnAjuda', titulo: 'Precisa de ajuda?', texto: 'Toque aqui para ver este tutorial de novo quando quiser.' }
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
      <h2 id="bvTitulo">Bem-vindo ao personalizador de camisetas da ArtRock!</h2>
      <p class="bvSub">Aqui você monta a sua camiseta do seu jeito:</p>
      <ul class="bvLista">
        <li><span>👕</span><div><b>Escolha o modelo, a malha e a cor</b><small>Masculina, feminina ou infantil/juvenil.</small></div></li>
        <li><span>🎨</span><div><b>Envie sua arte ou escreva um texto</b><small>PNG, JPG, SVG ou PDF, e textos com várias fontes.</small></div></li>
        <li><span>✋</span><div><b>Posicione na frente e nas costas</b><small>Arraste, mude o tamanho e veja tudo em escala real.</small></div></li>
        <li><span>📏</span><div><b>Confira as medidas e escolha os tamanhos</b><small>Tabela de medidas de cada modelo.</small></div></li>
        <li><span>📄</span><div><b>Gere o PDF e fale com a gente</b><small>Envie o pedido para o atendimento pelo WhatsApp.</small></div></li>
      </ul>
      <button type="button" class="btn-dark bvProsseguir" data-bv="ir">Prosseguir ›</button>
      <button type="button" class="bvPular" data-bv="pular">Já conheço, pular tutorial</button>
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
