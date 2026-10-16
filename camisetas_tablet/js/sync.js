/**
 * @module sync
 * @description Envia os pedidos do tablet para a nuvem (Worker do Cloudflare),
 * para a confecção ver no computador em /pedidos.html.
 *
 * - Já vem ligado, com a senha inicial da confecção 000000 (dá para trocar ou
 *   desligar em Administrador → Configurações).
 * - Cada pedido vai com as imagens das camisetas e os arquivos das artes
 *   (original do cliente, prévia das artes da loja). Se estiver sem internet,
 *   fica "aguardando envio" e vai sozinho quando a internet voltar.
 */

import { DB } from './db.js';

const API = 'api/pedidos';
let enviando = null;

/** Configuração de envio (dentro das configurações da loja). */
export const SENHA_INICIAL = '000000';
export const configEnvio = cfg => {
  const e = { ativo: true, chave: SENHA_INICIAL, ...(cfg?.envio || {}) };
  return e.chave ? e : { ativo: true, chave: SENHA_INICIAL }; // nunca configurado: envio ligado com a senha inicial
};

/** Confere a senha da confecção no servidor (e troca, se vier a nova). */
export async function testarChave(chave, nova) {
  const r = await fetch(`${API}/chave`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chave, nova }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || `erro ${r.status}`);
  return d; // { ok, trocada? }
}

async function api(caminho, chave, opc = {}) {
  const r = await fetch(`${API}/${caminho}`, { ...opc, headers: { 'x-chave': chave, ...(opc.headers || {}) } });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    const e = new Error(d.erro || `erro ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r;
}

/** Miniatura pequena (lista da confecção). */
async function miniatura(dataUrl) {
  if (!dataUrl) return '';
  const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = dataUrl; });
  const k = 240 / Math.max(img.naturalWidth, img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}

const extensao = tipo => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' }[tipo] || 'bin');
/** Código curto e estável de um texto (para não repetir nomes de arquivo). */
const codigo = s => { let h = 5381; for (const ch of String(s)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return h.toString(36); };
const limpar = s => String(s || 'arquivo').replace(/[\\/:*?"<>|#%]+/g, '_').slice(0, 80);

/** Arquivos das artes de um pedido: [{nome, blob}] (sem repetir). */
async function arquivosDoPedido(p) {
  const lista = [], vistos = new Set();
  for (const it of p.itens) for (const a of it.artes) {
    if (a.tipo === 'texto' || !a.artId || vistos.has(a.artId)) continue;
    vistos.add(a.artId);
    const reg = await DB.pegar('artes', a.artId);
    if (!reg) continue;
    const base = limpar(reg.nome);
    if (reg.original) lista.push({ nome: `cliente-${base}-${limpar(reg.original.name || reg.arquivo)}`, blob: reg.original, artId: a.artId, papel: 'original' });
    if (reg.previa) lista.push({ nome: `previa-${base}-${codigo(a.artId)}.${extensao(reg.previa.type)}`, blob: reg.previa, artId: a.artId, papel: 'previa' });
  }
  return lista;
}

/** Envia um pedido (arquivos primeiro; o pedido só aparece completo). */
async function enviarPedido(p, chave) {
  const arquivos = await arquivosDoPedido(p);
  for (const f of arquivos) {
    await api(`${encodeURIComponent(p.id)}/arquivos/${encodeURIComponent(f.nome)}`, chave, { method: 'PUT', headers: { 'content-type': f.blob.type || 'application/octet-stream' }, body: f.blob });
  }
  // Liga cada arte ao arquivo dela (para a confecção mostrar a imagem certa)
  const mapa = {};
  arquivos.forEach(f => { (mapa[f.artId] ||= {})[f.papel] = f.nome; });
  const { enviado, erroEnvio, ...limpo } = p;
  const corpo = {
    ...limpo,
    itens: p.itens.map(it => ({ ...it, artes: it.artes.map(a => ({ ...a, arquivos: mapa[a.artId] || null })) })),
    miniatura: await miniatura(Object.values(p.itens[0]?.imagens || {})[0]).catch(() => '')
  };
  await api(encodeURIComponent(p.id), chave, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
}

/**
 * Envia os pedidos que ainda não foram (um de cada vez).
 * @returns {Promise<{enviados: number, pendentes: number, erro?: string}>}
 */
export function enviarPendentes(cfg) {
  if (enviando) return enviando;
  enviando = (async () => {
    const env = configEnvio(cfg);
    const pendentes = (await DB.todos('pedidos')).filter(p => !p.enviado).sort((a, b) => a.id - b.id);
    if (!env.ativo || !env.chave || !pendentes.length) return { enviados: 0, pendentes: pendentes.length };
    if (!navigator.onLine) return { enviados: 0, pendentes: pendentes.length, erro: 'sem internet' };
    let enviados = 0, erro;
    for (const p of pendentes) {
      try {
        await enviarPedido(p, env.chave);
        p.enviado = Date.now(); delete p.erroEnvio;
        enviados++;
      } catch (e) {
        p.erroEnvio = e.message;
        erro = e.message;
        await DB.salvar('pedidos', p);
        if (e.status === 401 || e.status === 429 || e.status === 501) break; // senha errada / servidor sem pedidos: não insiste
        continue;
      }
      await DB.salvar('pedidos', p);
    }
    return { enviados, pendentes: pendentes.length - enviados, erro };
  })().finally(() => { enviando = null; });
  return enviando;
}

/** Tenta enviar ao abrir, quando a internet volta e a cada 2 minutos. */
export function vigiarEnvio(pegarCfg) {
  const tentar = () => enviarPendentes(pegarCfg()).catch(() => {});
  window.addEventListener('online', tentar);
  setInterval(tentar, 2 * 60 * 1000);
  setTimeout(tentar, 4000);
  return tentar;
}
