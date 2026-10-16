/**
 * @module tabelaMedidasModule
 * @description Janela "Tabela de medidas" (identidade ArtRock).
 *
 * Mostra, para cada modelo, o desenho da camiseta com as medidas (L, A, M/C)
 * e a tabela em centímetros. O tamanho usado como exemplo no preview fica
 * destacado. Os dados ficam em TABELAS_MEDIDAS (constants.js).
 */

import { TABELAS_MEDIDAS, CAMISETA_EXEMPLO } from '../core/constants.js';

const LETRA = { Largura: 'L', Altura: 'A', Manga: 'M', Cintura: 'C' };
const NOMES = { 'Masculina': 'Masculina', 'Feminina': 'Feminina', 'Infantil/Juvenil': 'Infantil / Juvenil' };

// Desenho simples da camiseta (viewBox 1000 × 1100) e onde fica cada seta
const CORTES = {
  tradicional: 'M 390 72 C 425 140, 575 140, 610 72 L 690 96 L 868 166 C 915 245, 950 335, 972 418 L 830 470 C 812 425, 798 385, 790 342 C 794 560, 800 800, 806 1040 C 605 1056, 395 1056, 194 1040 C 200 800, 206 560, 210 342 C 202 385, 188 425, 170 470 L 28 418 C 50 335, 85 245, 132 166 L 310 96 Z',
  feminino: 'M 400 82 C 432 150, 568 150, 600 82 L 676 100 L 812 160 C 852 214, 880 268, 898 322 L 792 372 C 782 348, 772 328, 764 306 C 738 470, 722 560, 744 700 C 762 820, 768 930, 774 1040 C 600 1058, 400 1058, 226 1040 C 232 930, 238 820, 256 700 C 278 560, 262 470, 236 306 C 228 328, 218 348, 208 372 L 102 322 C 120 268, 148 214, 188 160 L 324 100 Z'
};
const SETAS = {
  tradicional: { L: [212, 380, 788, 380, 430, 335], A: [640, 92, 640, 1044, 686, 760], M: [738, 232, 900, 440, 870, 300] },
  feminino:    { L: [244, 345, 756, 345, 430, 300], A: [630, 100, 630, 1048, 676, 760], C: [266, 580, 734, 580, 430, 535] }
};

let dlg = null;

function desenho(cat, colunas) {
  const corte = cat === 'Feminina' ? 'feminino' : 'tradicional';
  const setas = Object.entries(SETAS[corte]).filter(([k]) => colunas.some(c => LETRA[c] === k));
  return `<svg viewBox="0 0 1000 1100" role="img" aria-label="Como medir">
    <defs><marker id="arPonta" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#ED3051"/></marker></defs>
    <path d="${CORTES[corte]}" fill="#f4f6f8" stroke="#111" stroke-width="8" stroke-linejoin="round"/>
    ${setas.map(([k, [x1, y1, x2, y2, tx, ty]]) => `
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ED3051" stroke-width="9" marker-start="url(#arPonta)" marker-end="url(#arPonta)"/>
      <circle cx="${tx}" cy="${ty}" r="38" fill="#111"/><text x="${tx}" y="${ty + 15}" text-anchor="middle" font-size="44" font-weight="900" fill="#fff" font-family="Montserrat, sans-serif">${k}</text>`).join('')}
  </svg>`;
}

export const TabelaMedidasModule = {
  /** Abre a tabela (na categoria escolhida na tela, se não for informada). */
  abrir(categoria) {
    let atual = categoria || document.getElementById('category')?.value || 'Masculina';
    dlg?.remove();
    dlg = document.createElement('dialog');
    dlg.className = 'contactDlg medidasDlg';
    dlg.innerHTML = `
      <div class="dlgHead"><strong>📏 Tabela de medidas</strong>
        <button type="button" class="dlgClose" aria-label="Fechar">✕</button></div>
      <div class="dlgBody">
        <div class="medAbas" role="tablist">${Object.keys(TABELAS_MEDIDAS).map(c => `<button type="button" data-cat="${c}">${NOMES[c] || c}</button>`).join('')}</div>
        <div class="medCorpo" id="medCorpo"></div>
        <p class="dlgHint">Medidas da peça com a camiseta esticada sobre a mesa, em centímetros. Pode variar cerca de 2 cm.
          A linha destacada é o tamanho da camiseta usada como exemplo no preview.</p>
      </div>`;
    document.body.appendChild(dlg);
    const pintar = () => {
      dlg.querySelectorAll('[data-cat]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === atual)));
      const tabelas = TABELAS_MEDIDAS[atual] || [];
      const colunas = [...new Set(tabelas.flatMap(t => t.colunas))];
      const ex = CAMISETA_EXEMPLO[atual]?.tamanho;
      dlg.querySelector('#medCorpo').innerHTML = `
        <figure class="medDesenho">${desenho(atual, colunas)}
          <figcaption>${colunas.map(c => `<span><b>${LETRA[c]}</b> ${c}</span>`).join('')}</figcaption></figure>
        <div class="medTabelas">${tabelas.map(t => `
          <table class="medTabela">
            ${tabelas.length > 1 ? `<caption>${t.nome}</caption>` : ''}
            <thead><tr><th>Tamanho</th>${t.colunas.map(c => `<th><b>${LETRA[c]}</b> ${c}</th>`).join('')}</tr></thead>
            <tbody>${t.linhas.map(([tam, ...v]) => `<tr class="${tam === ex ? 'exemplo' : ''}"><th>${tam}${t.apelidos?.[tam] ? ` <small>/ ${t.apelidos[tam]}</small>` : ''}${tam === ex ? ' <em>exemplo</em>' : ''}</th>${v.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>`).join('')}</div>`;
    };
    dlg.querySelectorAll('[data-cat]').forEach(b => (b.onclick = () => { atual = b.dataset.cat; pintar(); }));
    dlg.querySelector('.dlgClose').onclick = () => dlg.close();
    dlg.addEventListener('close', () => { dlg.remove(); dlg = null; }, { once: true });
    pintar();
    dlg.showModal();
  }
};
