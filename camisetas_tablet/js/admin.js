/**
 * @module admin
 * @description Área do administrador (protegida por senha):
 *  - Artes: importar arquivos/pasta/.zip, organizar temas, renomear, ocultar, apagar,
 *           configurar a "camiseta pronta" (lado, tamanho, posição, cores, arte das costas),
 *           selecionar várias artes de uma vez (apagar, ocultar, mover de tema, camiseta pronta),
 *           exportar e importar uma cópia do catálogo (para outro tablet)
 *  - Pedidos: ver em tela cheia (camiseta e cada arte/texto), baixar o PDF, apagar
 *  - Preços: preço de cada modelo/malha, acréscimos, mostrar ou esconder do cliente
 *  - Configurações: nome da loja, frase, senha, tempo de inatividade
 *  - Ajuda: como preparar as artes do Corel, instalar o app e travar o tablet
 */

import { PADRAO, CORES, POSICOES, MODELOS, MALHAS, ordenarTemas, ordenarGrupos, compararArtes } from './config.js';
import { DB } from './db.js';
import { icone } from './icons.js';
import { $, $$, esc, num, aviso, janela, confirmar, pedirSenha, progressoJanela, aoDeslizar, setasDoTeclado } from './ui.js';
import { importar, urlDa, urlMiniatura, limparUrls, exportarCatalogo, importarCatalogo, lib } from './catalog.js';
import { credito } from './fontes.js';
import { pdfPedido, baixar, numeroPedido, totalPecas, textoResumo, imagemLado } from './order.js';
import { precosDe, dinheiro, dtfDe, custoEstampa } from './precos.js';
import { configEnvio, testarChave, enviarPendentes, SENHA_INICIAL, VERSAO_ENVIO } from './sync.js';
import { listarAparelhos, testarAparelhos } from './avisos.js';
import { arquivosTexto } from './textoVetor.js';
import { modelo } from './shirt.js';

let App = null;

export async function abrirAdmin(app) {
  App = app;
  if (document.querySelector('.janelaAdmin')) return;
  const senha = await pedirSenha('Acesso da equipe', 'Digite a senha do <b>administrador</b> ou a senha da <b>confecção</b>.');
  if (!senha) return;
  if (senha !== String(App.S.cfg.senha)) {
    // Não é a do administrador: tenta como senha da confecção (abre os pedidos da confecção)
    if (senha.length >= 6 && await entrarConfeccao(senha)) return;
    aviso('Senha incorreta.', 'erro'); return;
  }
  const j = janela({ titulo: `${icone('engrenagem')} Administrador`, classe: 'janelaAdmin', html: `
    <nav class="abas" role="tablist">
      <button type="button" data-aba="artes" aria-selected="true">${icone('arte', 20)} Artes</button>
      <button type="button" data-aba="pedidos" aria-selected="false">${icone('lista', 20)} Pedidos</button>
      <button type="button" data-aba="precos" aria-selected="false">${icone('dinheiro', 20)} Preços</button>
      <button type="button" data-aba="config" aria-selected="false">${icone('engrenagem', 20)} Configurações</button>
      <button type="button" data-aba="ajuda" aria-selected="false">${icone('ajuda', 20)} Ajuda</button>
    </nav>
    <div class="abaConteudo" id="abaConteudo"></div>` });
  const ir = aba => {
    selecao = null;
    $$('[data-aba]', j.el).forEach(b => b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
    ABAS[aba]($('#abaConteudo', j.el));
  };
  $$('[data-aba]', j.el).forEach(b => (b.onclick = () => ir(b.dataset.aba)));
  selecao = null;
  ir('artes');
  if (String(App.S.cfg.senha) === PADRAO.senha) aviso('Dica: troque a senha padrão (1234) em Configurações.');
  await j.aoFechar;
  await App.recarregarCatalogo();
  if (App.S.tela === 'artes' || App.S.tela === 'inicio') App.irPara(App.S.tela);
}

const ABAS = {};
/** Artes marcadas no modo "Selecionar várias" (null = modo desligado). */
let selecao = null;
let obsAdmin = null;

// ---------- Artes ----------

ABAS.artes = async el => {
  const lista = (await DB.artesResumo()).filter(a => !a.cliente);
  const temas = ordenarTemas([...new Set(lista.map(a => a.tema))], App.S.cfg);
  const ordemArtes = compararArtes(App.S.cfg, lista);
  const espaco = DB.espaco(); // preenchido depois (não segura a tela)
  const mb = b => (b / 1048576).toFixed(0) + ' MB';
  const pasta = 'webkitdirectory' in document.createElement('input');
  el.innerHTML = `
    <div class="adminCaixa">
      <h3>${icone('upload', 22)} Importar artes</h3>
      <p class="textoAjuda">Aceita <b>PDF</b>, <b>PNG</b>, JPG, SVG, <b>CorelDRAW (.cdr)</b> e <b>.ZIP</b> com pastas (pode misturar PDF e PNG).
        A <b>categoria</b> e a <b>subcategoria</b> vêm das pastas: <i>Rock/Metallica/arte.png</i> → categoria <b>Rock</b>, subcategoria <b>Metallica</b>.
        Nome do arquivo com código, como <i>ROCK-151 - Metallica – Logo.png</i>, vira o código <b>ROCK-151</b> e o nome <b>Metallica – Logo</b>.
        Arquivos soltos usam a categoria abaixo.</p>
      <div class="formLinha">
        <label class="campoPeq"><span>Categoria dos arquivos soltos</span>
          <input id="temaPadrao" list="listaTemas" placeholder="Ex.: Rock, Futebol, Religioso…" value="${esc(temas[0] || '')}"></label>
        <datalist id="listaTemas">${temas.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      </div>
      <label class="checkLinha"><input type="checkbox" id="optFundo" checked> Remover fundo branco/de cor única (JPG e prévias do Corel)</label>
      <label class="checkLinha"><input type="checkbox" id="optSeparar"> Separar artes que estão lado a lado na mesma página</label>
      <label class="checkLinha"><input type="checkbox" id="optCodigos" checked> <span><b>PDF de catálogo</b>: separa cada arte pelo selo com o código em cima (ex.: <i>COD: ROCK-1</i>), dá o código como nome e usa a cor do fundo como cor da camiseta</span></label>
      <div class="linhaBotoes">
        <label class="btn btnEscuro btnGrande">${icone('upload')} Escolher arquivos<input type="file" id="inArquivos" multiple hidden></label>
        ${pasta ? `<label class="btn btnClaro btnGrande">${icone('pasta')} Escolher uma pasta<input type="file" id="inPasta" webkitdirectory multiple hidden></label>` : ''}
      </div>
    </div>
    <div class="adminCaixa">
      <div class="caixaTopo">
        <h3>${icone('arte', 22)} Catálogo <small>${lista.length} arte${lista.length === 1 ? '' : 's'} em ${temas.length} tema${temas.length === 1 ? '' : 's'}<span id="espacoUsado"></span></small></h3>
        <div class="linhaBotoes">
          ${lista.length ? `<button type="button" class="btn ${selecao ? 'btnEscuro' : 'btnClaro'}" id="modoSelecao">${icone('check', 20)} ${selecao ? 'Concluir seleção' : 'Selecionar várias'}</button>` : ''}
          ${lista.length ? `<button type="button" class="btn btnClaro" id="verTodas">${icone('expandir', 20)} Ver em tela cheia</button>` : ''}
          ${temas.length > 1 || lista.some(a => a.grupo) ? `<button type="button" class="btn btnClaro" id="ordemTemas">${icone('lista', 20)} Ordem das categorias</button>` : ''}
          <button type="button" class="btn btnClaro" id="exportar" ${lista.length ? '' : 'disabled'}>${icone('baixar', 20)} Exportar cópia</button>
          ${lista.length ? `<button type="button" class="btn btnClaro btnPerigoTexto" id="apagarTodasArtes">${icone('lixo', 20)} Apagar todas</button>` : ''}
          <label class="btn btnClaro">${icone('upload', 20)} Importar cópia<input type="file" id="inCopia" accept=".zip,application/zip" hidden></label>
        </div>
      </div>
      ${selecao ? `<div class="dicaSelecao">${icone('mao', 18)} Toque nas artes para marcar. <button type="button" class="btnTexto" id="selTodas">Marcar todas</button> <button type="button" class="btnTexto" id="selNenhuma">Desmarcar</button></div>` : `<p class="dicaPequena dicaSegurar">Dica: segure o dedo numa arte para selecionar várias.</p>`}
      ${temas.length ? temas.map(t => {
        const doTema = lista.filter(a => a.tema === t).sort(ordemArtes);
        return `<details class="temaAdmin" open>
          <summary><strong>${esc(t)}</strong> <small>${doTema.length}</small>
            <span class="summaryAcoes">${selecao ? `<button type="button" class="btn btnClaro btnPeq" data-sel-tema="${esc(t)}">${icone('check', 18)} Marcar tema</button>` : ''}<button type="button" class="btnIcone" data-ver-tema="${esc(t)}" aria-label="Ver ${esc(t)} em tela cheia" title="Ver em tela cheia">${icone('expandir', 20)}</button><button type="button" class="btnIcone" data-renomear-tema="${esc(t)}" aria-label="Renomear tema">${icone('editar', 20)}</button>
            <button type="button" class="btnIcone" data-apagar-tema="${esc(t)}" aria-label="Apagar tema">${icone('lixo', 20)}</button></span></summary>
          <div class="gradeAdmin">${doTema.map(a => `
            <button type="button" class="miniAdmin ${a.oculto ? 'oculta' : ''} ${selecao?.has(a.id) ? 'marcada' : ''}" data-arte="${esc(a.id)}" ${selecao ? `aria-pressed="${selecao.has(a.id)}"` : ''}>
              ${selecao ? `<span class="marcaSel">${icone('check', 18)}</span>` : ''}
              <span class="miniImg"><img data-id="${esc(a.id)}" alt="" decoding="async"></span>
              <span class="miniNome">${esc(a.nome)}</span>
              ${a.codigo || a.grupo ? `<span class="miniCod">${esc([a.codigo, a.grupo].filter(Boolean).join(' · '))}</span>` : ''}
              ${a.baixaRes ? '<span class="seloAviso">baixa resolução</span>' : ''}
              ${a.oculto ? '<span class="seloAviso">oculta</span>' : ''}
              ${a.fixo ? '<span class="seloPronta" title="Camiseta pronta configurada">' + icone('estrela', 14) + '</span>' : ''}
            </button>`).join('')}</div>
        </details>`;
      }).join('') : `<div class="vazio">${icone('pasta', 48)}<p>Nenhuma arte ainda. Use <b>Escolher arquivos</b> acima.</p></div>`}
    </div>
    ${selecao ? `<div class="barraSelecao" id="barraSelecao"></div>` : ''}`;

  espaco.then(e => { const s = $('#espacoUsado', el); if (s && e) s.textContent = ` · ${mb(e.usage)} usados`; });
  // Miniaturas: todas lidas de uma vez; as que estão longe da tela só aparecem ao chegar perto
  obsAdmin?.disconnect();
  const minis = await DB.miniaturas();
  obsAdmin = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    obsAdmin.unobserve(e.target);
    const b = minis.get(e.target.dataset.id);
    if (b) e.target.src = urlMiniatura(e.target.dataset.id, b);
  }), { root: el.closest('.janelaCorpo'), rootMargin: '600px' });
  $$('img[data-id]', el).forEach(i => obsAdmin.observe(i));

  const rodarImportacao = async (files, comPasta) => {
    if (!files.length) return;
    const itens = [...files].map(f => ({ file: f, caminho: (comPasta && f.webkitRelativePath) || f.name }));
    const p = progressoJanela('Importando artes');
    try {
      const r = await importar(itens, {
        temaPadrao: $('#temaPadrao', el).value.trim() || 'Diversos',
        separar: $('#optSeparar', el).checked,
        codigos: $('#optCodigos', el).checked,
        removerFundo: $('#optFundo', el).checked
      }, ({ feitos, total, arquivo, fracao }) => p.atualizar(fracao ?? (total ? feitos / total : 0), arquivo ? `${feitos + 1} de ${total}: ${arquivo}` : 'Concluído'), p.sinal);
      p.fechar();
      limparUrls();
      await App.recarregarCatalogo();
      const j = janela({ titulo: `${icone('check')} Importação concluída`, classe: 'janelaPequena', html: `
        <p class="textoConfirmar"><b>${r.importadas}</b> arte${r.importadas === 1 ? '' : 's'} pronta${r.importadas === 1 ? '' : 's'} de ${r.total} arquivo${r.total === 1 ? '' : 's'}.</p>
        ${r.avisos.length ? `<details class="avisosImport"><summary>${r.avisos.length} aviso${r.avisos.length > 1 ? 's' : ''}</summary><ul>${r.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></details>` : ''}
        <button type="button" class="btn btnEscuro btnLargo" data-fechar>Ok</button>` });
      await j.aoFechar;
      ABAS.artes(el);
    } catch (e) {
      p.fechar();
      aviso('Erro na importação: ' + e.message, 'erro');
    }
  };
  $('#inArquivos', el).onchange = e => rodarImportacao(e.target.files, false);
  $('#inPasta', el) && ($('#inPasta', el).onchange = e => rodarImportacao(e.target.files, true));

  $('#apagarTodasArtes', el) && ($('#apagarTodasArtes', el).onclick = async () => {
    if (!(await confirmar(`Apagar TODAS as ${lista.length} artes do catálogo deste tablet? Os pedidos já feitos continuam com as artes deles. Os arquivos originais no computador não são apagados.`, { sim: 'Continuar', perigo: true }))) return;
    if (!(await confirmar('Tem certeza? Isso não pode ser desfeito. (Dica: use "Exportar cópia" antes, se quiser guardar.)', { sim: 'Apagar todas', perigo: true }))) return;
    const p = progressoJanela('Apagando as artes');
    for (const [i, a] of lista.entries()) {
      await DB.apagar('artes', a.id);
      if (i % 20 === 0) p.atualizar(i / lista.length, `${i} de ${lista.length}`);
    }
    p.fechar(); selecao = null; limparUrls();
    await App.recarregarCatalogo();
    aviso(`${lista.length} artes apagadas.`, 'ok');
    ABAS.artes(el);
  });
  // Ver as artes em tela cheia, como o cliente vê (setas, deslizar o dedo, editar e ocultar ali mesmo)
  const emOrdem = temas.flatMap(t => lista.filter(a => a.tema === t).sort(ordemArtes));
  $('#verTodas', el) && ($('#verTodas', el).onclick = () => verArtesAdmin(emOrdem, 0, temas, () => ABAS.artes(el)));
  $$('[data-ver-tema]', el).forEach(b => (b.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    verArtesAdmin(emOrdem, Math.max(0, emOrdem.findIndex(a => a.tema === b.dataset.verTema)), temas, () => ABAS.artes(el));
  }));
  $('#ordemTemas', el) && ($('#ordemTemas', el).onclick = () => ordemDasCategorias(lista, () => ABAS.artes(el)));
  $('#exportar', el).onclick = async () => {
    const p = progressoJanela('Gerando a cópia do catálogo');
    try {
      const blob = await exportarCatalogo(pct => p.atualizar(pct / 100, `${Math.round(pct)}%`));
      p.fechar();
      baixar(blob, `catalogo-artes-${new Date().toISOString().slice(0, 10)}.zip`);
      aviso('Cópia salva em Downloads. Use "Importar cópia" no outro tablet.');
    } catch (e) { p.fechar(); aviso('Não foi possível exportar: ' + e.message, 'erro'); }
  };
  $('#inCopia', el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const p = progressoJanela('Importando a cópia do catálogo');
    try {
      const n = await importarCatalogo(f);
      p.fechar(); aviso(`${n} artes importadas.`); ABAS.artes(el);
    } catch (err) { p.fechar(); aviso(err.message, 'erro'); }
  };

  // Seleção de várias artes
  const pintarBarra = () => {
    const n = selecao?.size || 0, barra = $('#barraSelecao', el);
    if (!barra) return;
    barra.innerHTML = `
      <strong>${n} selecionada${n === 1 ? '' : 's'}</strong>
      <div class="linhaBotoes">
        <button type="button" class="btn btnClaro" data-massa="pronta" ${n ? '' : 'disabled'}>${icone('estrela', 20)} Camiseta pronta</button>
        <button type="button" class="btn btnClaro" data-massa="tema" ${n ? '' : 'disabled'}>${icone('pasta', 20)} Mover para tema</button>
        <button type="button" class="btn btnClaro" data-massa="ocultar" ${n ? '' : 'disabled'}>${icone('olho', 20)} Ocultar</button>
        <button type="button" class="btn btnClaro" data-massa="mostrar" ${n ? '' : 'disabled'}>${icone('olho', 20)} Mostrar</button>
        <button type="button" class="btn btnPerigo" data-massa="apagar" ${n ? '' : 'disabled'}>${icone('lixo', 20)} Apagar</button>
      </div>`;
    $$('[data-massa]', barra).forEach(b => (b.onclick = () => acaoEmMassa(b.dataset.massa, lista, temas, () => ABAS.artes(el))));
  };
  const marcar = (id, sim) => {
    if (sim) selecao.add(id); else selecao.delete(id);
    const b = el.querySelector(`[data-arte="${CSS.escape(id)}"]`);
    b?.classList.toggle('marcada', sim); b?.setAttribute('aria-pressed', String(sim));
  };
  $('#modoSelecao', el) && ($('#modoSelecao', el).onclick = () => { selecao = selecao ? null : new Set(); ABAS.artes(el); });
  $('#selTodas', el) && ($('#selTodas', el).onclick = () => { lista.forEach(a => marcar(a.id, true)); pintarBarra(); });
  $('#selNenhuma', el) && ($('#selNenhuma', el).onclick = () => { lista.forEach(a => marcar(a.id, false)); pintarBarra(); });
  $$('[data-sel-tema]', el).forEach(b => (b.onclick = e => {
    e.preventDefault();
    const doTema = lista.filter(a => a.tema === b.dataset.selTema);
    const todas = doTema.every(a => selecao.has(a.id));
    doTema.forEach(a => marcar(a.id, !todas));
    pintarBarra();
  }));
  pintarBarra();
  $$('[data-arte]', el).forEach(b => {
    let tSegurar = null, segurou = false;
    b.addEventListener('pointerdown', () => {
      segurou = false;
      if (selecao) return;
      tSegurar = setTimeout(() => { segurou = true; selecao = new Set([b.dataset.arte]); ABAS.artes(el); }, 650);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => clearTimeout(tSegurar)));
    b.onclick = () => {
      if (segurou) return;
      if (selecao) { marcar(b.dataset.arte, !selecao.has(b.dataset.arte)); pintarBarra(); return; }
      editarArte(b.dataset.arte, temas, () => ABAS.artes(el));
    };
  });
  $$('[data-renomear-tema]', el).forEach(b => (b.onclick = async e => {
    e.preventDefault();
    const velho = b.dataset.renomearTema;
    const novo = await perguntarTexto('Novo nome do tema', velho);
    if (!novo || novo === velho) return;
    const todas = (await DB.todos('artes')).filter(a => a.tema === velho);
    todas.forEach(a => (a.tema = novo));
    await DB.salvarVarios('artes', todas);
    // Mantém a categoria no mesmo lugar da ordem
    const cfg = App.S.cfg;
    if ((cfg.ordemTemas || []).includes(velho) || cfg.ordemGrupos?.[velho]) {
      const nova = { ...cfg, ordemTemas: (cfg.ordemTemas || []).map(t => (t === velho ? novo : t)), ordemGrupos: { ...(cfg.ordemGrupos || {}) } };
      if (nova.ordemGrupos[velho]) { nova.ordemGrupos[novo] = nova.ordemGrupos[velho]; delete nova.ordemGrupos[velho]; }
      await DB.salvarConfig(nova); App.aplicarConfig(nova);
    }
    await App.recarregarCatalogo();
    ABAS.artes(el);
  }));
  $$('[data-apagar-tema]', el).forEach(b => (b.onclick = async e => {
    e.preventDefault();
    const t = b.dataset.apagarTema;
    const ids = lista.filter(a => a.tema === t).map(a => a.id);
    if (!(await confirmar(`Apagar o tema "${t}" e suas ${ids.length} artes do tablet? (os arquivos originais não são apagados)`, { sim: 'Apagar', perigo: true }))) return;
    for (const id of ids) await DB.apagar('artes', id);
    limparUrls(); ABAS.artes(el);
  }));
};

