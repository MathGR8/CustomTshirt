/**
 * @module fontes
 * @description De onde vem a arte além do catálogo da loja:
 *  - arte enviada pelo cliente (arquivo do tablet, pendrive, Google Drive…)
 *  - imagem da internet (busca no Openverse: só imagens com licença que
 *    permite uso comercial e modificação)
 * E a avaliação de qualidade para impressão (vetor ou DPI no tamanho escolhido).
 *
 * A busca e o download passam pelo próprio Worker do site (/api/busca e
 * /api/imagem, ver worker/index.js), que evita bloqueios entre sites (CORS).
 */

/** DPI mínimos para cada nível de qualidade no tamanho escolhido. */
export const DPI = { boa: 220, aceitavel: 150 };

/**
 * Qualidade de impressão de uma arte colocada (largura `a.cm`).
 * Artes do catálogo da loja não são avaliadas (a loja imprime do original).
 * @returns {null | {nivel: 'otima'|'boa'|'media'|'baixa'|'verificar', rotulo, texto, dpi?, cmBom?}}
 */
export function qualidade(a, cm = a.cm) {
  if (!a.origem || a.origem === 'catalogo') return null;
  if (a.vetor) return { nivel: 'otima', rotulo: 'Ótima (vetor)', texto: 'Arte em vetor: fica nítida em qualquer tamanho.' };
  if (a.pdfComImagem) return { nivel: 'verificar', rotulo: 'Verificar', texto: 'PDF com imagem dentro: o atendente vai conferir a qualidade.' };
  if (!a.pxW) return null;
  const dpi = Math.round(a.pxW / (cm / 2.54));
  const cmBom = Math.floor(a.pxW / DPI.boa * 2.54);
  if (dpi >= DPI.boa) return { nivel: 'boa', rotulo: `Boa (${dpi} dpi)`, texto: 'Boa resolução para este tamanho.', dpi, cmBom };
  if (dpi >= DPI.aceitavel) return { nivel: 'media', rotulo: `Aceitável (${dpi} dpi)`, texto: cmBom >= 5
    ? `Pode perder um pouco de nitidez. Para ficar boa, use até ${cmBom} cm.`
    : 'Imagem pequena: só fica boa em estampas bem pequenas. Para uma estampa maior, envie um arquivo maior ou em vetor.', dpi, cmBom };
  return { nivel: 'baixa', rotulo: `Baixa (${dpi} dpi)`, texto: cmBom >= 5
    ? `Pode ficar borrada/pixelada. Diminua para até ${cmBom} cm ou envie um arquivo melhor (de preferência em vetor).`
    : 'Imagem pequena demais: vai ficar borrada/pixelada. Envie um arquivo maior, de preferência em vetor (PDF ou SVG).', dpi, cmBom };
}

/** Ícone de cada nível (icons.js). */
export const ICONE_QUALIDADE = { otima: 'estrela', boa: 'check', media: 'ajuda', baixa: 'fechar', verificar: 'olho' };

// ---------- Busca na internet ----------

/**
 * Busca imagens com licença livre para uso comercial.
 * @param {string} termo
 * @param {{vetor?: boolean, pagina?: number}} opc
 * @returns {Promise<{total: number, resultados: Array}>}
 */
export async function buscarImagens(termo, { vetor = false, pagina = 1 } = {}) {
  const p = new URLSearchParams({ q: termo, pagina: String(pagina) });
  if (vetor) p.set('vetor', '1');
  let r;
  try { r = await fetch('api/busca?' + p); }
  catch { throw new Error('Sem internet no momento. Tente de novo ou escolha uma arte do catálogo.'); }
  if (!r.ok) throw new Error('A busca está indisponível agora. Tente de novo em instantes.');
  return r.json();
}

/** Baixa a imagem em tamanho original (pelo Worker). @returns {Promise<File>} */
export async function baixarImagem(res) {
  const r = await fetch('api/imagem?u=' + encodeURIComponent(res.url));
  if (!r.ok) throw new Error('Não foi possível baixar esta imagem. Escolha outra.');
  const blob = await r.blob();
  const ext = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[blob.type.split(';')[0]] || (res.tipo || 'jpg');
  const nome = (res.titulo || 'imagem').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'imagem';
  return new File([blob], `${nome}.${ext}`, { type: blob.type });
}

/** Texto do crédito/licença de uma imagem da internet. */
export function credito(f) {
  if (!f) return '';
  return [f.autor && `por ${f.autor}`, f.licenca, f.origem && `(${f.origem})`].filter(Boolean).join(' · ');
}
