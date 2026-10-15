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

import { PADRAO, CORES, POSICOES, MODELOS, MALHAS } from './config.js';
import { DB } from './db.js';
import { icone } from './icons.js';
import { $, $$, esc, num, aviso, janela, confirmar, pedirSenha, progressoJanela } from './ui.js';
import { importar, urlDa, limparUrls, exportarCatalogo, importarCatalogo, lib } from './catalog.js';
import { credito } from './fontes.js';
import { pdfPedido, baixar, numeroPedido, totalPecas, textoResumo, imagemLado } from './order.js';
import { precosDe, dinheiro } from './precos.js';
import { modelo } from './shirt.js';

let App = null;

export async function abrirAdmin(app) {
  App = app;
  if (document.querySelector('.janelaAdmin')) return;
  const senha = await pedirSenha();
  if (senha == null) return;
  if (senha !== String(App.S.cfg.senha)) { aviso('Senha incorreta.', 'erro'); return; }
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

// ---------- Artes ----------

ABAS.artes = async el => {
  const lista = (await DB.artesResumo()).filter(a => !a.cliente);
  const temas = [...new Set(lista.map(a => a.tema))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const espaco = await DB.espaco();
  const mb = b => (b / 1048576).toFixed(0) + ' MB';
  const pasta = 'webkitdirectory' in document.createElement('input');
  el.innerHTML = `
    <div class="adminCaixa">
      <h3>${icone('upload', 22)} Importar artes</h3>
      <p class="textoAjuda">Aceita <b>PDF</b>, <b>CorelDRAW (.cdr)</b>, PNG, JPG, SVG e <b>.ZIP</b> com pastas. O tema de cada arte vem do nome da pasta (ex.: <i>Rock/banda.pdf</i> → tema <b>Rock</b>). Arquivos soltos usam o tema abaixo.</p>
      <div class="formLinha">
        <label class="campoPeq"><span>Tema dos arquivos soltos</span>
          <input id="temaPadrao" list="listaTemas" placeholder="Ex.: Rock, Futebol, Religioso…" value="${esc(temas[0] || '')}"></label>
        <datalist id="listaTemas">${temas.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      </div>
      <label class="checkLinha"><input type="checkbox" id="optFundo" checked> Remover fundo branco/de cor única (JPG e prévias do Corel)</label>
      <label class="checkLinha"><input type="checkbox" id="optSeparar"> Separar artes que estão lado a lado na mesma página</label>
      <div class="linhaBotoes">
        <label class="btn btnEscuro btnGrande">${icone('upload')} Escolher arquivos<input type="file" id="inArquivos" multiple hidden></label>
        ${pasta ? `<label class="btn btnClaro btnGrande">${icone('pasta')} Escolher uma pasta<input type="file" id="inPasta" webkitdirectory multiple hidden></label>` : ''}
      </div>
    </div>
    <div class="adminCaixa">
      <div class="caixaTopo">
        <h3>${icone('arte', 22)} Catálogo <small>${lista.length} arte${lista.length === 1 ? '' : 's'} em ${temas.length} tema${temas.length === 1 ? '' : 's'}${espaco ? ` · ${mb(espaco.usage)} usados` : ''}</small></h3>
        <div class="linhaBotoes">
          ${lista.length ? `<button type="button" class="btn ${selecao ? 'btnEscuro' : 'btnClaro'}" id="modoSelecao">${icone('check', 20)} ${selecao ? 'Concluir seleção' : 'Selecionar várias'}</button>` : ''}
          <button type="button" class="btn btnClaro" id="exportar" ${lista.length ? '' : 'disabled'}>${icone('baixar', 20)} Exportar cópia</button>
          <label class="btn btnClaro">${icone('upload', 20)} Importar cópia<input type="file" id="inCopia" accept=".zip,application/zip" hidden></label>
        </div>
      </div>
      ${selecao ? `<div class="dicaSelecao">${icone('mao', 18)} Toque nas artes para marcar. <button type="button" class="btnTexto" id="selTodas">Marcar todas</button> <button type="button" class="btnTexto" id="selNenhuma">Desmarcar</button></div>` : `<p class="dicaPequena dicaSegurar">Dica: segure o dedo numa arte para selecionar várias.</p>`}
      ${temas.length ? temas.map(t => {
        const doTema = lista.filter(a => a.tema === t).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
        return `<details class="temaAdmin" open>
          <summary><strong>${esc(t)}</strong> <small>${doTema.length}</small>
            <span class="summaryAcoes">${selecao ? `<button type="button" class="btn btnClaro btnPeq" data-sel-tema="${esc(t)}">${icone('check', 18)} Marcar tema</button>` : ''}<button type="button" class="btnIcone" data-renomear-tema="${esc(t)}" aria-label="Renomear tema">${icone('editar', 20)}</button>
            <button type="button" class="btnIcone" data-apagar-tema="${esc(t)}" aria-label="Apagar tema">${icone('lixo', 20)}</button></span></summary>
          <div class="gradeAdmin">${doTema.map(a => `
            <button type="button" class="miniAdmin ${a.oculto ? 'oculta' : ''} ${selecao?.has(a.id) ? 'marcada' : ''}" data-arte="${esc(a.id)}" ${selecao ? `aria-pressed="${selecao.has(a.id)}"` : ''}>
              ${selecao ? `<span class="marcaSel">${icone('check', 18)}</span>` : ''}
              <span class="miniImg"><img data-id="${esc(a.id)}" alt=""></span>
              <span class="miniNome">${esc(a.nome)}</span>
              ${a.baixaRes ? '<span class="seloAviso">baixa resolução</span>' : ''}
              ${a.oculto ? '<span class="seloAviso">oculta</span>' : ''}
              ${a.fixo ? '<span class="seloPronta" title="Camiseta pronta configurada">' + icone('estrela', 14) + '</span>' : ''}
            </button>`).join('')}</div>
        </details>`;
      }).join('') : `<div class="vazio">${icone('pasta', 48)}<p>Nenhuma arte ainda. Use <b>Escolher arquivos</b> acima.</p></div>`}
    </div>
    ${selecao ? `<div class="barraSelecao" id="barraSelecao"></div>` : ''}`;

  // Miniaturas sob demanda
  const obs = new IntersectionObserver(es => es.forEach(async e => {
    if (!e.isIntersecting) return;
    obs.unobserve(e.target);
    const u = await urlDa(e.target.dataset.id);
    if (u) e.target.src = u;
  }), { rootMargin: '300px' });
  $$('img[data-id]', el).forEach(i => obs.observe(i));

  const rodarImportacao = async (files, comPasta) => {
    if (!files.length) return;
    const itens = [...files].map(f => ({ file: f, caminho: (comPasta && f.webkitRelativePath) || f.name }));
    const p = progressoJanela('Importando artes');
    try {
      const r = await importar(itens, {
        temaPadrao: $('#temaPadrao', el).value.trim() || 'Diversos',
        separar: $('#optSeparar', el).checked,
        removerFundo: $('#optFundo', el).checked
      }, ({ feitos, total, arquivo }) => p.atualizar(total ? feitos / total : 0, arquivo ? `${feitos + 1} de ${total}: ${arquivo}` : 'Concluído'), p.sinal);
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
    const artes = await pegar();
    artes.forEach(a => (a.tema = novo));
    await DB.salvarVarios('artes', artes);
    aviso(`Movida${n > 1 ? 's' : ''} para "${novo}".`);
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

ABAS.pedidos = async el => {
  const lista = (await DB.todos('pedidos')).sort((a, b) => b.id - a.id);
  el.innerHTML = `
    <div class="adminCaixa">
      <div class="caixaTopo"><h3>${icone('lista', 22)} Pedidos feitos neste tablet <small>${lista.length}</small></h3>
        ${lista.length ? `<button type="button" class="btn btnClaro btnPerigoTexto" id="apagarTodos">${icone('lixo', 20)} Apagar todos</button>` : ''}</div>
      ${lista.length ? `<div class="listaPedidos">${lista.map(p => {
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
        if (a.tipo === 'texto') { // o texto vai como PNG transparente
          const k = `t${vistos.size + 1}`; vistos.add(k);
          zip.file(`${String(vistos.size).padStart(2, '0')}-texto.png`, a.url.split(',')[1], { base64: true });
          zip.file(`${String(vistos.size).padStart(2, '0')}-texto.txt`, `${a.texto}\n${a.descricao || ''}\n${a.lado} · ${a.medidas}\n`);
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
async function verPedido(p, acoes = {}) {
  if (!p) return;
  const d = new Date(p.data), c = p.cliente || {};
  const totalPc = p.itens.reduce((s, it) => s + totalPecas(it), 0);
  const nomeCor = it => CORES[it.cor]?.nome || it.cor;
  const descArte = a => a.tipo === 'texto'
    ? `<b>Texto:</b> “${esc(a.texto).replace(/\n/g, '<br>')}”<small>${esc(a.descricao || '')}</small>`
    : `<b>${esc(a.nome)}</b><small>${a.origem === 'cliente' ? `Arte do cliente · ${esc(a.arquivo || '')}` : a.origem === 'internet' ? `Imagem da internet${a.credito ? ' · ' + esc(a.credito) : ''}` : `${esc(a.tema || '')} · ${esc(a.arquivo || '')}${a.pagina > 1 ? ` (pág. ${a.pagina})` : ''}`}</small>`;
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
          ${p.itens.some(it => it.artes.some(a => a.origem && a.origem !== 'catalogo')) ? `<button type="button" class="btn btnClaro" id="dArtes">${icone('baixar', 20)} Artes do cliente</button>` : ''}
        </div>
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
                    <span class="arteLado">${a.lado} · ${esc(a.medidas || '')}</span>
                    ${descArte(a)}
                    ${a.qualidade ? `<small class="${/Baixa/.test(a.qualidade) ? 'alertaPedido' : ''}">Qualidade: ${esc(a.qualidade)}</small>` : ''}
                  </div>
                </li>`).join('') : `<li class="semArte">${icone('camisa', 18)} Camiseta lisa (sem estampa)</li>`}
              </ul>
            </div>
          </div>
        </section>`).join('')}
    </div>` });
  $('#dPdf', j.el).onclick = () => acoes.pdf?.();
  $('#dArtes', j.el) && ($('#dArtes', j.el).onclick = () => acoes.artes?.());

  // Vistas para a tela cheia (lados em alta resolução e cada arte sozinha)
  const vistas = [];
  const fonteArte = async a => (a.tipo === 'texto' ? a.url : await urlDa(a.artId, 'previa'));
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
      const hd = await imagemLado(it, l, 1800);
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
  const pr = precosDe(App.S.cfg);
  const temAcrescimo = m => Object.values(pr.tamanhos?.[m.id] || {}).some(v => +v);
  el.innerHTML = `
    <div class="adminCaixa formPrecos">
      <h3>${icone('dinheiro', 22)} Preços das camisetas</h3>
      <label class="chaveGrande"><input type="checkbox" id="pMostrar" ${pr.mostrar ? 'checked' : ''}>
        <span><b>Mostrar preços para o cliente</b><small>Desligado: o cliente não vê nenhum preço. Os pedidos continuam com o valor aqui no administrador.</small></span></label>
      <p class="textoAjuda">Preço de <b>uma peça</b> com estampa. Vazio = sem preço (não aparece). Camisetas prontas podem ter preço próprio (toque na arte, na aba Artes).</p>
      ${MODELOS.map(m => `
        <fieldset class="precoModelo">
          <legend>${icone('camisa', 20)} ${esc(m.nome)}</legend>
          <div class="formLinha">${MALHAS.map(x => `
            <label class="campoPeq"><span>${esc(x.nome)}</span>
              <span class="campoDinheiro"><i>R$</i><input inputmode="decimal" data-base="${esc(m.id)}|${esc(x.id)}" value="${mostrarValor(pr.base?.[m.id]?.[x.id])}" placeholder="0,00"></span></label>`).join('')}
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
      <button type="button" class="btn btnEscuro btnGrande" id="pSalvar">${icone('check')} Salvar preços</button>
    </div>`;
  $('#pSalvar', el).onclick = async () => {
    const base = {}, tamanhos = {};
    $$('[data-base]', el).forEach(i => { const [m, x] = i.dataset.base.split('|'); const v = lerValor(i.value); if (v) (base[m] ||= {})[x] = v; });
    $$('[data-tam]', el).forEach(i => { const [m, t] = i.dataset.tam.split('|'); const v = lerValor(i.value); if (v) (tamanhos[m] ||= {})[t] = v; });
    const precos = { mostrar: $('#pMostrar', el).checked, base, tamanhos, costas: lerValor($('#pCostas', el).value), texto: lerValor($('#pTexto', el).value) };
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
      <label class="checkLinha"><input type="checkbox" id="cBusca" ${c.permitirBusca !== false ? 'checked' : ''}> Cliente pode <b>buscar imagens na internet</b> (só imagens com licença livre para uso comercial)</label>
      <label class="campoPeq"><span>Voltar ao início depois de quantos minutos parado</span><input id="cIdle" type="number" min="1" max="30" value="${c.inatividadeMin}"></label>
      <label class="campoPeq"><span>Nova senha do administrador (deixe vazio para manter)</span><input id="cSenha" inputmode="numeric" maxlength="6" placeholder="4 a 6 números"></label>
      <button type="button" class="btn btnEscuro btnGrande" id="cSalvar">${icone('check')} Salvar configurações</button>
    </div>`;
  $('#cSalvar', el).onclick = async () => {
    const senha = $('#cSenha', el).value.trim();
    if (senha && !/^\d{4,6}$/.test(senha)) return aviso('A senha deve ter de 4 a 6 números.', 'erro');
    const nova = {
      ...c,
      loja: $('#cLoja', el).value.trim() || PADRAO.loja,
      slogan: $('#cSlogan', el).value.trim() || PADRAO.slogan,
      inatividadeMin: Math.max(1, Math.min(30, +$('#cIdle', el).value || 3)),
      permitirEnvio: $('#cEnvio', el).checked,
      permitirBusca: $('#cBusca', el).checked,
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
      <h3>${icone('check', 22)} Várias artes de uma vez</h3>
      <p>Em <b>Artes</b>, toque em <b>Selecionar várias</b> (ou segure o dedo numa arte). Marque as artes ou um tema inteiro e escolha: <b>Camiseta pronta</b> (tamanho, posição, cores e preço para todas), <b>Mover para tema</b>, <b>Ocultar</b>, <b>Mostrar</b> ou <b>Apagar</b>.</p>
      <h3>${icone('dinheiro', 22)} Preços</h3>
      <p>Na aba <b>Preços</b>, preencha o preço de cada modelo e malha, os acréscimos por tamanho e para frente + costas. Desligue <b>Mostrar preços para o cliente</b> para esconder os valores do app.</p>
      <p>Os pedidos ficam salvos neste tablet, na aba <b>Pedidos</b>, com o PDF para produção (imagens da frente/costas, tamanhos, nome do arquivo de cada arte e medidas em cm).</p>
      <p>Quando o cliente <b>envia a própria arte</b> ou usa uma <b>imagem da internet</b>, o pedido mostra a qualidade de impressão e o botão <b>Artes do cliente</b> baixa o arquivo original (e o crédito/licença das imagens da internet). Pedidos com arte de qualidade baixa aparecem com um alerta.</p>
    </div>`;
};
