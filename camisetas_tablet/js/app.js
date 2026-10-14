/**
 * @module app
 * @description App do tablet (quiosque): o cliente monta a camiseta em passos.
 *
 *   Início → 1 Camiseta → 2 Arte → 3 Ajustar → 4 Tamanhos → 5 Revisar → Seus dados → Pronto
 *
 * Cada tela tem o botão "Ajuda" com dicas curtas. Na primeira vez em
 * "Ajustar" aparece a dica animada (arrastar / dois dedos). Depois de alguns
 * minutos parado o app pergunta "Ainda está aí?" e volta ao início.
 *
 * Área do administrador: toque 5 vezes no nome da loja (canto superior
 * esquerdo) ou segure o dedo nele por 2 segundos.
 */

import { PADRAO, CORES, MALHAS, MODELOS, POSICOES } from './config.js';
import { DB } from './db.js';
import { icone } from './icons.js';
import { $, $$, esc, num, aviso, janela, confirmar, ajuda, coach } from './ui.js';
import { camisetaSVG, areaImpressao, modelo, VB } from './shirt.js';
import { urlDa, processarArquivoCliente, removerFundoDaArte } from './catalog.js';
import { qualidade, ICONE_QUALIDADE, buscarImagens, baixarImagem, credito } from './fontes.js';
import { maxCm, textoMedidas, medidas, totalPecas, salvarPedido, numeroPedido, textoResumo, escalaInfantil, ladosDo } from './order.js';

// ---------- Estado ----------

const novoItem = (base = {}) => ({
  modelo: base.modelo || MODELOS[0].id,
  malha: base.malha || MALHAS[0].id,
  cor: base.cor || MALHAS[0].cores[0],
  artes: [], quantidades: {}
});

const S = {
  cfg: { ...PADRAO },
  tela: 'inicio',
  itens: [novoItem()], atual: 0,
  lado: 'Frente', sel: null,
  desfazer: [],
  catalogo: [], tema: 'Todas', busca: '',
  fonte: 'catalogo',                    // de onde vem a arte: catalogo | enviar | buscar
  artesCliente: new Set(),              // artes enviadas/baixadas nesta sessão (apagadas ao recomeçar)
  web: { termo: '', vetor: false, resultados: [], total: 0, pagina: 1, erro: '' },
  coachVisto: false,
  ultimoPedido: null
};
const item = () => S.itens[S.atual];
let uidSeq = 0;

export const App = { S, irPara, recarregarCatalogo, aplicarConfig, recomecar };

// ---------- Estrutura da tela ----------

const PASSOS = [
  { id: 'camiseta', nome: 'Camiseta', ic: 'camisa' },
  { id: 'artes',    nome: 'Arte',     ic: 'arte' },
  { id: 'ajustar',  nome: 'Ajustar',  ic: 'ajustar' },
  { id: 'tamanhos', nome: 'Tamanhos', ic: 'regua' },
  { id: 'revisar',  nome: 'Revisar',  ic: 'lista' }
];

function montarEsqueleto() {
  document.body.innerHTML = `
    <div id="app">
      <header class="topo">
        <button type="button" class="marca" id="marca" aria-label="Nome da loja"><span class="marcaIcone">${icone('camisa', 22)}</span><span id="nomeLoja"></span></button>
        <nav class="passos" id="passos" aria-label="Etapas"></nav>
        <div class="topoAcoes">
          <button type="button" class="btnTopo" id="btnAjuda">${icone('ajuda', 22)}<span>Ajuda</span></button>
          <button type="button" class="btnTopo" id="btnRecomecar">${icone('desfazer', 22)}<span>Recomeçar</span></button>
        </div>
      </header>
      <main id="tela" tabindex="-1"></main>
      <footer class="rodape" id="rodape"></footer>
    </div>`;
  $('#btnAjuda').onclick = () => AJUDA[S.tela]?.();
  $('#btnRecomecar').onclick = async () => {
    if (await confirmar('Quer apagar tudo e começar de novo?', { sim: 'Recomeçar', perigo: true })) recomecar();
  };
  ativarAdminSecreto($('#marca'));
}

/** Toque 5× (ou segure 2 s) no nome da loja → área do administrador. */
function ativarAdminSecreto(el) {
  let toques = 0, tToques = null, tSegurar = null;
  const abrir = () => import('./admin.js').then(m => m.abrirAdmin(App));
  el.addEventListener('click', () => {
    toques++;
    clearTimeout(tToques);
    tToques = setTimeout(() => (toques = 0), 1500);
    if (toques >= 5) { toques = 0; abrir(); }
  });
  el.addEventListener('pointerdown', () => { tSegurar = setTimeout(abrir, 2000); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, () => clearTimeout(tSegurar)));
}

function pintarPassos() {
  const i = PASSOS.findIndex(p => p.id === S.tela);
  $('#passos').innerHTML = PASSOS.map((p, k) => `
    <button type="button" class="passo ${k === i ? 'atual' : k < i ? 'feito' : ''}" data-ir="${p.id}" ${k > i ? 'disabled' : ''} aria-current="${k === i ? 'step' : 'false'}">
      <span class="passoNum">${k < i ? icone('check', 16) : k + 1}</span><span class="passoNome">${p.nome}</span>
    </button>`).join('<span class="passoLinha"></span>');
  $$('#passos [data-ir]').forEach(b => (b.onclick = () => irPara(b.dataset.ir)));
}

/** Rodapé: voltar (esquerda), texto do meio, avançar (direita). */
function rodape({ voltar, meio = '', avancar } = {}) {
  const r = $('#rodape');
  r.innerHTML = `
    ${voltar ? `<button type="button" class="btn btnClaro btnGrande" id="rVoltar">${icone('voltar')} ${voltar.texto || 'Voltar'}</button>` : '<span></span>'}
    <div class="rodapeMeio">${meio}</div>
    ${avancar ? `<button type="button" class="btn btnEscuro btnGrande" id="rAvancar" ${avancar.desabilitado ? 'aria-disabled="true"' : ''}>${avancar.texto} ${icone('avancar')}</button>` : '<span></span>'}`;
  if (voltar) $('#rVoltar').onclick = voltar.acao;
  if (avancar) $('#rAvancar').onclick = () => (avancar.desabilitado ? aviso(avancar.motivo || 'Complete esta etapa para continuar.', 'erro') : avancar.acao());
}

const TELAS = {};

function irPara(tela) {
  S.tela = tela;
  const app = $('#app');
  app.dataset.tela = tela;
  const fluxo = PASSOS.some(p => p.id === tela);
  app.classList.toggle('semPassos', !fluxo);
  if (fluxo) pintarPassos();
  $('#tela').scrollTop = 0;
  TELAS[tela]();
  $('#tela').focus({ preventScroll: true });
}

/** Apaga do tablet as artes enviadas/baixadas que não entraram num pedido. */
function limparArtesCliente() {
  const usadas = new Set((S.ultimoPedido?.itens || []).flatMap(it => it.artes.map(a => a.artId)));
  S.artesCliente.forEach(id => { if (!usadas.has(id)) DB.apagar('artes', id).catch(() => {}); });
  S.artesCliente.clear();
}

function recomecar() {
  limparArtesCliente();
  S.fonte = 'catalogo'; S.web = { termo: '', vetor: false, resultados: [], total: 0, pagina: 1, erro: '' };
  S.itens = [novoItem()]; S.atual = 0; S.lado = 'Frente'; S.sel = null; S.desfazer = [];
  S.tema = 'Todas'; S.busca = ''; S.coachVisto = false; S.ultimoPedido = null; S.cliente = null;
  $$('dialog[open]').forEach(d => d.remove());
  irPara('inicio');
}

// ---------- Desenho da camiseta com as artes ----------

/** Mantém a arte dentro da área e do tamanho máximo. */
function encaixar(a, it = item()) {
  const area = areaImpressao(it.modelo, a.lado);
  a.cm = Math.max(3, Math.min(a.cm, maxCm(it.modelo, a)));
  const meiaW = (a.cm * area.upc) / 2 / area.w, meiaH = (a.cm * area.upc * a.h / a.w) / 2 / area.h;
  a.fx = Math.min(1 - meiaW, Math.max(meiaW, a.fx));
  a.fy = Math.min(1 - meiaH, Math.max(meiaH, a.fy));
  return a;
}