/** Ações com as artes selecionadas. */
async function acaoEmMassa(acao, lista, temas, depois) {
  const ids = [...selecao];
  const n = ids.length;
  const pegar = async () => (await Promise.all(ids.map(id => DB.pegar('artes', id)))).filter(Boolean);
  if (acao === 'apagar') {
    if (!(await confirmar(`Apagar ${n} arte${n > 1 ? 's' : ''} do tablet? Os arquivos originais no computador não são apagados.`, { sim: 'Apagar', perigo: true }))) return;
    const p = progressoJanela('Apagando artes');
    for (const [i, id] of ids.entries()) { await DB.apagar('artes', id); p.atualizar((i + 1) / n, `${i + 1} de ${n}`); }
    // Tira a referência de "arte das costas" que apontava para uma apagada
    const restantes = (await DB.todos('artes')).filter(a => a.fixo?.costas && ids.includes(a.fixo.costas));
    restantes.forEach(a => (a.fixo.costas = null));
    if (restantes.length) await DB.salvarVarios('artes', restantes);
    p.fechar(); limparUrls();
    aviso(`${n} arte${n > 1 ? 's' : ''} apagada${n > 1 ? 's' : ''}.`);
  } else if (acao === 'ocultar' || acao === 'mostrar') {
    const artes = await pegar();
    artes.forEach(a => (a.oculto = acao === 'ocultar'));
    await DB.salvarVarios('artes', artes);
    aviso(acao === 'ocultar' ? `${n} arte${n > 1 ? 's' : ''} escondida${n > 1 ? 's' : ''} dos clientes.` : `${n} arte${n > 1 ? 's' : ''} à mostra para os clientes.`);
  } else if (acao === 'tema') {
    const novo = await perguntarTexto(`Mover ${n} arte${n > 1 ? 's' : ''} para o tema`, '', temas);
    if (!novo) return;
    const todas = await DB.artesResumo();
    const grupos = [...new Set(todas.filter(a => a.tema === novo && a.grupo).map(a => a.grupo))].sort();
    // Subcategoria (ex.: banda): vazio = sem subcategoria; Cancelar = mantém a de cada arte
    const grupo = await perguntarTexto(`Subcategoria dentro de "${novo}" (opcional; ex.: nome da banda)`, '', grupos);
    const artes = await pegar();
    artes.forEach(a => { a.tema = novo; if (grupo === '') delete a.grupo; else if (grupo) a.grupo = grupo; });
    await DB.salvarVarios('artes', artes);
    aviso(`Movida${n > 1 ? 's' : ''} para "${novo}${grupo ? ' › ' + grupo : ''}".`);
  } else if (acao === 'pronta') {
    const f = await prontaEmMassa(n);
    if (!f) return;
    const artes = await pegar();
    artes.forEach(a => {
      const atual = { ...FIXO_PADRAO, ...(a.cmW ? { cm: Math.min(38, a.cmW) } : {}), ...(a.fixo || {}) };
      if (f.lado) atual.lado = f.lado;
      if (f.pos) atual.pos = f.pos;
      if (f.cm === 'arquivo') { if (a.cmW) atual.cm = Math.min(38, a.cmW); } else if (f.cm) atual.cm = f.cm;
      if (f.cores !== undefined) atual.cores = f.cores;
      if (f.preco !== undefined) atual.preco = f.preco;
      a.fixo = atual;
    });
    await DB.salvarVarios('artes', artes);
    aviso(`Camiseta pronta atualizada em ${n} arte${n > 1 ? 's' : ''}.`, 'ok');
  }
  selecao = null;
  await App.recarregarCatalogo();
  depois();
}

