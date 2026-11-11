/**
 * @module calibragem
 * @description Área de impressão ajustada à mão (modo desenvolvedor).
 *
 * O arquivo calibragem.json (na pasta do site) guarda, para cada modelo e
 * lado, onde fica a área de impressão sobre a imagem da camiseta:
 *
 *   { "versao": 1, "areas": { "Feminina": { "Frente": { "x": 0.33, "y": 0.21, "w": 0.34 } } } }
 *
 * x, y = canto superior esquerdo e w = largura, em frações (0–1) da imagem.
 * A altura vem da proporção da área em cm (ex.: 30 × 35 cm). Como a área
 * representa medidas reais, a largura também define a escala das estampas.
 *
 * Quem não tem ajuste usa a medição automática (medidaCamiseta.js).
 * No modo desenvolvedor, os ajustes salvos no navegador valem por cima do
 * arquivo publicado, até serem publicados.
 */

const CHAVE_LOCAL = 'artrock_calibragem_dev';
let publicado = {};
let local = null;    // só no modo desenvolvedor
let usarLocal = false;

const copia = o => JSON.parse(JSON.stringify(o || {}));

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

  /** Área ajustada de um modelo/lado, ou null (automático). */
  area(categoria, lado) {
    const a = this.areas()?.[categoria]?.[lado];
    return a && isFinite(a.x) && isFinite(a.y) && a.w > 0 ? a : null;
  },

  /** Altera (no rascunho) a área de um modelo/lado; null volta ao automático. */
  definir(categoria, lado, area) {
    if (!local) local = copia(publicado);
    local[categoria] = local[categoria] || {};
    if (area) local[categoria][lado] = { x: +area.x.toFixed(4), y: +area.y.toFixed(4), w: +area.w.toFixed(4) };
    else delete local[categoria][lado];
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
    return JSON.stringify({ versao: 1, atualizado: new Date().toISOString().slice(0, 10), areas: this.areas() }, null, 2) + '\n';
  }
};
