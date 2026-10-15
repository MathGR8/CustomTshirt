/**
 * @module app
 * @description App do tablet (quiosque): o cliente monta a camiseta em passos.
 *
 *   Início → 1 Modelo → 2 Estampa → 3 Personalizar → 4 Tamanhos → 5 Revisar → Seus dados → Pronto
 *
 * Estampa, dois caminhos:
 *  - Camiseta pronta: arte do catálogo da loja com tamanho, posição e cores
 *    definidos no administrador (o cliente só escolhe a cor). Pula "Personalizar".
 *  - Criar a minha: cor, imagem própria ou da internet, textos; ajuste livre.
 *
 * Cada tela tem o botão "Ajuda" com dicas curtas. Na primeira vez em
 * "Personalizar" aparece a dica animada (arrastar / dois dedos). Depois de alguns
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
import { abrirTabela, resumoMedidas } from './medidas.js';
import { desenharTexto, editorTexto } from './texto.js';
import { mostrarPrecos, dinheiro, aPartirDe, precoBase, precoPeca, precoItem, precoTexto, acrescimoTamanho, valorItem, valorTotal } from './precos.js';
import { maxCm, textoMedidas, medidas, totalPecas, salvarPedido, numeroPedido, escalaInfantil, ladosDo } from './order.js';

// ---------- Estado ----------

const novoItem = (base = {}) => ({
  modelo: base.modelo || MODELOS[0].id,
  malha: base.malha || MALHAS[0].id,
  cor: base.cor || MALHAS[0].cores[0],
  modo: null,          // 'pronta' (arte da loja, fixa) | 'criar' (livre) | null (ainda não escolheu)
  pronta: null,        // id da arte da camiseta pronta
  precoPronta: null,   // preço próprio da camiseta pronta (se a loja definiu)
  artes: [], quantidades: {}
});

const S = {
  cfg: { ...PADRAO },
  tela: 'inicio',
  itens: [novoItem()], atual: 0,
  lado: 'Frente', sel: null,
  desfazer: [],
  catalogo: [], todasArtes: [], tema: 'Todas', busca: '',
  fonte: 'enviar',                      // imagem do cliente: enviar | buscar
  janelaImagem: null,
  artesCliente: new Set(),              // artes enviadas/baixadas nesta sessão (apagadas ao recomeçar)
  web: { termo: '', vetor: false, resultados: [], total: 0, pagina: 1, erro: '' },
  coachVisto: false,
  editando: false,                      // veio do "Editar" da revisão: volta para a revisão
  ultimoPedido: null
};
const item = () => S.itens[S.atual];
let uidSeq = 0;

export const App = { S, irPara, recarregarCatalogo, aplicarConfig, recomecar, previaPronta };

/** Prévia (SVG de cada lado) de uma camiseta pronta — usada no administrador. */
async function previaPronta(resumo, modeloId, cor) {
  const artes = await montarPronta(resumo, modeloId);
  const it = { modelo: modeloId, cor, artes };
  return ladosDo(it).map(l => `<figure>${palco(it, l, { mostrarArea: true })}<figcaption>${l}</figcaption></figure>`).join('');
}

/** Preços visíveis para o cliente? */
const comPreco = () => mostrarPrecos(S.cfg);
/** " (+R$ 10,00)" do texto, quando há preço. */
const extraTexto = (antes = ' (+', depois = ')') => (comPreco() && precoTexto(S.cfg) ? `${antes}${dinheiro(precoTexto(S.cfg))}${depois}` : '');
/** Preço de uma camiseta pronta numa cor (preço próprio ou o do modelo/malha). */
const precoDaPronta = (r, modeloId, cor) => +r.fixo?.preco > 0 ? +r.fixo.preco : precoBase(S.cfg, modeloId, malhaDaCor(cor));

// ---------- Estrutura da tela ----------

