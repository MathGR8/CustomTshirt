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
  /* Uma estampa para cada cor da camiseta (7,5 s no total, 2,5 s cada):
     guitarra na preta, moto na branca, caveira mexicana na azul */
  .arp-est { transform-box: fill-box; transform-origin: center; opacity: 0; animation: arp-pop 7.5s infinite cubic-bezier(.3, 1.6, .5, 1); }
  .arp-est2 { animation-delay: -5s; }   /* aparece com a camiseta branca */
  .arp-est3 { animation-delay: -2.5s; } /* aparece com a camiseta azul */
  @keyframes arp-pop {
    0%, 2% { transform: scale(0) rotate(-25deg); opacity: 0; }
    5.3% { transform: scale(1.18) rotate(4deg); opacity: 1; }
    7.3%, 28% { transform: scale(1) rotate(0); opacity: 1; }
    31.3%, 100% { transform: scale(0) rotate(20deg); opacity: 0; }
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
  .arp-flutua { position: fixed; left: 18px; bottom: 18px; z-index: 2147483000; display: flex; align-items: center; gap: 0; }
  .arp-flutua .arp-link { display: flex; align-items: center; gap: 12px; padding: 7px 18px 7px 7px; border-radius: 999px;
    background: linear-gradient(135deg, #ff3d60 0%, var(--arp-vermelho) 45%, #9d1030 100%); color: #fff !important;
    box-shadow: 0 10px 28px rgba(237, 48, 81, .45), 0 2px 6px rgba(0, 0, 0, .25); transition: transform .2s, box-shadow .2s, padding .25s;
    animation: arp-entra .7s cubic-bezier(.2, 1.4, .4, 1) both, arp-pulo 6s 3s infinite; }
  .arp-flutua .arp-link:hover { transform: translateY(-3px) scale(1.03); box-shadow: 0 16px 34px rgba(237, 48, 81, .55), 0 3px 8px rgba(0, 0, 0, .25); }
  .arp-flutua .arp-cta { display: none; }
  .arp-flutua .arp-link:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
  .arp-icone { position: relative; flex: none; width: 66px; height: 66px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #2b2b31, var(--arp-escuro) 70%);
    box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .9); overflow: hidden; }
  .arp-icone::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, .55); animation: arp-onda 2.5s infinite; }
  .arp-textos { display: flex; flex-direction: column; gap: 2px; white-space: nowrap; }
  .arp-textos small { font-size: 11px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; opacity: .9; }
  .arp-textos b { font-size: 17px; font-weight: 800; }
  .arp-textos em { font-style: normal; font-size: 12.5px; font-weight: 600; opacity: .95; }
  .arp-seta { display: inline-block; transition: transform .2s; }
  .arp-link:hover .arp-seta { transform: translateX(4px); }
  .arp-novo { position: absolute; top: -9px; left: 46px; background: #ffd23f; color: #3a2a00; font-size: 10px; font-weight: 900; letter-spacing: .5px;
    padding: 3px 7px; border-radius: 99px; box-shadow: 0 2px 6px rgba(0, 0, 0, .25); transform: rotate(-8deg); pointer-events: none; }
  /* "−": minimiza (fica só o círculo animado) */
  .arp-fechar { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; border: 0; cursor: pointer;
    background: #fff; color: #333; font: 700 15px/24px Arial, sans-serif; text-align: center; padding: 0; box-shadow: 0 2px 8px rgba(0, 0, 0, .3); opacity: 0; transition: opacity .2s; }
  .arp-flutua:hover .arp-fechar, .arp-fechar:focus-visible { opacity: 1; }
  @keyframes arp-entra { from { transform: translateY(40px) scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes arp-pulo { 0%, 88%, 100% { transform: none; } 91% { transform: translateY(-8px); } 94% { transform: none; } 97% { transform: translateY(-3px); } }
  @keyframes arp-onda { 0% { transform: scale(.9); opacity: .9; } 100% { transform: scale(1.35); opacity: 0; } }

  /* Balão "Crie a sua camiseta aqui!" (celular; e no computador ao passar o mouse no círculo minimizado) */
  .arp-balao { display: none; position: absolute; left: 82px; bottom: 14px; background: #fff; color: var(--arp-escuro); border-radius: 14px; padding: 9px 12px;
    font-size: 13px; font-weight: 700; white-space: nowrap; box-shadow: 0 8px 22px rgba(0, 0, 0, .22); pointer-events: none; }
  .arp-balao::before { content: ""; position: absolute; left: -6px; bottom: 15px; border: 7px solid transparent; border-left: 0; border-right-color: #fff; }
  .arp-balao b { color: var(--arp-vermelho); }
  @keyframes arp-balao { 0% { opacity: 0; transform: translateX(-8px); } 6%, 85% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateX(-8px); visibility: hidden; } }

  /* Minimizado (depois do "−") e celular: só o círculo com a animação */
  .arp-flutua.arp-mini .arp-link { padding: 7px; gap: 0; }
  .arp-flutua.arp-mini .arp-textos, .arp-flutua.arp-mini .arp-novo, .arp-flutua.arp-mini .arp-fechar { display: none; }
  @media (hover: hover) { .arp-flutua.arp-mini:hover .arp-balao { display: block; } }
  @media (max-width: 640px) {
    .arp-flutua { left: 12px; bottom: 14px; }
    .arp-flutua .arp-link, .arp-flutua.arp-mini .arp-link { padding: 5px; gap: 0; }
    .arp-flutua .arp-textos, .arp-novo { display: none; }
    .arp-flutua .arp-icone { width: 62px; height: 62px; }
    .arp-flutua .arp-fechar { opacity: 1; top: -6px; right: -6px; width: 22px; height: 22px; line-height: 22px; font-size: 13px; }
    .arp-balao { left: 78px; bottom: 10px; }
    .arp-balao::before { bottom: 18px; }
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
    .arp-est { animation-name: arp-surge !important; animation-timing-function: ease-in-out !important; }
    @keyframes arp-surge { 0%, 2% { opacity: 0; } 6.6%, 28% { opacity: 1; } 32%, 100% { opacity: 0; } }
  }
  /* ---------- Celular e tablet (até 1024 px): continua à esquerda, 80 px acima do rodapé ----------
     Para mudar a altura, troque só o número abaixo (o id #arp-personalize é o do botão). */
  @media only screen and (max-width: 1024px) {
    #arp-personalize.arp-flutua { bottom: 80px !important; }
  }
`;
    (document.head || document.documentElement).appendChild(st);
  }

  // Animação: camiseta (troca de cor) + uma estampa por cor (guitarra, moto, caveira mexicana) com o pincel
  var ANIM =
    '<svg class="arp-anim" viewBox="8 10 104 102" aria-hidden="true" focusable="false">' +
      '<path class="arp-camisa" stroke-width="2" stroke="#3a3a40" stroke-linejoin="round" d="M44 22 L30 27 L12 41 L21 58 L32 52 L32 102 Q60 107 88 102 L88 52 L99 58 L108 41 L90 27 L76 22 Q60 34 44 22 Z"/>' +
      '<path class="arp-gola" fill="none" stroke-width="3" stroke-linecap="round" stroke="#3a3a40" d="M46 23 Q60 33 74 23"/>' +
      '<g class="arp-estampa">' +
        // 1) Guitarra (camiseta preta): corpo vermelho, braço amarelo, cordas brancas
        '<g class="arp-est arp-est1"><g transform="translate(5 6) rotate(-35 60 66)">' +
          '<rect x="57.4" y="33" width="5.2" height="8" rx="1.6" fill="#ffd23f"/>' +
          '<circle cx="56.6" cy="35" r="1" fill="#fff"/><circle cx="56.6" cy="38.6" r="1" fill="#fff"/>' +
          '<circle cx="63.4" cy="35" r="1" fill="#fff"/><circle cx="63.4" cy="38.6" r="1" fill="#fff"/>' +
          '<rect x="58.5" y="40" width="3" height="32" fill="#e8b44a"/>' +
          '<path stroke="#7a4b14" stroke-width=".7" d="M58.5 46 H61.5 M58.5 51 H61.5 M58.5 56 H61.5 M58.5 61 H61.5"/>' +
          '<ellipse cx="60" cy="71" rx="9" ry="7.5" fill="#ed3051"/>' +
          '<ellipse cx="60" cy="82" rx="12" ry="9.5" fill="#ed3051"/>' +
          '<path fill="#fff" d="M53.5 74 Q52 82 56 86 L60 86 L60 72 Q56 71 53.5 74 Z"/>' +
          '<rect x="55.5" y="73.5" width="9" height="2.2" rx=".6" fill="#121214"/>' +
          '<rect x="55.5" y="78.5" width="9" height="2.2" rx=".6" fill="#121214"/>' +
          '<rect x="56" y="84.5" width="8" height="2" rx=".6" fill="#ffd23f"/>' +
          '<path stroke="#fff" stroke-width=".45" opacity=".85" d="M59.2 37 V85 M60.8 37 V85"/>' +
        '</g></g>' +
        // 2) Moto (camiseta branca): silhueta escura, tanque vermelho, farol amarelo
        '<g class="arp-est arp-est2">' +
          '<circle cx="44" cy="78" r="8.3" fill="none" stroke="#121214" stroke-width="3.2"/>' +
          '<circle cx="76" cy="78" r="8.3" fill="none" stroke="#121214" stroke-width="3.2"/>' +
          '<circle cx="44" cy="78" r="2" fill="#121214"/><circle cx="76" cy="78" r="2" fill="#121214"/>' +
          '<path stroke="#121214" stroke-width="2.6" stroke-linecap="round" fill="none" d="M44 78 L55 70 M76 78 L71.5 58 L68.5 54.5 M66.5 55.5 L71 53.5"/>' +
          '<path fill="#121214" d="M41 66 Q45 63 52 64.5 L56 65 L57 70.5 L50 71.5 Q44 71 41 66 Z"/>' +
          '<rect x="55" y="67" width="10" height="8" rx="2" fill="#3a3a40"/>' +
          '<path stroke="#9aa0a6" stroke-width="2" stroke-linecap="round" d="M50 76 L63 76.5"/>' +
          '<path fill="#ed3051" d="M55 64.5 Q61 57.5 70 60 L68.5 65 Q62 66.5 55.5 67 Z"/>' +
          '<path fill="#fff" opacity=".55" d="M58 62.5 Q62 60 66 60.6 L65.6 61.8 Q62 61.6 58.8 63.4 Z"/>' +
          '<circle cx="74.5" cy="59.5" r="2.2" fill="#ffd23f" stroke="#121214" stroke-width=".8"/>' +
        '</g>' +
        // 3) Caveira mexicana (camiseta azul): branca, olhos com flores coloridas
        '<g class="arp-est arp-est3">' +
          '<path fill="#f4f4f5" d="M60 42 C50 42 44 49 44 57.5 C44 63 47 66.6 50.5 68.4 L50.5 74.5 Q50.5 79 55 79 L65 79 Q69.5 79 69.5 74.5 L69.5 68.4 C73 66.6 76 63 76 57.5 C76 49 70 42 60 42 Z"/>' +
          '<circle cx="53.8" cy="59" r="5.6" fill="#ed3051"/><circle cx="66.2" cy="59" r="5.6" fill="#ffd23f"/>' +
          '<circle cx="53.8" cy="59" r="3.3" fill="#121214"/><circle cx="66.2" cy="59" r="3.3" fill="#121214"/>' +
          '<circle cx="54.8" cy="58" r=".9" fill="#fff"/><circle cx="67.2" cy="58" r=".9" fill="#fff"/>' +
          '<g fill="#ed3051"><circle cx="60" cy="46.6" r="1.9"/><circle cx="62.5" cy="48.4" r="1.9"/><circle cx="61.5" cy="51.3" r="1.9"/><circle cx="58.5" cy="51.3" r="1.9"/><circle cx="57.5" cy="48.4" r="1.9"/></g>' +
          '<circle cx="60" cy="49.2" r="1.5" fill="#ffd23f"/>' +
          '<path fill="#121214" d="M60 63.6 C58.6 62.3 57 64.2 58.4 65.6 L60 67.2 L61.6 65.6 C63 64.2 61.4 62.3 60 63.6 Z"/>' +
          '<circle cx="48.6" cy="66" r="1.3" fill="#2ec4b6"/><circle cx="71.4" cy="66" r="1.3" fill="#2ec4b6"/>' +
          '<path stroke="#121214" stroke-width="1.2" stroke-linecap="round" d="M53 73 H67 M55 70.6 V75.4 M58.3 70.6 V75.4 M61.7 70.6 V75.4 M65 70.6 V75.4"/>' +
          '<g fill="#2ec4b6"><circle cx="55" cy="77.3" r=".8"/><circle cx="60" cy="77.6" r=".8"/><circle cx="65" cy="77.3" r=".8"/></g>' +
        '</g>' +
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
      '<span class="arp-textos"><small>Novo \u00b7 Editor Art Rock</small><b>Personalize sua camiseta</b>' +
        '<em>Sua arte, seu estilo \u00b7 Monte agora <span class="arp-seta">\u2192</span></em></span>' +
      '<span class="arp-cta">Criar a minha \u2192</span>' +
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
      '<span class="arp-balao">\u2728 <b>Crie a sua camiseta</b> aqui!</span>' +
      '<button type="button" class="arp-fechar" aria-label="Minimizar" title="Minimizar">\u2212</button>';
    caixa.querySelector('.arp-fechar').onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      caixa.className += ' arp-mini';
    };
    document.body.appendChild(caixa);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