/** Posição/tamanho da arte em unidades do desenho. */
function geom(a, it = item()) {
  const area = areaImpressao(it.modelo, a.lado);
  const w = a.cm * area.upc, h = w * a.h / a.w;
  return { x: area.x + a.fx * area.w - w / 2, y: area.y + a.fy * area.h - h / 2, w, h };
}

/** SVG da camiseta + artes. */
function palco(it, lado, { mostrarArea = false, sel = null, artesExtra = [] } = {}) {
  const area = areaImpressao(it.modelo, lado);
  const m = modelo(it.modelo);
  const artes = [...it.artes.filter(a => a.lado === lado), ...artesExtra];
  const g = sel && artes.find(a => a.uid === sel) ? geom(artes.find(a => a.uid === sel), it) : null;
  const rotulo = m.infantil ? `Máx. ${m.area.nome} ${m.area.w}×${m.area.h} · ${m.infantil.nome} ${m.infantil.w}×${m.infantil.h} cm` : `Área máxima ${m.area.w} × ${m.area.h} cm`;
  return `<svg class="palcoSvg" viewBox="0 0 ${VB.w} ${VB.h}" role="img" aria-label="Camiseta ${esc(m.nome)} ${esc(lado)}">
    ${camisetaSVG({ modelo: it.modelo, lado, cor: it.cor })}
    ${mostrarArea ? `<rect class="areaImp" x="${area.x}" y="${area.y}" width="${area.w}" height="${area.h}" rx="6"/>
      <text class="areaRotulo" x="${VB.w / 2}" y="${area.y + area.h + 30}">${rotulo}</text>` : ''}
    <g class="artes">${artes.map(a => { const r = geom(a, it); return `<image data-uid="${a.uid}" href="${a.url}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="none"/>`; }).join('')}</g>
    ${g ? `<rect class="selecao" x="${g.x - 6}" y="${g.y - 6}" width="${g.w + 12}" height="${g.h + 12}" rx="6"/>` : ''}
  </svg>`;
}

/** Arte nova com tamanho e posição iniciais. */
async function criarArte(resumo, lado) {
  const url = await urlDa(resumo.id, 'previa');
  const it = item(), area = areaImpressao(it.modelo, lado);
  const a = { uid: 'a' + (++uidSeq), artId: resumo.id, nome: resumo.nome, tema: resumo.tema, arquivo: resumo.arquivo,
              pagina: resumo.pagina, w: resumo.w, h: resumo.h, url, lado, cm: 0, fx: 0.5, fy: 0.5,
              origem: resumo.origem || 'catalogo', vetor: !!resumo.vetor, pdfComImagem: !!resumo.pdfComImagem,
              pxW: resumo.pxW, pxH: resumo.pxH, fonte: resumo.fonte || null };
  a.cm = Math.min(maxCm(it.modelo, a), modelo(it.modelo).area.w * 0.65);
  // Imagem (não vetor) do cliente/internet: começa no maior tamanho com boa qualidade
  const q = qualidade(a);
  if (q?.cmBom && q.cmBom < a.cm) a.cm = Math.max(5, q.cmBom);
  const meiaH = (a.cm * area.upc * a.h / a.w) / 2 / area.h;
  a.fy = Math.min(0.5, meiaH + 0.04); // um pouco abaixo da gola
  return encaixar(a);
}

// ---------- Início ----------

TELAS.inicio = () => {
  const vazio = !S.catalogo.length;
  $('#tela').innerHTML = `
    <section class="inicio">
      <div class="inicioTexto">
        <button type="button" class="inicioMarca" id="marcaInicio">${esc(S.cfg.loja)}</button>
        <h1>${esc(S.cfg.slogan)}</h1>
        <ol class="inicioPassos">
          <li>${icone('camisa', 26)}<span><b>Escolha</b> a camiseta e a cor</span></li>
          <li>${icone('arte', 26)}<span><b>Escolha</b> uma arte</span></li>
          <li>${icone('mao', 26)}<span><b>Ajuste</b> com o dedo</span></li>
          <li>${icone('regua', 26)}<span><b>Diga</b> os tamanhos</span></li>
        </ol>
        <button type="button" class="btn btnEscuro btnEnorme" id="btnComecar">Toque para começar ${icone('avancar', 28)}</button>
        <button type="button" class="btnTexto" id="btnComoFunciona">${icone('olho', 20)} Ver como funciona</button>
        ${vazio ? `<p class="avisoLoja">${icone('cadeado', 18)} Catálogo vazio. Atendente: toque 5 vezes no nome da loja para importar as artes.</p>` : ''}
      </div>
      <div class="inicioVitrine" aria-hidden="true">
        ${['Preto', 'Branco', 'Cinza Mescla'].map((c, i) => `<div class="vitrineCamisa v${i}"><svg viewBox="0 0 ${VB.w} ${VB.h}">${camisetaSVG({ modelo: 'Masculina', lado: 'Frente', cor: c })}</svg></div>`).join('')}
      </div>
    </section>`;
  $('#btnComecar').onclick = () => irPara('camiseta');
  $('#btnComoFunciona').onclick = tutorial;
  ativarAdminSecreto($('#marcaInicio'));
  rodape();
};

function tutorial() {
  return coach([
    { icone: 'camisa', titulo: '1. Escolha a camiseta', texto: 'Toque no modelo, na malha e na cor. A camiseta muda na hora para você ver como fica.' },
    { icone: 'arte', titulo: '2. Escolha uma arte', texto: 'Passe o dedo para ver as artes. Toque numa delas para ver maior e depois em <b>Usar esta arte</b>.' },
    { icone: 'mao', titulo: '3. Ajuste com o dedo', texto: 'Arraste a arte para mudar o lugar. Use dois dedos (ou os botões + e −) para mudar o tamanho.', anim: 'arrastar' },
    { icone: 'regua', titulo: '4. Tamanhos e pronto!', texto: 'Diga quantas camisetas de cada tamanho. No final você recebe o número do pedido para mostrar ao atendente.' }
  ]);
}

// ---------- 1. Camiseta ----------

TELAS.camiseta = () => {
  const it = item();
  const malha = MALHAS.find(m => m.id === it.malha) || MALHAS[0];
  const mod = modelo(it.modelo);
  const cores = malha.cores.filter(c => !mod.cores || mod.cores.includes(c));
  if (!cores.includes(it.cor)) it.cor = cores[0] || malha.cores[0];
  $('#tela').innerHTML = `
    <section class="duasColunas">
      <div class="palco palcoCamiseta">
        <div class="palcoArea">${palco(it, S.lado)}</div>
        <div class="segmento" role="group" aria-label="Lado">
          ${['Frente', 'Costas'].map(l => `<button type="button" data-lado="${l}" aria-pressed="${S.lado === l}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="painel">
        <h2 class="tituloTela">Como é a sua camiseta?</h2>
        <h3 class="subtitulo"><span class="bola">1</span> Modelo</h3>
        <div class="opcoes opcoes3">${MODELOS.map(m => `
          <button type="button" class="opcao" data-modelo="${m.id}" aria-pressed="${m.id === it.modelo}">
            <svg class="opcaoCamisa" viewBox="0 0 ${VB.w} ${VB.h}">${camisetaSVG({ modelo: m.id, lado: 'Frente', cor: it.cor })}</svg>
            <strong>${m.nome}</strong><small>${m.desc}</small>${icone('check', 20)}</button>`).join('')}
        </div>
        <h3 class="subtitulo"><span class="bola">2</span> Malha</h3>
        <div class="opcoes opcoes2">${MALHAS.map(m => `
          <button type="button" class="opcao opcaoTexto" data-malha="${m.id}" aria-pressed="${m.id === it.malha}">
            <strong>${m.nome}</strong><small>${m.desc}</small>${icone('check', 20)}</button>`).join('')}
        </div>
        <h3 class="subtitulo"><span class="bola">3</span> Cor</h3>
        <div class="cores">${cores.map(c => `
          <button type="button" class="cor" data-cor="${c}" aria-pressed="${c === it.cor}" aria-label="${esc(CORES[c].nome || c)}">
            <span class="corBola ${CORES[c].mescla ? 'mescla' : ''}" style="--c:${CORES[c].hex}">${icone('check', 22)}</span>
            <span>${esc(CORES[c].nome || c)}</span></button>`).join('')}
        </div>
      </div>
    </section>`;
  $$('[data-modelo]').forEach(b => (b.onclick = () => { it.modelo = b.dataset.modelo; it.artes.forEach(a => encaixar(a)); it.quantidades = {}; TELAS.camiseta(); }));
  $$('[data-malha]').forEach(b => (b.onclick = () => { it.malha = b.dataset.malha; TELAS.camiseta(); }));
  $$('[data-cor]').forEach(b => (b.onclick = () => { it.cor = b.dataset.cor; TELAS.camiseta(); }));
  $$('[data-lado]').forEach(b => (b.onclick = () => { S.lado = b.dataset.lado; TELAS.camiseta(); }));
  rodape({
    voltar: { texto: 'Início', acao: async () => { if (!temAlgo() || await confirmar('Voltar ao início? O que você montou será apagado.', { sim: 'Voltar ao início', perigo: true })) recomecar(); } },
    meio: `${esc(mod.nome)} · ${esc(malha.nome)} · ${esc(CORES[it.cor].nome || it.cor)}`,
    avancar: { texto: it.artes.length ? 'Ajustar a arte' : 'Escolher a arte', acao: () => irPara(it.artes.length ? 'ajustar' : 'artes') }
  });
};

const temAlgo = () => S.itens.some(i => i.artes.length || totalPecas(i) > 0);

// ---------- 2. Artes ----------

function artesFiltradas() {
  const b = S.busca.trim().toLowerCase();
  return S.catalogo.filter(a => (S.tema === 'Todas' || a.tema === S.tema) && (!b || (a.nome + ' ' + a.tema).toLowerCase().includes(b)));
}

let observador = null;
function carregarMiniaturas(raiz) {
  observador?.disconnect();
  observador = new IntersectionObserver(entradas => entradas.forEach(async e => {
    if (!e.isIntersecting) return;
    const img = e.target;
    observador.unobserve(img);
    const url = await urlDa(img.dataset.id);
    if (url) { img.src = url; img.onload = () => img.classList.add('ok'); }
  }), { root: raiz, rootMargin: '400px' });
  $$('img[data-id]', raiz).forEach(i => observador.observe(i));
}

/** Fontes de arte liberadas pela loja (Configurações). */
function fontesAtivas() {
  return [
    { id: 'catalogo', nome: 'Artes da loja', ic: 'arte' },
    S.cfg.permitirEnvio !== false && { id: 'enviar', nome: 'Enviar minha arte', ic: 'upload' },
    S.cfg.permitirBusca !== false && { id: 'buscar', nome: 'Buscar na internet', ic: 'busca' }
  ].filter(Boolean);
}

TELAS.artes = () => {
  const it = item();
  const fontes = fontesAtivas();
  if (!fontes.some(f => f.id === S.fonte)) S.fonte = 'catalogo';
  $('#tela').innerHTML = `
    <section class="galeria">
      <div class="galeriaCabeca">
        <h2 class="tituloTela">Escolha uma arte ${S.lado === 'Costas' ? '<span class="etiqueta">para as COSTAS</span>' : ''}</h2>
        ${fontes.length > 1 ? `<div class="segmento segmentoFontes" role="tablist" aria-label="De onde vem a arte">
          ${fontes.map(f => `<button type="button" role="tab" data-fonte="${f.id}" aria-pressed="${S.fonte === f.id}">${icone(f.ic, 20)} ${f.nome}</button>`).join('')}
        </div>` : ''}
      </div>
      <div id="fonteConteudo" class="fonteConteudo"></div>
    </section>`;
  $$('[data-fonte]').forEach(b => (b.onclick = () => { S.fonte = b.dataset.fonte; TELAS.artes(); }));
  ({ catalogo: telaCatalogo, enviar: telaEnviar, buscar: telaBuscar })[S.fonte]();
  rodape({
    voltar: { texto: it.artes.length ? 'Ajustar' : 'Camiseta', acao: () => irPara(it.artes.length ? 'ajustar' : 'camiseta') },
    meio: `<button type="button" class="btnTexto" id="semArte">Quero sem arte (lisa)</button>`,
    avancar: it.artes.length
      ? { texto: 'Ajustar', acao: () => irPara('ajustar') }
      : { texto: 'Ajustar', desabilitado: true, motivo: 'Escolha uma arte (ou toque em "Quero sem arte").' }
  });
  $('#semArte').onclick = () => irPara('tamanhos');
};

/** Catálogo da loja. */
function telaCatalogo() {
  const it = item();
  const temas = [...new Set(S.catalogo.map(a => a.tema))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const cont = t => S.catalogo.filter(a => a.tema === t).length;
  const malha = MALHAS.find(m => m.id === it.malha) || MALHAS[0];
  const cores = malha.cores.filter(c => !modelo(it.modelo).cores || modelo(it.modelo).cores.includes(c));
  $('#fonteConteudo').innerHTML = `
      <div class="galeriaTopo">
        <label class="busca">${icone('busca')}<input type="search" id="busca" placeholder="Procurar arte…" value="${esc(S.busca)}" autocomplete="off" enterkeyhint="search"></label>
        <div class="coresMini" role="group" aria-label="Ver as artes na cor">${cores.map(c => `<button type="button" class="corMini ${CORES[c].mescla ? 'mescla' : ''}" data-cor="${c}" style="--c:${CORES[c].hex}" aria-pressed="${c === it.cor}" title="${esc(CORES[c].nome || c)}"></button>`).join('')}</div>
      </div>
      <div class="temas" id="temas" role="tablist">
        <button type="button" class="tema" data-tema="Todas" aria-pressed="${S.tema === 'Todas'}">Todas <small>${S.catalogo.length}</small></button>
        ${temas.map(t => `<button type="button" class="tema" data-tema="${esc(t)}" aria-pressed="${S.tema === t}">${esc(t)} <small>${cont(t)}</small></button>`).join('')}
      </div>
      <div class="grade" id="grade" style="--fundo:${CORES[it.cor].hex}"></div>`;
  const pintarGrade = () => {
    const lista = artesFiltradas();
    const usadas = new Set(it.artes.map(a => a.artId));
    $('#grade').innerHTML = lista.length ? lista.map((a, i) => `
      <button type="button" class="cartaoArte" data-i="${i}">
        <span class="cartaoImg"><img data-id="${esc(a.id)}" alt=""></span>
        <span class="cartaoNome">${esc(a.nome)}</span>
        ${usadas.has(a.id) ? `<span class="selo">${icone('check', 14)} Na camiseta</span>` : ''}
      </button>`).join('')
      : `<div class="vazio">${icone(S.catalogo.length ? 'busca' : 'arte', 48)}<p>${S.catalogo.length ? 'Nenhuma arte encontrada. Tente outra palavra ou outro tema.' : 'Ainda não há artes cadastradas neste tablet. Chame o atendente.'}</p></div>`;
    carregarMiniaturas($('#grade'));
    $$('#grade [data-i]').forEach(b => (b.onclick = () => verArte(lista, +b.dataset.i)));
  };
  pintarGrade();
  let tBusca;
  $('#busca').oninput = e => { clearTimeout(tBusca); tBusca = setTimeout(() => { S.busca = e.target.value; pintarGrade(); }, 180); };
  $$('#temas [data-tema]').forEach(b => (b.onclick = () => {
    S.tema = b.dataset.tema;
    $$('#temas [data-tema]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    pintarGrade();
  }));
  $$('.coresMini [data-cor]').forEach(b => (b.onclick = () => {
    it.cor = b.dataset.cor;
    $$('.coresMini [data-cor]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('#grade').style.setProperty('--fundo', CORES[it.cor].hex);
  }));
}

/** Quadro com o que é uma arte boa para estampar. */
const GUIA_QUALIDADE = `
  <ul class="guiaQualidade">
    <li class="otima">${icone('estrela', 22)}<div><b>Ótimo: arte em vetor</b><span>PDF, SVG ou AI exportado em PDF. Fica nítida em qualquer tamanho.</span></div></li>
    <li class="boa">${icone('check', 22)}<div><b>Bom: imagem grande</b><span>PNG ou JPG com pelo menos <b>3000 pixels</b> de largura (para estampas grandes). PNG com fundo transparente é melhor.</span></div></li>
    <li class="baixa">${icone('fechar', 22)}<div><b>Evite</b><span>Prints de tela, fotos do WhatsApp/Instagram e imagens pequenas da internet: ficam borradas na camiseta.</span></div></li>
  </ul>`;

/** Enviar a própria arte. */
function telaEnviar() {
  $('#fonteConteudo').innerHTML = `
    <div class="envio">
      <label class="caixaEnvio" id="caixaEnvio">
        ${icone('upload', 56)}
        <strong>Toque para escolher o arquivo</strong>
        <span>Do tablet, pendrive, Google Drive ou e-mail</span>
        <span class="formatos">PDF · SVG · AI · PNG · JPG</span>
        <input type="file" id="arquivoCliente" accept="image/*,.pdf,.svg,.ai,application/pdf,image/svg+xml" hidden>
      </label>
      <div class="envioInfo">
        <h3>${icone('regua', 22)} Para a estampa ficar perfeita</h3>
        ${GUIA_QUALIDADE}
        <p class="textoAjuda">Depois de escolher, mostramos a <b>qualidade de impressão</b> no tamanho que você quer.</p>
      </div>
    </div>`;
  $('#arquivoCliente').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    await prepararArteCliente(() => processarArquivoCliente(f, { origem: 'cliente' }), 'Lendo o seu arquivo…');
  };
}

/** Processa a arte (com aviso de "carregando") e abre a revisão. */
async function prepararArteCliente(processar, texto) {
  const j = janela({ fechar: false, classe: 'janelaPequena janelaCarregando', html: `<div class="carregando"><span class="girando"></span><p>${texto}</p></div>` });
  try {
    const resumo = await processar();
    S.artesCliente.add(resumo.id);
    j.fechar();
    revisarArteCliente(resumo);
  } catch (err) {
    j.fechar();
    aviso(err.message || 'Não foi possível abrir este arquivo.', 'erro');
  }
}

/** Revisão da arte enviada/baixada: na camiseta, com a qualidade de impressão. */
async function revisarArteCliente(resumo) {
  const it = item();
  let a = await criarArte(resumo, S.lado);
  const j = janela({ classe: 'janelaArte', titulo: '', html: `
    <div class="verArte">
      <div class="verPalco" id="verPalco"></div>
      <div class="verInfo">
        <p class="verTema">${resumo.origem === 'internet' ? 'Imagem da internet' : 'Sua arte'}</p>
        <h2>${esc(resumo.nome)}</h2>
        <div id="qualidadeBox"></div>
        <p class="textoAjuda" id="detalhes"></p>
        <button type="button" class="btn btnClaro btnLargo" id="tirarFundo" ${resumo.vetor || resumo.fundoRemovido ? 'hidden' : ''}>${icone('arte', 20)} Remover fundo branco</button>
        <button type="button" class="btn btnEscuro btnGrande btnLargo" id="usar">${icone('check')} Usar esta arte</button>
        <button type="button" class="btnTexto" data-fechar>Escolher outra</button>
      </div>
    </div>` });
  const mostrar = () => {
    $('#verPalco', j.el).innerHTML = palco({ ...it, artes: [] }, S.lado, { artesExtra: [a] });
    $('#qualidadeBox', j.el).innerHTML = caixaQualidade(a, true);
    const det = a.vetor ? 'Arquivo em vetor' : a.pdfComImagem ? 'PDF com imagem' : `Imagem de ${a.pxW} × ${a.pxH} pixels`;
    $('#detalhes', j.el).innerHTML = `${det}${resumo.paginasNoArquivo > 1 ? ` · usamos a 1ª de ${resumo.paginasNoArquivo} páginas` : ''}${resumo.fonte ? `<br><small>${icone('olho', 14)} ${esc(credito(resumo.fonte))}</small>` : ''}`;
  };
  mostrar();
  $('#tirarFundo', j.el).onclick = async () => {
    const ok = await removerFundoDaArte(resumo.id);
    if (!ok) return aviso('Não encontramos um fundo de cor única para remover.');
    const novo = (await DB.artesResumo()).find(x => x.id === resumo.id) || resumo;
    resumo = novo; a = await criarArte(novo, S.lado);
    $('#tirarFundo', j.el).hidden = true;
    mostrar();
    aviso('Fundo removido.', 'ok');
  };
  $('#usar', j.el).onclick = async () => {
    const q = qualidade(a);
    if (q?.nivel === 'baixa' && !(await confirmar(`A qualidade desta imagem está BAIXA para estampar (${q.dpi} dpi). ${q.texto} Quer usar mesmo assim?`, { sim: 'Usar mesmo assim', nao: 'Escolher outra', titulo: 'Atenção à qualidade' }))) return;
    salvarDesfazer();
    it.artes.push(a);
    S.sel = a.uid;
    j.fechar();
    irPara('ajustar');
  };
}

/** Caixinha de qualidade de impressão (ou nada, para artes da loja). */
function caixaQualidade(a, grande = false) {
  const q = qualidade(a);
  if (!q) return '';
  return `<div class="qualidade q-${q.nivel} ${grande ? 'grande' : ''}" role="status">
    ${icone(ICONE_QUALIDADE[q.nivel], grande ? 24 : 18)}
    <div><b>Qualidade de impressão: ${q.rotulo}</b>${grande || q.nivel !== 'boa' ? `<span>${q.texto}</span>` : ''}</div></div>`;
}

/** Buscar imagens na internet (licença livre para uso comercial). */
function telaBuscar() {
  const w = S.web;
  $('#fonteConteudo').innerHTML = `
    <div class="buscaWeb">
      <form class="buscaWebForm" id="formWeb">
        <label class="busca">${icone('busca')}<input type="search" id="termoWeb" placeholder="O que você procura? Ex.: leão, guitarra, flores…" value="${esc(w.termo)}" autocomplete="off" enterkeyhint="search"></label>
        <button type="submit" class="btn btnEscuro">Buscar</button>
        <label class="chave"><input type="checkbox" id="soVetor" ${w.vetor ? 'checked' : ''}> <span>${icone('estrela', 18)} Só vetores (melhor qualidade)</span></label>
      </form>
      <p class="avisoWeb">${icone('ajuda', 18)}<span>Mostramos só imagens com <b>licença livre para uso comercial</b>. Prefira as maiores ou os vetores: a qualidade aparece em cada imagem.</span></p>
      <div class="grade gradeWeb" id="gradeWeb"></div>
      <div class="maisWeb" id="maisWeb"></div>
    </div>`;
  const pintar = () => {
    const g = $('#gradeWeb');
    if (w.erro) { g.innerHTML = `<div class="vazio">${icone('busca', 48)}<p>${esc(w.erro)}</p></div>`; $('#maisWeb').innerHTML = ''; return; }
    if (!w.termo) { g.innerHTML = `<div class="vazio">${icone('busca', 48)}<p>Digite o que você procura e toque em <b>Buscar</b>.</p></div>`; $('#maisWeb').innerHTML = ''; return; }
    if (!w.resultados.length) { g.innerHTML = `<div class="vazio">${icone('busca', 48)}<p>Nada encontrado. Tente outra palavra${w.vetor ? ' ou desligue "Só vetores"' : ''}.</p></div>`; $('#maisWeb').innerHTML = ''; return; }
    g.innerHTML = w.resultados.map((r, i) => {
      const est = estimativa(r);
      return `<button type="button" class="cartaoArte" data-r="${i}">
        <span class="cartaoImg cartaoWeb"><img src="${esc(r.mini || r.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onload="this.classList.add('ok')"></span>
        <span class="cartaoNome">${esc(r.titulo)}</span>
        <span class="seloQualidade q-${est.nivel}">${icone(ICONE_QUALIDADE[est.nivel], 14)} ${est.curto}</span>
      </button>`;
    }).join('');
    $$('#gradeWeb [data-r]').forEach(b => (b.onclick = () => verImagemWeb(w.resultados[+b.dataset.r])));
    $('#maisWeb').innerHTML = w.resultados.length < w.total && w.pagina < 20 ? `<button type="button" class="btn btnClaro" id="carregarMais">Ver mais imagens</button>` : '';
    $('#carregarMais') && ($('#carregarMais').onclick = () => procurar(w.pagina + 1));
  };
  const procurar = async (pagina = 1) => {
    w.termo = $('#termoWeb').value.trim(); w.vetor = $('#soVetor').checked; w.erro = '';
    if (!w.termo) return pintar();
    $('#gradeWeb').innerHTML = pagina === 1 ? `<div class="vazio"><span class="girando"></span><p>Buscando…</p></div>` : $('#gradeWeb').innerHTML;
    try {
      const r = await buscarImagens(w.termo, { vetor: w.vetor, pagina });
      w.resultados = pagina === 1 ? r.resultados : [...w.resultados, ...r.resultados];
      w.total = r.total; w.pagina = pagina;
    } catch (e) { w.erro = e.message; w.resultados = []; }
    pintar();
  };
  $('#formWeb').onsubmit = e => { e.preventDefault(); $('#termoWeb').blur(); procurar(1); };
  $('#soVetor').onchange = () => { if ($('#termoWeb').value.trim()) procurar(1); };
  pintar();
}

/** Qualidade estimada de um resultado da busca (para uma estampa de ~25 cm). */
function estimativa(r) {
  if ((r.tipo || '').toLowerCase() === 'svg') return { nivel: 'otima', curto: 'Vetor' };
  const q = qualidade({ origem: 'internet', pxW: r.w || 0 }, 25);
  if (!q || !r.w) return { nivel: 'verificar', curto: 'Tamanho ?' };
  return { nivel: q.nivel, curto: `${r.w}×${r.h}` };
}

/** Detalhes de uma imagem da busca antes de baixar. */
function verImagemWeb(r) {
  const est = estimativa(r);
  const q = est.nivel === 'otima' ? null : qualidade({ origem: 'internet', pxW: r.w || 0 }, 25);
  const j = janela({ classe: 'janelaArte', titulo: '', html: `
    <div class="verArte">
      <div class="verPalco"><div class="soArte" style="--fundo:#e9e9e6"><img src="${esc(r.mini || r.url)}" alt="" referrerpolicy="no-referrer"></div></div>
      <div class="verInfo">
        <p class="verTema">Imagem da internet</p>
        <h2>${esc(r.titulo)}</h2>
        <div class="qualidade q-${est.nivel} grande">${icone(ICONE_QUALIDADE[est.nivel], 24)}<div>
          <b>${est.nivel === 'otima' ? 'Vetor: ótima qualidade' : r.w ? `${r.w} × ${r.h} pixels` : 'Tamanho desconhecido'}</b>
          <span>${est.nivel === 'otima' ? 'Fica nítida em qualquer tamanho.' : q ? `Para ficar boa, a estampa pode ter até <b>${q.cmBom} cm</b> de largura.` : 'Vamos conferir a qualidade depois de baixar.'}</span></div></div>
        <p class="textoAjuda"><small>${icone('olho', 14)} ${esc(credito({ autor: r.autor, licenca: r.licenca, origem: r.origem }))}</small></p>
        <button type="button" class="btn btnEscuro btnGrande btnLargo" id="baixar">${icone('check')} Usar esta imagem</button>
        <button type="button" class="btnTexto" data-fechar>Voltar à busca</button>
      </div>
    </div>` });
  $('#baixar', j.el).onclick = () => {
    j.fechar();
    prepararArteCliente(async () => processarArquivoCliente(await baixarImagem(r), {
      origem: 'internet', nome: r.titulo,
      fonte: { autor: r.autor, licenca: r.licenca, licencaUrl: r.licencaUrl, pagina: r.pagina, origem: r.origem, url: r.url }
    }), 'Baixando a imagem…');
  };
}

/** Janela com a arte grande (na camiseta), passando para os lados. */
async function verArte(lista, i) {
  const it = item();
  let atual = i, naCamisa = true, inicioX = null;
  const j = janela({ classe: 'janelaArte', titulo: '', html: `
    <div class="verArte">
      <div class="verPalco" id="verPalco"></div>
      <div class="verInfo">
        <p class="verTema" id="verTema"></p>
        <h2 id="verNome"></h2>
        <p class="verMedida" id="verMedida"></p>
        <div class="segmento" role="group" aria-label="Ver">
          <button type="button" data-ver="1" aria-pressed="true">${icone('camisa', 18)} Na camiseta</button>
          <button type="button" data-ver="0" aria-pressed="false">${icone('arte', 18)} Só a arte</button>
        </div>
        <button type="button" class="btn btnEscuro btnGrande btnLargo" id="usar">${icone('check')} Usar esta arte</button>
        <div class="verNav">
          <button type="button" class="btn btnClaro" id="ant" aria-label="Arte anterior">${icone('voltar')}</button>
          <span id="verPos"></span>
          <button type="button" class="btn btnClaro" id="prox" aria-label="Próxima arte">${icone('avancar')}</button>
        </div>
        <p class="dicaPequena">${icone('mao', 16)} Passe o dedo na imagem para ver as outras</p>
      </div>
    </div>` });
  const mostrar = async () => {
    const r = lista[atual];
    $('#verNome', j.el).textContent = r.nome;
    $('#verTema', j.el).textContent = r.tema;
    $('#verPos', j.el).textContent = `${atual + 1} de ${lista.length}`;
    const a = await criarArte(r, S.lado);
    $('#verMedida', j.el).innerHTML = `${icone('regua', 16)} Até ${num(maxCm(it.modelo, a))} cm de largura neste modelo`;
    $('#verPalco', j.el).innerHTML = naCamisa ? palco({ ...it, artes: [] }, S.lado, { artesExtra: [a] })
      : `<div class="soArte" style="--fundo:${CORES[it.cor].hex}"><img src="${a.url}" alt="${esc(r.nome)}"></div>`;
  };
  const passar = d => { atual = (atual + d + lista.length) % lista.length; mostrar(); };
  $('#ant', j.el).onclick = () => passar(-1);
  $('#prox', j.el).onclick = () => passar(1);
  $$('[data-ver]', j.el).forEach(b => (b.onclick = () => {
    naCamisa = b.dataset.ver === '1';
    $$('[data-ver]', j.el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    mostrar();
  }));
  const pal = $('#verPalco', j.el);
  pal.addEventListener('pointerdown', e => { inicioX = e.clientX; });
  pal.addEventListener('pointerup', e => {
    if (inicioX == null) return;
    const d = e.clientX - inicioX; inicioX = null;
    if (Math.abs(d) > 50) passar(d < 0 ? 1 : -1);
  });
  $('#usar', j.el).onclick = async () => {
    const a = await criarArte(lista[atual], S.lado);
    salvarDesfazer();
    it.artes.push(a);
    S.sel = a.uid;
    j.fechar();
    aviso(`Arte "${a.nome}" ${S.lado === 'Costas' ? 'nas costas' : 'na frente'} da camiseta.`, 'ok');
    irPara('ajustar');
  };
  await mostrar();
}

// ---------- 3. Ajustar ----------

function salvarDesfazer() {
  S.desfazer.push(JSON.stringify(item().artes));
  if (S.desfazer.length > 30) S.desfazer.shift();
}

TELAS.ajustar = () => {
  const it = item();
  const doLado = it.artes.filter(a => a.lado === S.lado);
  if (!doLado.some(a => a.uid === S.sel)) S.sel = doLado[0]?.uid || null;
  const a = it.artes.find(x => x.uid === S.sel);
  const m = modelo(it.modelo);
  const conta = l => it.artes.filter(x => x.lado === l).length;
  $('#tela').innerHTML = `
    <section class="duasColunas ajustar">
      <div class="palco">
        <div class="segmento segmentoTopo" role="group" aria-label="Lado da camiseta">
          ${['Frente', 'Costas'].map(l => `<button type="button" data-lado="${l}" aria-pressed="${S.lado === l}">${icone('virar', 18)} ${l}${conta(l) ? ` <small>${conta(l)}</small>` : ''}</button>`).join('')}
        </div>
        <div class="palcoArea" id="palcoArea">${palco(it, S.lado, { mostrarArea: true, sel: S.sel })}</div>
        ${doLado.length ? `<p class="dicaPalco">${icone('mao', 18)} Arraste a arte · dois dedos mudam o tamanho</p>`
          : `<button type="button" class="adicionarNoPalco" id="addPalco">${icone('mais', 40)}<span>Toque para colocar uma arte na ${S.lado === 'Costas' ? 'COSTAS' : 'FRENTE'}</span></button>`}
        <button type="button" class="btnFlutuante" id="btnDesfazer" ${S.desfazer.length ? '' : 'disabled'} aria-label="Desfazer">${icone('desfazer')}<span>Desfazer</span></button>
      </div>
      <div class="painel painelCompacto">
        ${a ? `
          <div class="arteAtual">
            <span class="arteAtualImg" style="--fundo:${CORES[it.cor].hex}"><img src="${a.url}" alt=""></span>
            <div class="arteAtualNome"><small>${esc(a.origem === 'cliente' ? 'Sua arte' : a.origem === 'internet' ? 'Da internet' : a.tema)}</small><strong>${esc(a.nome)}</strong></div>
            <button type="button" class="btnIcone" id="trocar" aria-label="Trocar arte" title="Trocar arte">${icone('arte', 22)}</button>
            <button type="button" class="btnIcone btnPerigoTexto" id="remover" aria-label="Tirar arte" title="Tirar arte">${icone('lixo', 22)}</button>
          </div>
          <div class="rotuloLinha">${icone('regua', 18)} <b>Tamanho</b><span class="medidas" id="medidas"></span></div>
          <div class="tamanhoArte">
            <button type="button" class="btnRedondo" data-tam="-1" aria-label="Diminuir">${icone('menos', 24)}</button>
            <input type="range" id="tamanho" min="3" max="${maxCm(it.modelo, a)}" step="0.5" value="${a.cm}" aria-label="Largura em centímetros">
            <button type="button" class="btnRedondo" data-tam="1" aria-label="Aumentar">${icone('mais', 24)}</button>
          </div>
          <div id="qualidadeAjuste"></div>
          <div class="rotuloLinha">${icone('centro', 18)} <b>Posição</b></div>
          <div class="chipsPos">
            ${Object.entries(POSICOES).map(([k, p]) => `<button type="button" class="chipPos" data-pos="${k}">${p.nome}</button>`).join('')}
          </div>` : `
          <div class="vazio vazioPainel">${icone('arte', 40)}<p>Nenhuma arte ${S.lado === 'Costas' ? 'nas costas' : 'na frente'} ainda.</p></div>`}
        <button type="button" class="btn btnContorno btnLargo" id="adicionar">${icone('mais', 20)} ${a ? 'Outra arte' : 'Colocar arte'} ${S.lado === 'Costas' ? 'nas costas' : 'na frente'}</button>
        ${S.lado === 'Frente' && !conta('Costas') ? `<button type="button" class="btnTexto" id="irCostas">${icone('virar', 18)} Arte nas costas também?</button>` : ''}
        ${m.infantil ? `<p class="notaInfantil">${icone('ajuda', 16)} Montada no tamanho <b>juvenil</b>; nas peças infantis (01 a 06) é reduzida automaticamente.</p>` : ''}
      </div>
    </section>`;

  const svg = $('#palcoArea svg');
  const pintarMedidas = () => {
    if (!a) return;
    $('#medidas').innerHTML = `${textoMedidas(it.modelo, a)}`;
    $('#medidas').title = `Máximo ${m.area.w} × ${m.area.h} cm`;
    const box = $('#qualidadeAjuste'), novo = caixaQualidade(a);
    if (box.dataset.html !== novo) { box.dataset.html = novo; box.innerHTML = novo; }
  };
  pintarMedidas();
  /** Atualiza só a arte selecionada (rápido, durante o arraste). */
  const redesenhar = () => {
    if (!a) return;
    const g = geom(a);
    const img = svg.querySelector(`[data-uid="${a.uid}"]`);
    img.setAttribute('x', g.x); img.setAttribute('y', g.y); img.setAttribute('width', g.w); img.setAttribute('height', g.h);
    const sel = svg.querySelector('.selecao');
    if (sel) { sel.setAttribute('x', g.x - 6); sel.setAttribute('y', g.y - 6); sel.setAttribute('width', g.w + 12); sel.setAttribute('height', g.h + 12); }
    const r = $('#tamanho'); if (r && Math.abs(+r.value - a.cm) > 0.01) r.value = a.cm;
    pintarMedidas();
  };

  // Arrastar (1 dedo) e mudar o tamanho (2 dedos)
  const ponto = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  const dedos = new Map();
  let arraste = null, pinca = null, mudou = false;
  svg.addEventListener('pointerdown', e => {
    const alvo = e.target.closest('image[data-uid]');
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch { /* ok */ }
    if (dedos.size === 1 && alvo && alvo.dataset.uid !== S.sel) { S.sel = alvo.dataset.uid; return TELAS.ajustar(); }
    if (!a) return;
    if (dedos.size === 2) {
      const [p1, p2] = [...dedos.values()];
      pinca = { d0: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, cm0: a.cm };
      arraste = null;
    } else if (dedos.size === 1) {
      const p = ponto(e);
      arraste = { p0: p, fx: a.fx, fy: a.fy };
    }
    if (!mudou) { salvarDesfazer(); mudou = true; }
  });
  svg.addEventListener('pointermove', e => {
    if (!dedos.has(e.pointerId) || !a) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const area = areaImpressao(it.modelo, a.lado);
    if (pinca && dedos.size >= 2) {
      const [p1, p2] = [...dedos.values()];
      a.cm = Math.round(pinca.cm0 * Math.hypot(p1.x - p2.x, p1.y - p2.y) / pinca.d0 * 2) / 2;
      encaixar(a); redesenhar();
    } else if (arraste) {
      const p = ponto(e);
      a.fx = arraste.fx + (p.x - arraste.p0.x) / area.w;
      a.fy = arraste.fy + (p.y - arraste.p0.y) / area.h;
      encaixar(a); redesenhar();
    }
  });
  const soltar = e => {
    dedos.delete(e.pointerId);
    if (dedos.size < 2) pinca = null;
    if (!dedos.size) { arraste = null; if (mudou) { mudou = false; $('#btnDesfazer').disabled = false; } }
  };
  svg.addEventListener('pointerup', soltar);
  svg.addEventListener('pointercancel', soltar);

  $$('[data-lado]').forEach(b => (b.onclick = () => { S.lado = b.dataset.lado; S.sel = null; TELAS.ajustar(); }));
  $('#btnDesfazer').onclick = () => {
    if (!S.desfazer.length) return;
    const antes = JSON.parse(S.desfazer.pop());
    it.artes = antes;
    if (!it.artes.some(x => x.uid === S.sel)) S.sel = null;
    TELAS.ajustar();
  };
  $('#addPalco') && ($('#addPalco').onclick = () => irPara('artes'));
  $('#adicionar').onclick = () => irPara('artes');
  $('#irCostas') && ($('#irCostas').onclick = () => { S.lado = 'Costas'; S.sel = null; TELAS.ajustar(); });
  if (a) {
    const tam = $('#tamanho');
    tam.addEventListener('pointerdown', () => salvarDesfazer(), { once: true });
    tam.oninput = () => { a.cm = +tam.value; encaixar(a); redesenhar(); };
    tam.onchange = () => { $('#btnDesfazer').disabled = false; };
    $$('[data-tam]').forEach(b => (b.onclick = () => {
      salvarDesfazer();
      a.cm = Math.round(a.cm) + +b.dataset.tam;
      const max = maxCm(it.modelo, a);
      if (a.cm > max) aviso(`Este é o tamanho máximo para esta arte: ${num(max)} cm.`);
      encaixar(a); redesenhar(); $('#btnDesfazer').disabled = false;
    }));
    $$('[data-pos]').forEach(b => (b.onclick = () => {
      salvarDesfazer();
      const p = POSICOES[b.dataset.pos], area = areaImpressao(it.modelo, a.lado);
      if (p.cm) a.cm = Math.min(a.cm, p.cm);
      a.fx = p.cx;
      const meiaH = (a.cm * area.upc * a.h / a.w) / 2 / area.h;
      a.fy = p.topo == null ? 0.5 : p.topo + meiaH;
      encaixar(a); redesenhar(); $('#btnDesfazer').disabled = false;
    }));
    $('#trocar').onclick = async () => {
      salvarDesfazer();
      it.artes = it.artes.filter(x => x.uid !== a.uid);
      S.sel = null;
      irPara('artes');
    };
    $('#remover').onclick = () => {
      salvarDesfazer();
      it.artes = it.artes.filter(x => x.uid !== a.uid);
      S.sel = null;
      aviso('Arte retirada. Toque em "Desfazer" se quiser de volta.');
      TELAS.ajustar();
    };
  }
  rodape({
    voltar: { texto: 'Artes', acao: () => irPara('artes') },
    meio: it.artes.length ? `${it.artes.length} arte${it.artes.length > 1 ? 's' : ''} · ${['Frente', 'Costas'].filter(l => conta(l)).join(' e ')}` : '',
    avancar: { texto: 'Tamanhos', acao: () => irPara('tamanhos') }
  });
  if (!S.coachVisto && a) {
    S.coachVisto = true;
    coach([
      { icone: 'mao', anim: 'arrastar', titulo: 'Arraste para mudar o lugar', texto: 'Encoste o dedo na arte e arraste. Ela não sai da área tracejada (a área de impressão).' },
      { icone: 'ajustar', anim: 'pinca', titulo: 'Dois dedos mudam o tamanho', texto: 'Afaste ou junte dois dedos sobre a arte. Também dá para usar os botões <b>−</b> e <b>+</b>.' }
    ]);
  }
};

// ---------- 4. Tamanhos ----------

TELAS.tamanhos = () => {
  const it = item(), m = modelo(it.modelo);
  const grupos = m.infantil
    ? [{ nome: `${m.infantil.nome} (${m.infantil.tamanhos[0]} a ${m.infantil.tamanhos.at(-1)})`, tamanhos: m.infantil.tamanhos, nota: 'A arte é reduzida automaticamente para caber.' },
       { nome: `${m.area.nome} (${m.area.tamanhos[0]} a ${m.area.tamanhos.at(-1)})`, tamanhos: m.area.tamanhos }]
    : [{ nome: '', tamanhos: m.tamanhos }];
  const total = () => totalPecas(it);
  $('#tela').innerHTML = `
    <section class="tamanhos">
      <h2 class="tituloTela">Quantas camisetas de cada tamanho?</h2>
      <p class="textoAjuda">Toque em <b>+</b> para adicionar. ${esc(m.nome)} · ${esc(CORES[it.cor].nome || it.cor)}</p>
      ${grupos.map(g => `
        ${g.nome ? `<h3 class="subtitulo">${g.nome}${g.nota ? ` <small>${g.nota}</small>` : ''}</h3>` : ''}
        <div class="gradeTamanhos">${g.tamanhos.map(t => `
          <div class="cartaoTamanho ${(it.quantidades[t] || 0) > 0 ? 'temQtd' : ''}" data-t="${t}">
            <span class="tamanhoNome">${t}</span>
            <div class="contador">
              <button type="button" class="btnRedondo" data-d="-1" aria-label="Menos ${t}">${icone('menos', 26)}</button>
              <output>${it.quantidades[t] || 0}</output>
              <button type="button" class="btnRedondo btnRedondoEscuro" data-d="1" aria-label="Mais ${t}">${icone('mais', 26)}</button>
            </div>
          </div>`).join('')}</div>`).join('')}
    </section>`;
  const atualizarRodape = () => rodape({
    voltar: { texto: it.artes.length ? 'Ajustar' : 'Artes', acao: () => irPara(it.artes.length ? 'ajustar' : 'artes') },
    meio: `<span class="total">${total()} peça${total() === 1 ? '' : 's'}</span>`,
    avancar: total() ? { texto: 'Revisar', acao: () => irPara('revisar') } : { texto: 'Revisar', desabilitado: true, motivo: 'Escolha pelo menos uma camiseta (toque em +).' }
  });
  $$('.cartaoTamanho').forEach(c => c.addEventListener('click', e => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    const t = c.dataset.t;
    it.quantidades[t] = Math.max(0, Math.min(999, (it.quantidades[t] || 0) + +b.dataset.d));
    c.querySelector('output').textContent = it.quantidades[t];
    c.classList.toggle('temQtd', it.quantidades[t] > 0);
    atualizarRodape();
  }));
  atualizarRodape();
};

// ---------- 5. Revisar ----------

TELAS.revisar = () => {
  const lados = it => ladosDo(it);
  const descr = it => `${modelo(it.modelo).nome} · ${it.malha} · ${CORES[it.cor].nome || it.cor}`;
  const tam = it => Object.entries(it.quantidades).filter(([, n]) => n > 0).map(([t, n]) => `<span class="chip">${t} <b>×${n}</b></span>`).join('') || '<span class="chip vazioChip">Sem tamanhos</span>';
  const totalGeral = S.itens.reduce((s, it) => s + totalPecas(it), 0);
  $('#tela').innerHTML = `
    <section class="revisar">
      <h2 class="tituloTela">Confira o seu pedido</h2>
      <div class="listaItens">${S.itens.map((it, i) => `
        <article class="itemPedido ${i === S.atual ? 'atual' : ''}">
          <div class="itemImagens">${lados(it).map(l => `<figure>${palco(it, l)}<figcaption>${l}</figcaption></figure>`).join('')}</div>
          <div class="itemInfo">
            <h3>Camiseta ${i + 1}</h3>
            <p>${esc(descr(it))}</p>
            <div class="chips">${tam(it)}</div>
            <ul class="itemArtes">${it.artes.length ? it.artes.map(a => `<li>${icone('arte', 16)} <b>${a.lado}:</b> ${esc(a.nome)} <small>${textoMedidas(it.modelo, a, true)}</small></li>`).join('') : `<li>${icone('camisa', 16)} Camiseta lisa (sem arte)</li>`}</ul>
            <div class="linhaBotoes">
              <button type="button" class="btn btnClaro" data-editar="${i}">${icone('editar', 20)} Editar</button>
              ${S.itens.length > 1 ? `<button type="button" class="btn btnClaro btnPerigoTexto" data-remover="${i}">${icone('lixo', 20)} Remover</button>` : ''}
            </div>
          </div>
        </article>`).join('')}
      </div>
      <button type="button" class="btn btnContorno btnLargo btnGrande" id="outra">${icone('mais', 24)} Adicionar outra camiseta (outro modelo, cor ou arte)</button>
    </section>`;
  $$('[data-editar]').forEach(b => (b.onclick = () => { S.atual = +b.dataset.editar; S.lado = 'Frente'; S.sel = null; S.desfazer = []; irPara('camiseta'); }));
  $$('[data-remover]').forEach(b => (b.onclick = async () => {
    if (!(await confirmar(`Remover a camiseta ${+b.dataset.remover + 1} do pedido?`, { sim: 'Remover', perigo: true }))) return;
    S.itens.splice(+b.dataset.remover, 1);
    S.atual = Math.min(S.atual, S.itens.length - 1);
    TELAS.revisar();
  }));
  $('#outra').onclick = () => {
    const base = item();
    S.itens.push(novoItem({ modelo: base.modelo, malha: base.malha, cor: base.cor }));
    S.atual = S.itens.length - 1; S.lado = 'Frente'; S.sel = null; S.desfazer = [];
    aviso('Nova camiseta: escolha modelo, cor e arte.');
    irPara('camiseta');
  };
  const semQtd = S.itens.findIndex(it => !totalPecas(it));
  rodape({
    voltar: { texto: 'Tamanhos', acao: () => irPara('tamanhos') },
    meio: `<span class="total">${totalGeral} peça${totalGeral === 1 ? '' : 's'} no total</span>`,
    avancar: semQtd >= 0
      ? { texto: 'Finalizar', desabilitado: true, motivo: `A camiseta ${semQtd + 1} está sem tamanhos. Toque em "Editar" ou remova.` }
      : { texto: 'Finalizar', acao: () => irPara('dados') }
  });
};

// ---------- Seus dados ----------

TELAS.dados = () => {
  const c = S.cliente || {};
  $('#tela').innerHTML = `
    <section class="dados">
      <h2 class="tituloTela">Quase pronto! Como podemos te chamar?</h2>
      <p class="textoAjuda">Assim o atendente encontra o seu pedido.</p>
      <label class="campo">${icone('pessoa')}<span>Seu nome</span><input id="nome" autocomplete="name" autocapitalize="words" enterkeyhint="next" value="${esc(c.nome)}" placeholder="Ex.: Maria"></label>
      <label class="campo">${icone('whatsapp')}<span>WhatsApp <small>(opcional)</small></span><input id="tel" type="tel" inputmode="tel" autocomplete="tel" enterkeyhint="next" value="${esc(c.telefone)}" placeholder="(00) 00000-0000"></label>
      <label class="campo campoTexto">${icone('editar')}<span>Alguma observação? <small>(opcional)</small></span><textarea id="obs" rows="3" placeholder="Ex.: preciso para sexta-feira">${esc(c.obs)}</textarea></label>
    </section>`;
  const ler = () => (S.cliente = { nome: $('#nome').value.trim(), telefone: $('#tel').value.trim(), obs: $('#obs').value.trim() });
  $('#tel').oninput = e => { // máscara simples (00) 00000-0000
    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
    e.target.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  };
  rodape({
    voltar: { texto: 'Revisar', acao: () => { ler(); irPara('revisar'); } },
    avancar: { texto: 'Enviar pedido', acao: async () => {
      ler();
      if (!S.cliente.nome) { aviso('Digite o seu nome para continuar.', 'erro'); $('#nome').focus(); return; }
      const b = $('#rAvancar'); b.disabled = true; b.innerHTML = 'Salvando…';
      try {
        S.ultimoPedido = await salvarPedido(S.itens, S.cliente);
        irPara('pronto');
      } catch (e) {
        b.disabled = false; b.innerHTML = `Enviar pedido ${icone('avancar')}`;
        aviso('Não foi possível salvar o pedido: ' + e.message, 'erro');
      }
    } }
  });
  setTimeout(() => $('#nome')?.focus(), 250);
};

// ---------- Pronto ----------

let tPronto = null;
TELAS.pronto = () => {
  const p = S.ultimoPedido;
  const total = p.itens.reduce((s, it) => s + totalPecas(it), 0);
  $('#tela').innerHTML = `
    <section class="pronto">
      <div class="prontoCheck">${icone('check', 64)}</div>
      <h2>Pedido enviado!</h2>
      <p class="prontoNumeroRotulo">Número do pedido</p>
      <p class="prontoNumero">${numeroPedido(p.numero)}</p>
      <p class="textoAjuda">Obrigado, <b>${esc(p.cliente.nome)}</b>! Mostre este número ao atendente para concluir.<br>${p.itens.length} camiseta${p.itens.length > 1 ? 's' : ''} diferente${p.itens.length > 1 ? 's' : ''} · ${total} peça${total === 1 ? '' : 's'}</p>
      <div class="linhaBotoes centro">
        ${S.cfg.whatsapp ? `<button type="button" class="btn btnClaro btnGrande" id="zap">${icone('whatsapp')} Enviar resumo pelo WhatsApp</button>` : ''}
        <button type="button" class="btn btnEscuro btnGrande" id="novo">${icone('camisa')} Fazer outro pedido</button>
      </div>
      <p class="dicaPequena" id="contagem"></p>
    </section>`;
  $('#zap') && ($('#zap').onclick = () => window.open(`https://wa.me/${S.cfg.whatsapp}?text=${encodeURIComponent(textoResumo(p, S.cfg.loja))}`, '_blank'));
  $('#novo').onclick = recomecar;
  let s = 90;
  clearInterval(tPronto);
  tPronto = setInterval(() => {
    if (S.tela !== 'pronto') return clearInterval(tPronto);
    $('#contagem').textContent = `Voltando ao início em ${--s} s`;
    if (s <= 0) { clearInterval(tPronto); recomecar(); }
  }, 1000);
  rodape();
};

// ---------- Ajuda de cada tela ----------

const AJUDA = {
  camiseta: () => ajuda('Escolher a camiseta', [
    ['camisa', 'Modelo', 'Masculina (tradicional), Feminina (baby look) ou Infantil/Juvenil.'],
    ['estrela', 'Malha', '<b>100% algodão</b> é a clássica. <b>Premium mesclado</b> tem toque mais macio e visual mesclado.'],
    ['olho', 'Cor', 'Toque numa cor e veja a camiseta mudar na hora. Use <b>Frente / Costas</b> para ver os dois lados.']
  ]),
  artes: () => ajuda('Escolher a arte', [
    ['busca', 'Procure', 'Digite uma palavra ou toque num <b>tema</b> para ver só aquele tipo de arte.'],
    ['olho', 'Veja maior', 'Toque numa arte para ver como fica na camiseta. Passe o dedo para o lado para ver as próximas.'],
    ['check', 'Escolha', 'Gostou? Toque em <b>Usar esta arte</b>. Depois você ajusta o tamanho e o lugar.'],
    ['camisa', 'Fundo das artes', 'As artes aparecem na cor da sua camiseta. Use as bolinhas de cor no alto para testar outra cor.'],
    ['upload', 'Sua própria arte', 'Toque em <b>Enviar minha arte</b>. O melhor é arte em <b>vetor</b> (PDF ou SVG) ou imagem grande (3000 pixels ou mais). Prints e fotos de redes sociais ficam borrados.'],
    ['busca', 'Buscar na internet', 'Mostramos só imagens com licença livre. Cada uma mostra a qualidade: prefira as de <b>vetor</b> ou as maiores.']
  ]),
  ajustar: () => ajuda('Ajustar a arte', [
    ['mao', 'Mover', 'Arraste a arte com um dedo. Ela fica sempre dentro da área tracejada (onde dá para imprimir).'],
    ['ajustar', 'Tamanho', 'Use dois dedos sobre a arte, a barra ou os botões <b>−</b> e <b>+</b>. As medidas aparecem em centímetros.'],
    ['estrela', 'Qualidade', 'Na sua arte ou em imagens da internet aparece a <b>qualidade de impressão</b>. Se ficar "baixa", diminua a arte ou envie um arquivo melhor.'],
    ['virar', 'Costas', 'Toque em <b>Costas</b> no alto para colocar uma arte atrás também.'],
    ['desfazer', 'Errou?', 'O botão <b>Desfazer</b> volta o último ajuste.']
  ]),
  tamanhos: () => ajuda('Tamanhos', [
    ['mais', 'Quantidade', 'Toque em <b>+</b> no tamanho desejado. Pode escolher vários tamanhos.'],
    ['regua', 'Dúvida no tamanho?', 'Peça ao atendente a tabela de medidas ou uma peça para provar.']
  ]),
  revisar: () => ajuda('Revisar o pedido', [
    ['editar', 'Mudar algo', 'Toque em <b>Editar</b> na camiseta para trocar modelo, cor, arte ou tamanhos.'],
    ['mais', 'Mais modelos', '<b>Adicionar outra camiseta</b> cria outro item (ex.: outra cor ou outra arte) no mesmo pedido.'],
    ['check', 'Tudo certo?', 'Toque em <b>Finalizar</b>, diga o seu nome e pronto!']
  ]),
  dados: () => ajuda('Seus dados', [['pessoa', 'Nome', 'Só para o atendente encontrar o seu pedido.'], ['whatsapp', 'WhatsApp', 'Opcional, para avisarmos quando estiver pronto.']]),
  pronto: () => ajuda('Pedido enviado', [['check', 'E agora?', 'Mostre o número do pedido ao atendente para combinar pagamento e entrega.']])
};

// ---------- Inatividade (quiosque) ----------

let tParado = null, avisoParado = null;
function vigiarInatividade() {
  const reiniciar = () => {
    clearTimeout(tParado);
    tParado = setTimeout(perguntar, (S.cfg.inatividadeMin || 3) * 60000);
  };
  const perguntar = () => {
    if (S.tela === 'inicio' || S.tela === 'pronto' || document.querySelector('.janelaAdmin')) return reiniciar();
    let s = 30;
    avisoParado = janela({ titulo: 'Ainda está aí?', classe: 'janelaPequena', fechar: false, html: `
      <p class="textoConfirmar">Por segurança, vamos recomeçar em <b data-s>${s}</b> segundos.</p>
      <button type="button" class="btn btnEscuro btnGrande btnLargo" data-continuar>Estou aqui, continuar</button>` });
    const t = setInterval(() => {
      const el = avisoParado?.el.querySelector('[data-s]');
      if (el) el.textContent = --s;
      if (s <= 0) { clearInterval(t); avisoParado.fechar(); avisoParado = null; $$('dialog[open]').forEach(d => d.remove()); recomecar(); }
    }, 1000);
    avisoParado.el.querySelector('[data-continuar]').onclick = () => { clearInterval(t); avisoParado.fechar(); avisoParado = null; reiniciar(); };
  };
  ['pointerdown', 'keydown', 'input'].forEach(t => document.addEventListener(t, () => { if (!avisoParado) reiniciar(); }, { passive: true, capture: true }));
  reiniciar();
}

// ---------- Catálogo e configuração ----------

async function recarregarCatalogo() {
  const lista = await DB.artesResumo();
  S.catalogo = lista.filter(a => !a.oculto && !a.cliente).sort((a, b) => a.tema.localeCompare(b.tema, 'pt-BR') || (a.ordem ?? 0) - (b.ordem ?? 0));
}

function aplicarConfig(cfg) {
  S.cfg = cfg;
  $('#nomeLoja').textContent = cfg.loja;
  document.title = cfg.loja;
}

// ---------- Inicialização ----------

async function iniciar() {
  montarEsqueleto();
  aplicarConfig(await DB.config(PADRAO));
  await recarregarCatalogo();
  DB.persistir();
  irPara('inicio');
  vigiarInatividade();
  // Sem zoom acidental com dois toques / gestos fora do palco
  document.addEventListener('gesturestart', e => e.preventDefault());
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

iniciar();
