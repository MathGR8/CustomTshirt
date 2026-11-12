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

  /* ---------- Seção para landing page (data-estilo="secao") ----------
     No estilo da página de personalizados da Art Rock: fundo grafite, vermelho
     #EC3236, Montserrat nos títulos e Nunito no texto, cartões escuros que
     "enchem" de vermelho ao passar o mouse e botão vermelho com brilho. */
  .arp-secao { --sx-vermelho: #EC3236; --sx-grafite: #1a1a1a; width: 100%; container-type: inline-size; font-family: "Nunito", "Segoe UI", system-ui, Arial, sans-serif; color: #fff; }
  .arp-secao .arp-sx { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, .85fr); align-items: center; gap: 40px;
    max-width: 1100px; margin: 0 auto; padding: 56px 48px; border-radius: 26px;
    background: radial-gradient(circle at 82% 45%, rgba(236, 50, 54, .38), transparent 46%), radial-gradient(circle at 0% 100%, rgba(236, 50, 54, .16), transparent 40%), var(--sx-grafite);
    box-shadow: 0 24px 60px rgba(0, 0, 0, .28); }
  .arp-secao .arp-sx::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .07;
    background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 18px 18px; }
  .arp-secao .arp-sx > * { position: relative; }
  .arp-secao .arp-sx-selo { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 16px; padding: 6px 14px; border-radius: 999px;
    background: rgba(236, 50, 54, .16); border: 1px solid rgba(236, 50, 54, .55); color: #ff8a8d; font: 800 12px/1 "Montserrat", Arial, sans-serif; letter-spacing: 1.4px; text-transform: uppercase; }
  .arp-secao .arp-sx-selo::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--sx-vermelho); box-shadow: 0 0 0 4px rgba(236, 50, 54, .25); animation: arp-sx-ponto 1.6s infinite; }
  @keyframes arp-sx-ponto { 50% { box-shadow: 0 0 0 7px rgba(236, 50, 54, 0); } }
  .arp-secao h2.arp-sx-titulo { margin: 0 0 14px !important; padding: 0 !important; color: #fff !important; font: 900 clamp(28px, 3.4vw, 44px)/1.08 "Montserrat", Arial, sans-serif !important; letter-spacing: -.5px; text-transform: none; }
  .arp-secao .arp-sx-titulo i { display: block; font-style: italic; font-weight: 300; color: #fff; }
  .arp-secao .arp-sx-titulo em { font-style: normal; color: var(--sx-vermelho); }
  .arp-secao p.arp-sx-sub { margin: 0 0 24px !important; color: #d4d4d8 !important; font: 400 17px/1.5 "Nunito", Arial, sans-serif !important; max-width: 520px; }
  .arp-secao .arp-sx-passos { list-style: none; margin: 0 0 28px !important; padding: 0 !important; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .arp-secao .arp-sx-passos li { position: relative; overflow: hidden; margin: 0; padding: 16px 14px; border-radius: 14px; background: #232326; border: 1px solid #333; cursor: default; }
  /* "Enche" de vermelho da esquerda para a direita, como os cartões da página */
  .arp-secao .arp-sx-passos li::before { content: ""; position: absolute; inset: 0; background: var(--sx-vermelho); transform: scaleX(0); transform-origin: left center; transition: transform .45s ease; }
  .arp-secao .arp-sx-passos li:hover::before { transform: scaleX(1); }
  .arp-secao .arp-sx-passos li > * { position: relative; }
  .arp-secao .arp-sx-passos b { display: inline-grid; place-items: center; width: 30px; height: 30px; margin-bottom: 10px; border-radius: 8px; background: var(--sx-vermelho); color: #fff;
    font: 900 15px/1 "Montserrat", Arial, sans-serif; transition: background .45s, color .45s; }
  .arp-secao .arp-sx-passos li:hover b { background: var(--sx-grafite); }
  .arp-secao .arp-sx-passos span { display: block; color: #fff; font: 700 14px/1.3 "Montserrat", Arial, sans-serif; }
  .arp-secao .arp-sx-acoes { display: flex; align-items: center; flex-wrap: wrap; gap: 14px 20px; }
  .arp-secao a.arp-sx-cta { display: inline-flex; align-items: center; gap: 10px; padding: 18px 34px; border-radius: 12px; color: #fff !important; text-decoration: none !important;
    background: linear-gradient(90deg, #EC3236, #ff5a5e, #EC3236); background-size: 200% 100%; font: 900 17px/1 "Montserrat", Arial, sans-serif; letter-spacing: .6px; text-transform: uppercase;
    box-shadow: 0 10px 30px rgba(236, 50, 54, .5); animation: arp-sx-grad 3s linear infinite, arp-sx-zoom 2.4s ease-in-out infinite; transition: box-shadow .2s; }
  .arp-secao a.arp-sx-cta:hover { box-shadow: 0 14px 40px rgba(236, 50, 54, .7); }
  .arp-secao a.arp-sx-cta:focus-visible { outline: 3px solid #fff; outline-offset: 4px; }
  @keyframes arp-sx-grad { to { background-position: -200% 0; } }
  @keyframes arp-sx-zoom { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  .arp-secao .arp-sx-nota { color: #a1a1aa; font: 600 13px/1.4 "Nunito", Arial, sans-serif; }
  /* Lado direito: a camiseta animada grande, com selos */
  .arp-secao a.arp-sx-visual { position: relative; display: grid; place-items: center; aspect-ratio: 1; width: 100%; max-width: 380px; justify-self: center; text-decoration: none !important; }
  .arp-secao .arp-sx-visual .arp-icone { width: 78%; height: auto; aspect-ratio: 1; box-shadow: inset 0 0 0 6px rgba(255, 255, 255, .92), 0 20px 50px rgba(0, 0, 0, .45); }
  .arp-secao .arp-sx-visual .arp-icone::after { inset: -10px; border-width: 3px; }
  .arp-secao .arp-sx-visual .arp-anim { width: 84%; height: 84%; margin: 8%; }
  .arp-secao .arp-sx-tag { position: absolute; padding: 8px 12px; border-radius: 10px; background: #fff; color: var(--sx-grafite); font: 800 13px/1 "Montserrat", Arial, sans-serif; white-space: nowrap;
    box-shadow: 0 10px 24px rgba(0, 0, 0, .3); animation: arp-sx-flutua 4s ease-in-out infinite; }
  .arp-secao .arp-sx-tag::before { content: "\\2713  "; color: var(--sx-vermelho); }
  .arp-secao .arp-sx-tag.t1 { top: 6%; left: -2%; }
  .arp-secao .arp-sx-tag.t2 { top: 48%; right: -6%; animation-delay: -1.3s; }
  .arp-secao .arp-sx-tag.t3 { bottom: 6%; left: 4%; animation-delay: -2.6s; }
  @keyframes arp-sx-flutua { 50% { transform: translateY(-8px); } }
  @media (max-width: 860px) {
    .arp-secao .arp-sx { grid-template-columns: 1fr; gap: 8px; padding: 32px 20px 36px; border-radius: 20px; text-align: center; }
    .arp-secao a.arp-sx-visual { order: -1; max-width: 270px; }
    .arp-secao .arp-sx-selo { margin-bottom: 12px; }
    .arp-secao p.arp-sx-sub { margin-left: auto !important; margin-right: auto !important; font-size: 15px !important; }
    .arp-secao .arp-sx-passos { grid-template-columns: 1fr; gap: 8px; text-align: left; }
    .arp-secao .arp-sx-passos li { display: flex; align-items: center; gap: 12px; padding: 12px; }
    .arp-secao .arp-sx-passos b { margin: 0; flex: none; }
    .arp-secao .arp-sx-acoes { flex-direction: column; }
    .arp-secao a.arp-sx-cta { width: 100%; justify-content: center; padding: 17px 14px; font-size: 15px; letter-spacing: .3px; white-space: nowrap; }
    .arp-secao .arp-sx-tag { font-size: 11.5px; padding: 7px 10px; }
    .arp-secao .arp-sx-tag.t2 { right: -4%; }
  }
  /* Mesmo layout de celular quando a CAIXA da secao e estreita (bloco estreito
     no construtor, coluna lateral, previa mobile do editor), nao so a tela. */
  @container (max-width: 860px) {
    .arp-secao h2.arp-sx-titulo { font-size: clamp(26px, 8.5cqi, 34px) !important; }
    .arp-secao .arp-sx { grid-template-columns: 1fr; gap: 8px; padding: 32px 20px 36px; border-radius: 20px; text-align: center; }
    .arp-secao a.arp-sx-visual { order: -1; max-width: 270px; }
    .arp-secao .arp-sx-selo { margin-bottom: 12px; }
    .arp-secao p.arp-sx-sub { margin-left: auto !important; margin-right: auto !important; font-size: 15px !important; }
    .arp-secao .arp-sx-passos { grid-template-columns: 1fr; gap: 8px; text-align: left; }
    .arp-secao .arp-sx-passos li { display: flex; align-items: center; gap: 12px; padding: 12px; }
    .arp-secao .arp-sx-passos b { margin: 0; flex: none; }
    .arp-secao .arp-sx-acoes { flex-direction: column; }
    .arp-secao a.arp-sx-cta { width: 100%; justify-content: center; padding: 17px 14px; font-size: 15px; letter-spacing: .3px; white-space: nowrap; }
    .arp-secao .arp-sx-tag { font-size: 11.5px; padding: 7px 10px; }
    .arp-secao .arp-sx-tag.t2 { right: -4%; }
  }
  /* Celulares bem estreitos (320 a 380px) */
  @media (max-width: 380px) {
    .arp-secao .arp-sx { padding: 26px 14px 30px; }
    .arp-secao a.arp-sx-visual { max-width: 240px; }
    .arp-secao h2.arp-sx-titulo { font-size: 26px !important; }
    .arp-secao .arp-sx-tag { font-size: 10.5px; padding: 6px 8px; }
    .arp-secao .arp-sx-tag.t2 { right: -2%; }
    .arp-secao a.arp-sx-cta { font-size: 14px; padding: 16px 10px; }
    .arp-secao .arp-sx-passos span { font-size: 13px; }
  }

  /* Aparelho com "reduzir animações" ligado (Windows sem efeitos de animação,
     celular em economia de bateria): continua animado, mas só com o suave:
     a camiseta troca de cor e a estampa aparece/some. Sem pulos nem pincel. */
  @media (prefers-reduced-motion: reduce) {
    .arp-flutua .arp-link, .arp-icone::after { animation: none !important; }
    .arp-pincel, .arp-brilho { animation: none !important; opacity: 0 !important; }
    .arp-est { animation-name: arp-surge !important; animation-timing-function: ease-in-out !important; }
    .arp-secao a.arp-sx-cta, .arp-secao .arp-sx-tag, .arp-secao .arp-sx-selo::before { animation: none !important; }
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

  // Estampas da animação (ícones PNG embutidos, para não precisar hospedar arquivo).
  // Para trocar: gere o PNG em base64 (ex.: site "base64 image encoder") e cole depois de "base64,".
  var IMG_GUITARRA = 'data:image/png;base64,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';
  var IMG_MOTO = 'data:image/png;base64,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';
  var IMG_CAVEIRA = 'data:image/png;base64,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';

  // Animação: camiseta (troca de cor) + uma estampa por cor (guitarra, moto, caveira mexicana) com o pincel
  var ANIM =
    '<svg class="arp-anim" viewBox="8 10 104 102" aria-hidden="true" focusable="false">' +
      '<path class="arp-camisa" stroke-width="2" stroke="#3a3a40" stroke-linejoin="round" d="M44 22 L30 27 L12 41 L21 58 L32 52 L32 102 Q60 107 88 102 L88 52 L99 58 L108 41 L90 27 L76 22 Q60 34 44 22 Z"/>' +
      '<path class="arp-gola" fill="none" stroke-width="3" stroke-linecap="round" stroke="#3a3a40" d="M46 23 Q60 33 74 23"/>' +
      '<g class="arp-estampa">' +
        // 1) Guitarra (camiseta preta)
        '<g class="arp-est arp-est1"><image href="' + IMG_GUITARRA + '" x="40" y="39" width="40" height="37"/>' +
          '<text x="60" y="89" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="10.5" letter-spacing="1.2" fill="#ed3051" stroke="#fff" stroke-width=".35">ROCK</text></g>' +
        // 2) Moto (camiseta branca)
        '<g class="arp-est arp-est2"><image href="' + IMG_MOTO + '" x="35" y="47" width="50" height="28"/>' +
          '<text x="60" y="87.5" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="10" letter-spacing="1.2" fill="#121214">MOTOR</text></g>' +
        // 3) Caveira mexicana (camiseta azul)
        '<g class="arp-est arp-est3"><image href="' + IMG_CAVEIRA + '" x="45" y="38" width="30" height="41"/>' +
          '<text x="60" y="89.5" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="10.5" letter-spacing="1.2" fill="#ffd23f">VIVA</text></g>' +
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

  // Seção para landing page: textos à esquerda, camiseta animada grande à direita.
  // Os textos podem ser trocados aqui (acentos escritos como \\u00e1 etc. para nunca sair embaralhado).
  function secao() {
    return '<section class="arp-sx" aria-label="Editor de camisetas Art Rock">' +
      '<div class="arp-sx-texto">' +
        '<span class="arp-sx-selo">Novo \u00b7 Editor online</span>' +
        '<h2 class="arp-sx-titulo"><i>Monte a sua camiseta</i> e veja como fica <em>antes de pedir</em></h2>' +
        '<p class="arp-sx-sub">Envie a logo da sua empresa, evento ou projeto, escolha modelo, cor e tamanhos, e receba o or\u00e7amento da Art Rock.</p>' +
        '<ol class="arp-sx-passos">' +
          '<li><b>1</b><span>Escolha o modelo e a cor</span></li>' +
          '<li><b>2</b><span>Envie sua arte ou escreva um texto</span></li>' +
          '<li><b>3</b><span>Defina os tamanhos e pe\u00e7a o or\u00e7amento</span></li>' +
        '</ol>' +
        '<div class="arp-sx-acoes">' +
          '<a class="arp-sx-cta" id="arp-personalize-link" href="' + EDITOR + '"' + aba + '>Personalizar agora! <span aria-hidden="true">\u2192</span></a>' +
          '<span class="arp-sx-nota">Para marcas pr\u00f3prias, uniformes e eventos.<br>Sem cadastro e sem compromisso.</span>' +
        '</div>' +
      '</div>' +
      '<a class="arp-sx-visual" href="' + EDITOR + '"' + aba + ' tabindex="-1" aria-hidden="true">' +
        '<span class="arp-icone">' + ANIM + '</span>' +
        '<span class="arp-sx-tag t1">Sua logo</span>' +
        '<span class="arp-sx-tag t2">Tamanho real em cm</span>' +
        '<span class="arp-sx-tag t3">Frente e costas</span>' +
      '</a>' +
    '</section>';
  }

  function montar() {
    var el = target();
    var caixa = document.createElement('div');
    // id fixo do botão (para estilizar ou mover pelo CSS da loja): #arp-personalize
    // e o link dentro dele: #arp-personalize-link
    caixa.id = 'arp-personalize';
    if (el) {
      // Seção completa para landing page (data-estilo="secao")
      if (el.getAttribute('data-estilo') === 'secao') {
        caixa.className = 'arp arp-secao';
        caixa.innerHTML = secao();
        el.innerHTML = '';
        el.appendChild(caixa);
        return;
      }
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
