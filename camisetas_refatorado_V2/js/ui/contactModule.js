/**
 * @module contactModule
 * @description Janela "Seu projeto está pronto!", aberta depois de gerar o PDF.
 *
 * Responsabilidades:
 *  - Oferecer o contato com o atendimento pelo WhatsApp (número e mensagem
 *    padrão em WHATSAPP, constants.js). O cliente pode editar a mensagem.
 *  - Juntar os arquivos do pedido: o PDF gerado e as artes enviadas
 *    (arquivo original e, se editada, a versão editada).
 *
 * Como os arquivos chegam ao atendimento:
 *  O link do WhatsApp (wa.me) só leva TEXTO — o navegador não consegue anexar
 *  arquivos automaticamente a uma conversa. Por isso:
 *   1. "Enviar pelo WhatsApp" baixa as artes (artes-pedido.zip; o PDF já foi
 *      baixado) e abre a conversa com o atendimento com a mensagem pronta.
 *      O cliente anexa os arquivos baixados pelo clipe (📎).
 *   2. SÓ NO CELULAR, "Enviar arquivos direto" abre o menu de compartilhar do
 *      aparelho já com o PDF e as artes; o cliente escolhe o WhatsApp e a
 *      conversa. No computador esse menu do sistema raramente oferece o
 *      WhatsApp, por isso o botão não aparece lá.
 *  Envio 100% automático exige um servidor com a API do WhatsApp Business.
 *
 * Dependências: appState.js, constants.js, logger.js, noticeModule.js.
 * Biblioteca opcional: JSZip (window.JSZip) para juntar as artes num .zip.
 */

import { AppState } from '../core/appState.js';
import { WHATSAPP } from '../core/constants.js';
import { Logger } from '../core/logger.js';
import { NoticeModule } from './noticeModule.js';

const PDF_NAME = 'pedido-artrock.pdf';
const ZIP_NAME = 'artes-pedido.zip';

const WA_ICON = `<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4c-1.2-1.8-1.9-3.9-1.9-6 0-5.9 4.9-10.6 11-10.6s11 4.8 11 10.6-4.9 10.9-10.9 10.9zm6-7.9c-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.2 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg>`;

const HTML = `
<button type="button" class="ctClose" data-act="fechar" aria-label="Fechar" title="Fechar">✕</button>
<div class="ctHero">
  <div class="ctConfetti" aria-hidden="true">${'<i></i>'.repeat(14)}</div>
  <div class="ctCheck" aria-hidden="true">
    <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27 L23 35 L38 18"/></svg>
  </div>
  <h2 id="ctTitulo">Seu projeto está pronto!</h2>
  <p id="ctSubtitulo">O PDF do pedido já foi baixado. Agora é só falar com a gente para receber a sua cotação.</p>
</div>
<div class="ctBody">
  <div class="ctStats">
    <div><b id="ctItens">0</b><span>modelo(s)</span></div>
    <div><b id="ctPecas">0</b><span>peça(s)</span></div>
    <div><b id="ctArtes">–</b><span>arte(s)</span></div>
  </div>
  <div class="ctFiles" id="waFiles"></div>
  <label for="waMsg" class="ctLabel">💬 Sua mensagem para o atendimento <span>pode editar</span></label>
  <div class="ctBubble"><textarea id="waMsg" rows="3"></textarea></div>
  <ol class="ctSteps" id="waSteps" hidden></ol>
</div>
<div class="ctFoot">
  <button type="button" class="ctWa" data-act="wa">${WA_ICON}<span>Falar no WhatsApp</span></button>
  <button type="button" class="ctShare" data-act="share" hidden>📲 Enviar arquivos direto pelo celular</button>
  <button type="button" class="ctLink" data-act="baixar">⬇ Baixar os arquivos novamente</button>
</div>`;

/** Estado da janela aberta. */
let st = { dlg: null, pdf: null, artes: [], zip: null, artesBaixadas: false };

const $ = id => document.getElementById(id);

/** Nome de arquivo seguro (sem acentos/caracteres especiais). */
function nomeSeguro(nome) {
  return String(nome || 'arte')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'arte';
}

/** Converte um dataURL em Blob. */
async function dataUrlParaBlob(url) {
  return (await fetch(url)).blob();
}

/** Baixa um Blob com o nome indicado. */
function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Lista as artes de todos os itens do pedido (sem repetir a mesma arte):
 * o arquivo original enviado e, se a arte foi editada, também a versão editada.
 * @returns {Promise<File[]>}
 */