const PASSOS = [
  { id: 'modelo',       nome: 'Modelo' },
  { id: 'estampa',      nome: 'Estampa' },
  { id: 'personalizar', nome: 'Personalizar' },
  { id: 'tamanhos',     nome: 'Tamanhos' },
  { id: 'revisar',      nome: 'Revisar' }
];
/** Na camiseta pronta o passo "Personalizar" vira "Texto" (opcional: a estampa é fixa). */
const passosAtivos = () => PASSOS.map(p => (p.id === 'personalizar' && item().modo === 'pronta' ? { ...p, nome: 'Texto' } : p));

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
  const passos = passosAtivos();
  const i = passos.findIndex(p => p.id === S.tela);
  $('#passos').innerHTML = passos.map((p, k) => `
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
  S.fonte = 'enviar'; S.janelaImagem = null; S.web = { termo: '', vetor: false, resultados: [], total: 0, pagina: 1, erro: '' };
  S.itens = [novoItem()]; S.atual = 0; S.lado = 'Frente'; S.sel = null; S.desfazer = [];
  S.tema = 'Todas'; S.busca = ''; S.coachVisto = false; S.editando = false; S.ultimoPedido = null; S.cliente = null;
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
    <g class="artes">${artes.map(a => { const r = geom(a, it); return `<image data-uid="${a.uid}" ${a.fixa ? 'class="fixa" ' : ''}href="${a.url}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="none"/>`; }).join('')}</g>
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

/** Põe a arte nova logo abaixo das que já estão no mesmo lado (ou no alto, se for a primeira). */
function abaixoDasOutras(a, it = item()) {
  const area = areaImpressao(it.modelo, a.lado);
  const meia = x => (x.cm * area.upc * x.h / x.w) / 2 / area.h;
  const outros = it.artes.filter(x => x.lado === a.lado && x.uid !== a.uid);
  a.fx = 0.5;
  a.fy = outros.length ? Math.max(...outros.map(x => x.fy + meia(x))) + meia(a) + 0.03 : 0.04 + meia(a);
  if (a.fy + meia(a) > 1) { // não cabe embaixo: diminui até caber (mínimo 5 cm)
    const livre = Math.max(0, 1 - (a.fy - meia(a)));
    const novoCm = Math.max(5, a.cm * livre / (2 * meia(a)));
    a.cm = Math.min(a.cm, novoCm);
    a.fy = 1 - meia(a);
  }
  return encaixar(a, it);
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
          <li>${icone('camisa', 26)}<span><b>Escolha</b> o modelo</span></li>
          <li>${icone('estrela', 26)}<span><b>Camiseta pronta</b> ou <b>crie a sua</b></span></li>
          <li>${icone('editar', 26)}<span><b>Imagens e textos</b> do seu jeito</span></li>
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
  $('#btnComecar').onclick = () => irPara('modelo');
  $('#btnComoFunciona').onclick = tutorial;
  ativarAdminSecreto($('#marcaInicio'));
  rodape();
};

function tutorial() {
  return coach([
    { icone: 'camisa', titulo: '1. Escolha o modelo', texto: 'Masculina, Feminina ou Infantil/Juvenil. A <b>Tabela de medidas</b> ajuda a escolher o tamanho.' },
    { icone: 'estrela', titulo: '2. Pronta ou do seu jeito', texto: '<b>Camiseta pronta</b>: escolha uma das nossas artes e a cor. <b>Criar a minha</b>: envie sua imagem, busque na internet e escreva textos.' },
    { icone: 'mao', titulo: '3. Ajuste com o dedo', texto: 'Arraste a imagem ou o texto para mudar o lugar. Use dois dedos (ou os botões + e −) para mudar o tamanho.', anim: 'arrastar' },
    { icone: 'regua', titulo: '4. Tamanhos e pronto!', texto: 'Diga quantas camisetas de cada tamanho. No final você recebe o número do pedido para mostrar ao atendente.' }
  ]);
}

// ---------- Cores e camisetas prontas ----------

/** Cores disponíveis para o modelo (todas as malhas). */
function coresDoModelo(modeloId) {
  const m = modelo(modeloId);
  return MALHAS.flatMap(x => x.cores).filter(c => !m.cores || m.cores.includes(c));
}
const malhaDaCor = cor => (MALHAS.find(m => m.cores.includes(cor)) || MALHAS[0]).id;

/** Configuração padrão de uma camiseta pronta (a loja ajusta no administrador). */
const FIXO_PADRAO = { lado: 'Frente', cm: 28, pos: 'alto', cores: null, costas: null };

/** Cores permitidas para uma camiseta pronta neste modelo. */
function coresDaPronta(resumo, modeloId) {
  const todas = coresDoModelo(modeloId);
  const lib = resumo.fixo?.cores;
  const ok = lib?.length ? todas.filter(c => lib.includes(c)) : todas;
  return ok.length ? ok : todas;
}

/** Arte da camiseta pronta, com tamanho e posição definidos pela loja. */
async function arteFixa(resumo, modeloId, ladoForcado) {
  const cfg = { ...FIXO_PADRAO, ...(resumo.fixo || {}) };
  const lado = ladoForcado || cfg.lado;
  const url = await urlDa(resumo.id, 'previa');
  const m = modelo(modeloId), area = areaImpressao(modeloId, lado);
  const a = { uid: 'a' + (++uidSeq), artId: resumo.id, nome: resumo.nome, tema: resumo.tema, arquivo: resumo.arquivo,
              pagina: resumo.pagina, w: resumo.w, h: resumo.h, url, lado, origem: 'catalogo', fixa: true, cm: 0, fx: 0.5, fy: 0.5 };
  // Tamanho definido para a masculina (38 cm de largura máxima); nos outros modelos, proporcional
  a.cm = Math.min(maxCm(modeloId, a), cfg.cm * m.area.w / 38);
  const p = POSICOES[cfg.pos] || POSICOES.alto;
  a.fx = p.cx;
  const meiaH = (a.cm * area.upc * a.h / a.w) / 2 / area.h;
  a.fy = p.topo == null ? 0.5 : p.topo + meiaH;
  return encaixar(a, { modelo: modeloId });
}

/** Todas as artes de uma camiseta pronta (frente e, se houver, costas). */
async function montarPronta(resumo, modeloId) {
  const artes = [await arteFixa(resumo, modeloId)];
  const par = resumo.fixo?.costas && S.todasArtes.find(x => x.id === resumo.fixo.costas);
  if (par) artes.push(await arteFixa(par, modeloId, artes[0].lado === 'Costas' ? 'Frente' : 'Costas'));
  return artes;
}

// ---------- 1. Modelo ----------

TELAS.modelo = () => {
  const it = item();
  if (!coresDoModelo(it.modelo).includes(it.cor)) it.cor = coresDoModelo(it.modelo)[0];
  $('#tela').innerHTML = `
    <section class="telaModelo">
      <div class="cabecaTela">
        <h2 class="tituloTela">Qual modelo de camiseta?</h2>
        <button type="button" class="btn btnClaro" id="verMedidas">${icone('regua')} Tabela de medidas</button>
      </div>
      <div class="modelosGrandes">${MODELOS.map(m => `
        <button type="button" class="modeloCard" data-modelo="${esc(m.id)}" aria-pressed="${m.id === it.modelo}">
          <svg viewBox="0 0 ${VB.w} ${VB.h}" aria-hidden="true">${camisetaSVG({ modelo: m.id, lado: 'Frente', cor: coresDoModelo(m.id).includes(it.cor) ? it.cor : coresDoModelo(m.id)[0] })}</svg>
          <strong>${esc(m.nome)}</strong><small>${esc(m.desc)}</small>
          <span class="tamanhosLista">Tamanhos ${m.tamanhos[0]} ao ${m.tamanhos.at(-1)}</span>
          ${comPreco() && aPartirDe(S.cfg, m.id) ? `<span class="preco">a partir de <b>${dinheiro(aPartirDe(S.cfg, m.id))}</b></span>` : ''}
          ${icone('check', 22)}
        </button>`).join('')}
      </div>
    </section>`;
  $('#verMedidas').onclick = () => abrirTabela(it.modelo);
  $$('[data-modelo]').forEach(b => (b.onclick = async () => { await escolherModelo(b.dataset.modelo); irPara('estampa'); }));
  rodape({
    voltar: { texto: 'Início', acao: async () => { if (!temAlgo() || await confirmar('Voltar ao início? O que você montou será apagado.', { sim: 'Voltar ao início', perigo: true })) recomecar(); } },
    meio: `${esc(modelo(it.modelo).nome)}`,
    avancar: { texto: 'Escolher a estampa', acao: () => irPara('estampa') }
  });
};

/** Troca o modelo mantendo o que dá (artes reencaixadas, camiseta pronta recalculada). */
async function escolherModelo(id) {
  const it = item();
  if (id === it.modelo) return;
  it.modelo = id;
  it.quantidades = {};
  if (it.modo === 'pronta' && it.pronta) {
    const r = S.todasArtes.find(x => x.id === it.pronta);
    if (r) {
      const textos = it.artes.filter(a => a.tipo === 'texto');
      it.artes = [...await montarPronta(r, id), ...textos];
      textos.forEach(a => encaixar(a));
      const cores = coresDaPronta(r, id);
      if (!cores.includes(it.cor)) { it.cor = cores[0]; it.malha = malhaDaCor(it.cor); }
    }
  } else {
    it.artes.forEach(a => encaixar(a));
    if (!coresDoModelo(id).includes(it.cor)) { it.cor = coresDoModelo(id)[0]; it.malha = malhaDaCor(it.cor); }
  }
}

const temAlgo = () => S.itens.some(i => i.artes.length || totalPecas(i) > 0);

// ---------- 2. Estampa: pronta ou criar ----------

TELAS.estampa = () => {
  const it = item();
  if (it.modo === 'pronta') return galeriaProntas();
  const amostras = S.catalogo.slice(0, 3);
  $('#tela').innerHTML = `
    <section class="caminhos">
      <h2 class="tituloTela">Como você quer a estampa?</h2>
      <div class="cartoesCaminho">
        <button type="button" class="caminho" id="caminhoPronta" ${S.catalogo.length ? '' : 'disabled'}>
          <span class="caminhoAmostras">${amostras.length ? amostras.map(a => `<span class="amostraPronta" style="--fundo:${CORES[coresDaPronta(a, it.modelo)[0]].hex}"><img data-id="${esc(a.id)}" alt=""></span>`).join('') : icone('estrela', 56)}</span>
          <strong>${icone('estrela', 24)} Camiseta pronta</strong>
          <span>Escolha uma das nossas artes. Tamanho e posição já estão certinhos: é só escolher a cor.</span>
          ${S.catalogo.length ? `<em>${S.catalogo.length} modelo${S.catalogo.length > 1 ? 's' : ''} de arte</em>` : '<em>Nenhuma arte cadastrada ainda</em>'}
        </button>
        <button type="button" class="caminho" id="caminhoCriar" aria-pressed="${it.modo === 'criar'}">
          <span class="caminhoIcones">${icone('upload', 44)}${icone('editar', 44)}${icone('busca', 44)}</span>
          <strong>${icone('editar', 24)} Criar a minha</strong>
          <span>Envie a sua arte ou busque uma imagem na internet, escreva textos com várias fontes e ajuste do seu jeito.</span>
          <em>Você escolhe cor, tamanho e posição</em>
        </button>
      </div>
      <button type="button" class="btnTexto" id="lisa">${icone('camisa', 18)} Quero camiseta lisa (sem estampa)</button>
    </section>`;
  carregarMiniaturas($('#tela'));
  $('#caminhoPronta').onclick = async () => {
    if (it.modo === 'criar' && it.artes.length && !(await confirmar('Escolher uma camiseta pronta apaga o que você criou. Continuar?', { sim: 'Continuar' }))) return;
    it.modo = 'pronta'; it.artes = []; it.pronta = null;
    TELAS.estampa();
  };
  $('#caminhoCriar').onclick = () => { it.modo = 'criar'; irPara('personalizar'); };
  $('#lisa').onclick = () => { it.modo = 'criar'; it.artes = []; it.pronta = null; irPara('tamanhos'); };
  rodape({
    voltar: { texto: 'Modelo', acao: () => irPara('modelo') },
    meio: '',
    avancar: it.modo === 'criar' ? { texto: 'Personalizar', acao: () => irPara('personalizar') } : null
  });
};

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
  }), { rootMargin: '400px' });
  $$('img[data-id]', raiz).forEach(i => observador.observe(i));
}