/** Janela "camiseta pronta" para várias artes: cada campo pode ficar "não mudar". */
function prontaEmMassa(n) {
  const todasCores = Object.keys(CORES);
  const seg = (id, ops) => `<div class="segmento segPeq" id="${id}">${ops.map(([v, t], i) => `<button type="button" data-v="${v}" aria-pressed="${i === 0}">${t}</button>`).join('')}</div>`;
  const j = janela({ titulo: `${icone('estrela')} Camiseta pronta · ${n} arte${n > 1 ? 's' : ''}`, classe: 'janelaMedia', html: `
    <p class="textoAjuda">Só muda o que você escolher. O que ficar em <b>Não mudar</b> continua como está em cada arte.</p>
    <div class="campoPeq"><span>Lado</span>${seg('mLado', [['', 'Não mudar'], ['Frente', 'Frente'], ['Costas', 'Costas']])}</div>
    <div class="campoPeq"><span>Largura da arte (na masculina)</span>${seg('mCmModo', [['', 'Não mudar'], ['arquivo', 'Tamanho do arquivo (PDF)'], ['valor', 'Definir']])}
      <label class="linhaCm" id="mCmLinha" hidden><input type="range" id="mCm" min="5" max="38" step="0.5" value="28"> <b id="mCmTxt">28 cm</b></label></div>
    <div class="campoPeq"><span>Posição</span>${seg('mPos', [['', 'Não mudar'], ...Object.entries(POSICOES).map(([k, p]) => [k, p.nome])])}</div>
    <div class="campoPeq"><span>Cores liberadas</span>${seg('mCoresModo', [['', 'Não mudar'], ['todas', 'Todas'], ['escolher', 'Escolher']])}
      <div class="coresAdmin" id="mCores" hidden>${todasCores.map(c => `<label class="corAdmin"><input type="checkbox" value="${esc(c)}"><i style="--c:${CORES[c].hex}"></i>${esc(CORES[c].nome || c)}</label>`).join('')}</div></div>
    <div class="campoPeq"><span>Preço próprio</span>${seg('mPrecoModo', [['', 'Não mudar'], ['tirar', 'Usar o preço do modelo'], ['valor', 'Definir']])}
      <span class="campoDinheiro" id="mPrecoLinha" hidden><i>R$</i><input inputmode="decimal" id="mPreco" placeholder="0,00"></span></div>
    <div class="linhaBotoes"><button type="button" class="btn btnClaro" data-fechar>Cancelar</button>
      <button type="button" class="btn btnEscuro" id="mAplicar">${icone('check', 20)} Aplicar</button></div>` });
  const val = id => $(`#${id} [aria-pressed="true"]`, j.el).dataset.v;
  $$('.segmento', j.el).forEach(sg => (sg.onclick = e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    $$('[data-v]', sg).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('#mCmLinha', j.el).hidden = val('mCmModo') !== 'valor';
    $('#mCores', j.el).hidden = val('mCoresModo') !== 'escolher';
    $('#mPrecoLinha', j.el).hidden = val('mPrecoModo') !== 'valor';
  }));
  $('#mCm', j.el).oninput = e => { $('#mCmTxt', j.el).textContent = `${e.target.value} cm`; };
  $('#mAplicar', j.el).onclick = () => {
    const f = { lado: val('mLado') || null, pos: val('mPos') || null };
    const cm = val('mCmModo');
    f.cm = cm === 'arquivo' ? 'arquivo' : cm === 'valor' ? +$('#mCm', j.el).value : null;
    const cores = val('mCoresModo');
    if (cores === 'todas') f.cores = null;
    if (cores === 'escolher') { const lista = $$('#mCores input:checked', j.el).map(i => i.value); f.cores = lista.length ? lista : null; }
    const pr = val('mPrecoModo');
    if (pr === 'tirar') f.preco = null;
    if (pr === 'valor') { const v = lerValor($('#mPreco', j.el).value); if (!v) return aviso('Digite o preço.', 'erro'); f.preco = v; }
    j.fechar(f);
  };
  return j.aoFechar;
}