async function coletarArtes() {
  const arquivos = [];
  const vistos = new Set();
  const nomesUsados = new Set();
  const nomeUnico = nome => {
    let n = nome, i = 2;
    const ponto = nome.lastIndexOf('.');
    const base = ponto > 0 ? nome.slice(0, ponto) : nome, ext = ponto > 0 ? nome.slice(ponto) : '';
    while (nomesUsados.has(n)) n = `${base}-${i++}${ext}`;
    nomesUsados.add(n);
    return n;
  };

  for (const [i, item] of AppState.orderItems.entries()) {
    for (const s of (item.stamps || []).filter(x => !x.hidden)) {
      const prefixo = `modelo${i + 1}-`;
      const base = nomeSeguro((s.name || 'arte').replace(/\.[^.]+$/, ''));

      // Arquivo original (como o cliente enviou)
      const chaveOriginal = s.file || s.original?.dataURL || s.dataURL;
      if (!vistos.has(chaveOriginal)) {
        vistos.add(chaveOriginal);
        if (s.file) {
          arquivos.push(new File([s.file], nomeUnico(prefixo + nomeSeguro(s.file.name)), { type: s.file.type }));
        } else {
          const blob = await dataUrlParaBlob(s.original?.dataURL || s.dataURL);
          const ext = (blob.type.split('/')[1] || 'png').replace('svg+xml', 'svg').replace('jpeg', 'jpg');
          arquivos.push(new File([blob], nomeUnico(`${prefixo}${base}.${ext}`), { type: blob.type }));
        }
      }

      // Versão editada no site (girada, recortada, cores…)
      if (s.original && !vistos.has(s.dataURL)) {
        vistos.add(s.dataURL);
        const blob = await dataUrlParaBlob(s.dataURL);
        arquivos.push(new File([blob], nomeUnico(`${prefixo}${base}-editada.png`), { type: 'image/png' }));
      }
    }
  }
  return arquivos;
}

/** Monta a janela (uma única vez) e liga os botões. */
function montar() {
  if (st.dlg) return st.dlg;
  const dlg = document.createElement('dialog');
  dlg.className = 'contactDlg ctDlg';
  dlg.innerHTML = HTML;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'fechar') dlg.close();
    else if (act === 'wa')     ContactModule._enviarWhatsApp();
    else if (act === 'wa-de-novo') ContactModule._abrirConversa();
    else if (act === 'share')  ContactModule._compartilhar();
    else if (act === 'baixar') ContactModule._baixarTudo();
  });
  return dlg;
}

/** Link do WhatsApp com o número do atendimento e a mensagem. */
function linkWhatsApp(msg) {
  return `https://wa.me/${WHATSAPP.number}?text=${encodeURIComponent(msg)}`;
}