/** Galeria das camisetas prontas. */
function galeriaProntas() {
  const it = item();
  const temas = [...new Set(S.catalogo.map(a => a.tema))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const cont = t => S.catalogo.filter(a => a.tema === t).length;
  $('#tela').innerHTML = `
    <section class="galeria">
      <div class="galeriaCabeca">
        <h2 class="tituloTela">Camisetas prontas</h2>
        <div class="segmento segmentoFontes" role="tablist">
          <button type="button" aria-pressed="true">${icone('estrela', 20)} Prontas</button>
          <button type="button" id="irCriar" aria-pressed="false">${icone('editar', 20)} Criar a minha</button>
        </div>
      </div>
      <div class="galeriaTopo">
        <label class="busca">${icone('busca')}<input type="search" id="busca" placeholder="Procurar arte…" value="${esc(S.busca)}" autocomplete="off" enterkeyhint="search"></label>
      </div>
      <div class="temas" id="temas" role="tablist">
        <button type="button" class="tema" data-tema="Todas" aria-pressed="${S.tema === 'Todas'}">Todas <small>${S.catalogo.length}</small></button>
        ${temas.map(t => `<button type="button" class="tema" data-tema="${esc(t)}" aria-pressed="${S.tema === t}">${esc(t)} <small>${cont(t)}</small></button>`).join('')}
      </div>
      <div class="grade" id="grade"></div>
    </section>`;
  const pintarGrade = () => {
    const lista = artesFiltradas();
    $('#grade').innerHTML = lista.length ? lista.map((a, i) => {
      const cores = coresDaPronta(a, it.modelo);
      return `<button type="button" class="cartaoArte" data-i="${i}">
        <span class="cartaoImg" style="background-color:${CORES[cores[0]].hex}"><img data-id="${esc(a.id)}" alt=""></span>
        <span class="cartaoNome">${esc(a.nome)}</span>
        ${comPreco() && precoDaPronta(a, it.modelo, cores[0]) ? `<span class="preco precoCartao">${dinheiro(Math.min(...cores.map(c => precoDaPronta(a, it.modelo, c)).filter(Boolean)))}</span>` : ''}
        <span class="bolinhasCor">${cores.slice(0, 7).map(c => `<i style="--c:${CORES[c].hex}" title="${esc(CORES[c].nome || c)}"></i>`).join('')}</span>
        ${it.pronta === a.id ? `<span class="selo">${icone('check', 14)} Escolhida</span>` : ''}
        ${a.fixo?.costas ? `<span class="selo seloCostas">Frente + costas</span>` : ''}
      </button>`;
    }).join('')
      : `<div class="vazio">${icone(S.catalogo.length ? 'busca' : 'arte', 48)}<p>${S.catalogo.length ? 'Nenhuma arte encontrada. Tente outra palavra ou outro tema.' : 'Ainda não há artes cadastradas neste tablet. Chame o atendente.'}</p></div>`;
    carregarMiniaturas($('#grade'));
    $$('#grade [data-i]').forEach(b => (b.onclick = () => verPronta(lista, +b.dataset.i)));
  };
  pintarGrade();
  let tBusca;
  $('#busca').oninput = e => { clearTimeout(tBusca); tBusca = setTimeout(() => { S.busca = e.target.value; pintarGrade(); }, 180); };
  $$('#temas [data-tema]').forEach(b => (b.onclick = () => {
    S.tema = b.dataset.tema;
    $$('#temas [data-tema]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    pintarGrade();
  }));
  $('#irCriar').onclick = async () => {
    if (it.pronta && !(await confirmar('Criar a sua apaga a camiseta pronta escolhida. Continuar?', { sim: 'Continuar' }))) return;
    it.modo = 'criar'; it.artes = []; it.pronta = null;
    irPara('personalizar');
  };
  rodape({
    voltar: { texto: 'Modelo', acao: () => irPara('modelo') },
    meio: it.pronta ? `Escolhida: <b>${esc(S.catalogo.find(a => a.id === it.pronta)?.nome || '')}</b>` : 'Toque numa arte para ver as cores',
    avancar: it.pronta ? (S.editando ? { texto: 'Revisar', acao: () => irPara('revisar') } : { texto: 'Tamanhos', acao: () => irPara('tamanhos') })
      : { texto: 'Tamanhos', desabilitado: true, motivo: 'Toque numa arte para escolher.' }
  });
}

/** Janela da camiseta pronta: ver na camiseta, escolher a cor. */
async function verPronta(lista, i) {
  const it = item();
  let atual = i, cor = it.cor, lado = 'Frente', artes = [], inicioX = null;
  const j = janela({ classe: 'janelaArte', titulo: '', html: `
    <div class="verArte">
      <div class="verPalco" id="verPalco"></div>
      <div class="verInfo">
        <p class="verTema" id="verTema"></p>
        <h2 id="verNome"></h2>
        <div class="segmento" id="verLados" role="group" aria-label="Lado" hidden>
          <button type="button" data-lado="Frente" aria-pressed="true">Frente</button><button type="button" data-lado="Costas" aria-pressed="false">Costas</button>
        </div>
        <div class="rotuloLinha"><b>Escolha a cor</b><span class="medidas" id="verCorNome"></span></div>
        <div class="coresProntas" id="verCores"></div>
        <p class="verMedida" id="verMedida"></p>
        <button type="button" class="btn btnEscuro btnGrande btnLargo" id="usar">${icone('check')} Escolher esta camiseta</button>
        <button type="button" class="btn btnClaro btnLargo" id="usarTexto">${icone('editar', 20)} Escolher e adicionar um texto${extraTexto()}</button>
        <div class="verNav">
          <button type="button" class="btn btnClaro" id="ant" aria-label="Anterior">${icone('voltar')}</button>
          <span id="verPos"></span>
          <button type="button" class="btn btnClaro" id="prox" aria-label="Próxima">${icone('avancar')}</button>
        </div>
      </div>
    </div>` });
  const pintar = () => {
    const r = lista[atual];
    $('#verPalco', j.el).innerHTML = palco({ modelo: it.modelo, cor, artes }, lado);
    const cores = coresDaPronta(r, it.modelo);
    $('#verCores', j.el).innerHTML = cores.map(c => `<button type="button" class="corMini corGrande ${CORES[c].mescla ? 'mescla' : ''}" data-cor="${c}" style="--c:${CORES[c].hex}" aria-pressed="${c === cor}" aria-label="${esc(CORES[c].nome || c)}"></button>`).join('');
    $('#verCorNome', j.el).textContent = `${CORES[cor].nome || cor} · ${malhaDaCor(cor)}`;
    $$('#verCores [data-cor]', j.el).forEach(b => (b.onclick = () => { cor = b.dataset.cor; pintar(); }));
    $$('#verLados [data-lado]', j.el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lado === lado)));
    const a = artes.find(x => x.lado === lado) || artes[0];
    $('#verMedida', j.el).innerHTML = (a ? `${icone('regua', 16)} Estampa de ${textoMedidas(it.modelo, a, true)}` : '')
      + (comPreco() && precoDaPronta(r, it.modelo, cor) ? `<span class="preco precoGrande">${dinheiro(precoPeca(S.cfg, { modelo: it.modelo, malha: malhaDaCor(cor), modo: 'pronta', precoPronta: r.fixo?.preco, artes }, null))}</span>` : '');
  };
  const carregar = async () => {
    const r = lista[atual];
    $('#verNome', j.el).textContent = r.nome;
    $('#verTema', j.el).textContent = r.tema;
    $('#verPos', j.el).textContent = `${atual + 1} de ${lista.length}`;
    artes = await montarPronta(r, it.modelo);
    const cores = coresDaPronta(r, it.modelo);
    if (!cores.includes(cor)) cor = cores[0];
    lado = artes[0].lado;
    $('#verLados', j.el).hidden = artes.length < 2;
    pintar();
  };
  const passar = d => { atual = (atual + d + lista.length) % lista.length; carregar(); };
  $('#ant', j.el).onclick = () => passar(-1);
  $('#prox', j.el).onclick = () => passar(1);
  $$('#verLados [data-lado]', j.el).forEach(b => (b.onclick = () => { lado = b.dataset.lado; pintar(); }));
  const pal = $('#verPalco', j.el);
  pal.addEventListener('pointerdown', e => { inicioX = e.clientX; });
  pal.addEventListener('pointerup', e => {
    if (inicioX == null) return;
    const d = e.clientX - inicioX; inicioX = null;
    if (Math.abs(d) > 50) passar(d < 0 ? 1 : -1);
  });
  const escolher = comTexto => {
    const r = lista[atual];
    const textos = it.artes.filter(a => a.tipo === 'texto'); // textos já colocados continuam
    it.modo = 'pronta'; it.pronta = r.id; it.artes = [...artes, ...textos]; it.cor = cor; it.malha = malhaDaCor(cor);
    it.precoPronta = +r.fixo?.preco > 0 ? +r.fixo.preco : null;
    textos.forEach(a => encaixar(a));
    S.lado = 'Frente'; S.sel = null;
    j.fechar();
    if (comTexto) { irPara('personalizar'); adicionarTexto(); return; }
    aviso(`"${r.nome}" na cor ${CORES[cor].nome || cor}.`, 'ok');
    irPara(S.editando ? 'revisar' : 'tamanhos');
  };
  $('#usar', j.el).onclick = () => escolher(false);
  $('#usarTexto', j.el).onclick = () => escolher(true);
  await carregar();
}

