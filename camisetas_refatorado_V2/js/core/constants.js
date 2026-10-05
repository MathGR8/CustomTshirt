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
//  LIMITES DE NEGÓCIO
// ============================================================

/** Largura máxima de impressão em centímetros. */
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
    area: { x: 0.160, y: 0.145, w: 0.85, h: 0.90 },
    ONE:  { w: 0.70, h: 1.00 },
    TWO:  { w: 0.50, h: 0.46 }
  },

  /**
   * ÁREA DOS QUADROS (miniaturas) DAS ESTAMPAS. Os quadros sempre preenchem
   * a área inteira, qualquer que seja a quantidade de estampas: a área é
   * dividida na grade (colunas × linhas) em que as estampas ficam maiores.
   * gap = espaço entre quadros (fração da largura do fundo).
   */
  THUMBS: {
    area:  { x: 0.0021, y: 0.48, w: 0.17, h: 0.17 },
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
export const CHEST_PRESET = { cm: 10, centerX: 0.74, top: 0.08 };

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
