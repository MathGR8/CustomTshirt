/**
 * @module admin
 * @description Área do administrador (protegida por senha):
 *  - Artes: importar arquivos/pasta/.zip, organizar temas, renomear, ocultar, apagar,
 *           configurar a "camiseta pronta" (lado, tamanho, posição, cores, arte das costas),
 *           exportar e importar uma cópia do catálogo (para outro tablet)
 *  - Pedidos: ver, baixar o PDF, apagar
 *  - Configurações: nome da loja, frase, WhatsApp, senha, tempo de inatividade
 *  - Ajuda: como preparar as artes do Corel, instalar o app e travar o tablet
 */

import { PADRAO, CORES, POSICOES } from './config.js';
import { DB } from './db.js';
import { icone } from './icons.js';
import { $, $$, esc, aviso, janela, confirmar, pedirSenha, progressoJanela } from './ui.js';
import { importar, urlDa, limparUrls, exportarCatalogo, importarCatalogo, lib } from './catalog.js';
import { credito } from './fontes.js';
import { pdfPedido, baixar, numeroPedido, totalPecas, textoResumo } from './order.js';
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
      <button type="button" data-aba="config" aria-selected="false">${icone('engrenagem', 20)} Configurações</button>
      <button type="button" data-aba="ajuda" aria-selected="false">${icone('ajuda', 20)} Ajuda</button>
    </nav>
    <div class="abaConteudo" id="abaConteudo"></div>` });
  const ir = aba => {
    $$('[data-aba]', j.el).forEach(b => b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
    ABAS[aba]($('#abaConteudo', j.el));
  };
  $$('[data-aba]', j.el).forEach(b => (b.onclick = () => ir(b.dataset.aba)));
  ir('artes');
  if (String(App.S.cfg.senha) === PADRAO.senha) aviso('Dica: troque a senha padrão (1234) em Configurações.');
  await j.aoFechar;
  await App.recarregarCatalogo();
  if (App.S.tela === 'artes' || App.S.tela === 'inicio') App.irPara(App.S.tela);
}

const ABAS = {};

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
          <button type="button" class="btn btnClaro" id="exportar" ${lista.length ? '' : 'disabled'}>${icone('baixar', 20)} Exportar cópia</button>
          <label class="btn btnClaro">${icone('upload', 20)} Importar cópia<input type="file" id="inCopia" accept=".zip,application/zip" hidden></label>
        </div>
      </div>
      ${temas.length ? temas.map(t => {
        const doTema = lista.filter(a => a.tema === t).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
        return `<details class="temaAdmin" open>
          <summary><strong>${esc(t)}</strong> <small>${doTema.length}</small>
            <span class="summaryAcoes"><button type="button" class="btnIcone" data-renomear-tema="${esc(t)}" aria-label="Renomear tema">${icone('editar', 20)}</button>
            <button type="button" class="btnIcone" data-apagar-tema="${esc(t)}" aria-label="Apagar tema">${icone('lixo', 20)}</button></span></summary>
          <div class="gradeAdmin">${doTema.map(a => `
            <button type="button" class="miniAdmin ${a.oculto ? 'oculta' : ''}" data-arte="${esc(a.id)}">
              <span class="miniImg"><img data-id="${esc(a.id)}" alt=""></span>
              <span class="miniNome">${esc(a.nome)}</span>
              ${a.baixaRes ? '<span class="seloAviso">baixa resolução</span>' : ''}
              ${a.oculto ? '<span class="seloAviso">oculta</span>' : ''}
            </button>`).join('')}</div>
        </details>`;
      }).join('') : `<div class="vazio">${icone('pasta', 48)}<p>Nenhuma arte ainda. Use <b>Escolher arquivos</b> acima.</p></div>`}
    </div>`;

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

  $$('[data-arte]', el).forEach(b => (b.onclick = () => editarArte(b.dataset.arte, temas, () => ABAS.artes(el))));
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

function perguntarTexto(titulo, valor = '') {
  const j = janela({ titulo, classe: 'janelaPequena', html: `
    <input class="inputGrande" id="txt" value="${esc(valor)}">
    <div class="linhaBotoes"><button type="button" class="btn btnClaro" data-fechar>Cancelar</button>
      <button type="button" class="btn btnEscuro" id="okTxt">Salvar</button></div>` });
  const inp = $('#txt', j.el); setTimeout(() => inp.select(), 50);
  $('#okTxt', j.el).onclick = () => j.fechar(inp.value.trim());
  inp.onkeydown = e => { if (e.key === 'Enter') j.fechar(inp.value.trim()); };
  return j.aoFechar;
}

/** Padrão da camiseta pronta (igual ao do app). */
const FIXO_PADRAO = { lado: 'Frente', cm: 28, pos: 'alto', cores: null, costas: null };

