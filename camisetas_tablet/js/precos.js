/**
 * @module precos
 * @description Preços das camisetas (editados na área do administrador, aba "Preços").
 *
 * Preço de uma peça = preço do modelo na malha escolhida
 *                     (ou o preço próprio da camiseta pronta, se a loja definiu)
 *                   + acréscimo do tamanho (ex.: X1 a X8)
 *                   + acréscimo "frente e costas" (quando tem imagem/arte nos dois lados;
 *                     não vale para camiseta pronta com preço próprio)
 *                   + acréscimo de cada texto (vale também para a camiseta pronta)
 *                   + custo do DTF de cada estampa (se ligado): proporcional à área
 *                     da estampa na folha de DTF (ex.: folha 57 × 100 cm = R$ 50,00).
 * Preço vazio ou zero = sem preço (não aparece para o cliente).
 */

import { MODELOS, MALHAS } from './config.js';

/** Padrão: sem preços e escondido até a loja preencher. */
export const PRECOS_PADRAO = {
  mostrar: false,   // mostrar preços para o cliente
  base: {},         // { 'Masculina': { '100% algodão': 59.9, … }, … }
  tamanhos: {},     // { 'Masculina': { 'X1': 5, … }, … }  acréscimo por tamanho
  costas: 0,        // acréscimo por peça com estampa na frente e nas costas
  texto: 0,         // acréscimo por texto, por peça
  dtf: {},          // custo do DTF (ver DTF_PADRAO)
  usarMinimo: false,// preço mínimo por peça estampada ligado?
  minimo: {}        // { 'Masculina': { '100% algodão': 69.97, … }, … }
};

/** DTF terceirizado: folha (cm) e valor; margem (%) e mínimo por estampa opcionais. */
export const DTF_PADRAO = { ativo: true, largura: 57, altura: 100, valor: 50, margem: 0, minimo: 0 };

/** Configuração de preços (com os padrões). */
export const precosDe = cfg => ({ ...PRECOS_PADRAO, ...(cfg?.precos || {}) });

const n = v => (Number.isFinite(+v) && +v > 0 ? +v : 0);

/** "R$ 59,90" */
export const dinheiro = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Configuração do DTF (com os padrões). */
export const dtfDe = cfg => ({ ...DTF_PADRAO, ...(precosDe(cfg).dtf || {}) });

/** O tamanho t usa a estampa infantil (menor)? */
const ehInfantil = (modeloId, t) => !!t && !!MODELOS.find(m => m.id === modeloId)?.infantil?.tamanhos?.includes(t);
const escalaInf = modeloId => {
  const m = MODELOS.find(x => x.id === modeloId);
  return m?.infantil ? Math.min(m.infantil.w / m.area.w, m.infantil.h / m.area.h) : 1;
};

/**
 * Custo do DTF de uma estampa: área da estampa ÷ área da folha × valor da folha
 * (+ margem), nunca menos que o mínimo. 0 se o DTF estiver desligado.
 * @param {{cm: number, w: number, h: number}} a - estampa (largura em cm e proporção)
 * @param {string} [t] - tamanho da camiseta (infantis usam a estampa menor)
 */
export function custoEstampa(cfg, modeloId, a, t) {
  const d = dtfDe(cfg);
  if (!d.ativo || !a?.cm || !a.w || !a.h) return 0;
  const folha = n(d.largura) * n(d.altura);
  if (!folha || !n(d.valor)) return 0;
  const k = ehInfantil(modeloId, t) ? escalaInf(modeloId) : 1;
  const w = a.cm * k, h = w * a.h / a.w;
  const v = (w * h) / folha * n(d.valor) * (1 + n(d.margem) / 100);
  return Math.round(Math.max(v, n(d.minimo)) * 100) / 100;
}

/** Custo do DTF de todas as estampas de uma peça. */
export const custoEstampas = (cfg, it, t) => (it.artes || []).reduce((s, a) => s + custoEstampa(cfg, it.modelo, a, t), 0);

/** Mostrar o custo de cada estampa para o cliente? */
export const mostrarCustoDtf = cfg => !!precosDe(cfg).mostrar && dtfDe(cfg).ativo && n(dtfDe(cfg).valor) > 0;

