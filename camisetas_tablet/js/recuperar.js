/**
 * @module recuperar
 * @description "Esqueci a senha": manda um código de 6 números para o e-mail de
 * recuperação e, com o código, grava a senha nova.
 *  - confecção e loja: a senha nova fica no servidor;
 *  - admin (tablet): o servidor só confere o código; quem grava é o tablet.
 */

import { $, esc, janela } from './ui.js';
import { icone } from './icons.js';

const NOMES = { confeccao: 'da confecção', loja: 'da loja (balcão)', admin: 'do administrador' };

async function chamar(caminho, corpo) {
  let r;
  try { r = await fetch(`api/pedidos/${caminho}`, { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }); }
  catch { throw new Error('Sem conexão com a internet.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || `erro ${r.status}`);
  return d;
}

/**
 * Janela de recuperação.
 * @param {'confeccao'|'loja'|'admin'} tipo
 * @returns {Promise<string|null>} a senha nova (ou null se desistiu)
 */
export function janelaRecuperar(tipo) {
  const admin = tipo === 'admin';
  const j = janela({ titulo: `${icone('cadeado')} Esqueci a senha ${NOMES[tipo]}`, classe: 'janelaPequena janelaRecuperar', html: `
    <form class="formConfig" id="rcEtapa1">
      <p class="textoAjuda">Vamos mandar um <b>código de 6 números</b> para o e-mail de recuperação cadastrado. Com ele você cria uma senha nova.</p>
      <p class="alertaPedido" id="rcErro1" hidden></p>
      <div class="linhaBotoes"><button type="button" class="btn btnClaro" data-fechar>Cancelar</button>
        <button type="submit" class="btn btnEscuro" id="rcEnviar">${icone('upload', 20)} Enviar código</button></div>
    </form>
    <form class="formConfig" id="rcEtapa2" hidden>
      <p class="textoAjuda" id="rcPara"></p>
      <label class="campoPeq"><span>Código recebido</span><input id="rcCodigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></label>
      <label class="campoPeq"><span>Nova senha ${admin ? '(4 a 6 números)' : '(pelo menos 6 caracteres)'}</span>
        <input id="rcNova" type="password" autocomplete="new-password" ${admin ? 'inputmode="numeric" maxlength="6"' : 'minlength="6"'}></label>
      <label class="campoPeq"><span>Repita a nova senha</span><input id="rcNova2" type="password" autocomplete="new-password" ${admin ? 'inputmode="numeric" maxlength="6"' : ''}></label>
      ${tipo === 'confeccao' ? '<p class="textoAjuda">Depois, atualize a senha da confecção também no tablet (Administrador → Configurações), senão os pedidos não chegam.</p>' : ''}
      <p class="alertaPedido" id="rcErro2" hidden></p>
      <div class="linhaBotoes"><button type="button" class="btnTexto" id="rcDeNovo">Mandar outro código</button>
        <button type="submit" class="btn btnEscuro" id="rcSalvar">${icone('check', 20)} Trocar a senha</button></div>
    </form>` });
  const el = j.el;
  const erro = (n, m) => { const e = $(`#rcErro${n}`, el); e.hidden = !m; e.textContent = m || ''; };
  const enviar = async () => {
    erro(1); erro(2);
    const b = $('#rcEnviar', el); b.disabled = true;
    try {
      const d = await chamar('recuperar', { tipo });
      $('#rcEtapa1', el).hidden = true; $('#rcEtapa2', el).hidden = false;
      $('#rcPara', el).innerHTML = `Enviamos o código para <b>${esc(d.para)}</b>. Confira também a caixa de spam. Vale por 30 minutos.`;
      setTimeout(() => $('#rcCodigo', el).focus(), 100);
    } catch (e) {
      if (!$('#rcEtapa2', el).hidden) erro(2, e.message); else erro(1, e.message);
    }
    b.disabled = false;
  };
  $('#rcEtapa1', el).onsubmit = e => { e.preventDefault(); enviar(); };
  $('#rcDeNovo', el).onclick = enviar;
  $('#rcEtapa2', el).onsubmit = async e => {
    e.preventDefault();
    const codigo = $('#rcCodigo', el).value.replace(/\D/g, ''), nova = $('#rcNova', el).value.trim();
    if (codigo.length !== 6) return erro(2, 'Digite o código de 6 números do e-mail.');
    if (admin ? !/^\d{4,6}$/.test(nova) : nova.length < 6) return erro(2, admin ? 'A senha do administrador precisa ter de 4 a 6 números.' : 'A nova senha precisa ter pelo menos 6 caracteres.');
    if (nova !== $('#rcNova2', el).value.trim()) return erro(2, 'As duas senhas não são iguais.');
    const b = $('#rcSalvar', el); b.disabled = true;
    try {
      await chamar('recuperar/conferir', { tipo, codigo, ...(admin ? {} : { nova }) });
      j.fechar(nova);
    } catch (err) { b.disabled = false; erro(2, err.message); }
  };
  return j.aoFechar;
}