function perguntarTexto(titulo, valor = '', sugestoes = []) {
  const j = janela({ titulo, classe: 'janelaPequena', html: `
    <input class="inputGrande" id="txt" value="${esc(valor)}" ${sugestoes.length ? 'list="txtSug"' : ''}>
    ${sugestoes.length ? `<datalist id="txtSug">${sugestoes.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <div class="chips">${sugestoes.map(t => `<button type="button" class="chip" data-sug="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
    <div class="linhaBotoes"><button type="button" class="btn btnClaro" data-fechar>Cancelar</button>
      <button type="button" class="btn btnEscuro" id="okTxt">Salvar</button></div>` });
  const inp = $('#txt', j.el); setTimeout(() => inp.select(), 50);
  $('#okTxt', j.el).onclick = () => j.fechar(inp.value.trim());
  inp.onkeydown = e => { if (e.key === 'Enter') j.fechar(inp.value.trim()); };
  $$('[data-sug]', j.el).forEach(b => (b.onclick = () => j.fechar(b.dataset.sug)));
  return j.aoFechar;
}

/**
 * Lista com setas para mudar a ordem (toque). Resolve com a nova ordem ou null (cancelou).
 * extra(item) → HTML de um botão a mais na linha (ex.: "Subcategorias").
 */
function ordenarNaTela({ titulo, ajuda, itens, conta = () => '', extra = () => '', aoExtra = null }) {
  const lista = [...itens];
  const j = janela({ titulo, classe: 'janelaPequena janelaOrdem', html: `
    <p class="textoAjuda">${ajuda}</p>
    <ol class="listaOrdem" id="listaOrdem"></ol>
    <div class="linhaBotoes"><button type="button" class="btnTexto" id="ordemAlfa">Ordem alfabética</button>
      <span class="espacador"></span>
      <button type="button" class="btn btnClaro" data-fechar>Cancelar</button>
      <button type="button" class="btn btnEscuro" id="okOrdem">${icone('check', 20)} Salvar ordem</button></div>` });
  const pintar = foco => {
    $('#listaOrdem', j.el).innerHTML = lista.map((t, i) => `<li data-i="${i}">
      <span class="numOrdem">${i + 1}</span><span class="nomeOrdem"><b>${esc(t)}</b> <small>${conta(t)}</small></span>
      ${extra(t)}
      <button type="button" class="btnIcone" data-subir="${i}" ${i ? '' : 'disabled'} aria-label="Subir ${esc(t)}">▲</button>
      <button type="button" class="btnIcone" data-descer="${i}" ${i < lista.length - 1 ? '' : 'disabled'} aria-label="Descer ${esc(t)}">▼</button>
      <button type="button" class="btnTexto" data-topo="${i}" ${i ? '' : 'disabled'}>Primeira</button></li>`).join('');
    const mover = (i, para) => { const [x] = lista.splice(i, 1); lista.splice(para, 0, x); pintar(para); };
    $$('[data-subir]', j.el).forEach(b => (b.onclick = () => mover(+b.dataset.subir, +b.dataset.subir - 1)));
    $$('[data-descer]', j.el).forEach(b => (b.onclick = () => mover(+b.dataset.descer, +b.dataset.descer + 1)));
    $$('[data-topo]', j.el).forEach(b => (b.onclick = () => mover(+b.dataset.topo, 0)));
    $$('[data-extra]', j.el).forEach(b => (b.onclick = () => aoExtra?.(b.dataset.extra)));
    if (foco != null) $(`#listaOrdem [data-i="${foco}"]`, j.el)?.classList.add('movido');
  };
  pintar();
  $('#ordemAlfa', j.el).onclick = () => { lista.sort((a, b) => (a === 'Diversos') - (b === 'Diversos') || a.localeCompare(b, 'pt-BR')); pintar(); };
  $('#okOrdem', j.el).onclick = () => j.fechar([...lista]);
  return j.aoFechar;
}

/** Ordem das categorias (e das subcategorias de cada uma) na galeria do cliente. */
async function ordemDasCategorias(lista, depois) {
  const cfg = App.S.cfg;
  const temas = ordenarTemas([...new Set(lista.map(a => a.tema))], cfg);
  const gruposDe = t => [...new Set(lista.filter(a => a.tema === t && a.grupo).map(a => a.grupo))];
  const ordemGrupos = { ...(cfg.ordemGrupos || {}) };
  const salvar = async mudanca => {
    const nova = { ...App.S.cfg, ...mudanca };
    await DB.salvarConfig(nova); App.aplicarConfig(nova); await App.recarregarCatalogo();
  };
  const nova = await ordenarNaTela({
    titulo: `${icone('lista')} Ordem das categorias`,
    ajuda: 'A primeira aparece primeiro para o cliente (e no "Todas"). Use as setas ou <b>Primeira</b> para mandar direto para o topo.',
    itens: temas,
    conta: t => { const n = lista.filter(a => a.tema === t).length; return `${n} arte${n === 1 ? '' : 's'}`; },
    extra: t => (gruposDe(t).length > 1 ? `<button type="button" class="btn btnClaro btnPeq" data-extra="${esc(t)}">Subcategorias</button>` : ''),
    aoExtra: async t => {
      const g = await ordenarNaTela({
        titulo: `${icone('lista')} Subcategorias de ${esc(t)}`,
        ajuda: `Ordem dos botões dentro de <b>${esc(t)}</b> (ex.: bandas). As novas entram em ordem alfabética, depois destas.`,
        itens: ordenarGrupos(t, gruposDe(t), { ordemGrupos }),
        conta: g => `${lista.filter(a => a.tema === t && a.grupo === g).length}`
      });
      if (g) { ordemGrupos[t] = g; await salvar({ ordemGrupos }); aviso(`Ordem das subcategorias de ${t} salva.`, 'ok'); }
    }
  });
  if (!nova) return;
  await salvar({ ordemTemas: nova, ordemGrupos });
  aviso('Ordem das categorias salva.', 'ok');
  depois();
}

/**
 * Passar pelas artes do catálogo em tela cheia, na camiseta, como o cliente vê:
 * setas, deslizar o dedo ou ← →. Dá para trocar a cor, editar e ocultar sem sair.
 */
async function verArtesAdmin(lista, i, temas, depois) {
  if (!lista.length) return;
  let atual = i, cor = null, mexeu = false, vez = 0;
  const j = janela({ classe: 'janelaArte telaCheia janelaVerAdmin', titulo: '', html: `
    <div class="verArte">
      <div class="verPalcoBox"><div class="verPalco verPalcoAdmin" id="vaPalco"></div>
        ${lista.length > 1 ? `<button type="button" class="setaCheia esq" data-passo="-1" aria-label="Arte anterior">${icone('voltar', 30)}</button>
          <button type="button" class="setaCheia dir" data-passo="1" aria-label="Próxima arte">${icone('avancar', 30)}</button>
          <p class="dicaSwipe">${icone('mao', 16)} Deslize para o lado para passar</p>` : ''}</div>
      <div class="verInfo">
        <p class="verTema" id="vaTema"></p>
        <h2 id="vaNome"></h2>
        <p class="seloOcultaGrande" id="vaOculta" hidden>${icone('olho', 16)} Oculta para os clientes</p>
        <div class="rotuloLinha"><b>Cor da camiseta</b><span class="medidas" id="vaCorNome"></span></div>
        <div class="coresProntas" id="vaCores"></div>
        <p class="textoAjuda" id="vaArquivo"></p>
        <div class="linhaBotoes">
          <button type="button" class="btn btnEscuro" id="vaEditar">${icone('editar', 20)} Editar</button>
          <button type="button" class="btn btnClaro" id="vaOcultar"></button>
        </div>
        <div class="verNav">
          <button type="button" class="btn btnClaro" data-passo="-1" aria-label="Anterior">${icone('voltar')}</button>
          <span id="vaPos"></span>
          <button type="button" class="btn btnClaro" data-passo="1" aria-label="Próxima">${icone('avancar')}</button>
        </div>
      </div>
    </div>` });
  const mostrar = async (d = 0) => {
    const minha = ++vez, r = lista[atual];
    const cores = App.coresDaPronta(r, 'Masculina');
    if (!cor || !cores.includes(cor)) cor = cores[0];
    $('#vaTema', j.el).textContent = [r.tema, r.grupo, r.codigo && `Cód. ${r.codigo}`].filter(Boolean).join(' · ');
    $('#vaNome', j.el).textContent = r.nome;
    $('#vaOculta', j.el).hidden = !r.oculto;
    $('#vaOcultar', j.el).innerHTML = r.oculto ? `${icone('olho', 20)} Mostrar para os clientes` : `${icone('olho', 20)} Ocultar dos clientes`;
    $('#vaPos', j.el).textContent = `${atual + 1} de ${lista.length}`;
    $('#vaArquivo', j.el).textContent = `Arquivo: ${r.arquivo || '—'}`;
    $('#vaCorNome', j.el).textContent = CORES[cor]?.nome || cor;
    $('#vaCores', j.el).innerHTML = cores.map(c => `<button type="button" class="corMini corGrande ${CORES[c].mescla ? 'mescla' : ''}" data-cor="${esc(c)}" style="--c:${CORES[c].hex}" aria-pressed="${c === cor}" aria-label="${esc(CORES[c].nome || c)}"></button>`).join('');
    $$('#vaCores [data-cor]', j.el).forEach(b => (b.onclick = () => { cor = b.dataset.cor; mostrar(); }));
    const html = await App.previaPronta(r, 'Masculina', cor);
    if (minha !== vez) return; // já passou para outra
    const pal = $('#vaPalco', j.el);
    pal.innerHTML = html;
    if (d) { pal.style.setProperty('--de', d > 0 ? '3rem' : '-3rem'); pal.classList.remove('entra'); void pal.offsetWidth; pal.classList.add('entra'); }
  };
  const passar = d => { atual = (atual + d + lista.length) % lista.length; mostrar(d); };
  $$('[data-passo]', j.el).forEach(b => (b.onclick = () => passar(+b.dataset.passo)));
  if (lista.length > 1) { aoDeslizar($('.verPalcoBox', j.el), passar); setasDoTeclado(j.el, passar); }
  $('#vaOcultar', j.el).onclick = async () => {
    const r = lista[atual], a = await DB.pegar('artes', r.id);
    if (!a) return;
    a.oculto = r.oculto = !r.oculto;
    await DB.salvar('artes', a); mexeu = true;
    aviso(r.oculto ? 'Arte escondida dos clientes.' : 'Arte à mostra para os clientes.');
    mostrar();
  };
  $('#vaEditar', j.el).onclick = () => {
    const id = lista[atual].id;
    editarArte(id, temas, async () => {
      mexeu = true;
      const novo = (await DB.artesResumo()).find(x => x.id === id);
      if (novo) lista[atual] = novo; else { lista.splice(atual, 1); if (!lista.length) return j.fechar(); atual %= lista.length; }
      mostrar();
    });
  };
  j.aoFechar.then(async () => { if (mexeu) { await App.recarregarCatalogo(); depois(); } });
  await mostrar();
}

/** Padrão da camiseta pronta (igual ao do app). */
const FIXO_PADRAO = { lado: 'Frente', cm: 28, pos: 'alto', cores: null, costas: null };

async function editarArte(id, temas, depois) {
  const a = await DB.pegar('artes', id);
  if (!a) return;
  const outras = (await DB.artesResumo()).filter(x => !x.cliente && x.id !== id)
    .sort((x, y) => (x.tema === a.tema ? 0 : 1) - (y.tema === a.tema ? 0 : 1) || x.nome.localeCompare(y.nome, 'pt-BR'));
  const fx = { ...FIXO_PADRAO, ...(a.cmW ? { cm: Math.min(38, a.cmW) } : {}), ...(a.fixo || {}) };
  const todasCores = Object.keys(CORES);
  let corPrevia = (fx.cores?.length ? fx.cores : todasCores)[0];
  const j = janela({ titulo: 'Editar arte', classe: 'janelaMedia janelaEditarArte', html: `
    <div class="editarArte">
      <div class="editarImg editarPrevia" id="ePrevia"></div>
      <div class="editarCampos">
        <label class="campoPeq"><span>Nome que o cliente vê</span><input id="eNome" value="${esc(a.nome)}"></label>
        <label class="campoPeq"><span>Tema</span><input id="eTema" list="eTemas" value="${esc(a.tema)}"></label>
        <datalist id="eTemas">${temas.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
        <div class="formLinha">
          <label class="campoPeq"><span>Subcategoria <small>(ex.: banda, jogo ou filme)</small></span><input id="eGrupo" list="eGrupos" value="${esc(a.grupo || '')}" placeholder="—"></label>
          <label class="campoPeq"><span>Código da estampa</span><input id="eCodigo" value="${esc(a.codigo || '')}" placeholder="Ex.: ROCK-12" autocapitalize="characters"></label>
        </div>
        <datalist id="eGrupos">${[...new Set(outras.filter(o => o.tema === a.tema && o.grupo).map(o => o.grupo))].sort().map(g => `<option value="${esc(g)}">`).join('')}</datalist>
        <label class="checkLinha"><input type="checkbox" id="eOculta" ${a.oculto ? 'checked' : ''}> Ocultar dos clientes</label>
        <p class="textoAjuda">Arquivo: ${esc(a.arquivo)}${a.pagina > 1 ? ` (página ${a.pagina})` : ''} · ${a.w}×${a.h} px${a.baixaRes ? ' · <b>prévia do Corel em baixa resolução</b> — exporte em PDF para melhorar' : ''}</p>

        <h4 class="subtituloAdmin">${icone('estrela', 18)} Camiseta pronta</h4>
        <p class="textoAjuda">O cliente não muda o tamanho nem a posição: só escolhe a cor (entre as liberadas).</p>
        <div class="campoPeq"><span>Lado</span>
          <div class="segmento segPeq" id="eLado">${['Frente', 'Costas'].map(l => `<button type="button" data-lado="${l}" aria-pressed="${fx.lado === l}">${l}</button>`).join('')}</div></div>
        <label class="campoPeq"><span>Largura da arte na <b>masculina</b>: <b id="eCmTxt">${fx.cm} cm</b> <small>(nos outros modelos fica proporcional)</small></span>
          <input type="range" id="eCm" min="5" max="38" step="0.5" value="${fx.cm}"></label>
        ${a.cmW ? `<p class="textoAjuda tamArquivo">${icone('regua', 16)} No arquivo: <b>${num(a.cmW)} × ${num(a.cmH)} cm</b> <button type="button" class="btnTexto" id="eUsarArquivo">usar este tamanho</button></p>` : ''}
        <div class="campoPeq"><span>Posição</span>
          <div class="segmento segPeq" id="ePos">${Object.entries(POSICOES).map(([k, p]) => `<button type="button" data-pos="${k}" aria-pressed="${fx.pos === k}">${p.nome}</button>`).join('')}</div></div>
        <div class="campoPeq"><span>Cores liberadas <small>(nenhuma marcada = todas)</small></span>
          <div class="coresAdmin" id="eCores">${todasCores.map(c => `<label class="corAdmin"><input type="checkbox" value="${esc(c)}" ${fx.cores?.includes(c) ? 'checked' : ''}><i style="--c:${CORES[c].hex}"></i>${esc(CORES[c].nome || c)}</label>`).join('')}</div></div>
        <label class="campoPeq"><span>Preço próprio desta camiseta pronta <small>(opcional; vazio = preço do modelo, na aba Preços)</small></span>
          <span class="campoDinheiro"><i>R$</i><input id="ePreco" inputmode="decimal" value="${fx.preco ? String(fx.preco).replace('.', ',') : ''}" placeholder="—"></span></label>
        <label class="campoPeq"><span>Arte das costas (opcional)</span>
          <select id="eCostas"><option value="">Nenhuma</option>${outras.map(o => `<option value="${esc(o.id)}" ${fx.costas === o.id ? 'selected' : ''}>${esc(o.tema)} · ${esc(o.nome)}</option>`).join('')}</select></label>
        <p class="textoAjuda dicaCostas">A arte escolhida para as costas some da galeria e aparece junto com esta.</p>
        <label class="checkLinha"><input type="checkbox" id="eTodas"> Usar este tamanho, posição, cores e preço em todas as artes do tema "<span id="eTemaNome">${esc(a.tema)}</span>"</label>
        <div class="linhaBotoes">
          <button type="button" class="btn btnClaro btnPerigoTexto" id="eApagar">${icone('lixo', 20)} Apagar</button>
          <button type="button" class="btn btnEscuro" id="eSalvar">${icone('check', 20)} Salvar</button>
        </div>
      </div>
    </div>` });
  const ler = () => ({
    lado: fx.lado, cm: +$('#eCm', j.el).value, pos: fx.pos,
    cores: $$('#eCores input:checked', j.el).map(i => i.value),
    costas: $('#eCostas', j.el).value || null,
    preco: lerValor($('#ePreco', j.el).value) || null
  });
  const pintar = async () => {
    const f = ler();
    if (f.cores.length && !f.cores.includes(corPrevia)) corPrevia = f.cores[0];
    if (!f.cores.length && !todasCores.includes(corPrevia)) corPrevia = todasCores[0];
    $('#eCmTxt', j.el).textContent = `${f.cm} cm`;
    const svgs = await App.previaPronta({ ...a, fixo: f }, 'Masculina', corPrevia);
    $('#ePrevia', j.el).innerHTML = `<div class="previaLados">${svgs}</div>
      <div class="previaCores">${(f.cores.length ? f.cores : todasCores).map(c => `<button type="button" class="corMini ${CORES[c].mescla ? 'mescla' : ''}" data-cor="${esc(c)}" style="--c:${CORES[c].hex}" aria-pressed="${c === corPrevia}" title="${esc(CORES[c].nome || c)}"></button>`).join('')}</div>`;
    $$('#ePrevia [data-cor]', j.el).forEach(b => (b.onclick = () => { corPrevia = b.dataset.cor; pintar(); }));
  };
  $$('#eLado [data-lado]', j.el).forEach(b => (b.onclick = () => { fx.lado = b.dataset.lado; $$('#eLado [data-lado]', j.el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); pintar(); }));
  $$('#ePos [data-pos]', j.el).forEach(b => (b.onclick = () => { fx.pos = b.dataset.pos; $$('#ePos [data-pos]', j.el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); pintar(); }));
  let tCm;
  $('#eUsarArquivo', j.el) && ($('#eUsarArquivo', j.el).onclick = () => { $('#eCm', j.el).value = Math.min(38, a.cmW); pintar(); });
  $('#eCm', j.el).oninput = () => { $('#eCmTxt', j.el).textContent = `${$('#eCm', j.el).value} cm`; clearTimeout(tCm); tCm = setTimeout(pintar, 120); };
  $('#eCores', j.el).onchange = pintar;
  $('#eCostas', j.el).onchange = pintar;
  $('#eTema', j.el).oninput = e => { $('#eTemaNome', j.el).textContent = e.target.value; };
  await App.recarregarCatalogo(); // a prévia usa a lista atual (arte das costas)
  pintar();
  $('#eSalvar', j.el).onclick = async () => {
    const f = ler();
    a.nome = $('#eNome', j.el).value.trim() || a.nome;
    a.tema = $('#eTema', j.el).value.trim() || a.tema;
    const grupo = $('#eGrupo', j.el).value.trim(), codigo = $('#eCodigo', j.el).value.trim().toUpperCase();
    if (grupo) a.grupo = grupo; else delete a.grupo;
    if (codigo) a.codigo = codigo; else delete a.codigo;
    a.oculto = $('#eOculta', j.el).checked;
    a.fixo = { ...f, cores: f.cores.length ? f.cores : null };
    await DB.salvar('artes', a);
    if ($('#eTodas', j.el).checked) {
      const doTema = (await DB.todos('artes')).filter(x => !x.cliente && x.tema === a.tema && x.id !== a.id && x.id !== f.costas);
      doTema.forEach(x => (x.fixo = { ...(x.fixo || FIXO_PADRAO), lado: f.lado, cm: f.cm, pos: f.pos, cores: a.fixo.cores, preco: f.preco }));
      await DB.salvarVarios('artes', doTema);
      aviso(`Aplicado a ${doTema.length + 1} artes do tema.`, 'ok');
    }
    await App.recarregarCatalogo();
    j.fechar(); depois();
  };
  $('#eApagar', j.el).onclick = async () => {
    if (!(await confirmar(`Apagar "${a.nome}" do tablet?`, { sim: 'Apagar', perigo: true }))) return;
    await DB.apagar('artes', id);
    limparUrls(); j.fechar(); depois();
  };
}

// ---------- Pedidos ----------

/** Cliente que quer usar a própria arte e deixou o WhatsApp. */
function artigoContato(p) {
  const d = new Date(p.data);
  return `<article class="pedidoAdmin contatoAdmin">
    <div class="pedidoInfo">
      <strong>${icone('whatsapp', 18)} Contato — ${esc(p.cliente?.nome || 'Sem nome')}</strong>
      <small>${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${esc(p.cliente?.telefone || '')} · quer usar a própria arte</small>
      ${p.cliente?.obs ? `<small>“${esc(p.cliente.obs)}”</small>` : ''}
      ${configEnvio(App.S.cfg).ativo ? (p.enviado ? `<small class="seloEnvio ok">${icone('check', 14)} Enviado para a confecção</small>` : `<small class="seloEnvio">${icone('upload', 14)} Aguardando envio${p.erroEnvio ? ` (${esc(p.erroEnvio)})` : ''}</small>`) : ''}
    </div>
    <div class="linhaBotoes"><button type="button" class="btnIcone" data-apagar="${p.id}" aria-label="Apagar contato">${icone('lixo', 20)}</button></div>
  </article>`;
}

ABAS.pedidos = async el => {
  const lista = (await DB.todos('pedidos')).sort((a, b) => b.id - a.id);
  el.innerHTML = `
    <div class="adminCaixa">
      <div class="caixaTopo"><h3>${icone('lista', 22)} Pedidos feitos neste tablet <small>${lista.length}</small></h3>
        ${configEnvio(App.S.cfg).ativo && lista.some(p => !p.enviado) ? `<button type="button" class="btn btnEscuro" id="enviarAgora">${icone('upload', 20)} Enviar agora</button>` : ''}
        ${lista.length ? `<button type="button" class="btn btnClaro btnPerigoTexto" id="apagarTodos">${icone('lixo', 20)} Apagar todos</button>` : ''}</div>
      ${lista.length ? `<div class="listaPedidos">${lista.map(p => {
        if (p.tipo === 'contato') return artigoContato(p);
        const d = new Date(p.data), total = p.itens.reduce((s, it) => s + totalPecas(it), 0);
        const img = Object.values(p.itens[0]?.imagens || {})[0];
        const doCliente = p.itens.flatMap(it => it.artes).filter(a => a.origem && a.origem !== 'catalogo');
        const prontas = p.itens.filter(it => it.modo === 'pronta').length;
        return `<article class="pedidoAdmin">
          ${img ? `<button type="button" class="pedidoMini" data-ver="${p.id}" aria-label="Ver pedido"><img src="${img}" alt=""></button>` : ''}
          <div class="pedidoInfo">
            <strong>Nº ${numeroPedido(p.numero)} — ${esc(p.cliente?.nome || 'Sem nome')}</strong>
            <small>${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${p.cliente?.telefone ? ' · ' + esc(p.cliente.telefone) : ''}</small>
            <small>${p.itens.map(it => modelo(it.modelo).nome).join(', ')} · ${total} peça${total === 1 ? '' : 's'}${prontas ? ` · ${prontas} pronta${prontas > 1 ? 's' : ''}` : ''}${p.total ? ` · <b>${dinheiro(p.total)}</b>` : ''}</small>
            ${configEnvio(App.S.cfg).ativo ? (p.enviado ? `<small class="seloEnvio ok">${icone('check', 14)} Enviado para a confecção</small>` : `<small class="seloEnvio">${icone('upload', 14)} Aguardando envio${p.erroEnvio ? ` (${esc(p.erroEnvio)})` : ''}</small>`) : ''}
            ${doCliente.some(a => /Baixa/.test(a.qualidade || '')) ? `<small class="alertaPedido">${icone('fechar', 14)} Tem arte com qualidade BAIXA</small>` : ''}
          </div>
          <div class="linhaBotoes">
            <button type="button" class="btn btnEscuro" data-ver="${p.id}">${icone('expandir', 20)} Ver pedido</button>
            <button type="button" class="btn btnClaro" data-pdf="${p.id}">${icone('baixar', 20)} PDF</button>
            ${doCliente.length ? `<button type="button" class="btn btnClaro" data-artes="${p.id}">${icone('baixar', 20)} Artes e textos do cliente (${doCliente.length})</button>` : ''}
            <button type="button" class="btn btnClaro" data-copiar="${p.id}">${icone('lista', 20)} Copiar texto</button>
            <button type="button" class="btnIcone" data-apagar="${p.id}" aria-label="Apagar pedido">${icone('lixo', 20)}</button>
          </div>
        </article>`;
      }).join('')}</div>` : `<div class="vazio">${icone('lista', 48)}<p>Nenhum pedido ainda.</p></div>`}
    </div>`;
  const achar = id => lista.find(p => String(p.id) === String(id));
  $('#enviarAgora', el) && ($('#enviarAgora', el).onclick = async () => {
    const b = $('#enviarAgora', el); b.disabled = true; b.textContent = 'Enviando…';
    const r = await enviarPendentes(App.S.cfg).catch(e => ({ erro: e.message }));
    aviso(r.erro ? `Não foi possível enviar: ${r.erro}` : `${r.enviados} pedido${r.enviados === 1 ? '' : 's'} enviado${r.enviados === 1 ? '' : 's'}.`, r.erro ? 'erro' : 'ok');
    ABAS.pedidos(el);
  });
  $$('[data-ver]', el).forEach(b => (b.onclick = () => verPedido(achar(b.dataset.ver), { pdf: () => el.querySelector(`[data-pdf="${b.dataset.ver}"]`)?.click(), artes: () => el.querySelector(`[data-artes="${b.dataset.ver}"]`)?.click() })));
  $$('[data-pdf]', el).forEach(b => (b.onclick = async () => {
    b.disabled = true;
    try { const p = achar(b.dataset.pdf); baixar(await pdfPedido(p, App.S.cfg.loja), `pedido-${numeroPedido(p.numero)}.pdf`); }
    catch (e) { aviso('Não foi possível gerar o PDF: ' + e.message, 'erro'); }
    b.disabled = false;
  }));
  $$('[data-artes]', el).forEach(b => (b.onclick = async () => {
    b.disabled = true;
    try {
      const p = achar(b.dataset.artes);
      const JSZip = await lib('jszip');
      const zip = new JSZip();
      const vistos = new Set();
      for (const a of p.itens.flatMap(it => it.artes).filter(x => x.origem && x.origem !== 'catalogo')) {
        if (a.tipo === 'texto') { // o texto vai em vetor (SVG) e PNG 300 dpi
          const k = `t${vistos.size + 1}`; vistos.add(k);
          const base = `${String(vistos.size).padStart(2, '0')}-texto`;
          for (const f of await arquivosTexto(a, base)) zip.file(f.nome, f.blob);
          zip.file(`${base}.txt`, `${a.texto}\n${a.descricao || ''}\n${a.lado} · ${a.medidas}\n`);
          continue;
        }
        if (vistos.has(a.artId)) continue;
        vistos.add(a.artId);
        const reg = await DB.pegar('artes', a.artId);
        if (reg?.original) zip.file(`${String(vistos.size).padStart(2, '0')}-${reg.original.name || reg.arquivo}`, reg.original);
        if (reg?.fonte) zip.file(`${String(vistos.size).padStart(2, '0')}-credito.txt`, `${reg.nome}\n${credito(reg.fonte)}\nLicença: ${reg.fonte.licencaUrl || ''}\nPágina: ${reg.fonte.pagina || ''}\nArquivo: ${reg.fonte.url || ''}\n`);
      }
      if (!vistos.size) throw new Error('as artes deste pedido não estão mais no tablet');
      baixar(await zip.generateAsync({ type: 'blob' }), `pedido-${numeroPedido(p.numero)}-artes-do-cliente.zip`);
    } catch (e) { aviso('Não foi possível baixar: ' + e.message, 'erro'); }
    b.disabled = false;
  }));
  $$('[data-copiar]', el).forEach(b => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(textoResumo(achar(b.dataset.copiar), App.S.cfg.loja)); aviso('Texto copiado.'); }
    catch { aviso('Não foi possível copiar neste aparelho.', 'erro'); }
  }));
  $$('[data-apagar]', el).forEach(b => (b.onclick = async () => {
    if (!(await confirmar('Apagar este pedido do tablet?', { sim: 'Apagar', perigo: true }))) return;
    await apagarArtesDoCliente([achar(b.dataset.apagar)], lista);
    await DB.apagar('pedidos', +b.dataset.apagar); ABAS.pedidos(el);
  }));
  $('#apagarTodos', el) && ($('#apagarTodos', el).onclick = async () => {
    if (!(await confirmar('Apagar TODOS os pedidos deste tablet?', { sim: 'Apagar todos', perigo: true }))) return;
    await apagarArtesDoCliente(lista, lista);
    await DB.limpar('pedidos'); ABAS.pedidos(el);
  });
};

