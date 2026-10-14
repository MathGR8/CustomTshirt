/**
 * @module medidas
 * @description Tabelas de medidas das camisetas (em cm) e a janela que mostra
 * a tabela com o desenho da camiseta indicando cada medida.
 *
 * >>> Para atualizar as medidas, altere TABELAS abaixo <<<
 */

import { camisetaSVG, VB } from './shirt.js';
import { MODELOS } from './config.js';
import { janela, esc } from './ui.js';
import { icone } from './icons.js';

/** Medidas em cm. Cada linha: [tamanho, ...valores na ordem de "colunas"]. */
export const TABELAS = {
  'Masculina': [{
    nome: 'Masculina', colunas: ['Largura', 'Altura', 'Manga'],
    linhas: [['P', 49, 69, 20], ['M', 52, 72, 22], ['G', 55, 74, 23], ['GG', 58, 77, 23],
             ['X1', 60, 79, 23], ['X2', 64, 81, 23], ['X3', 68, 81, 24], ['X4', 71, 81, 25],
             ['X5', 74, 83, 26], ['X6', 79, 86, 28], ['X7', 83, 88, 28], ['X8', 86, 90, 28]],
    // Nome alternativo do tamanho (X1 = G1…)
    apelidos: { X1: 'G1', X2: 'G2', X3: 'G3', X4: 'G4', X5: 'G5', X6: 'G6', X7: 'G7', X8: 'G8' }
  }],
  'Feminina': [{
    nome: 'Feminina', colunas: ['Altura', 'Largura', 'Cintura'],
    linhas: [['P', 59, 44, 40], ['M', 61, 46, 42], ['G', 63, 49, 45], ['GG', 65, 51, 48]]
  }],
  'Infantil/Juvenil': [
    { nome: 'Infantil', colunas: ['Altura', 'Largura'], linhas: [['01', 37, 28], ['02', 41, 30], ['04', 45, 32], ['06', 49, 34]] },
    { nome: 'Juvenil', colunas: ['Altura', 'Largura'], linhas: [['08', 53, 36], ['10', 54, 40], ['12', 58, 43], ['14', 63, 46]] }
  ]
};

/** Letra de cada medida no desenho. */
const LETRA = { Largura: 'L', Altura: 'A', Manga: 'M', Cintura: 'C' };

/** Medidas de um tamanho: { Largura: 52, Altura: 72, … } ou null. */
export function medidasDoTamanho(modeloId, tamanho) {
  for (const t of TABELAS[modeloId] || []) {
    const l = t.linhas.find(x => x[0] === tamanho);
    if (l) return Object.fromEntries(t.colunas.map((c, i) => [c, l[i + 1]]));
  }
  return null;
}

/** Texto curto para o cartão do tamanho: "L 52 × A 72 cm". */
export function resumoMedidas(modeloId, tamanho) {
  const m = medidasDoTamanho(modeloId, tamanho);
  return m ? `L ${m.Largura} × A ${m.Altura} cm` : '';
}

/** Linhas (setas) das medidas sobre o desenho de cada corte: [x1, y1, x2, y2, xLetra, yLetra]. */
function setas(modeloId, colunas) {
  const s = modeloId === 'Feminina'
    ? { L: [244, 345, 756, 345, 430, 300], A: [630, 100, 630, 1048, 676, 760], C: [266, 580, 734, 580, 430, 535] }
    : { L: [212, 380, 788, 380, 430, 335], A: [640, 92, 640, 1044, 686, 760], M: [738, 232, 900, 440, 870, 300] };
  const seta = (k, [x1, y1, x2, y2, tx, ty]) => `<g class="seta">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-start="url(#pontaM)" marker-end="url(#pontaM)"/>
      <circle cx="${tx}" cy="${ty}" r="34"/><text x="${tx}" y="${ty + 14}">${k}</text></g>`;
  return `<defs><marker id="pontaM" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z"/></marker></defs>
    ${Object.entries(s).filter(([k]) => colunas.some(c => LETRA[c] === k)).map(([k, v]) => seta(k, v)).join('')}`;
}

/**
 * Janela com as tabelas de medidas.
 * @param {string} modeloId - modelo aberto primeiro
 * @param {string} [destaque] - tamanho a destacar na tabela
 */
export function abrirTabela(modeloId = 'Masculina', destaque = null) {
  let atual = modeloId;
  const j = janela({ titulo: `${icone('regua')} Tabela de medidas`, classe: 'janelaMedidas', html: `
    <div class="segmento abasMedidas" role="tablist">${MODELOS.map(m => `<button type="button" data-m="${esc(m.id)}">${esc(m.nome)}</button>`).join('')}</div>
    <div class="medidasCorpo" id="medidasCorpo"></div>
    <p class="dicaPequena">Medidas da peça (camiseta esticada sobre a mesa), em centímetros. Pode variar cerca de 2 cm.</p>` });
  const pintar = () => {
    j.el.querySelectorAll('[data-m]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === atual)));
    const tabelas = TABELAS[atual] || [];
    const colunas = [...new Set(tabelas.flatMap(t => t.colunas))];
    j.el.querySelector('#medidasCorpo').innerHTML = `
      <figure class="desenhoMedidas">
        <svg viewBox="0 0 ${VB.w} ${VB.h}" role="img" aria-label="Como medir">
          ${camisetaSVG({ modelo: atual, lado: 'Frente', cor: 'Branco' })}${setas(atual, colunas)}
        </svg>
        <figcaption>${colunas.map(c => `<span><b>${LETRA[c]}</b> ${c}</span>`).join('')}</figcaption>
      </figure>
      <div class="tabelasMedidas">${tabelas.map(t => `
        <table class="tabelaMedidas">
          ${tabelas.length > 1 ? `<caption>${esc(t.nome)}</caption>` : ''}
          <thead><tr><th>Tamanho</th>${t.colunas.map(c => `<th><b>${LETRA[c]}</b> ${c}</th>`).join('')}</tr></thead>
          <tbody>${t.linhas.map(([tam, ...v]) => `
            <tr class="${tam === destaque ? 'destaque' : ''}"><th>${tam}${t.apelidos?.[tam] ? ` <small>/ ${t.apelidos[tam]}</small>` : ''}</th>${v.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>`).join('')}
      </div>`;
    j.el.querySelector('tr.destaque')?.scrollIntoView({ block: 'center' });
  };
  j.el.querySelectorAll('[data-m]').forEach(b => (b.onclick = () => { atual = b.dataset.m; destaque = null; pintar(); }));
  pintar();
  return j.aoFechar;
}
