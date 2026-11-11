/**
 * @module calibragem
 * @description Área de impressão ajustada à mão (modo desenvolvedor).
 *
 * O arquivo calibragem.json (na pasta do site) guarda onde fica a área de
 * impressão sobre a imagem da camiseta, por modelo e lado, e — quando a foto
 * de uma cor é diferente das outras — também por cor:
 *
 *   { "versao": 2, "areas": {
 *       "Feminina": {
 *         "Frente": { "x": 0.33, "y": 0.21, "w": 0.34 },          ← todas as cores
 *         "cores": { "Branco": { "Frente": { "x": …, "y": …, "w": … } } }  ← só esta cor
 *       } } }
 *
 * x, y = canto superior esquerdo e w = largura, em frações (0–1) da imagem.
 * A altura vem da proporção da área em cm (ex.: 30 × 35 cm). Como a área
 * representa medidas reais, a largura também define a escala das estampas.
 *
 * Ordem de uso: ajuste da cor → ajuste do modelo (todas as cores) → medição
 * automática (medidaCamiseta.js). No modo desenvolvedor, os ajustes salvos no
 * navegador valem por cima do arquivo publicado, até serem publicados.
 */

const CHAVE_LOCAL = 'artrock_calibragem_dev';
let publicado = {};
let local = null;    // só no modo desenvolvedor
let usarLocal = false;

const copia = o => JSON.parse(JSON.stringify(o || {}));
const valida = a => (a && isFinite(a.x) && isFinite(a.y) && a.w > 0 ? a : null);
const arred = a => ({ x: +a.x.toFixed(4), y: +a.y.toFixed(4), w: +a.w.toFixed(4) });

export const Calibragem = {
  /** Lê o calibragem.json publicado (e, no modo dev, o rascunho do navegador). */
  async carregar({ dev = false } = {}) {
    usarLocal = dev;
    try {
      const r = await fetch('calibragem.json', { cache: 'no-store' });
      if (r.ok) publicado = (await r.json())?.areas || {};
    } catch { /* sem arquivo: tudo automático */ }
    if (dev) {
      try { local = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || 'null'); } catch { local = null; }
    }
  },

  /** Áreas em uso (rascunho do navegador no modo dev, senão o publicado). */
  areas() { return usarLocal && local ? local : publicado; },

  /**
   * Área ajustada de um modelo/lado (e cor), ou null (automático).
   * @param {string} [cor] - com cor, procura primeiro o ajuste só desta cor.
   */
  area(categoria, lado, cor) {
    const m = this.areas()?.[categoria];
    return valida(cor && m?.cores?.[cor]?.[lado]) || valida(m?.[lado]);
  },

  /** De onde vem a área em uso: 'cor', 'modelo' ou null (automática). */
  origem(categoria, lado, cor) {
    const m = this.areas()?.[categoria];
    return valida(cor && m?.cores?.[cor]?.[lado]) ? 'cor' : valida(m?.[lado]) ? 'modelo' : null;
  },

  /**
   * Altera (no rascunho) a área de um modelo/lado; null tira o ajuste.
   * @param {string|null} cor - com cor, o ajuste vale só para ela.
   */
  definir(categoria, lado, area, cor = null) {
    if (!local) local = copia(publicado);
    const m = (local[categoria] = local[categoria] || {});
    if (cor) {
      m.cores = m.cores || {};
      const c = (m.cores[cor] = m.cores[cor] || {});
      if (area) c[lado] = arred(area); else delete c[lado];
      if (!Object.keys(c).length) delete m.cores[cor];
      if (!Object.keys(m.cores).length) delete m.cores;
    } else if (area) m[lado] = arred(area);
    else delete m[lado];
    if (!Object.keys(m).length) delete local[categoria];
  },

  /** Guarda o rascunho no navegador. */
  salvarLocal() {
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(local || copia(publicado))); return true; } catch { return false; }
  },

  /** Descarta o rascunho e volta ao que está publicado. */
  descartarLocal() {
    local = null;
    try { localStorage.removeItem(CHAVE_LOCAL); } catch { /* ok */ }
  },

  /** Há diferença entre o rascunho e o publicado? */
  temRascunho() { return !!local && JSON.stringify(local) !== JSON.stringify(publicado); },

  /** Conteúdo do arquivo calibragem.json para publicar. */
  arquivo() {
    return JSON.stringify({ versao: 2, atualizado: new Date().toISOString().slice(0, 10), areas: this.areas() }, null, 2) + '\n';
  }
};