// ---------- Imagem do cliente (enviar ou buscar) ----------

/** Janela para colocar uma imagem: enviar a própria ou buscar na internet. */
function janelaImagem() {
  const fontes = [
    S.cfg.permitirEnvio !== false && { id: 'enviar', nome: 'Enviar minha arte', ic: 'upload' },
    S.cfg.permitirBusca !== false && { id: 'buscar', nome: 'Buscar na internet', ic: 'busca' }
  ].filter(Boolean);
  if (!fontes.length) return aviso('A loja desativou o envio de imagens. Use um texto ou uma camiseta pronta.');
  if (!fontes.some(f => f.id === S.fonte)) S.fonte = fontes[0].id;
  const j = janela({ titulo: `${icone('arte')} Colocar uma imagem`, classe: 'janelaImagem', html: `
    ${fontes.length > 1 ? `<div class="segmento segmentoFontes" role="tablist">${fontes.map(f => `<button type="button" data-fonte="${f.id}" aria-pressed="${S.fonte === f.id}">${icone(f.ic, 20)} ${f.nome}</button>`).join('')}</div>` : ''}
    <div id="contImagem"></div>` });
  S.janelaImagem = j;
  const pintar = () => {
    $$('[data-fonte]', j.el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fonte === S.fonte)));
    (S.fonte === 'buscar' ? telaBuscar : telaEnviar)($('#contImagem', j.el));
  };
  $$('[data-fonte]', j.el).forEach(b => (b.onclick = () => { S.fonte = b.dataset.fonte; pintar(); }));
  pintar();
  j.aoFechar.then(() => { if (S.janelaImagem === j) S.janelaImagem = null; });
}