/** Apaga as artes de clientes dos pedidos (se nenhum outro pedido usa). */
async function apagarArtesDoCliente(pedidos, todos) {
  const ids = new Set(pedidos.flatMap(p => p.itens.flatMap(it => it.artes)).filter(a => a.origem && a.origem !== 'catalogo' && a.artId).map(a => a.artId));
  const outros = new Set(todos.filter(p => !pedidos.includes(p)).flatMap(p => p.itens.flatMap(it => it.artes.map(a => a.artId))));
  for (const id of ids) if (!outros.has(id)) await DB.apagar('artes', id).catch(() => {});
}

// ---------- Ver pedido (tela cheia) ----------

/** Pedido em tela cheia: camisetas grandes, cada arte/texto, tamanhos e valores. */
/**
 * Senha da confecção digitada na entrada do app: confere no servidor e abre
 * a tela de pedidos da confecção (no computador fica lembrada; no tablet só
 * até fechar o app).
 */
async function entrarConfeccao(chave) {
  try {
    await testarChave(chave);
  } catch (e) {
    if (/muitas tentativas/i.test(e.message)) aviso(e.message, 'erro');
    else if (!/errada/i.test(e.message)) aviso('Não foi possível conferir a senha da confecção: ' + e.message, 'erro');
    return false;
  }
  const lembrar = !matchMedia('(pointer: coarse)').matches;
  try { (lembrar ? localStorage : sessionStorage).setItem('chaveConfeccao', chave); } catch { /* sem armazenamento */ }
  location.hash = 'confeccao';
  location.reload();
  return true;
}

/**
 * Pedido em tela cheia (no tablet e no computador da confecção).
 * @param {Object} acoes - pdf(), artes(), fonteArte(a) → URL da imagem da arte,
 *   topo (HTML extra no cabeçalho), extraArte(a) (HTML extra em cada arte), aoAbrir(janela)
 */
