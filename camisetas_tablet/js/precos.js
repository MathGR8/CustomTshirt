/**
 * @module precos
 * @description Preços das camisetas (editados na área do administrador, aba "Preços").
 *
 * Preço de uma peça = preço do modelo na malha escolhida
 *                     (ou o preço próprio da camiseta pronta, se a loja definiu)
 *                   + acréscimo do tamanho (ex.: X1 a X8)
 *                   + acréscimo "frente e costas" (quando tem imagem/arte nos dois lados;
 *                     não vale para camiseta pronta com preço próprio)
 *                   + acréscimo de cada texto (vale também para a camiseta pronta).
 * Preço vazio ou zero = sem preço (não aparece para o cliente).
 */

import { MODELOS, MALHAS } from './config.js';

/** Padrão: sem preços e escondido até a loja preencher. */
export const PRECOS_PADRAO = {
  mostrar: false,   // mostrar preços para o cliente
  base: {},         // { 'Masculina': { '100% algodão': 59.9, … }, … }
  tamanhos: {},     // { 'Masculina': { 'X1': 5, … }, … }  acréscimo por tamanho
  costas: 0,        // acréscimo por peça com estampa na frente e nas costas
  texto: 0          // acréscimo por texto, por peça
};

/** Configuração de preços (com os padrões). */
export const precosDe = cfg => ({ ...PRECOS_PADRAO, ...(cfg?.precos || {}) });

const n = v => (Number.isFinite(+v) && +v > 0 ? +v : 0);

/** "R$ 59,90" */
export const dinheiro = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

/** Preço de uma peça do item no tamanho t (0 = sem preço). */
export function precoPeca(cfg, it, t) {
  const proprio = it.modo === 'pronta' ? n(it.precoPronta) : 0;
  const base = proprio || precoBase(cfg, it.modelo, it.malha);
  if (!base) return 0;
  const costas = !proprio && doisLados(it) ? n(precosDe(cfg).costas) : 0;
  return Math.max(0, base + costas + precoTexto(cfg) * qtdTextos(it) + acrescimoTamanho(cfg, it.modelo, t));
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