/** Preço base de um modelo numa malha (0 = sem preço). */
export const precoBase = (cfg, modeloId, malhaId) => n(precosDe(cfg).base?.[modeloId]?.[malhaId]);

/** Acréscimo de um tamanho. */
export const acrescimoTamanho = (cfg, modeloId, t) => +(precosDe(cfg).tamanhos?.[modeloId]?.[t]) || 0;

/** O cliente vê preços? (ligado no administrador e com algum preço preenchido) */
export function mostrarPrecos(cfg) {
  const p = precosDe(cfg);
  return !!p.mostrar && MODELOS.some(m => MALHAS.some(x => precoBase(cfg, m.id, x.id) > 0));
}

/** Menor preço do modelo ("a partir de"). */
export function aPartirDe(cfg, modeloId) {
  const v = MALHAS.map(x => precoBase(cfg, modeloId, x.id)).filter(Boolean);
  return v.length ? Math.min(...v) : 0;
}

/** Tem imagem/arte nos dois lados? (os textos são cobrados à parte) */
const doisLados = it => ['Frente', 'Costas'].every(l => (it.artes || []).some(a => a.lado === l && a.tipo !== 'texto'));

/** Acréscimo de um texto, por peça. */
export const precoTexto = cfg => n(precosDe(cfg).texto);
const qtdTextos = it => (it.artes || []).filter(a => a.tipo === 'texto').length;

/** Preço mínimo de uma peça estampada do modelo/malha (0 = sem mínimo). */
export const precoMinimo = (cfg, modeloId, malhaId) => (precosDe(cfg).usarMinimo ? n(precosDe(cfg).minimo?.[modeloId]?.[malhaId]) : 0);

/** Valor da peça estampada respeitando o preço mínimo do produto. */
export const aplicarMinimo = (cfg, modeloId, malhaId, v) => (v > 0 ? Math.max(v, precoMinimo(cfg, modeloId, malhaId)) : v);

/** Preço de uma peça do item no tamanho t (0 = sem preço). */
export function precoPeca(cfg, it, t) {
  const proprio = it.modo === 'pronta' ? n(it.precoPronta) : 0;
  const base = proprio || precoBase(cfg, it.modelo, it.malha);
  if (!base) return 0;
  const costas = !proprio && doisLados(it) ? n(precosDe(cfg).costas) : 0;
  // DTF: todas as estampas (na pronta com preço próprio, só os textos que o cliente pôs)
  const dtf = proprio ? custoEstampas(cfg, { ...it, artes: (it.artes || []).filter(a => a.tipo === 'texto') }, t) : custoEstampas(cfg, it, t);
  let v = Math.max(0, base + costas + dtf + precoTexto(cfg) * qtdTextos(it) + acrescimoTamanho(cfg, it.modelo, t));
  // Preço mínimo por peça estampada (ex.: tudo abaixo de R$ 69,97 sai por R$ 69,97)
  if ((it.artes || []).length) v = aplicarMinimo(cfg, it.modelo, it.malha, v);
  return Math.round(v * 100) / 100;
}

/** Preço "por peça" sem acréscimo de tamanho (para mostrar enquanto monta). */
export const precoItem = (cfg, it) => precoPeca(cfg, { ...it }, null);

/**
 * Valor do item: linhas por tamanho e total.
 * @returns {{linhas: {t: string, qtd: number, unit: number, sub: number}[], total: number, completo: boolean}}
 */
export function valorItem(cfg, it) {
  const linhas = Object.entries(it.quantidades || {}).filter(([, q]) => q > 0)
    .map(([t, qtd]) => { const unit = precoPeca(cfg, it, t); return { t, qtd, unit, sub: unit * qtd }; });
  return { linhas, total: linhas.reduce((s, l) => s + l.sub, 0), completo: linhas.every(l => l.unit > 0) };
}

/** Total de vários itens. */
export const valorTotal = (cfg, itens) => itens.reduce((s, it) => s + valorItem(cfg, it).total, 0);
