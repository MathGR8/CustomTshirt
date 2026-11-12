/**
 * @module direitosModule
 * @description Aviso de direitos autorais das artes.
 *
 * O personalizador é para camisetas de conteúdo PRÓPRIO (marca própria,
 * uniformes, eventos, empresas, escolas…). Artes com direitos autorais ou
 * licenças de terceiros (bandas, times, personagens, marcas famosas…) sem
 * autorização não são aceitas.
 *
 * Onde o cliente vê:
 *  - etapa "Arte": linha curta sempre visível, com "Saiba mais";
 *  - a 1ª vez que toca em "Enviar minha arte": janela explicando, com
 *    "Entendi, enviar minha arte" (lembrado no navegador);
 *  - janela final (contactModule): confirmação obrigatória antes de enviar.
 *
 * Dependências: nenhuma (só DOM).
 */

const CHAVE = 'artrock_direitos_ok_v1';

const TEXTO = `
  <p>O personalizador da Art Rock serve para você <b>visualizar camisetas com conteúdo próprio</b>:
  a sua marca, uniformes, eventos, empresas, escolas, festas, grupos e afins.</p>
  <p class="dirAlerta">🚫 <b>Não aceitamos estampas com direitos autorais ou licenças de terceiros</b>
  sem autorização: logos e nomes de bandas, times, marcas famosas, personagens, filmes, séries, games e afins.</p>
  <p>Pedidos com esse tipo de arte serão recusados. Se você tem autorização do dono dos direitos, envie junto com o pedido.</p>`;

const lembrado = () => { try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; } };
const lembrar = () => { try { localStorage.setItem(CHAVE, '1'); } catch { /* ok */ } };

let dlg = null;
let aoOk = null; // ação no próprio toque do "Entendi" (Safari só abre o arquivo dentro do toque)

/** Janela do aviso (criada uma vez). */
function janela() {
  if (dlg) return dlg;
  dlg = document.createElement('dialog');
  dlg.className = 'direitosDlg';
  dlg.setAttribute('aria-labelledby', 'dirTitulo');
  dlg.innerHTML = `
    <h2 id="dirTitulo">⚖️ Só artes próprias ou autorizadas</h2>
    <div class="dirTexto">${TEXTO}</div>
    <div class="dirBotoes">
      <button type="button" class="dirOk" data-dir="ok">Entendi</button>
      <button type="button" class="dirVoltar" data-dir="voltar">Voltar</button>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => {
    const b = e.target.closest('[data-dir]');
    if (b) {
      if (b.dataset.dir === 'ok' && aoOk) { const f = aoOk; aoOk = null; f(); }
      dlg.close(b.dataset.dir);
    }
    else if (e.target === dlg) dlg.close('voltar'); // toque fora
  });
  return dlg;
}

/**
 * Mostra o aviso.
 * @param {{enviar?: boolean, ok?: Function}} [opc] - enviar: o botão principal vira
 *   "Entendi, enviar minha arte"; ok: roda no próprio toque do "Entendi".
 * @returns {Promise<boolean>} true se o cliente tocou em "Entendi".
 */
function mostrar({ enviar = false, ok = null } = {}) {
  const d = janela();
  aoOk = ok;
  d.querySelector('.dirOk').textContent = enviar ? 'Entendi, enviar minha arte' : 'Entendi';
  d.querySelector('.dirVoltar').hidden = !enviar;
  return new Promise(ok => {
    d.addEventListener('close', () => ok(d.returnValue === 'ok'), { once: true });
    d.returnValue = '';
    d.showModal();
  });
}

export const DireitosModule = {
  TEXTO_CURTO: 'Use só artes próprias ou com autorização: estampas com direitos autorais de terceiros não são aceitas.',

  init() {
    // Linha curta na etapa "Arte"
    const saiba = document.getElementById('btnDireitos');
    if (saiba) saiba.onclick = () => mostrar();

    // 1ª vez em "Enviar minha arte": explica antes de abrir a escolha do arquivo
    const label = document.querySelector('label[for="stampFile"]');
    const input = document.getElementById('stampFile');
    if (label && input) {
      label.addEventListener('click', e => {
        if (lembrado()) return;
        e.preventDefault();
        mostrar({ enviar: true, ok: () => { lembrar(); input.click(); } });
      });
    }
  },

  /** Abre o aviso completo (ex.: link "Saiba mais"). */
  mostrar: opc => mostrar(opc)
};
