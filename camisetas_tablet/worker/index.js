/**
 * Worker do app do tablet (Cloudflare).
 *
 * Serve os arquivos do app (ASSETS) e duas rotas de apoio:
 *   GET /api/busca?q=termo[&vetor=1][&pagina=N]
 *       Busca imagens no Openverse (openverse.org) só com licença que permite
 *       uso comercial e modificação. Resultados em cache por 1 hora.
 *   GET /api/imagem?u=URL
 *       Baixa a imagem escolhida e devolve com CORS liberado, para o app
 *       poder usá-la no canvas (só imagens, até 25 MB).
 *
 *   /api/pedidos...
 *       Pedidos enviados pelo tablet para a confecção ver no computador
 *       (pedidos.html). Ver worker/pedidos.js.
 *
 * Opcional (mais buscas por dia): crie no Cloudflare as variáveis secretas
 * OPENVERSE_CLIENT_ID e OPENVERSE_CLIENT_SECRET (cadastro grátis em
 * https://api.openverse.org/v1/#tag/auth/operation/register).
 */

import { Pedidos, rotaPedidos } from './pedidos.js';

export { Pedidos };

const OPENVERSE = 'https://api.openverse.org/v1';
const LIMITE_BYTES = 25 * 1024 * 1024;
const UA = 'camisetas-tablet/1.0 (+https://github.com/MathGR8/CustomTshirt)';
let token = null; // { valor, expira }

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    try {
      if (url.pathname === '/api/busca') return await busca(url, env, ctx);
      if (url.pathname === '/api/imagem') return await imagem(url);
      if (url.pathname === '/api/pedidos' || url.pathname.startsWith('/api/pedidos/')) return await rotaPedidos(req, env);
    } catch (e) {
      return json({ erro: 'falha', detalhe: String(e && e.message || e) }, 502);
    }
    return env.ASSETS.fetch(req);
  }
};

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...extra }
  });
}

async function cabecalhoAuth(env) {
  if (!env.OPENVERSE_CLIENT_ID || !env.OPENVERSE_CLIENT_SECRET) return {};
  if (!token || token.expira < Date.now()) {
    const r = await fetch(`${OPENVERSE}/auth_tokens/token/`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.OPENVERSE_CLIENT_ID, client_secret: env.OPENVERSE_CLIENT_SECRET })
    });
    if (!r.ok) return {};
    const d = await r.json();
    token = { valor: d.access_token, expira: Date.now() + (d.expires_in - 60) * 1000 };
  }
  return { authorization: `Bearer ${token.valor}` };
}

async function busca(url, env, ctx) {
  const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
  if (!q) return json({ total: 0, resultados: [] });
  const pagina = Math.max(1, Math.min(20, parseInt(url.searchParams.get('pagina'), 10) || 1));
  const p = new URLSearchParams({ q, page: String(pagina), page_size: '30', license_type: 'commercial,modification', mature: 'false' });
  if (url.searchParams.get('vetor') === '1') p.set('extension', 'svg');
  else p.set('size', 'large');

  // Cache de 1 hora por busca (economiza o limite do Openverse)
  const chave = new Request(`https://cache.local/busca?${p}`);
  const cache = caches.default;
  const emCache = await cache.match(chave);
  if (emCache) return emCache;

  const r = await fetch(`${OPENVERSE}/images/?${p}`, { headers: { 'user-agent': UA, ...(await cabecalhoAuth(env)) } });
  if (!r.ok) return json({ erro: 'busca indisponível', status: r.status }, 502);
  const d = await r.json();
  const licenca = x => `${(x.license || '').toUpperCase() === 'CC0' ? 'CC0' : 'CC ' + (x.license || '').toUpperCase()} ${x.license_version || ''}`.replace('CC PDM', 'Domínio público').trim();
  const resposta = json({
    total: d.result_count || 0,
    resultados: (d.results || []).map(x => ({
      id: x.id, titulo: x.title || 'Imagem', url: x.url, mini: x.thumbnail,
      w: x.width || 0, h: x.height || 0, tipo: x.filetype || '',
      licenca: licenca(x), licencaUrl: x.license_url, autor: x.creator || '', pagina: x.foreign_landing_url, origem: x.source || x.provider || ''
    }))
  }, 200, { 'cache-control': 'public, max-age=3600' });
  ctx.waitUntil(cache.put(chave, resposta.clone()));
  return resposta;
}

async function imagem(url) {
  const alvo = url.searchParams.get('u') || '';
  let destino;
  try { destino = new URL(alvo); } catch { return json({ erro: 'endereço inválido' }, 400); }
  if (!/^https?:$/.test(destino.protocol)) return json({ erro: 'endereço inválido' }, 400);
  const r = await fetch(destino.toString(), { headers: { 'user-agent': UA, accept: 'image/*' }, redirect: 'follow', cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!r.ok) return json({ erro: 'não foi possível baixar', status: r.status }, 502);
  const tipo = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!tipo.startsWith('image/')) return json({ erro: 'o endereço não é uma imagem' }, 415);
  const tam = +r.headers.get('content-length') || 0;
  if (tam > LIMITE_BYTES) return json({ erro: 'imagem grande demais' }, 413);
  return new Response(r.body, {
    headers: {
      'content-type': tipo, 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=86400',
      'x-content-type-options': 'nosniff',
      // Se alguém abrir o endereço direto (ex.: um SVG), nada roda no site
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    }
  });
}