export const ContactModule = {
  /**
   * Abre a janela "Seu projeto está pronto!".
   * @param {Blob} pdfBlob - PDF do pedido recém-gerado.
   */
  async open(pdfBlob) {
    const dlg = montar();
    st = { dlg, pdf: new File([pdfBlob], PDF_NAME, { type: 'application/pdf' }), artes: [], zip: null, artesBaixadas: false };

    $('waMsg').value = WHATSAPP.message;
    $('waSteps').hidden = true;
    // Volta ao estado inicial (mensagem + botão do WhatsApp visíveis)
    dlg.classList.remove('ctEnviado');
    $('ctTitulo').textContent = 'Seu projeto está pronto!';
    $('ctSubtitulo').textContent = 'O PDF do pedido já foi baixado. Agora é só falar com a gente para receber a sua cotação.';
    $('waFiles').innerHTML = '<span class="ctChip ctChipWait">Preparando os arquivos…</span>';
    // Resumo do pedido
    $('ctItens').textContent = AppState.orderItems.length;
    $('ctPecas').textContent = AppState.orderItems.reduce((t, it) =>
      t + Object.values(it.quantities || {}).reduce((a, n) => a + (parseInt(n, 10) || 0), 0), 0);
    $('ctArtes').textContent = '–';
    const btnWa = dlg.querySelector('[data-act="wa"]');
    const btnShare = dlg.querySelector('[data-act="share"]');
    btnWa.disabled = true;
    btnShare.hidden = true;
    // Reinicia as animações (confete e check) a cada abertura
    dlg.classList.remove('ctAnim'); void dlg.offsetWidth; dlg.classList.add('ctAnim');
    if (!dlg.open) dlg.showModal();

    try {
      st.artes = await coletarArtes();
      if (st.artes.length && window.JSZip) {
        const zip = new window.JSZip();
        st.artes.forEach(f => zip.file(f.name, f));
        st.zip = await zip.generateAsync({ type: 'blob' });
      }
    } catch (e) {
      Logger.error('UI', 'Erro ao preparar as artes: ' + e.message, e);
    }

    const n = st.artes.length;
    $('ctArtes').textContent = n;
    $('waFiles').innerHTML =
      `<span class="ctChip"><i>PDF</i>${PDF_NAME}</span>` +
      (n ? `<span class="ctChip"><i>${st.zip ? 'ZIP' : 'IMG'}</i>${st.zip ? ZIP_NAME : n + ' arte(s)'}</span>` : '');
    btnWa.disabled = false;

    // "Enviar arquivos direto" só no celular: no computador o menu de
    // compartilhar do sistema quase nunca oferece o WhatsApp
    const celular = matchMedia('(pointer: coarse)').matches;
    const arquivos = [st.pdf, ...st.artes];
    try {
      btnShare.hidden = !(celular && navigator.canShare && navigator.canShare({ files: arquivos }));
    } catch { btnShare.hidden = true; }
  },

  /** Baixa as artes (se ainda não baixou) e abre a conversa do atendimento. @private */
  _enviarWhatsApp() {
    st.msg = $('waMsg').value.trim() || WHATSAPP.message;
    if (!st.artesBaixadas) this._baixarArtes();
    this._abrirConversa();

    // Depois de abrir a conversa ficam só as instruções e o "baixar de novo":
    // a mensagem e o botão do WhatsApp somem (classe ctEnviado, ver CSS)
    st.dlg.classList.add('ctEnviado');
    $('ctTitulo').textContent = 'Quase lá! 🙌';
    $('ctSubtitulo').textContent = 'Siga os passos abaixo para enviar seu pedido ao nosso atendimento.';

    const anexos = st.artes.length ? `<b>${PDF_NAME}</b> e <b>${st.zip ? ZIP_NAME : 'as artes'}</b>` : `<b>${PDF_NAME}</b>`;
    const steps = $('waSteps');
    steps.innerHTML = `
      <li class="ok"><span>Conversa aberta com a sua mensagem.
        <button type="button" class="ctInline" data-act="wa-de-novo">Não abriu? Abrir de novo</button></span></li>
      <li><span>Toque no clipe 📎 e anexe ${anexos} (estão nos seus downloads)</span></li>
      <li><span>Envie e aguarde nosso retorno com a cotação 🚀</span></li>`;
    steps.hidden = false;
    st.dlg.scrollTop = 0;
    Logger.info('UI', 'Conversa do WhatsApp aberta para o atendimento.');
  },

  /** Abre (ou reabre) a conversa do atendimento com a mensagem. @private */
  _abrirConversa() {
    const link = linkWhatsApp(st.msg || WHATSAPP.message);
    // Abre na mesma ação do clique para o navegador não bloquear a janela
    // ('noopener' faria window.open devolver null; o opener é zerado à mão)
    const win = window.open(link, '_blank');
    if (win) win.opener = null;
    else window.location.href = link; // janela bloqueada: abre na mesma aba
  },

  /** Compartilha o PDF e as artes pelo menu do aparelho. @private */
  async _compartilhar() {
    const msg = $('waMsg').value.trim() || WHATSAPP.message;
    try {
      await navigator.share({ files: [st.pdf, ...st.artes], text: msg, title: 'Pedido ArtRock' });
    } catch (e) {
      if (e.name !== 'AbortError') {
        Logger.warn('UI', 'Compartilhamento falhou: ' + e.message);
        NoticeModule.show('error', 'Não foi possível compartilhar. Use "Enviar pelo WhatsApp".');
      }
    }
  },

  /** Baixa só as artes (zip ou arquivos soltos). @private */
  _baixarArtes() {
    if (!st.artes.length) return;
    if (st.zip) baixar(st.zip, ZIP_NAME);
    else st.artes.forEach(f => baixar(f, f.name));
    st.artesBaixadas = true;
  },

  /** Baixa novamente o PDF e as artes. @private */
  _baixarTudo() {
    baixar(st.pdf, PDF_NAME);
    this._baixarArtes();
  },

  /** Baixa o PDF (usado logo após gerar). */
  baixarPdf(pdfBlob) {
    baixar(pdfBlob, PDF_NAME);
  }
};
