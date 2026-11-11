/*!
 * Art Rock · botão "Personalize sua camiseta" para a Loja Integrada
 *
 * Na loja, basta UMA linha (no código HTML que vai em todas as páginas):
 *   <script src="https://artrock-personalize.matheusmdn.workers.dev/loja/botao.js" defer></script>
 *
 * Este arquivo é publicado junto com o editor (pasta camisetas_refatorado_V2),
 * então qualquer mudança feita aqui chega na loja sozinha.
 *
 * Opções na própria linha do <script> (todas opcionais):
 *   data-nova-aba="sim"           abre o editor em outra aba
 *   data-editor="https://…"       outro endereço do editor (padrão: este site)
 *
 * Lugar do botão:
 *   - Sem nada: flutuante no canto inferior esquerdo (no celular/tablet, até
 *     1024 px, 80 px acima do rodapé). O "−" minimiza
 *     (fica só o círculo animado); ao recarregar a página, volta ao normal.
 *   - id do botão: #arp-personalize (e o link: #arp-personalize-link).
 *   - <div id="ar-personalize-aqui"></div> em qualquer lugar: vira banner ali.
 *   - <div id="ar-personalize-aqui" data-estilo="compacto"></div>: pílula
 *     pequena para menu/header.
 */
(function () {
  if (window.__arpPersonalize) return; // não duplica se a linha for colada duas vezes
  window.__arpPersonalize = true;

  var eu = document.currentScript;
  var EDITOR = (eu && eu.getAttribute('data-editor')) || (eu ? new URL('/', eu.src).href : 'https://artrock-personalize.matheusmdn.workers.dev/');
  var NOVA_ABA = !!(eu && /^(sim|1|true)$/i.test(eu.getAttribute('data-nova-aba') || ''));

  // Estilos (prefixo arp-, protegidos do tema da loja)
  if (!document.getElementById('arp-estilo')) {
    var st = document.createElement('style');
    st.id = 'arp-estilo';
    st.textContent = `
  .arp, .arp * { box-sizing: border-box; }
  .arp { --arp-vermelho: #ed3051; --arp-escuro: #121214; font-family: "Montserrat", "Segoe UI", system-ui, -apple-system, Arial, sans-serif; line-height: 1.2; }
  .arp a { text-decoration: none !important; }
  /* O tema da loja não muda as cores/letras do botão */
  .arp .arp-textos b, .arp .arp-textos small, .arp .arp-textos em, .arp .arp-seta { color: inherit !important; font-family: inherit !important; background: none !important; margin: 0 !important; padding: 0 !important; text-transform: none; line-height: 1.2 !important; }
  .arp .arp-textos small { text-transform: uppercase; }
  .arp .arp-icone svg { max-width: none !important; }

  /* ---------- Animação (camiseta que troca de cor e recebe a estampa) ---------- */
  .arp-anim { display: block; width: 100%; height: 100%; }
  .arp-camisa { animation: arp-cor 7.5s infinite; }
  .arp-gola { animation: arp-gola 7.5s infinite; }
  @keyframes arp-cor {
    0%, 30% { fill: #18181b; } 33.3%, 63.3% { fill: #f4f4f5; } 66.6%, 96.6% { fill: #1f3a7a; } 100% { fill: #18181b; }
  }
  @keyframes arp-gola {
    0%, 30% { stroke: #3a3a40; } 33.3%, 63.3% { stroke: #d4d4d8; } 66.6%, 96.6% { stroke: #2f4f9a; } 100% { stroke: #3a3a40; }
  }
  .arp-estampa { transform-box: fill-box; transform-origin: center; animation: arp-pop 2.5s infinite cubic-bezier(.3, 1.6, .5, 1); }
  @keyframes arp-pop {
    0%, 6% { transform: scale(0) rotate(-25deg); opacity: 0; }
    16% { transform: scale(1.18) rotate(4deg); opacity: 1; }
    22%, 84% { transform: scale(1) rotate(0); opacity: 1; }
    94%, 100% { transform: scale(0) rotate(20deg); opacity: 0; }
  }
  .arp-pincel { transform-box: fill-box; transform-origin: 20% 80%; animation: arp-pincel 2.5s infinite ease-in-out; }
  @keyframes arp-pincel {
    0%, 4% { transform: translate(14px, 10px) rotate(18deg); opacity: 0; }
    10% { opacity: 1; }
    16% { transform: translate(0, 0) rotate(-8deg); }
    24% { transform: translate(4px, -2px) rotate(6deg); opacity: 1; }
    34%, 100% { transform: translate(16px, 12px) rotate(20deg); opacity: 0; }
  }
  .arp-brilho { transform-box: fill-box; transform-origin: center; animation: arp-brilho 2.5s infinite; }
  .arp-brilho.b2 { animation-delay: .35s; } .arp-brilho.b3 { animation-delay: .7s; }
  @keyframes arp-brilho { 0%, 14% { transform: scale(0); opacity: 0; } 24% { transform: scale(1.2); opacity: 1; } 40%, 100% { transform: scale(0); opacity: 0; } }

  /* ---------- Flutuante (canto inferior esquerdo) ---------- */
  .arp-flutua { position: fixed; left: 16px; bottom: 16px; z-index: 2147483000; display: flex; align-items: center; gap: 0; }
  .arp-flutua .arp-link { display: flex; align-items: center; gap: 9px; padding: 4px 14px 4px 4px; border-radius: 999px;
    background: linear-gradient(135deg, #ff3d60 0%, var(--arp-vermelho) 45%, #9d1030 100%); color: #fff !important;
    box-shadow: 0 8px 22px rgba(237, 48, 81, .42), 0 2px 5px rgba(0, 0, 0, .22); transition: transform .2s, box-shadow .2s, padding .25s;
    animation: arp-entra .7s cubic-bezier(.2, 1.4, .4, 1) both, arp-pulo 6s 3s infinite; }
  .arp-flutua .arp-link:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 12px 28px rgba(237, 48, 81, .52), 0 3px 8px rgba(0, 0, 0, .22); }
  .arp-flutua .arp-cta { display: none; }
  .arp-flutua .arp-link:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
  .arp-icone { position: relative; flex: none; width: 66px; height: 66px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #2b2b31, var(--arp-escuro) 70%);
    box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .9); overflow: hidden; }
  .arp-flutua .arp-icone { width: 48px; height: 48px; box-shadow: inset 0 0 0 2.5px rgba(255, 255, 255, .9); }
  .arp-icone::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, .55); animation: arp-onda 2.5s infinite; }
  .arp-textos { display: flex; flex-direction: column; gap: 2px; white-space: nowrap; }
  .arp-textos small { font-size: 11px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; opacity: .9; }
  .arp-textos b { font-size: 17px; font-weight: 800; }
  .arp-textos em { font-style: normal; font-size: 12.5px; font-weight: 600; opacity: .95; }
  .arp-flutua .arp-textos { gap: 1px; }
  .arp-flutua .arp-textos small { font-size: 9px; letter-spacing: .6px; }
  .arp-flutua .arp-textos b { font-size: 13.5px; }
  .arp-flutua .arp-textos em { font-size: 10.5px; }
  .arp-seta { display: inline-block; transition: transform .2s; }
  .arp-link:hover .arp-seta { transform: translateX(4px); }
  .arp-novo { position: absolute; top: -8px; left: 32px; background: #ffd23f; color: #3a2a00; font-size: 9px; font-weight: 900; letter-spacing: .5px;
    padding: 2px 6px; border-radius: 99px; box-shadow: 0 2px 6px rgba(0, 0, 0, .25); transform: rotate(-8deg); pointer-events: none; }
  /* "−": minimiza (fica só o círculo animado) */
  .arp-fechar { position: absolute; top: -7px; right: -7px; width: 22px; height: 22px; border-radius: 50%; border: 0; cursor: pointer;
    background: #fff; color: #333; font: 700 15px/22px Arial, sans-serif; text-align: center; padding: 0; box-shadow: 0 2px 8px rgba(0, 0, 0, .3); opacity: 0; transition: opacity .2s; }
  .arp-flutua:hover .arp-fechar, .arp-fechar:focus-visible { opacity: 1; }
  @keyframes arp-entra { from { transform: translateY(40px) scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes arp-pulo { 0%, 88%, 100% { transform: none; } 91% { transform: translateY(-8px); } 94% { transform: none; } 97% { transform: translateY(-3px); } }
  @keyframes arp-onda { 0% { transform: scale(.9); opacity: .9; } 100% { transform: scale(1.35); opacity: 0; } }

  /* Balão "Crie a sua camiseta aqui!" (celular; e no computador ao passar o mouse no círculo minimizado) */
  .arp-balao { display: none; position: absolute; left: 66px; bottom: 9px; background: #fff; color: var(--arp-escuro); border-radius: 12px; padding: 7px 11px;
    font-size: 12.5px; font-weight: 700; white-space: nowrap; box-shadow: 0 8px 22px rgba(0, 0, 0, .22); pointer-events: none; }
  .arp-balao::before { content: ""; position: absolute; left: -6px; bottom: 13px; border: 7px solid transparent; border-left: 0; border-right-color: #fff; }
  .arp-balao b { color: var(--arp-vermelho); }
  @keyframes arp-balao { 0% { opacity: 0; transform: translateX(-8px); } 6%, 85% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateX(-8px); visibility: hidden; } }

  /* Minimizado (depois do "−") e celular: só o círculo com a animação */
  .arp-flutua.arp-mini .arp-link { padding: 4px; gap: 0; }
  .arp-flutua.arp-mini .arp-textos, .arp-flutua.arp-mini .arp-novo, .arp-flutua.arp-mini .arp-fechar { display: none; }
  .arp-flutua.arp-mini .arp-icone { width: 52px; height: 52px; }
  @media (hover: hover) { .arp-flutua.arp-mini:hover .arp-balao { display: block; } }
  @media (max-width: 640px) {
    .arp-flutua { left: 12px; bottom: 14px; }
    .arp-flutua .arp-link { padding: 4px; gap: 0; }
    .arp-flutua .arp-textos, .arp-novo { display: none; }
    .arp-flutua .arp-icone, .arp-flutua.arp-mini .arp-icone { width: 52px; height: 52px; }
    .arp-flutua .arp-fechar { opacity: 1; top: -6px; right: -6px; width: 20px; height: 20px; line-height: 20px; font-size: 13px; }
    .arp-flutua:not(.arp-mini) .arp-balao { display: block; animation: arp-balao 9s 1.8s both; }
  }

  /* ---------- Dentro de uma div: banner ---------- */
  .arp-banner .arp-link { display: flex; align-items: center; gap: 18px; padding: 14px 22px 14px 14px; border-radius: 18px; color: #fff !important;
    background: linear-gradient(120deg, #1a1a1d 0%, #2a0d16 45%, var(--arp-vermelho) 100%); box-shadow: 0 10px 26px rgba(0, 0, 0, .18); transition: transform .2s; }
  .arp-banner .arp-link:hover { transform: translateY(-2px); }
  .arp-banner .arp-icone { width: 92px; height: 92px; }
  .arp-banner .arp-textos { white-space: normal; flex: 1; }
  .arp-banner .arp-textos b { font-size: 22px; }
  .arp-banner .arp-textos em { font-size: 14px; }
  .arp-banner .arp-cta { flex: none; background: #fff; color: var(--arp-vermelho); font-weight: 800; font-size: 15px; padding: 12px 18px; border-radius: 999px; box-shadow: 0 4px 12px rgba(0, 0, 0, .2); }
  .arp-banner .arp-novo, .arp-banner .arp-fechar, .arp-banner .arp-balao { display: none; }
  @media (max-width: 640px) {
    .arp-banner .arp-link { gap: 12px; padding: 10px 14px 10px 10px; }
    .arp-banner .arp-icone { width: 70px; height: 70px; }
    .arp-banner .arp-textos b { font-size: 17px; }
    .arp-banner .arp-textos em { font-size: 12.5px; }
    .arp-banner .arp-cta { display: none; }
  }
  /* Compacto (menu / header): pílula pequena */
  .arp-compacto { display: inline-block; }
  .arp-compacto .arp-link { display: inline-flex; align-items: center; gap: 8px; padding: 4px 14px 4px 4px; border-radius: 999px; color: #fff !important;
    background: var(--arp-vermelho); font-weight: 800; font-size: 14px; white-space: nowrap; transition: filter .2s; }
  .arp-compacto .arp-link:hover { filter: brightness(1.08); }
  .arp-compacto .arp-icone { width: 34px; height: 34px; box-shadow: inset 0 0 0 2px #fff; }
  .arp-compacto .arp-icone::after, .arp-compacto .arp-textos small, .arp-compacto .arp-textos em, .arp-compacto .arp-novo,
  .arp-compacto .arp-fechar, .arp-compacto .arp-balao, .arp-compacto .arp-cta { display: none; }
  .arp-compacto .arp-textos b { font-size: 14px; }

  /* Aparelho com "reduzir animações" ligado (Windows sem efeitos de animação,
     celular em economia de bateria): continua animado, mas só com o suave:
     a camiseta troca de cor e a estampa aparece/some. Sem pulos nem pincel. */
  @media (prefers-reduced-motion: reduce) {
    .arp-flutua .arp-link, .arp-icone::after { animation: none !important; }
    .arp-pincel, .arp-brilho { animation: none !important; opacity: 0 !important; }
    .arp-estampa { animation-name: arp-surge !important; animation-timing-function: ease-in-out !important; }
    @keyframes arp-surge { 0%, 6% { opacity: 0; } 20%, 84% { opacity: 1; } 96%, 100% { opacity: 0; } }
  }
  /* ---------- Celular e tablet (até 1024 px): continua à esquerda, 80 px acima do rodapé ----------
     Para mudar a altura, troque só o número abaixo (o id #arp-personalize é o do botão). */
  @media only screen and (max-width: 1024px) {
    #arp-personalize.arp-flutua { bottom: 80px !important; }
  }
`;
    (document.head || document.documentElement).appendChild(st);
  }

  // Animação: camiseta (troca de cor) + estampa "ROCK" que aparece com o pincel
  var ANIM =
    '<svg class="arp-anim" viewBox="8 10 104 102" aria-hidden="true" focusable="false">' +
      '<path class="arp-camisa" stroke-width="2" stroke="#3a3a40" stroke-linejoin="round" d="M44 22 L30 27 L12 41 L21 58 L32 52 L32 102 Q60 107 88 102 L88 52 L99 58 L108 41 L90 27 L76 22 Q60 34 44 22 Z"/>' +
      '<path class="arp-gola" fill="none" stroke-width="3" stroke-linecap="round" stroke="#3a3a40" d="M46 23 Q60 33 74 23"/>' +
      '<g class="arp-estampa">' +
        '<path fill="#ed3051" d="M60 44 l5.6 11.4 12.6 1.8 -9.1 8.9 2.1 12.5 -11.2-5.9 -11.2 5.9 2.1-12.5 -9.1-8.9 12.6-1.8z"/>' +
        '<rect x="41" y="80" width="38" height="12" rx="3" fill="#ffd23f"/>' +
        '<text x="60" y="89.5" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="9.5" fill="#121214" letter-spacing="1">ROCK</text>' +
      '</g>' +
      '<g class="arp-pincel"><rect x="78" y="66" width="7" height="26" rx="3" fill="#ffd23f" transform="rotate(35 81 79)"/>' +
        '<path d="M70 86 q4 -6 10 -2 l-3 7 q-5 2 -7 -5z" fill="#ed3051" transform="rotate(35 75 86)"/></g>' +
      '<path class="arp-brilho" fill="#fff" d="M22 20 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2z"/>' +
      '<path class="arp-brilho b2" fill="#ffd23f" d="M100 16 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6-4 -4-1.6 4-1.6z"/>' +
      '<path class="arp-brilho b3" fill="#fff" d="M104 84 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4-3.4 -3.4-1.4 3.4-1.4z"/>' +
    '</svg>';

  function target() { return document.getElementById('ar-personalize-aqui'); }
  var aba = NOVA_ABA ? ' target="_blank" rel="noopener"' : '';
  var miolo =
    '<a class="arp-link" id="arp-personalize-link" href="' + EDITOR + '"' + aba + ' aria-label="Personalize sua camiseta no editor da Art Rock">' +
      '<span class="arp-icone">' + ANIM + '</span>' +
      '<span class="arp-textos"><small>Novo · Editor Art Rock</small><b>Personalize sua camiseta</b>' +
        '<em>Sua arte, seu estilo · Monte agora <span class="arp-seta">→</span></em></span>' +
      '<span class="arp-cta">Criar a minha →</span>' +
    '</a>';

  function montar() {
    var el = target();
    var caixa = document.createElement('div');
    // id fixo do botão (para estilizar ou mover pelo CSS da loja): #arp-personalize
    // e o link dentro dele: #arp-personalize-link
    caixa.id = 'arp-personalize';
    if (el) {
      // Dentro do lugar escolhido (banner, ou pílula pequena com data-estilo="compacto")
      caixa.className = 'arp ' + (el.getAttribute('data-estilo') === 'compacto' ? 'arp-compacto' : 'arp-banner');
      caixa.innerHTML = miolo;
      el.innerHTML = '';
      el.appendChild(caixa);
      return;
    }
    // Flutuante. O "−" minimiza: fica só o círculo animado. Toda página nova
    // (ou recarregada) abre com o botão normal.
    caixa.className = 'arp arp-flutua';
    caixa.innerHTML = miolo +
      '<span class="arp-novo">NOVO!</span>' +
      '<span class="arp-balao">✨ <b>Crie a sua camiseta</b> aqui!</span>' +
      '<button type="button" class="arp-fechar" aria-label="Minimizar" title="Minimizar">−</button>';
    caixa.querySelector('.arp-fechar').onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      caixa.className += ' arp-mini';
    };
    document.body.appendChild(caixa);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