export async function verPedido(p, acoes = {}) {
  if (!p) return;
  const d = new Date(p.data), c = p.cliente || {};
  const totalPc = p.itens.reduce((s, it) => s + totalPecas(it), 0);
  const nomeCor = it => CORES[it.cor]?.nome || it.cor;
  const descArte = a => a.tipo === 'texto'
    ? `<b>Texto:</b> “${esc(a.texto).replace(/\n/g, '<br>')}”<small>${esc(a.descricao || '')}</small>`
    : `<b>${esc(a.nome)}${a.codigo ? ` <span class="codPedido">${esc(a.codigo)}</span>` : ''}</b><small>${a.origem === 'cliente' ? `Arte do cliente · ${esc(a.arquivo || '')}` : a.origem === 'internet' ? `Imagem da internet${a.credito ? ' · ' + esc(a.credito) : ''}` : `${esc(a.tema || '')}${a.grupo ? ' › ' + esc(a.grupo) : ''} · ${esc(a.arquivo || '')}${a.pagina > 1 ? ` (pág. ${a.pagina})` : ''}`}</small>`;
  const j = janela({ titulo: `${icone('lista')} Pedido nº ${numeroPedido(p.numero)}`, classe: 'janelaPedido', html: `
    <div class="pedidoDetalhe">
      <header class="pedidoCab">
        <div class="pedidoCliente">
          <strong>${esc(c.nome || 'Sem nome')}</strong>
          <span>${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${c.telefone ? ` · ${icone('whatsapp', 16)} ${esc(c.telefone)}` : ''}</span>
          ${c.obs ? `<p class="pedidoObs">${icone('editar', 16)} ${esc(c.obs)}</p>` : ''}
        </div>
        <div class="pedidoResumo">
          <span>${p.itens.length} camiseta${p.itens.length > 1 ? 's' : ''} · ${totalPc} peça${totalPc === 1 ? '' : 's'}</span>
          ${p.total ? `<strong>${dinheiro(p.total)}</strong>${p.precos?.mostrar ? '' : '<small>(preços escondidos para o cliente)</small>'}` : ''}
        </div>
        <div class="linhaBotoes">
          <button type="button" class="btn btnEscuro" id="dPdf">${icone('baixar', 20)} PDF</button>
          ${acoes.artes && p.itens.some(it => it.artes.some(a => a.origem && a.origem !== 'catalogo')) ? `<button type="button" class="btn btnClaro" id="dArtes">${icone('baixar', 20)} Artes do cliente</button>` : ''}
        </div>
        ${acoes.topo || ''}
      </header>
      ${p.itens.map((it, i) => `
        <section class="pedidoItem">
          <h3>Camiseta ${i + 1}${p.itens.length > 1 ? ` de ${p.itens.length}` : ''} <span>${esc(modelo(it.modelo).nome)} · ${esc(it.malha)} · ${esc(nomeCor(it))}</span>${it.modo === 'pronta' ? ' <span class="etiqueta">Pronta</span>' : ''}</h3>
          <div class="pedidoCorpo">
            <div class="pedidoLados">${Object.keys(it.imagens).map(l => `
              <button type="button" class="ladoGrande" data-vista="lado|${i}|${l}">
                <img src="${it.imagens[l]}" alt="${l}" data-hd="${i}|${l}"><span>${l}</span><i>${icone('expandir', 20)}</i>
              </button>`).join('')}
            </div>
            <div class="pedidoInfoItem">
              <table class="tabelaPedido">
                <thead><tr><th>Tamanho</th><th>Qtd</th>${it.valor?.total ? '<th>Preço</th><th>Subtotal</th>' : ''}</tr></thead>
                <tbody>${(it.valor?.linhas?.length ? it.valor.linhas : Object.entries(it.quantidades).filter(([, q]) => q > 0).map(([t, qtd]) => ({ t, qtd })))
                  .map(l => `<tr><th>${l.t}</th><td>${l.qtd}</td>${it.valor?.total ? `<td>${dinheiro(l.unit)}</td><td>${dinheiro(l.sub)}</td>` : ''}</tr>`).join('')}</tbody>
                <tfoot><tr><th>Total</th><td>${totalPecas(it)}</td>${it.valor?.total ? `<td></td><td>${dinheiro(it.valor.total)}</td>` : ''}</tr></tfoot>
              </table>
              <ul class="artesPedido">${it.artes.length ? it.artes.map((a, k) => `
                <li>
                  <button type="button" class="arteMini" data-vista="arte|${i}|${k}" style="--fundo:${CORES[it.cor]?.hex || '#ddd'}"><img data-arte="${i}|${k}" alt=""></button>
                  <div class="arteDesc">
                    <span class="arteLado">${a.lado} · ${esc(a.medidas || '')}${a.foraArea ? ' · <b>fora da área padrão</b>' : ''}</span>
                    ${descArte(a)}
                    ${a.qualidade ? `<small class="${/Baixa/.test(a.qualidade) ? 'alertaPedido' : ''}">Qualidade: ${esc(a.qualidade)}</small>` : ''}
                    ${a.tipo === 'texto' && a.texto ? `<span class="botoesTexto">
                      <button type="button" class="btnTexto btnArquivo" data-vetor="svg|${i}|${k}">${icone('baixar', 16)} Texto em vetor (SVG)</button>
                      <button type="button" class="btnTexto btnArquivo" data-vetor="png|${i}|${k}">${icone('baixar', 16)} PNG 300 dpi</button></span>` : ''}
                    ${acoes.extraArte ? acoes.extraArte(a, i, k) : ''}
                  </div>
                </li>`).join('') : `<li class="semArte">${icone('camisa', 18)} Camiseta lisa (sem estampa)</li>`}
              </ul>
            </div>
          </div>
        </section>`).join('')}
    </div>` });
  $('#dPdf', j.el).onclick = () => acoes.pdf?.();
  acoes.aoAbrir?.(j);
  $('#dArtes', j.el) && ($('#dArtes', j.el).onclick = () => acoes.artes?.());
  // Texto para a produção: vetor (SVG, letras em curvas) ou PNG 300 dpi
  $$('[data-vetor]', j.el).forEach(b => (b.onclick = async () => {
    const [tipo, i, k] = b.dataset.vetor.split('|');
    b.disabled = true;
    try {
      const nome = `pedido-${numeroPedido(p.numero)}-texto-${+i + 1}-${+k + 1}`;
      const f = (await arquivosTexto(p.itens[i].artes[k], nome)).find(x => x.nome.endsWith('.' + tipo));
      if (!f) throw new Error(tipo === 'svg' ? 'não foi possível gerar o vetor' : 'não foi possível gerar a imagem');
      baixar(f.blob, f.nome);
    } catch (e) { aviso(e.message, 'erro'); }
    b.disabled = false;
  }));

  // Vistas para a tela cheia (lados em alta resolução e cada arte sozinha)
  const vistas = [];
  const fonteArte = acoes.fonteArte || (async a => (a.tipo === 'texto' ? a.url : await urlDa(a.artId, 'previa')));
  p.itens.forEach((it, i) => {
    Object.keys(it.imagens).forEach(l => vistas.push({ chave: `lado|${i}|${l}`, titulo: `Camiseta ${i + 1} · ${l}`, fundo: '#ffffff', src: it.imagens[l] }));
    it.artes.forEach((a, k) => vistas.push({ chave: `arte|${i}|${k}`, titulo: `Camiseta ${i + 1} · ${a.lado} · ${a.tipo === 'texto' ? 'Texto' : a.nome} · ${a.medidas || ''}`, fundo: CORES[it.cor]?.hex || '#ddd', src: null, arte: a }));
  });
  $$('[data-vista]', j.el).forEach(b => (b.onclick = () => zoomVistas(vistas, vistas.findIndex(v => v.chave === b.dataset.vista))));
  // Miniaturas das artes
  for (const [i, it] of p.itens.entries()) for (const [k, a] of it.artes.entries()) {
    const src = await fonteArte(a).catch(() => null);
    const v = vistas.find(x => x.chave === `arte|${i}|${k}`); if (v) v.src = src;
    const img = $(`[data-arte="${i}|${k}"]`, j.el); if (img && src) img.src = src;
  }
  // Camisetas redesenhadas em alta resolução (se as artes ainda estão no tablet)
  for (const [i, it] of p.itens.entries()) for (const l of Object.keys(it.imagens)) {
    try {
      const hd = await imagemLado(it, l, 1800, { fonte: fonteArte, exigirTodas: true });
      const v = vistas.find(x => x.chave === `lado|${i}|${l}`); if (v) v.src = hd;
      const img = $(`[data-hd="${i}|${l}"]`, j.el); if (img) img.src = hd;
    } catch { /* fica a imagem salva no pedido */ }
  }
}

/** Visualizador em tela cheia: toque para ampliar, arraste para mover, setas para passar. */
function zoomVistas(vistas, inicio = 0) {
  let i = Math.max(0, inicio), nivel = 1;
  const j = janela({ titulo: '', classe: 'janelaZoom', html: `
    <div class="zoomTopo"><span id="zTitulo"></span>
      <div class="linhaBotoes">
        <button type="button" class="btnRedondo" id="zMenos" aria-label="Diminuir">${icone('menos', 22)}</button>
        <button type="button" class="btnRedondo" id="zMais" aria-label="Ampliar">${icone('mais', 22)}</button>
      </div></div>
    <div class="zoomArea" id="zArea"><img id="zImg" alt=""></div>
    <button type="button" class="zoomNav esq" id="zAnt" aria-label="Anterior">${icone('voltar', 32)}</button>
    <button type="button" class="zoomNav dir" id="zProx" aria-label="Próxima">${icone('avancar', 32)}</button>
    <p class="zoomDica">Toque na imagem para ampliar · arraste para mover</p>` });
  const area = $('#zArea', j.el), img = $('#zImg', j.el);
  const aplicar = (cx = 0.5, cy = 0.5) => {
    img.style.width = `${nivel * 100}%`; img.style.height = `${nivel * 100}%`;
    area.classList.toggle('ampliado', nivel > 1);
    area.scrollLeft = cx * area.scrollWidth - area.clientWidth / 2;
    area.scrollTop = cy * area.scrollHeight - area.clientHeight / 2;
  };
  const mostrar = () => {
    const v = vistas[i];
    nivel = 1; aplicar();
    img.src = v.src || '';
    area.style.setProperty('--fundo', v.fundo);
    area.classList.toggle('soArteZoom', !!v.arte);
    $('#zTitulo', j.el).textContent = `${v.titulo}  (${i + 1}/${vistas.length})`;
    $('#zAnt', j.el).hidden = $('#zProx', j.el).hidden = vistas.length < 2;
  };
  $('#zAnt', j.el).onclick = () => { i = (i - 1 + vistas.length) % vistas.length; mostrar(); };
  $('#zProx', j.el).onclick = () => { i = (i + 1) % vistas.length; mostrar(); };
  $('#zMais', j.el).onclick = () => { nivel = Math.min(5, nivel + 1); aplicar(); };
  $('#zMenos', j.el).onclick = () => { nivel = Math.max(1, nivel - 1); aplicar(); };
  // Toque: amplia no ponto tocado (ou volta ao normal); arrastar move a imagem ampliada
  let arr = null, moveu = false;
  area.addEventListener('pointerdown', e => { arr = { x: e.clientX, y: e.clientY, sl: area.scrollLeft, st: area.scrollTop }; moveu = false; area.setPointerCapture?.(e.pointerId); });
  area.addEventListener('pointermove', e => {
    if (!arr) return;
    const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
    if (Math.abs(dx) + Math.abs(dy) > 8) moveu = true;
    if (nivel > 1) { area.scrollLeft = arr.sl - dx; area.scrollTop = arr.st - dy; }
  });
  area.addEventListener('pointerup', e => {
    if (!arr) return;
    const dx = e.clientX - arr.x; arr = null;
    if (nivel === 1 && moveu && Math.abs(dx) > 60 && vistas.length > 1) return (dx < 0 ? $('#zProx', j.el) : $('#zAnt', j.el)).click();
    if (moveu) return;
    const r = area.getBoundingClientRect();
    const cx = (area.scrollLeft + e.clientX - r.left) / area.scrollWidth, cy = (area.scrollTop + e.clientY - r.top) / area.scrollHeight;
    nivel = nivel > 1 ? 1 : 3;
    aplicar(cx, cy);
  });
  const teclas = e => { if (e.key === 'ArrowRight') $('#zProx', j.el).click(); if (e.key === 'ArrowLeft') $('#zAnt', j.el).click(); };
  document.addEventListener('keydown', teclas);
  j.aoFechar.then(() => document.removeEventListener('keydown', teclas));
  mostrar();
}

// ---------- Preços ----------