async function editarArte(id, temas, depois) {
  const a = await DB.pegar('artes', id);
  if (!a) return;
  const outras = (await DB.artesResumo()).filter(x => !x.cliente && x.id !== id)
    .sort((x, y) => (x.tema === a.tema ? 0 : 1) - (y.tema === a.tema ? 0 : 1) || x.nome.localeCompare(y.nome, 'pt-BR'));
  const fx = { ...FIXO_PADRAO, ...(a.fixo || {}) };
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
        <div class="campoPeq"><span>Posição</span>
          <div class="segmento segPeq" id="ePos">${Object.entries(POSICOES).map(([k, p]) => `<button type="button" data-pos="${k}" aria-pressed="${fx.pos === k}">${p.nome}</button>`).join('')}</div></div>
        <div class="campoPeq"><span>Cores liberadas <small>(nenhuma marcada = todas)</small></span>
          <div class="coresAdmin" id="eCores">${todasCores.map(c => `<label class="corAdmin"><input type="checkbox" value="${esc(c)}" ${fx.cores?.includes(c) ? 'checked' : ''}><i style="--c:${CORES[c].hex}"></i>${esc(CORES[c].nome || c)}</label>`).join('')}</div></div>
        <label class="campoPeq"><span>Arte das costas (opcional)</span>
          <select id="eCostas"><option value="">Nenhuma</option>${outras.map(o => `<option value="${esc(o.id)}" ${fx.costas === o.id ? 'selected' : ''}>${esc(o.tema)} · ${esc(o.nome)}</option>`).join('')}</select></label>
        <p class="textoAjuda dicaCostas">A arte escolhida para as costas some da galeria e aparece junto com esta.</p>
        <label class="checkLinha"><input type="checkbox" id="eTodas"> Usar este tamanho, posição e cores em todas as artes do tema "<span id="eTemaNome">${esc(a.tema)}</span>"</label>
        <div class="linhaBotoes">
          <button type="button" class="btn btnClaro btnPerigoTexto" id="eApagar">${icone('lixo', 20)} Apagar</button>
          <button type="button" class="btn btnEscuro" id="eSalvar">${icone('check', 20)} Salvar</button>
        </div>
      </div>
    </div>` });
  const ler = () => ({
    lado: fx.lado, cm: +$('#eCm', j.el).value, pos: fx.pos,
    cores: $$('#eCores input:checked', j.el).map(i => i.value),
    costas: $('#eCostas', j.el).value || null
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
      doTema.forEach(x => (x.fixo = { ...(x.fixo || FIXO_PADRAO), lado: f.lado, cm: f.cm, pos: f.pos, cores: a.fixo.cores }));
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
          ${img ? `<img src="${img}" alt="">` : ''}
          <div class="pedidoInfo">
            <strong>Nº ${numeroPedido(p.numero)} — ${esc(p.cliente?.nome || 'Sem nome')}</strong>
            <small>${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${p.cliente?.telefone ? ' · ' + esc(p.cliente.telefone) : ''}</small>
            <small>${p.itens.map(it => modelo(it.modelo).nome).join(', ')} · ${total} peça${total === 1 ? '' : 's'}${prontas ? ` · ${prontas} pronta${prontas > 1 ? 's' : ''}` : ''}</small>
            ${doCliente.some(a => /Baixa/.test(a.qualidade || '')) ? `<small class="alertaPedido">${icone('fechar', 14)} Tem arte com qualidade BAIXA</small>` : ''}
          </div>
          <div class="linhaBotoes">
            <button type="button" class="btn btnEscuro" data-pdf="${p.id}">${icone('baixar', 20)} PDF</button>
            ${doCliente.length ? `<button type="button" class="btn btnClaro" data-artes="${p.id}">${icone('baixar', 20)} Artes e textos do cliente (${doCliente.length})</button>` : ''}
            <button type="button" class="btn btnClaro" data-copiar="${p.id}">${icone('lista', 20)} Copiar texto</button>
            <button type="button" class="btnIcone" data-apagar="${p.id}" aria-label="Apagar pedido">${icone('lixo', 20)}</button>
          </div>
        </article>`;
      }).join('')}</div>` : `<div class="vazio">${icone('lista', 48)}<p>Nenhum pedido ainda.</p></div>`}
    </div>`;
  const achar = id => lista.find(p => String(p.id) === String(id));
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

// ---------- Configurações ----------

ABAS.config = el => {
  const c = App.S.cfg;
  el.innerHTML = `
    <div class="adminCaixa formConfig">
      <label class="campoPeq"><span>Nome da loja (aparece no topo e no PDF)</span><input id="cLoja" value="${esc(c.loja)}"></label>
      <label class="campoPeq"><span>Frase da tela inicial</span><input id="cSlogan" value="${esc(c.slogan)}"></label>
      <label class="campoPeq"><span>WhatsApp da loja (só números, com 55 e DDD). Vazio = sem botão de WhatsApp</span><input id="cZap" inputmode="numeric" value="${esc(c.whatsapp)}" placeholder="5512999999999"></label>
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
      whatsapp: $('#cZap', el).value.replace(/\D/g, ''),
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
        <li>Arquivos <b>.cdr</b> também funcionam, mas o app usa a <b>prévia</b> que o Corel grava dentro do arquivo (resolução menor). Eles aparecem com o selo "baixa resolução" — exporte esses em PDF quando puder.</li>
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
      <p>Os pedidos ficam salvos neste tablet, na aba <b>Pedidos</b>, com o PDF para produção (imagens da frente/costas, tamanhos, nome do arquivo de cada arte e medidas em cm).</p>
      <p>Quando o cliente <b>envia a própria arte</b> ou usa uma <b>imagem da internet</b>, o pedido mostra a qualidade de impressão e o botão <b>Artes do cliente</b> baixa o arquivo original (e o crédito/licença das imagens da internet). Pedidos com arte de qualidade baixa aparecem com um alerta.</p>
    </div>`;
};