/** Coloca um texto novo (ou edita um existente). */
async function adicionarTexto(existente = null) {
  const it = item();
  const r = await editorTexto(existente || {}, CORES[it.cor].hex);
  if (!r) return;
  const img = await desenharTexto(r);
  salvarDesfazer();
  const nome = `Texto "${r.texto.replace(/\s+/g, ' ').slice(0, 28)}${r.texto.length > 28 ? '…' : ''}"`;
  const props = { texto: r.texto, fonte: r.fonte, cor: r.cor, contorno: r.contorno, corContorno: r.corContorno, alinhar: r.alinhar, url: img.url, w: img.w, h: img.h, nome };
  if (existente) {
    Object.assign(existente, props);
    encaixar(existente);
  } else {
    const a = { uid: 'a' + (++uidSeq), tipo: 'texto', origem: 'texto', tema: 'Texto', artId: null, ...props, lado: S.lado, cm: 15, fx: 0.5, fy: 0.5 };
    a.cm = Math.min(maxCm(it.modelo, a), r.cmSugerido || 15);
    abaixoDasOutras(a);
    it.artes.push(a);
    S.sel = a.uid;
  }
  if (S.tela === 'personalizar') TELAS.personalizar(); else irPara('personalizar');
}

/** Quadro com o que é uma arte boa para estampar. */
const GUIA_QUALIDADE = `
  <ul class="guiaQualidade">
    <li class="otima">${icone('estrela', 22)}<div><b>Ótimo: arte em vetor</b><span>PDF, SVG ou AI exportado em PDF. Fica nítida em qualquer tamanho.</span></div></li>
    <li class="boa">${icone('check', 22)}<div><b>Bom: imagem grande</b><span>PNG ou JPG com pelo menos <b>3000 pixels</b> de largura (para estampas grandes). PNG com fundo transparente é melhor.</span></div></li>
    <li class="baixa">${icone('fechar', 22)}<div><b>Evite</b><span>Prints de tela, fotos do WhatsApp/Instagram e imagens pequenas da internet: ficam borradas na camiseta.</span></div></li>
  </ul>`;

