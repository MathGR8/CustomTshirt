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
 *   2. Em celulares (e navegadores) que permitem, "Compartilhar arquivos"
 *      abre o menu de compartilhar do aparelho já com o PDF e as artes;
 *      o cliente escolhe o WhatsApp e a conversa do atendimento.
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

const HTML = `
<div class="dlgHead"><strong>🎉 Seu projeto está pronto!</strong>
  <button type="button" class="dlgClose" data-act="fechar" aria-label="Fechar" title="Fechar">✕</button></div>
<div class="dlgBody">
  <p>O PDF do seu pedido foi baixado. Gostaria de entrar em contato com nosso atendimento para fazer a cotação?</p>
  <label for="waMsg" class="dlgLabel">Mensagem para o atendimento <span>(você pode alterar)</span></label>
  <textarea id="waMsg" rows="3"></textarea>
  <p class="dlgHint" id="waFiles"></p>
  <div class="dlgSteps" id="waSteps" hidden></div>
</div>
<div class="dlgFoot">
  <button type="button" class="btn-outline" data-act="baixar">⬇ Baixar arquivos</button>
  <button type="button" class="btn-dark" data-act="share" hidden>📎 Compartilhar arquivos</button>
  <button type="button" class="btn-whatsapp" data-act="wa">Enviar pelo WhatsApp</button>
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
  dlg.className = 'contactDlg';
  dlg.innerHTML = HTML;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'fechar') dlg.close();
    else if (act === 'wa')     ContactModule._enviarWhatsApp();
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
    $('waFiles').textContent = 'Preparando os arquivos do pedido…';
    const btnWa = dlg.querySelector('[data-act="wa"]');
    const btnShare = dlg.querySelector('[data-act="share"]');
    btnWa.disabled = true;
    btnShare.hidden = true;
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
    $('waFiles').textContent = n
      ? `Arquivos do pedido: ${PDF_NAME} e ${n} arte(s)${st.zip ? ` (em ${ZIP_NAME})` : ''}.`
      : `Arquivo do pedido: ${PDF_NAME}.`;
    btnWa.disabled = false;

    // Compartilhar arquivos direto (celulares e alguns navegadores)
    const arquivos = [st.pdf, ...st.artes];
    try {
      btnShare.hidden = !(navigator.canShare && navigator.canShare({ files: arquivos }));
    } catch { btnShare.hidden = true; }
  },

  /** Baixa as artes (se ainda não baixou) e abre a conversa do atendimento. @private */
  _enviarWhatsApp() {
    const msg = $('waMsg').value.trim() || WHATSAPP.message;
    if (!st.artesBaixadas) this._baixarArtes();
    // Abre na mesma ação do clique para o navegador não bloquear a janela
    // ('noopener' faria window.open devolver null; o opener é zerado à mão)
    const win = window.open(linkWhatsApp(msg), '_blank');
    if (win) win.opener = null;
    else window.location.href = linkWhatsApp(msg); // janela bloqueada: abre na mesma aba

    const anexos = st.artes.length ? `<b>${PDF_NAME}</b> e <b>${st.zip ? ZIP_NAME : 'as artes'}</b>` : `<b>${PDF_NAME}</b>`;
    const steps = $('waSteps');
    steps.innerHTML = `✅ A conversa com o atendimento foi aberta com a sua mensagem.<br>
      Agora toque no clipe <b>📎</b> da conversa e anexe ${anexos}, que foram baixados para o seu aparelho.`;
    steps.hidden = false;
    Logger.info('UI', 'Conversa do WhatsApp aberta para o atendimento.');
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
