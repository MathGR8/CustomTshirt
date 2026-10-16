/**
 * @module constants
 * @description Centraliza todos os dados estáticos e constantes da aplicação.
 *
 * Responsabilidades:
 *  - Mapas de imagens das camisetas por categoria, cor e lado (BASE_IMAGES).
 *  - Coordenadas relativas da área de impressão na camiseta (SHIRT_PRINT_BOX).
 *  - Imagens base utilizadas na geração do PDF (PDF_BASES).
 *  - Mapeamento de cor para tipo de base PDF (COLOR_BASE_MAP).
 *  - Mapeamento de cor para código hexadecimal (COLOR_HEX).
 *  - Limites máximos de largura de impressão e tamanho de arquivo.
 *
 * Dependências: nenhuma.
 * Módulos relacionados: appState.js, uiModule.js, pdfModule.js, stampModule.js.
 */

// ============================================================
//  IMAGENS BASE DAS CAMISETAS
//  Estrutura: BASE_IMAGES[categoria][cor][lado] = URL
// ============================================================
export const BASE_IMAGES = {
  "Masculina": {
    "Branco":         { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/branca-frente.png",       "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/branca-costas.png" },
    "Preto":          { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/preta-frente.png",        "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/preta-costas.png" },
    "Marinho":        { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/marinho-frente.png",      "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/marinho-costas.png" },
    "Preta Jaguar":   { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/jaguar-frente-2.png",     "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/jaguar-costas-2.png" },
    "Marinho Índigo": { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/indigo-frente-4.png",     "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/indigo-costas.png" },
    "Cinza Mescla":   { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/mescla-frente.png",       "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/mescla-costas.png" },
    "Cinza Grafite":  { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/grafite-frente.png",      "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/grafite-costas.png" }
  },
  "Feminina": {
    "Branco":         { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-feminina-branca-frente2.png",  "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-feminina-branca-costas2.png" },
    "Preto":          { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-feminina-preta-frente.png",   "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-feminina-preta-costas.png" },
    "Marinho":        { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-feminina-marinho-frente.png", "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-feminina-marinho-costas.png" },
    "Preta Jaguar":   { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-feminina-jaguar-frente.png",  "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-feminina-jaguar-costas.png" },
    "Marinho Índigo": { "Frente": "", "Costas": "" },
    "Cinza Mescla":   { "Frente": "", "Costas": "" },
    "Cinza Grafite":  { "Frente": "", "Costas": "" }
  },
  "Infantil/Juvenil": {
    "Branco":         { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/branca-frente.png",       "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/branca-costas.png" },
    "Preto":          { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/preta-frente.png",        "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/preta-costas.png" },
    "Marinho":        { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/marinho-frente.png",      "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/marinho-costas.png" },
    "Preta Jaguar":   { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/jaguar-frente-2.png",     "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/jaguar-costas-2.png" },
    "Marinho Índigo": { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/indigo-frente-4.png",     "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/indigo-costas.png" },
    "Cinza Mescla":   { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/mescla-frente.png",       "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/mescla-costas.png" },
    "Cinza Grafite":  { "Frente": "https://cdn.awsli.com.br/1274/1274265/arquivos/grafite-frente.png",      "Costas": "https://cdn.awsli.com.br/1274/1274265/arquivos/grafite-costas.png" }
  }
};

// ============================================================
//  ÁREA DE IMPRESSÃO NA CAMISETA (coordenadas relativas 0-1)
//  Define o retângulo de impressão como fração do tamanho renderizado da camiseta.
//  Utilizado por PreviewGeom e PDFModule para posicionamento de estampas.
// ============================================================
export const SHIRT_PRINT_BOX = {
  Frente: { x: 0.225, y: 0.15, w: 0.55, h: 0.68 },
  Costas: { x: 0.23,  y: 0.05, w: 0.54, h: 0.78 }
};

// ============================================================
//  ÁREA MÁXIMA DE IMPRESSÃO POR TIPO DE CAMISETA (em cm)
//  >>> AQUI você ajusta o tamanho máximo da estampa <<<
//  w = largura máxima, h = altura máxima. A estampa nunca passa disso.
//
//  No preview, a largura da área tracejada (SHIRT_PRINT_BOX) vale "w" cm e a
//  altura dela é calculada pela proporção w × h.
//
//  Infantil/Juvenil usam a mesma camiseta no preview: a estampa é montada no
//  tamanho JUVENIL e, nas peças infantis, é impressa na mesma posição e
//  proporção, só que reduzida pelo fator "escala" (calculado sozinho para a
//  arte caber em 20 × 24 cm: menor entre 20/30 e 24/35 = 0,667).
// ============================================================
export const AREA_IMPRESSAO = {
  'Masculina':        { w: 38, h: 42, nome: 'Masculina' },
  'Feminina':         { w: 30, h: 35, nome: 'Feminina' },
  'Infantil/Juvenil': { w: 30, h: 35, nome: 'Juvenil', tamanhos: ['08', '10', '12', '14'],
                        infantil: { w: 20, h: 24, nome: 'Infantil', tamanhos: ['01', '02', '04', '06'] } }
};

// ============================================================
//  CAMISETA DO EXEMPLO (escala real do preview)
//  >>> A camiseta do preview representa este tamanho <<<
//  largura e altura em cm (da tabela de medidas). O app mede a camiseta na
//  imagem e desenha a área de impressão na mesma proporção.
// ============================================================
export const CAMISETA_EXEMPLO = {
  'Masculina':        { tamanho: 'G',  largura: 55, altura: 74 },
  'Feminina':         { tamanho: 'G',  largura: 49, altura: 63 },
  'Infantil/Juvenil': { tamanho: '12', largura: 43, altura: 58 }
};

/**
 * Distância (cm) do alto do ombro até o começo da área de impressão.
 * Na frente a gola é mais funda; nas costas, mais rasa.
 */
export const TOPO_AREA_CM = {
  'Masculina':        { Frente: 9, Costas: 6 },
  'Feminina':         { Frente: 9, Costas: 6 },
  'Infantil/Juvenil': { Frente: 7, Costas: 5 }
};

/**
 * TABELAS DE MEDIDAS (cm). Cada linha: [tamanho, ...valores na ordem de "colunas"].
 * >>> Para atualizar as medidas, altere aqui <<<
 */
export const TABELAS_MEDIDAS = {
  'Masculina': [{
    nome: 'Masculina', colunas: ['Largura', 'Altura', 'Manga'],
    linhas: [['P', 49, 69, 20], ['M', 52, 72, 22], ['G', 55, 74, 23], ['GG', 58, 77, 23],
             ['X1', 60, 79, 23], ['X2', 64, 81, 23], ['X3', 68, 81, 24], ['X4', 71, 81, 25],
             ['X5', 74, 83, 26], ['X6', 79, 86, 28], ['X7', 83, 88, 28], ['X8', 86, 90, 28]],
    apelidos: { X1: 'G1', X2: 'G2', X3: 'G3', X4: 'G4', X5: 'G5', X6: 'G6', X7: 'G7', X8: 'G8' }
  }],
  'Feminina': [{
    nome: 'Feminina', colunas: ['Altura', 'Largura', 'Cintura'],
    linhas: [['P', 59, 44, 40], ['M', 61, 46, 42], ['G', 63, 49, 45], ['GG', 65, 51, 48]]
  }],
  'Infantil/Juvenil': [
    { nome: 'Infantil', colunas: ['Altura', 'Largura'], linhas: [['01', 37, 28], ['02', 41, 30], ['04', 45, 32], ['06', 49, 34]] },
    { nome: 'Juvenil',  colunas: ['Altura', 'Largura'], linhas: [['08', 53, 36], ['10', 54, 40], ['12', 58, 43], ['14', 63, 46]] }
  ]
};

// ============================================================
//  LIMITES DE NEGÓCIO
// ============================================================

/** Maior largura de impressão entre todas as camisetas (cm). */
export const MAX_PRINT_WIDTH_CM = 38;

/** Tamanho máximo de arquivo de estampa em megabytes. */
export const MAX_FILE_SIZE_MB = 100;

// ============================================================
//  IMAGENS BASE PARA O PDF
//  Estrutura: PDF_BASES[baseKind][categoria][lado] = URL
//  baseKind: 'white' para camisetas claras, 'black' para escuras.
// ============================================================
export const PDF_BASES = {
  white: {
    Masculina: {
      Frente: "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-branca---frente.png",
      Costas: "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-branca---costas.png"
    },
    Feminina: {
      Frente: "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-feminina-branca-frente-5.png",
      Costas: "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-feminina-branca-costas-5.png"
    }
  },
  black: {
    Masculina: {
      Frente: "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-preta---frente---sem-fundo.png",
      Costas: "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-preta---costas---sem-fundo.png"
    },
    Feminina: {
      Frente: "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-feminina-frente.png",
      Costas: "https://cdn.awsli.com.br/1274/1274265/arquivos/camiseta-feminina-costas.png"
    }
  }
};

// ============================================================
//  MAPEAMENTO DE COR → TIPO DE BASE DO PDF
//  Determina qual conjunto de imagens base usar no PDF.
// ============================================================
export const COLOR_BASE_MAP = {
  "Preto":          "black",
  "Marinho":        "black",
  "Preta Jaguar":   "black",
  "Cinza Grafite":  "black",
  "Branco":         "white",
  "Cinza Mescla":   "white"
};

// ============================================================
//  MAPEAMENTO DE COR → HEXADECIMAL
//  Utilizado para aplicar a cor da camiseta no canvas do PDF.
// ============================================================
export const COLOR_HEX = {
  "Preto":          "#000000",
  "Branco":         "#ffffff",
  "Marinho":        "#0a1f44",
  "Cinza Mescla":   "#c7c7c7",
  "Cinza Grafite":  "#3a3a3a",
  "Vermelho":       "#b1001a",
  "Azul Royal":     "#1546ff",
  "Verde":          "#0c7c34",
  "Amarelo":        "#ffc400",
  "Preta Jaguar":   "#000000",
  "Marinho Índigo": "#0b2e5a"
};

// ============================================================
//  LAYOUT DO PDF (página visual de cada item)
//  >>> AQUI você ajusta áreas e tamanhos no PDF <<<
//
//  Todas as medidas são FRAÇÕES (0 a 1) do fundo do layout do PDF:
//    x = distância da borda esquerda   y = distância do topo
//    w = largura                       h = altura
// ============================================================
export const PDF_LAYOUT = {
  /**
   * ÁREA DAS CAMISETAS. As camisetas se distribuem dentro dela sozinhas:
   *  - só 1 face com estampa → 1 camiseta centralizada (tamanho ONE)
   *  - Frente e Costas       → em diagonal: Frente no canto superior
   *                            esquerdo e Costas no canto inferior direito
   *                            (tamanho TWO de cada uma)
   * ONE e TWO são frações da própria área (a camiseta nunca é deformada).
   */
  SHIRTS: {
    area: { x: 0.205, y: 0.250, w: 0.80, h: 0.70 },
    ONE:  { w: 0.65, h: 0.65 },
    TWO:  { w: 0.62, h: 0.62 },

    /**
     * AJUSTES POR CATEGORIA (opcional). Qualquer valor colocado aqui substitui
     * o padrão acima só para aquela categoria: area, ONE, TWO e juntar.
     *
     * juntar (só com Frente e Costas) — de 0 a 1, quanto aproximar as duas:
     *   0   = Frente encostada à esquerda e Costas à direita (padrão; bom para
     *         camisetas largas, como a masculina)
     *   0.5 = cada camiseta no meio da sua caixa (vão menor)
     *   1   = as duas o mais perto possível uma da outra
     *   A camiseta feminina é mais estreita, então sobra espaço na caixa e,
     *   com 0, fica um vão grande entre Frente e Costas.
     *
     * Exemplo: Feminina: { juntar: 0.6, TWO: { w: 0.55, h: 0.62 } }
     */
    CATEGORIAS: {
      Feminina: { juntar: 0.5 }
    }
  },

  /**
   * ÁREA DOS QUADROS (miniaturas) DAS ESTAMPAS. Os quadros sempre preenchem
   * a área inteira, qualquer que seja a quantidade de estampas: a área é
   * dividida na grade (colunas × linhas) em que as estampas ficam maiores.
   * gap = espaço entre quadros (fração da largura do fundo).
   */
  THUMBS: {
    area:  { x: 0.0021, y: 0.48, w: 0.20, h: 0.50 },
    gap:   0.007
  }
};

// ============================================================
//  PRÉ-POSICIONAMENTO "PEITO"
//  cm      = largura da estampa (10 cm)
//  centerX = centro horizontal na área de impressão (0.74 = lado direito
//            da visualização, onde fica o peito esquerdo de quem veste)
//  top     = distância do topo da área de impressão (0.08 = um pouco abaixo)
// ============================================================
export const CHEST_PRESET = { cm: 10, centerX: 0.74, top: 0.12 };

// ============================================================
//  ATENDIMENTO (WhatsApp)
//  number  = número do atendimento, só dígitos com DDI + DDD
//            (55 = Brasil, 12 = DDD). >>> Troque aqui pelo número oficial <<<
//  message = mensagem padrão (o cliente pode editar antes de enviar)
// ============================================================
export const WHATSAPP = {
  number:  '5512982780352',
  message: 'Olá, finalizei minha personalização e gostaria de fazer uma cotação!'
};