/** Enviar a própria arte. */
function telaEnviar(cont) {
  cont.innerHTML = `
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
  const posicionar = x => (it.artes.some(o => o.lado === x.lado) ? abaixoDasOutras(x) : x);
  let a = posicionar(await criarArte(resumo, S.lado));
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
    $('#verPalco', j.el).innerHTML = palco(it, S.lado, { artesExtra: [a], sel: a.uid });
    $('#qualidadeBox', j.el).innerHTML = caixaQualidade(a, true);
    const det = a.vetor ? 'Arquivo em vetor' : a.pdfComImagem ? 'PDF com imagem' : `Imagem de ${a.pxW} × ${a.pxH} pixels`;
    $('#detalhes', j.el).innerHTML = `${det}${resumo.paginasNoArquivo > 1 ? ` · usamos a 1ª de ${resumo.paginasNoArquivo} páginas` : ''}${resumo.fonte ? `<br><small>${icone('olho', 14)} ${esc(credito(resumo.fonte))}</small>` : ''}`;
  };
  mostrar();
  $('#tirarFundo', j.el).onclick = async () => {
    const ok = await removerFundoDaArte(resumo.id);
    if (!ok) return aviso('Não encontramos um fundo de cor única para remover.');
    const novo = (await DB.artesResumo()).find(x => x.id === resumo.id) || resumo;
    resumo = novo; a = posicionar(await criarArte(novo, S.lado));
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
    S.janelaImagem?.fechar();
    if (S.tela === 'personalizar') TELAS.personalizar(); else irPara('personalizar');
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
function telaBuscar(cont) {
  const w = S.web;
  cont.innerHTML = `
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

// ---------- 3. Personalizar ----------

function salvarDesfazer() {
  S.desfazer.push(JSON.stringify(item().artes));
  if (S.desfazer.length > 30) S.desfazer.shift();
}

TELAS.personalizar = () => {
  const it = item();
  const pronta = it.modo === 'pronta';
  const doLado = it.artes.filter(a => a.lado === S.lado);
  const editaveis = doLado.filter(a => !a.fixa); // a estampa da camiseta pronta não se mexe
  if (!editaveis.some(a => a.uid === S.sel)) S.sel = editaveis[0]?.uid || null;
  const a = editaveis.find(x => x.uid === S.sel);
  const resumoPronta = pronta ? S.todasArtes.find(x => x.id === it.pronta) || {} : null;
  const cores = pronta ? coresDaPronta(resumoPronta, it.modelo)
    : (MALHAS.find(mm => mm.id === it.malha) || MALHAS[0]).cores.filter(c => coresDoModelo(it.modelo).includes(c));
  const m = modelo(it.modelo);
  const conta = l => it.artes.filter(x => x.lado === l).length;
  $('#tela').innerHTML = `
    <section class="duasColunas ajustar">
      <div class="palco">
        <div class="segmento segmentoTopo" role="group" aria-label="Lado da camiseta">
          ${['Frente', 'Costas'].map(l => `<button type="button" data-lado="${l}" aria-pressed="${S.lado === l}">${icone('virar', 18)} ${l}${conta(l) ? ` <small>${conta(l)}</small>` : ''}</button>`).join('')}
        </div>
        <div class="palcoArea" id="palcoArea">${palco(it, S.lado, { mostrarArea: true, sel: S.sel })}</div>
        ${doLado.length ? (editaveis.length ? `<p class="dicaPalco">${icone('mao', 18)} Arraste · dois dedos mudam o tamanho</p>` : '')
          : `<div class="adicionarNoPalco">
              <p>O que vai ${S.lado === 'Costas' ? 'nas <b>COSTAS</b>' : 'na <b>FRENTE</b>'}?</p>
              <div class="linhaBotoes centro">
                ${pronta ? '' : `<button type="button" class="btn btnEscuro btnGrande" data-add="imagem">${icone('arte', 24)} Imagem</button>`}
                <button type="button" class="btn btnEscuro btnGrande" data-add="texto">${icone('editar', 24)} Texto${extraTexto(' <small>+', '</small>')}</button>
              </div></div>`}
        <button type="button" class="btnFlutuante" id="btnDesfazer" ${S.desfazer.length ? '' : 'disabled'} aria-label="Desfazer">${icone('desfazer')}<span>Desfazer</span></button>
      </div>
      <div class="painel painelCompacto">
        <div class="corCompacta">
          <div class="rotuloLinha">${icone('camisa', 18)} <b>Cor da camiseta</b><span class="medidas">${esc(CORES[it.cor].nome || it.cor)}</span></div>
          ${pronta ? '' : `<div class="segmento segPeq" role="group" aria-label="Malha">${MALHAS.map(mm => `<button type="button" data-malha="${esc(mm.id)}" aria-pressed="${mm.id === it.malha}">${esc(mm.nome)}${comPreco() && precoBase(S.cfg, it.modelo, mm.id) ? ` <small>${dinheiro(precoBase(S.cfg, it.modelo, mm.id))}</small>` : ''}</button>`).join('')}</div>`}
          <div class="coresMini">${cores.map(c => `<button type="button" class="corMini ${CORES[c].mescla ? 'mescla' : ''}" data-cor="${c}" style="--c:${CORES[c].hex}" aria-pressed="${c === it.cor}" title="${esc(CORES[c].nome || c)}" aria-label="${esc(CORES[c].nome || c)}"></button>`).join('')}</div>
        </div>
        ${a ? `
          <div class="arteAtual">
            <span class="arteAtualImg" style="--fundo:${CORES[it.cor].hex}"><img src="${a.url}" alt=""></span>
            <div class="arteAtualNome"><small>${esc(a.tipo === 'texto' ? 'Texto' : a.origem === 'cliente' ? 'Sua arte' : a.origem === 'internet' ? 'Da internet' : a.tema)}</small><strong>${esc(a.tipo === 'texto' ? a.texto.replace(/\s+/g, ' ') : a.nome)}</strong></div>
            ${a.tipo === 'texto'
              ? `<button type="button" class="btnIcone" id="editarTexto" aria-label="Editar texto" title="Editar texto">${icone('editar', 22)}</button>`
              : `<button type="button" class="btnIcone" id="trocar" aria-label="Trocar imagem" title="Trocar imagem">${icone('arte', 22)}</button>`}
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
          ${pronta ? `<div class="avisoPronta">${icone('estrela', 22)}<div><b>Camiseta pronta: ${esc(resumoPronta.nome || '')}</b><span>A estampa fica do jeito que a loja definiu. Você pode adicionar textos (nome, frase, número) e mudar a cor.</span></div></div>`
            : `<div class="vazio vazioPainel">${icone('arte', 40)}<p>Nenhuma arte ${S.lado === 'Costas' ? 'nas costas' : 'na frente'} ainda.</p></div>`}`}
        <div class="botoesAdicionar ${pronta ? 'soTexto' : ''}">
          ${pronta ? '' : `<button type="button" class="btn btnContorno" data-add="imagem">${icone('mais', 20)} Imagem</button>`}
          <button type="button" class="btn btnContorno" data-add="texto">${icone('mais', 20)} ${pronta ? 'Adicionar texto' : 'Texto'}${extraTexto(' <small>+', '</small>')}</button>
        </div>
        ${S.lado === 'Frente' && !conta('Costas') ? `<button type="button" class="btnTexto" id="irCostas">${icone('virar', 18)} ${pronta ? 'Texto nas costas?' : 'Arte nas costas também?'}</button>` : ''}
        ${m.infantil ? `<p class="notaInfantil">${icone('ajuda', 16)} Montada no tamanho <b>juvenil</b>; nas peças infantis (01 a 06) é reduzida automaticamente.</p>` : ''}
      </div>
    </section>`;

  const svg = $('#palcoArea svg');
  const pintarMedidas = () => {
    if (!a) return;
    const linhas = a.tipo === 'texto' ? a.texto.split('\n').length : 0;
    $('#medidas').innerHTML = `${textoMedidas(it.modelo, a)}${linhas ? `<small>letras com ~${num(a.cm * a.h / a.w / linhas * 0.72)} cm de altura</small>` : ''}`;
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
    if (dedos.size === 1 && alvo && alvo.dataset.uid !== S.sel) { S.sel = alvo.dataset.uid; return TELAS.personalizar(); }
    if (!a) return;
    if (pronta && dedos.size === 1 && !alvo) return; // na pronta, só arrasta tocando no texto (a estampa é fixa)
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

  $$('[data-lado]').forEach(b => (b.onclick = () => { S.lado = b.dataset.lado; S.sel = null; TELAS.personalizar(); }));
  $('#btnDesfazer').onclick = () => {
    if (!S.desfazer.length) return;
    const antes = JSON.parse(S.desfazer.pop());
    it.artes = antes;
    if (!it.artes.some(x => x.uid === S.sel)) S.sel = null;
    TELAS.personalizar();
  };
  $$('[data-add]').forEach(b => (b.onclick = () => (b.dataset.add === 'texto' ? adicionarTexto() : janelaImagem())));
  $$('.corCompacta [data-malha]').forEach(b => (b.onclick = () => {
    it.malha = b.dataset.malha;
    const cores = (MALHAS.find(mm => mm.id === it.malha) || MALHAS[0]).cores.filter(c => coresDoModelo(it.modelo).includes(c));
    if (!cores.includes(it.cor)) it.cor = cores[0] || it.cor;
    TELAS.personalizar();
  }));
  $$('.corCompacta [data-cor]').forEach(b => (b.onclick = () => { it.cor = b.dataset.cor; it.malha = malhaDaCor(it.cor); TELAS.personalizar(); }));
  $('#irCostas') && ($('#irCostas').onclick = () => { S.lado = 'Costas'; S.sel = null; TELAS.personalizar(); });
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
    $('#trocar') && ($('#trocar').onclick = () => {
      salvarDesfazer();
      it.artes = it.artes.filter(x => x.uid !== a.uid);
      S.sel = null;
      TELAS.personalizar();
      janelaImagem();
    });
    $('#editarTexto') && ($('#editarTexto').onclick = () => adicionarTexto(a));
    $('#remover').onclick = () => {
      salvarDesfazer();
      it.artes = it.artes.filter(x => x.uid !== a.uid);
      S.sel = null;
      aviso('Arte retirada. Toque em "Desfazer" se quiser de volta.');
      TELAS.personalizar();
    };
  }
  rodape({
    voltar: { texto: 'Estampa', acao: () => irPara('estampa') },
    meio: (it.artes.length ? `${it.artes.length} arte${it.artes.length > 1 ? 's' : ''} · ${['Frente', 'Costas'].filter(l => conta(l)).join(' e ')}` : '')
      + (comPreco() && precoItem(S.cfg, it) ? `${it.artes.length ? ' · ' : ''}<b>${dinheiro(precoItem(S.cfg, it))}</b> a peça` : ''),
    avancar: S.editando ? { texto: 'Revisar', acao: () => irPara('revisar') } : { texto: 'Tamanhos', acao: () => irPara('tamanhos') }
  });
  if (!S.coachVisto && a) {
    S.coachVisto = true;
    coach([
      { icone: 'mao', anim: 'arrastar', titulo: 'Arraste para mudar o lugar', texto: 'Encoste o dedo na imagem ou no texto e arraste. Eles não saem da área tracejada (a área de impressão).' },
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
      <div class="cabecaTela">
        <h2 class="tituloTela">Quantas camisetas de cada tamanho?</h2>
        <button type="button" class="btn btnClaro" id="verMedidas">${icone('regua')} Tabela de medidas</button>
      </div>
      <p class="textoAjuda">Toque em <b>+</b> para adicionar. ${esc(m.nome)} · ${esc(CORES[it.cor].nome || it.cor)}</p>
      ${it.modo === 'pronta' ? `<div class="ofertaTexto">
        <span>${icone('editar', 26)}<span><b>${it.artes.some(a => a.tipo === 'texto') ? 'Texto na camiseta' : 'Quer um nome ou uma frase na camiseta?'}</b>
          <small>${it.artes.some(a => a.tipo === 'texto') ? it.artes.filter(a => a.tipo === 'texto').map(a => `“${esc(a.texto.replace(/\s+/g, ' '))}”`).join(', ') : `Escolha a fonte, a cor e o tamanho${extraTexto(' · +', ' por peça')}`}</small></span></span>
        <button type="button" class="btn btnEscuro" id="ofertaTexto">${it.artes.some(a => a.tipo === 'texto') ? `${icone('editar', 20)} Mudar texto` : `${icone('mais', 20)} Adicionar texto`}</button>
      </div>` : ''}
      ${grupos.map(g => `
        ${g.nome ? `<h3 class="subtitulo">${g.nome}${g.nota ? ` <small>${g.nota}</small>` : ''}</h3>` : ''}
        <div class="gradeTamanhos">${g.tamanhos.map(t => `
          <div class="cartaoTamanho ${(it.quantidades[t] || 0) > 0 ? 'temQtd' : ''}" data-t="${t}">
            <span class="tamanhoNome">${t}</span>
            ${comPreco() && precoPeca(S.cfg, it, t) ? `<span class="preco">${dinheiro(precoPeca(S.cfg, it, t))}${acrescimoTamanho(S.cfg, it.modelo, t) > 0 ? ' <small>(+' + dinheiro(acrescimoTamanho(S.cfg, it.modelo, t)) + ')</small>' : ''}</span>` : ''}
            <button type="button" class="medidaTamanho" data-medida="${t}">${resumoMedidas(it.modelo, t)}</button>
            <div class="contador">
              <button type="button" class="btnRedondo" data-d="-1" aria-label="Menos ${t}">${icone('menos', 26)}</button>
              <output>${it.quantidades[t] || 0}</output>
              <button type="button" class="btnRedondo btnRedondoEscuro" data-d="1" aria-label="Mais ${t}">${icone('mais', 26)}</button>
            </div>
          </div>`).join('')}</div>`).join('')}
    </section>`;
  $('#verMedidas').onclick = () => abrirTabela(it.modelo);
  $('#ofertaTexto') && ($('#ofertaTexto').onclick = () => (it.artes.some(a => a.tipo === 'texto') ? irPara('personalizar') : adicionarTexto()));
  $$('[data-medida]').forEach(b => (b.onclick = e => { e.stopPropagation(); abrirTabela(it.modelo, b.dataset.medida); }));
  const atualizarRodape = () => rodape({
    voltar: it.modo === 'pronta' && !it.artes.some(a => a.tipo === 'texto') ? { texto: 'Estampa', acao: () => irPara('estampa') } : { texto: it.modo === 'pronta' ? 'Texto' : 'Personalizar', acao: () => irPara('personalizar') },
    meio: `<span class="total">${total()} peça${total() === 1 ? '' : 's'}${comPreco() && valorItem(S.cfg, it).total ? ` · ${dinheiro(valorItem(S.cfg, it).total)}` : ''}</span>`,
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
  S.editando = false;
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
            ${comPreco() && valorItem(S.cfg, it).total ? `<p class="precoItem">${valorItem(S.cfg, it).linhas.map(l => `${l.qtd}× ${l.t} ${dinheiro(l.unit)}`).join(' · ')} = <b>${dinheiro(valorItem(S.cfg, it).total)}</b></p>` : ''}
            <ul class="itemArtes">
              ${it.modo === 'pronta' ? `<li>${icone('estrela', 16)} <b>Camiseta pronta</b></li>` : ''}
              ${it.artes.length ? it.artes.map(a => `<li>${icone(a.tipo === 'texto' ? 'editar' : 'arte', 16)} <b>${a.lado}:</b> ${esc(a.nome)} <small>${textoMedidas(it.modelo, a, true)}</small></li>`).join('') : `<li>${icone('camisa', 16)} Camiseta lisa (sem estampa)</li>`}</ul>
            <div class="linhaBotoes">
              <button type="button" class="btn btnClaro" data-editar="${i}">${icone('editar', 20)} Editar</button>
              ${S.itens.length > 1 ? `<button type="button" class="btn btnClaro btnPerigoTexto" data-remover="${i}">${icone('lixo', 20)} Remover</button>` : ''}
            </div>
          </div>
        </article>`).join('')}
      </div>
      <button type="button" class="btn btnContorno btnLargo btnGrande" id="outra">${icone('mais', 24)} Adicionar outra camiseta (outro modelo, cor ou arte)</button>
    </section>`;
  $$('[data-editar]').forEach(b => (b.onclick = () => editarItem(+b.dataset.editar)));
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
    aviso('Nova camiseta: escolha o modelo e a estampa.');
    irPara('modelo');
  };
  const semQtd = S.itens.findIndex(it => !totalPecas(it));
  rodape({
    voltar: { texto: 'Tamanhos', acao: () => irPara('tamanhos') },
    meio: `<span class="total">${totalGeral} peça${totalGeral === 1 ? '' : 's'}${comPreco() && valorTotal(S.cfg, S.itens) ? ` · ${dinheiro(valorTotal(S.cfg, S.itens))}` : ' no total'}</span>`,
    avancar: semQtd >= 0
      ? { texto: 'Finalizar', desabilitado: true, motivo: `A camiseta ${semQtd + 1} está sem tamanhos. Toque em "Editar" ou remova.` }
      : { texto: 'Finalizar', acao: () => irPara('dados') }
  });
};

/** Menu de edição de uma camiseta do pedido (sem recomeçar a montagem). */
function editarItem(i) {
  S.atual = i; S.lado = 'Frente'; S.sel = null; S.desfazer = [];
  const it = item(), pronta = it.modo === 'pronta';
  const r = pronta ? S.todasArtes.find(x => x.id === it.pronta) || {} : null;
  const cores = pronta ? coresDaPronta(r, it.modelo) : coresDoModelo(it.modelo);
  const temTexto = it.artes.some(a => a.tipo === 'texto');
  let lado = ladosDo(it)[0];
  const opcao = (acao, ic, titulo, sub) => `<button type="button" class="opcaoMenu" data-acao="${acao}">${icone(ic, 26)}<span><b>${titulo}</b><small>${sub}</small></span>${icone('avancar', 20)}</button>`;
  const j = janela({ classe: 'janelaArte janelaEditarItem', titulo: '', html: `
    <div class="verArte">
      <div class="verPalco" id="eiPalco"></div>
      <div class="verInfo">
        <p class="verTema">Camiseta ${i + 1} · ${pronta ? `Pronta: ${esc(r.nome || '')}` : 'Criada por você'}</p>
        <h2>${esc(modelo(it.modelo).nome)}</h2>
        <div class="segmento" id="eiLados" role="group" aria-label="Lado">${['Frente', 'Costas'].map(l => `<button type="button" data-lado="${l}">${l}</button>`).join('')}</div>
        <div class="rotuloLinha"><b>Cor</b><span class="medidas" id="eiCorNome"></span></div>
        <div class="coresProntas" id="eiCores"></div>
        <div class="menuEdicao">
          ${opcao('texto', 'editar', 'Adicionar texto', `Nome, frase ou número${extraTexto(' · +', ' por peça')}`)}
          ${temTexto ? opcao('ajustar', 'mao', 'Mudar os textos', 'Editar, mudar tamanho e lugar') : ''}
          ${pronta ? opcao('trocarPronta', 'estrela', 'Trocar a arte', 'Escolher outra camiseta pronta (os textos ficam)')
                   : opcao('ajustar', 'arte', 'Mudar a estampa', 'Imagens, textos, tamanho e posição')}
          ${opcao('tamanhos', 'regua', 'Tamanhos e quantidades', Object.entries(it.quantidades).filter(([, q]) => q > 0).map(([t, q]) => `${t} ×${q}`).join(' · ') || 'Nenhum tamanho escolhido')}
        </div>
        <button type="button" class="btn btnEscuro btnGrande btnLargo" data-fechar>${icone('check')} Pronto</button>
        <button type="button" class="btnTexto" data-acao="modelo">${icone('camisa', 18)} Trocar o modelo da camiseta</button>
      </div>
    </div>` });
  const pintar = () => {
    $('#eiPalco', j.el).innerHTML = palco(it, lado);
    $$('#eiLados [data-lado]', j.el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lado === lado)));
    $('#eiCores', j.el).innerHTML = cores.map(c => `<button type="button" class="corMini corGrande ${CORES[c].mescla ? 'mescla' : ''}" data-cor="${c}" style="--c:${CORES[c].hex}" aria-pressed="${c === it.cor}" aria-label="${esc(CORES[c].nome || c)}"></button>`).join('');
    $('#eiCorNome', j.el).textContent = `${CORES[it.cor].nome || it.cor} · ${it.malha}${comPreco() && precoItem(S.cfg, it) ? ` · ${dinheiro(precoItem(S.cfg, it))} a peça` : ''}`;
    $$('#eiCores [data-cor]', j.el).forEach(b => (b.onclick = () => { it.cor = b.dataset.cor; it.malha = malhaDaCor(it.cor); pintar(); }));
  };
  $$('#eiLados [data-lado]', j.el).forEach(b => (b.onclick = () => { lado = b.dataset.lado; pintar(); }));
  let indo = false;
  $$('[data-acao]', j.el).forEach(b => (b.onclick = () => {
    indo = true; S.editando = true;
    j.fechar();
    const acao = b.dataset.acao;
    if (acao === 'texto') return adicionarTexto().then(() => { if (S.tela === 'revisar') TELAS.revisar(); });
    irPara({ ajustar: 'personalizar', trocarPronta: 'estampa', tamanhos: 'tamanhos', modelo: 'modelo' }[acao]);
  }));
  j.aoFechar.then(() => { if (!indo && S.tela === 'revisar') TELAS.revisar(); });
  pintar();
}

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
        S.ultimoPedido = await salvarPedido(S.itens, S.cliente, S.cfg);
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
      ${p.precos?.mostrar && p.total ? `<p class="prontoValor">Total: <b>${dinheiro(p.total)}</b><small>Valor estimado. O atendente confirma na hora.</small></p>` : ''}
      <div class="linhaBotoes centro">
        <button type="button" class="btn btnEscuro btnGrande" id="novo">${icone('camisa')} Fazer outro pedido</button>
      </div>
      <p class="dicaPequena" id="contagem"></p>
    </section>`;
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
  modelo: () => ajuda('Escolher o modelo', [
    ['camisa', 'Modelos', '<b>Masculina</b> (tradicional), <b>Feminina</b> (baby look, mais ajustada) ou <b>Infantil/Juvenil</b> (do 01 ao 14).'],
    ['regua', 'Tabela de medidas', 'Toque em <b>Tabela de medidas</b> para ver largura, altura e manga de cada tamanho.']
  ]),
  estampa: () => ajuda('Escolher a estampa', [
    ['estrela', 'Camiseta pronta', 'Artes da loja com tamanho e posição já definidos. Toque numa arte, escolha a cor e pronto.'],
    ['editar', 'Criar a minha', 'Envie a sua imagem (PDF, SVG, PNG, JPG), busque na internet ou escreva textos com várias fontes. Você ajusta tudo com o dedo.'],
    ['busca', 'Procure', 'Nas prontas, digite uma palavra ou toque num <b>tema</b>. Passe o dedo na janela da arte para ver as próximas.']
  ]),
  personalizar: () => ajuda('Personalizar', [
    ['camisa', 'Cor', 'Escolha a malha e a cor no alto do painel.'],
    ['arte', 'Imagem', 'Toque em <b>+ Imagem</b>: envie a sua arte ou busque na internet. O melhor é <b>vetor</b> (PDF ou SVG) ou imagem grande. Prints e fotos de redes sociais ficam borrados.'],
    ['editar', 'Texto', 'Toque em <b>+ Texto</b>, escreva, escolha a fonte, a cor e se quer contorno. Para mudar depois, toque no lápis.'],
    ['mao', 'Mover e tamanho', 'Arraste com um dedo. Dois dedos, a barra ou os botões <b>−</b> e <b>+</b> mudam o tamanho.'],
    ['estrela', 'Qualidade', 'Nas imagens aparece a <b>qualidade de impressão</b>. Se ficar "baixa", diminua ou envie um arquivo melhor.'],
    ['desfazer', 'Errou?', 'O botão <b>Desfazer</b> volta o último ajuste.']
  ]),
  tamanhos: () => ajuda('Tamanhos', [
    ['mais', 'Quantidade', 'Toque em <b>+</b> no tamanho desejado. Pode escolher vários tamanhos.'],
    ['regua', 'Medidas', 'Cada tamanho mostra a largura (L) e a altura (A) da peça. Toque nelas ou em <b>Tabela de medidas</b> para ver a tabela completa.']
  ]),
  revisar: () => ajuda('Revisar o pedido', [
    ['editar', 'Mudar algo', 'Toque em <b>Editar</b> na camiseta para trocar modelo, estampa ou tamanhos.'],
    ['mais', 'Mais camisetas', '<b>Adicionar outra camiseta</b> cria outro item (outro modelo, cor ou estampa) no mesmo pedido.'],
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
  S.todasArtes = lista.filter(a => !a.cliente);
  const costas = new Set(S.todasArtes.map(a => a.fixo?.costas).filter(Boolean));
  S.catalogo = lista.filter(a => !a.oculto && !a.cliente && !costas.has(a.id)).sort((a, b) => a.tema.localeCompare(b.tema, 'pt-BR') || (a.ordem ?? 0) - (b.ordem ?? 0));
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