/** "59,90" / "59.9" / "R$ 59" → 59.9 (vazio/inválido = 0). */
const lerValor = v => {
  const t = String(v ?? '').replace(/[^\d,.-]/g, '');
  const n = parseFloat(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const mostrarValor = v => (+v ? (+v).toFixed(2).replace('.', ',') : '');

ABAS.precos = el => {
  const pr = precosDe(App.S.cfg), dtf = dtfDe(App.S.cfg);
  const temAcrescimo = m => Object.values(pr.tamanhos?.[m.id] || {}).some(v => +v);
  el.innerHTML = `
    <div class="adminCaixa formPrecos">
      <h3>${icone('dinheiro', 22)} Preços das camisetas</h3>
      <label class="chaveGrande"><input type="checkbox" id="pMostrar" ${pr.mostrar ? 'checked' : ''}>
        <span><b>Mostrar preços para o cliente</b><small>Desligado: o cliente não vê nenhum preço. Os pedidos continuam com o valor aqui no administrador.</small></span></label>
      <label class="checkLinha"><input type="checkbox" id="pUsarMinimo" ${pr.usarMinimo ? 'checked' : ''}> <span><b>Preço mínimo por peça estampada</b> — toda peça com estampa que der menos que o mínimo do produto sai pelo mínimo (ex.: R$ 69,97)</span></label>
      <p class="textoAjuda">Preço de <b>uma peça</b> com estampa. Vazio = sem preço (não aparece). Camisetas prontas podem ter preço próprio (toque na arte, na aba Artes).</p>
      ${MODELOS.map(m => `
        <fieldset class="precoModelo">
          <legend>${icone('camisa', 20)} ${esc(m.nome)}</legend>
          <div class="formLinha">${MALHAS.map(x => `
            <label class="campoPeq"><span>${esc(x.nome)}</span>
              <span class="campoDinheiro"><i>R$</i><input inputmode="decimal" data-base="${esc(m.id)}|${esc(x.id)}" value="${mostrarValor(pr.base?.[m.id]?.[x.id])}" placeholder="0,00"></span></label>`).join('')}
          </div>
          <div class="formLinha minimoLinha" ${pr.usarMinimo ? '' : 'hidden'}>${MALHAS.map(x => `
            <label class="campoPeq"><span>Mínimo por peça estampada · ${esc(x.nome)}</span>
              <span class="campoDinheiro"><i>R$</i><input inputmode="decimal" data-min="${esc(m.id)}|${esc(x.id)}" value="${mostrarValor(pr.minimo?.[m.id]?.[x.id])}" placeholder="—"></span></label>`).join('')}
          </div>
          <details class="acrescimos" ${temAcrescimo(m) ? 'open' : ''}>
            <summary>${icone('mais', 18)} Acréscimo por tamanho <small>(ex.: tamanhos grandes custam mais)</small></summary>
            <div class="gradeAcrescimo">${m.tamanhos.map(t => `
              <label><span>${t}</span><span class="campoDinheiro"><i>+R$</i><input inputmode="decimal" data-tam="${esc(m.id)}|${t}" value="${mostrarValor(pr.tamanhos?.[m.id]?.[t])}" placeholder="0"></span></label>`).join('')}
            </div>
          </details>
        </fieldset>`).join('')}
      <label class="campoPeq"><span>Acréscimo por peça com estampa na <b>frente e nas costas</b></span>
        <span class="campoDinheiro"><i>+R$</i><input inputmode="decimal" id="pCostas" value="${mostrarValor(pr.costas)}" placeholder="0,00"></span></label>
      <label class="campoPeq"><span>Acréscimo por <b>texto</b> adicionado (por peça; vale também nas camisetas prontas)</span>
        <span class="campoDinheiro"><i>+R$</i><input inputmode="decimal" id="pTexto" value="${mostrarValor(pr.texto)}" placeholder="0,00"></span></label>
      <fieldset class="precoModelo precoDtf">
        <legend>${icone('arte', 20)} Custo da estampa (DTF)</legend>
        <label class="checkLinha"><input type="checkbox" id="dAtivo" ${dtf.ativo ? 'checked' : ''}> <b>Somar o custo do DTF de cada estampa</b> no preço da peça</label>
        <p class="textoAjuda">Cada estampa custa a parte da folha que ela ocupa: <b>largura × altura da estampa ÷ (largura × altura da folha) × valor da folha</b>.
          O cliente vê o custo de cada estampa na hora, enquanto aumenta ou diminui. Com isto ligado, o preço do modelo acima é o da <b>camiseta</b> (sem a estampa).</p>
        <div class="formLinha">
          <label class="campoPeq"><span>Largura da folha (cm)</span><input inputmode="decimal" id="dLarg" value="${mostrarValor(dtf.largura)}"></label>
          <label class="campoPeq"><span>Altura da folha (cm)</span><input inputmode="decimal" id="dAlt" value="${mostrarValor(dtf.altura)}"></label>
          <label class="campoPeq"><span>Valor da folha</span><span class="campoDinheiro"><i>R$</i><input inputmode="decimal" id="dValor" value="${mostrarValor(dtf.valor)}"></span></label>
        </div>
        <div class="formLinha">
          <label class="campoPeq"><span>Margem sobre o DTF <small>(%, opcional)</small></span><input inputmode="decimal" id="dMargem" value="${mostrarValor(dtf.margem)}" placeholder="0"></label>
          <label class="campoPeq"><span>Mínimo por estampa <small>(opcional)</small></span><span class="campoDinheiro"><i>R$</i><input inputmode="decimal" id="dMinimo" value="${mostrarValor(dtf.minimo)}" placeholder="0,00"></span></label>
        </div>
        <p class="textoAjuda" id="dExemplo"></p>
      </fieldset>
      <button type="button" class="btn btnEscuro btnGrande" id="pSalvar">${icone('check')} Salvar preços</button>
    </div>`;
  $('#pUsarMinimo', el).onchange = e => $$('.minimoLinha', el).forEach(x => (x.hidden = !e.target.checked));
  // Exemplo ao vivo: quanto custam estampas de tamanhos comuns
  const lerDtf = () => ({ ativo: $('#dAtivo', el).checked, largura: lerValor($('#dLarg', el).value), altura: lerValor($('#dAlt', el).value),
    valor: lerValor($('#dValor', el).value), margem: lerValor($('#dMargem', el).value), minimo: lerValor($('#dMinimo', el).value) });
  const exemplo = () => {
    const d = lerDtf(), cfgT = { precos: { dtf: d } };
    const c = (w, h) => dinheiro(custoEstampa(cfgT, 'Masculina', { cm: w, w, h }));
    $('#dExemplo', el).innerHTML = d.ativo && d.largura && d.altura && d.valor
      ? `Exemplos: estampa <b>10 × 10 cm</b> = ${c(10, 10)} · <b>28 × 35 cm</b> (frente comum) = ${c(28, 35)} · <b>38 × 42 cm</b> (máxima) = ${c(38, 42)}`
      : 'Preencha a folha e o valor para ver exemplos.';
  };
  $$('#dAtivo, #dLarg, #dAlt, #dValor, #dMargem, #dMinimo', el).forEach(i => i.addEventListener('input', exemplo));
  exemplo();
  $('#pSalvar', el).onclick = async () => {
    const base = {}, tamanhos = {}, minimo = {};
    $$('[data-min]', el).forEach(i => { const [m, x] = i.dataset.min.split('|'); const v = lerValor(i.value); if (v) (minimo[m] ||= {})[x] = v; });
    $$('[data-base]', el).forEach(i => { const [m, x] = i.dataset.base.split('|'); const v = lerValor(i.value); if (v) (base[m] ||= {})[x] = v; });
    $$('[data-tam]', el).forEach(i => { const [m, t] = i.dataset.tam.split('|'); const v = lerValor(i.value); if (v) (tamanhos[m] ||= {})[t] = v; });
    const d = lerDtf();
    if (d.ativo && !(d.largura && d.altura && d.valor)) return aviso('Preencha a largura, a altura e o valor da folha de DTF.', 'erro');
    const precos = { mostrar: $('#pMostrar', el).checked, base, tamanhos, costas: lerValor($('#pCostas', el).value), texto: lerValor($('#pTexto', el).value), dtf: d,
      usarMinimo: $('#pUsarMinimo', el).checked, minimo };
    if (precos.mostrar && !Object.keys(base).length) aviso('Preencha pelo menos um preço para o cliente ver.', 'erro');
    const nova = { ...App.S.cfg, precos };
    await DB.salvarConfig(nova);
    App.aplicarConfig(nova);
    aviso('Preços salvos.');
    ABAS.precos(el);
  };
};

// ---------- Configurações ----------

ABAS.config = el => {
  const c = App.S.cfg;
  el.innerHTML = `
    <div class="adminCaixa formConfig">
      <label class="campoPeq"><span>Nome da loja (aparece no topo e no PDF)</span><input id="cLoja" value="${esc(c.loja)}"></label>
      <label class="campoPeq"><span>Frase da tela inicial</span><input id="cSlogan" value="${esc(c.slogan)}"></label>
      <label class="checkLinha"><input type="checkbox" id="cEnvio" ${c.permitirEnvio !== false ? 'checked' : ''}> Cliente pode <b>enviar a própria arte</b></label>
      <p class="textoAjuda">Desligado: quem tocar em "Imagem" vê as opções de texto, arte pronta ou falar com o responsável abaixo (e pode deixar o WhatsApp para a confecção chamar).</p>
      <div class="formLinha">
        <label class="campoPeq"><span>Responsável pelas artes próprias <small>(nome)</small></span><input id="cResp" value="${esc(c.nomeResponsavel || '')}" placeholder="Ex.: Marcos"></label>
        <label class="campoPeq"><span>WhatsApp do responsável</span><input id="cZap" type="tel" inputmode="tel" value="${esc(c.whatsResponsavel || '')}" placeholder="(00) 00000-0000"></label>
      </div>
      <label class="checkLinha"><input type="checkbox" id="cBusca" ${c.permitirBusca !== false ? 'checked' : ''}> Cliente pode <b>buscar imagens na internet</b> (só imagens com licença livre para uso comercial)</label>
      <label class="checkLinha"><input type="checkbox" id="cTela" ${c.telaLigada !== false ? 'checked' : ''}> <b>Manter a tela sempre ligada</b> enquanto o app está aberto</label>
      <label class="campoPeq"><span>Voltar ao início depois de quantos minutos parado</span><input id="cIdle" type="number" min="1" max="30" value="${c.inatividadeMin}"></label>
      <label class="campoPeq"><span>Escurecer a tela (descanso) depois de quantos minutos sem toque <small>(0 = nunca; o app continua aberto no mesmo lugar)</small></span><input id="cDescanso" type="number" min="0" max="30" value="${c.descansoMin ?? 2}"></label>
      <label class="campoPeq"><span>Nova senha do administrador (deixe vazio para manter)</span><input id="cSenha" inputmode="numeric" maxlength="6" placeholder="4 a 6 números"></label>
      <button type="button" class="btn btnEscuro btnGrande" id="cSalvar">${icone('check')} Salvar configurações</button>
    </div>
    <div class="adminCaixa formConfig">
      <h3>${icone('lista', 22)} Pedidos no computador da confecção</h3>
      <p class="textoAjuda">Cada pedido feito aqui é enviado pela internet. No computador, abra o mesmo endereço do app
        <b class="linkPainel">${esc(location.origin + location.pathname.replace(/[^/]*$/, ''))}</b>,
        clique em <b>Acesso da equipe</b> e digite a senha da confecção. Sem internet, o pedido espera e vai sozinho depois.</p>
      <label class="checkLinha"><input type="checkbox" id="eAtivo" ${configEnvio(c).ativo ? 'checked' : ''}> <b>Enviar pedidos para a confecção</b></label>
      <label class="campoPeq"><span>Senha da confecção (a inicial é <b>${SENHA_INICIAL}</b>)</span>
        <input id="eChave" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(configEnvio(c).chave)}" placeholder="${SENHA_INICIAL}"></label>
      <label class="campoPeq"><span>Trocar a senha da confecção (deixe vazio para manter; mínimo 6 caracteres)</span>
        <input id="eNova" type="password" autocomplete="new-password" placeholder="Nova senha"></label>
      <div class="linhaBotoes">
        <button type="button" class="btn btnEscuro" id="eSalvarEnvio">${icone('check', 20)} Testar e salvar</button>
        <button type="button" class="btn btnClaro" id="eAtualizar">${icone('virar', 20)} Atualizar e enviar agora</button>
        <span class="textoAjuda" id="eEstado"></span>
      </div>
      <p class="estadoEnvio" id="eSituacao"></p>
    </div>
    <div class="adminCaixa formConfig">
      <h3>${icone('sino', 22)} Aviso de pedido no computador do gestor</h3>
      <p class="textoAjuda">A cada pedido novo, o computador (ou celular) do gestor mostra um <b>alerta com som</b>, mesmo com a página fechada — basta o Chrome/Edge aberto.
        Grátis, sem WhatsApp e sem chip no tablet. <b>Para ativar:</b> no computador do gestor, abra os pedidos da confecção
        (o endereço do app + <b>#confeccao</b>, com a senha da confecção) e clique em <b>🔔 Avisos → Ativar neste aparelho</b>.</p>
      <p class="estadoEnvio" id="zAparelhos">Conferindo…</p>
      <div class="linhaBotoes">
        <button type="button" class="btn btnClaro" id="zTestar">${icone('sino', 20)} Enviar aviso de teste</button>
      </div>
    </div>`;
  // Avisos de pedido: aparelhos cadastrados no painel da confecção
  const zMostrar = lista => { $('#zAparelhos', el).innerHTML = lista.length
    ? `Recebem os avisos: ${lista.map(a => `<b>${esc(a.nome)}</b>${a.erro ? ' <span class="alertaPedido">(falhou)</span>' : ''}`).join(', ')}`
    : 'Nenhum aparelho recebe os avisos ainda.'; };
  listarAparelhos(configEnvio(App.S.cfg).chave).then(d => zMostrar(d.aparelhos))
    .catch(e => { $('#zAparelhos', el).textContent = navigator.onLine ? `Não deu para conferir: ${e.message}` : 'Sem internet.'; });
  $('#zTestar', el).onclick = async () => {
    try { const d = await testarAparelhos(configEnvio(App.S.cfg).chave); zMostrar(d.aparelhos); aviso(`Aviso de teste enviado para ${d.enviados} aparelho${d.enviados === 1 ? '' : 's'}.`, 'ok'); }
    catch (e) { aviso(`Não foi: ${e.message}`, 'erro'); }
  };
  // Situação dos pedidos no tablet (enviados / aguardando) e botão de atualizar
  const situacao = async () => {
    const caixa = $('#eSituacao', el); if (!caixa) return;
    const todos = await DB.todos('pedidos');
    const pend = todos.filter(p => !p.enviado);
    const erro = pend.find(p => p.erroEnvio)?.erroEnvio;
    const ultimoEnviado = Math.max(0, ...todos.map(p => p.enviado || 0));
    caixa.classList.toggle('erro', !!erro); caixa.classList.toggle('ok', !pend.length && !!todos.length);
    caixa.innerHTML = !configEnvio(App.S.cfg).ativo ? 'Envio desligado: os pedidos ficam só no tablet.'
      : `${todos.length - pend.length} de ${todos.length} pedido${todos.length === 1 ? '' : 's'} na confecção` +
        (pend.length ? ` · <b>${pend.length} aguardando envio</b>${erro ? ` (${esc(erro.replace(/\.$/, ''))})` : ''}` : ' · tudo enviado') +
        (ultimoEnviado ? ` · último envio ${new Date(ultimoEnviado).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '');
  };
  situacao();
  $('#eAtualizar', el).onclick = async () => {
    const b = $('#eAtualizar', el); b.disabled = true;
    $('#eSituacao', el).innerHTML = 'Enviando…';
    const r = await enviarPendentes(App.S.cfg).catch(e => ({ erro: e.message }));
    await situacao();
    b.disabled = false;
    if (r.desligado) aviso('Ligue "Enviar pedidos para a confecção" para enviar.', 'erro');
    else if (r.erro) aviso(`Não foi possível enviar: ${r.erro}`, 'erro');
    else aviso(r.enviados ? `${r.enviados} pedido${r.enviados === 1 ? '' : 's'} enviado${r.enviados === 1 ? '' : 's'} para a confecção.` : 'Tudo em dia: nenhum pedido aguardando envio.', 'ok');
  };
  $('#eSalvarEnvio', el).onclick = async () => {
    const ativo = $('#eAtivo', el).checked, nova = $('#eNova', el).value.trim();
    let chave = $('#eChave', el).value.trim();
    const estado = $('#eEstado', el);
    try {
      if (nova && nova.length < 6) return aviso('A nova senha precisa ter pelo menos 6 caracteres.', 'erro');
      if (ativo || nova) {
        if (!chave) return aviso('Digite a senha da confecção.', 'erro');
        estado.textContent = 'Conferindo…';
        const r = await testarChave(chave, nova || undefined);
        if (r.trocada) { chave = nova; $('#eChave', el).value = nova; $('#eNova', el).value = ''; }
        estado.textContent = r.trocada ? 'Senha trocada. Use a nova senha no computador.' : ativo ? 'Senha certa. Tudo pronto.' : 'Envio desligado.';
      } else estado.textContent = 'Envio desligado.';
      const cfgNova = { ...App.S.cfg, envio: { ativo, chave, versao: VERSAO_ENVIO } };
      await DB.salvarConfig(cfgNova);
      App.aplicarConfig(cfgNova);
      if (ativo) { const r = await enviarPendentes(cfgNova); if (r.enviados) aviso(`${r.enviados} pedido${r.enviados > 1 ? 's' : ''} enviado${r.enviados > 1 ? 's' : ''} para a confecção.`, 'ok'); } await situacao();
    } catch (e) {
      estado.textContent = '';
      aviso(navigator.onLine ? e.message : 'Sem internet. Tente de novo quando conectar.', 'erro');
    }
  };
  $('#cSalvar', el).onclick = async () => {
    const senha = $('#cSenha', el).value.trim();
    if (senha && !/^\d{4,6}$/.test(senha)) return aviso('A senha deve ter de 4 a 6 números.', 'erro');
    const nova = {
      ...c,
      loja: $('#cLoja', el).value.trim() || PADRAO.loja,
      slogan: $('#cSlogan', el).value.trim() || PADRAO.slogan,
      inatividadeMin: Math.max(1, Math.min(30, +$('#cIdle', el).value || 3)),
      descansoMin: Math.max(0, Math.min(30, Math.round(+$('#cDescanso', el).value || 0))),
      permitirEnvio: $('#cEnvio', el).checked,
      nomeResponsavel: $('#cResp', el).value.trim(),
      whatsResponsavel: $('#cZap', el).value.trim(),
      permitirBusca: $('#cBusca', el).checked,
      telaLigada: $('#cTela', el).checked,
      senha: senha || c.senha
    };
    await DB.salvarConfig(nova);
    App.aplicarConfig(nova);
    aviso('Configurações salvas.');
    ABAS.config(el);
  };
};

// ---------- Ajuda ----------

ABAS.ajuda = el => {
  el.innerHTML = `
    <div class="adminCaixa textoLongo">
      <h3>${icone('pasta', 22)} Como preparar as artes</h3>
      <ol>
        <li>Organize as artes em <b>pastas por tema</b> (ex.: <i>Rock</i>, <i>Futebol</i>, <i>Religioso</i>). O nome da pasta vira o tema no app.</li>
        <li><b>Melhor formato: PDF.</b> No CorelDRAW: <i>Arquivo → Exportar</i> (ou <i>Publicar em PDF</i>) com fundo transparente. Cada página do PDF vira uma arte.</li>
        <li>Arquivos <b>.cdr</b> também funcionam, mas o app usa a <b>prévia</b> que o Corel grava dentro do arquivo (resolução menor, selo "baixa resolução").</li>
        <li><b>Sem CorelDRAW?</b> Use o <a href="ferramentas/converter-cdr-para-pdf.bat" download>conversor de .cdr para PDF</a> (Windows): instale o <b>LibreOffice</b> (grátis), arraste a pasta das artes para cima do conversor e ele cria um PDF ao lado de cada .cdr. Depois importe a pasta de novo: o PDF substitui a versão .cdr (mantendo nome e configuração) e o tamanho da arte no arquivo vira o tamanho padrão da camiseta pronta.</li>
        <li>Para importar tudo de uma vez: compacte a pasta das artes em <b>.ZIP</b> no computador, copie para o tablet e escolha o .ZIP em <b>Escolher arquivos</b>.</li>
        <li>Para usar o mesmo catálogo em outro tablet: <b>Exportar cópia</b> aqui e <b>Importar cópia</b> no outro.</li>
        <li><b>Camiseta pronta:</b> toque numa arte para definir o lado, a largura (na masculina), a posição, as cores liberadas e a arte das costas. Marque "usar em todas as artes do tema" para configurar o tema inteiro de uma vez.</li>
      </ol>
      <h3>${icone('camisa', 22)} Deixar o tablet como "totem"</h3>
      <ol>
        <li>Abra o site no Chrome (Android) ou Safari (iPad) e toque em <b>Adicionar à tela inicial</b>. O app abre em tela cheia, como um aplicativo.</li>
        <li>Android: ative <b>Fixar app</b> (Configurações → Segurança → Fixar app). iPad: ative <b>Acesso Guiado</b> (Ajustes → Acessibilidade). Assim o cliente não sai do app.</li>
        <li>Depois de aberto uma vez com internet, o app continua funcionando sem internet (as artes ficam no tablet).</li>
      </ol>
      <h3>${icone('cadeado', 22)} Acesso a esta área</h3>
      <p>Toque <b>5 vezes</b> no nome da loja (canto superior esquerdo) ou segure o dedo nele por 2 segundos. Troque a senha em <b>Configurações</b>.</p>
      <h3>${icone('lista', 22)} Pedidos</h3>
      <p>Toque em <b>Ver pedido</b> para ver as camisetas e cada arte em tela cheia (toque na imagem para ampliar).</p>
      <h3>${icone('upload', 22)} PDF de catálogo (código em cima da arte)</h3>
      <p>Com <b>PDF de catálogo</b> marcado, cada arte do PDF é separada pelo selo com o código (ex.: <i>COD: ROCK-1</i>), recebe o código como nome e vira camiseta pronta na cor do fundo da página. Precisa de internet para ler os códigos. <b>Apagar todas</b> (em Catálogo) limpa todas as artes do tablet.</p>
      <h3>${icone('check', 22)} Várias artes de uma vez</h3>
      <p>Em <b>Artes</b>, toque em <b>Selecionar várias</b> (ou segure o dedo numa arte). Marque as artes ou um tema inteiro e escolha: <b>Camiseta pronta</b> (tamanho, posição, cores e preço para todas), <b>Mover para tema</b> (com subcategoria, ex.: a banda), <b>Ocultar</b>, <b>Mostrar</b> ou <b>Apagar</b>.</p>
      <h3>${icone('lista', 22)} Pedidos no computador da confecção</h3>
      <p>Cada pedido novo vai sozinho para a confecção. No computador, abra o mesmo endereço do app, clique em <b>Acesso da equipe</b> e digite a senha da confecção (a inicial é <b>${SENHA_INICIAL}</b>; troque em <b>Configurações</b>).</p>
      <h3>${icone('dinheiro', 22)} Preços</h3>
      <p>Na aba <b>Preços</b>, preencha o preço de cada modelo e malha, os acréscimos por tamanho e para frente + costas. Desligue <b>Mostrar preços para o cliente</b> para esconder os valores do app.</p>
      <p>Os pedidos ficam salvos neste tablet, na aba <b>Pedidos</b>, com o PDF para produção (imagens da frente/costas, tamanhos, nome do arquivo de cada arte e medidas em cm).</p>
      <p>Quando o cliente <b>envia a própria arte</b> ou usa uma <b>imagem da internet</b>, o pedido mostra a qualidade de impressão e o botão <b>Artes do cliente</b> baixa o arquivo original (e o crédito/licença das imagens da internet). Pedidos com arte de qualidade baixa aparecem com um alerta.</p>
    </div>`;
};
