/**
 * @module sync
 * @description Envia os pedidos do tablet para a nuvem (Worker do Cloudflare),
 * para a confecção ver no computador (no próprio app, com a senha da confecção).
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
export const VERSAO_ENVIO = 2;
export const configEnvio = cfg => {
  const e = cfg?.envio || {};
  // Nunca configurado, ou configurado numa versão antiga (o servidor voltou
  // para a senha inicial): envio ligado com 000000
  if (!e.chave || e.versao !== VERSAO_ENVIO) return { ativo: true, chave: SENHA_INICIAL, versao: VERSAO_ENVIO };
  return { ativo: true, ...e };
};

/** Confere a senha da confecção no servidor (e troca, se vier a nova). */
export async function testarChave(chave, nova) {
  const r = await buscar(`${API}/chave`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chave, nova }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || `erro ${r.status}`);
  return d; // { ok, trocada? }
}

async function buscar(url, opc = {}, ms = 90000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opc, signal: ctl.signal, cache: 'no-store' }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? 'internet lenta (tempo esgotado)' : 'sem conexão com o servidor'); }
  finally { clearTimeout(t); }
}

async function api(caminho, chave, opc = {}) {
  const ms = opc.method === 'PUT' ? 5 * 60000 : 60000; // arquivos grandes têm mais tempo
  const r = await buscar(`${API}/${caminho}`, { ...opc, headers: { 'x-chave': chave, ...(opc.headers || {}) } }, ms);
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    const e = new Error(d.erro || (r.status === 404 ? 'servidor de pedidos não encontrado' : `erro ${r.status}`));
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

/** Último resultado do envio (para mostrar no tablet). */
let ultimo = null;
export const estadoEnvio = () => ultimo;
function avisar(r) {
  ultimo = { ...r, quando: Date.now() };
  window.dispatchEvent(new CustomEvent('envio-pedidos', { detail: ultimo }));
  return r;
}

/**
 * Envia os pedidos que ainda não foram (um de cada vez).
 * Se já houver um envio acontecendo, roda de novo assim que ele terminar
 * (assim o pedido recém-finalizado nunca fica para trás).
 * @returns {Promise<{enviados: number, pendentes: number, erro?: string}>}
 */
// Depois de "senha errada" ou "muitas tentativas", as tentativas automáticas
// param (para não bloquear o acesso da confecção); o envio manual e um pedido
// novo continuam tentando.
let pausa = null; // { chave, ate }

export function enviarPendentes(cfg, { auto = false } = {}) {
  if (enviando) return enviando.then(() => enviarPendentes(cfg, { auto }));
  const envCfg = configEnvio(cfg);
  if (auto && pausa && pausa.chave === envCfg.chave && Date.now() < pausa.ate) {
    return Promise.resolve(ultimo || { enviados: 0, pendentes: 0, erro: 'senha da confecção errada' });
  }
  enviando = (async () => {
    const env = configEnvio(cfg);
    const pendentes = (await DB.todos('pedidos')).filter(p => !p.enviado).sort((a, b) => a.id - b.id);
    if (!env.ativo) return avisar({ enviados: 0, pendentes: pendentes.length, desligado: true });
    if (!pendentes.length) return avisar({ enviados: 0, pendentes: 0 });
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
        if (e.status === 401 || e.status === 429) pausa = { chave: env.chave, ate: Date.now() + (e.status === 401 ? 6 * 3600e3 : 16 * 60e3) };
        if (e.status === 401 || e.status === 429 || e.status === 501) break; // senha errada / servidor sem pedidos: não insiste
        continue;
      }
      await DB.salvar('pedidos', p);
    }
    if (enviados) pausa = null;
    return avisar({ enviados, pendentes: pendentes.length - enviados, erro });
  })().catch(e => avisar({ enviados: 0, pendentes: 0, erro: e.message }))
    .finally(() => { enviando = null; });
  return enviando;
}

/** Tenta enviar ao abrir, quando a internet volta e a cada minuto (se houver pendentes). */
export function vigiarEnvio(pegarCfg) {
  const tentar = () => enviarPendentes(pegarCfg(), { auto: true }).catch(() => {});
  window.addEventListener('online', tentar);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tentar(); });
  setInterval(tentar, 60 * 1000);
  setTimeout(tentar, 3000);
  return tentar;
}
