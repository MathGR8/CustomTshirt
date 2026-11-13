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
// ============================================================
//  SILHUETA DAS IMAGENS DA LOJA, MEDIDA À MÃO
//  O CDN da loja não libera a leitura das imagens (CORS), então o navegador
//  não consegue medir a camiseta sozinho. Frações (0–1) da imagem:
//  topo/base = ombro/barra; esq/dir = mangas; corpoEsq/corpoDir = peito logo
//  abaixo das axilas (= largura da tabela de medidas).
//  Feminina: medida nos prints da loja (todas as cores usam a mesma foto-base).
// ============================================================
export const SILHUETA_LOJA = {
  'Feminina': {
    Frente: { topo: 0.11, base: 0.878, esq: 0.112, dir: 0.884, corpoEsq: 0.226, corpoDir: 0.774 },
    Costas: { topo: 0.11, base: 0.878, esq: 0.114, dir: 0.884, corpoEsq: 0.226, corpoDir: 0.774 }
  }
};

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
  message: 'Olá, finalizei minha personalização e gostaria de um orçamento!'
};

// ============================================================
//  ENVIO DO PEDIDO PARA A CONFECÇÃO (app do tablet)
//  url = endereço do app do tablet (o mesmo que abre a confecção), ex.:
//        'https://camisetas-tablet.SEU-USUARIO.workers.dev'
//  Com o endereço, a janela final oferece "Enviar pedido para a Art Rock":
//  o pedido (dados, PDF e artes) chega no painel da confecção com a
//  etiqueta "Art Rock", número AR-0001… e aviso no celular/computador.
//  Vazio = só o WhatsApp, como antes.
// ============================================================
export const CONFECCAO = {
  url: 'https://camisetas-tablet.matheusmdn.workers.dev'
};

// ============================================================
//  FOTOS COM MODELO (visualização "No modelo")
//  MODELO_FOTOS[categoria][cor][lado] = foto + medidas da camiseta na foto
//  (frações da foto): topo = alto do ombro junto à gola, base = barra,
//  corpoEsq/corpoDir = largura do corpo abaixo das axilas, quadro = parte
//  da foto mostrada (cabeça até a barra). Com essas medidas a área de
//  impressão e as estampas ficam na escala real (cm) sobre a foto.
//  Cor/lado sem foto: mostra a camiseta sozinha.
//  Para incluir uma foto: coloque em img/modelo/ e meça como as outras.
// ============================================================
export const MODELO_FOTOS = {
  "Feminina": {
    "Branco": {
      "Costas": {
        "src": "img/modelo/feminina-branco-costas.jpg",
        "topo": 0.27,
        "base": 0.61,
        "corpoEsq": 0.3373,
        "corpoDir": 0.5307,
        "quadro": {
          "x0": 0.231,
          "x1": 0.637,
          "y0": 0.005,
          "y1": 0.67
        }
      },
      "Frente": {
        "src": "img/modelo/feminina-branco-frente.jpg",
        "topo": 0.34,
        "base": 0.88,
        "corpoEsq": 0.338,
        "corpoDir": 0.632,
        "quadro": {
          "x0": 0.176,
          "x1": 0.794,
          "y0": 0.006,
          "y1": 0.94
        }
      }
    },
    "Preta Jaguar": {
      "Costas": {
        "src": "img/modelo/feminina-jaguar-costas.jpg",
        "topo": 0.29,
        "base": 0.72,
        "corpoEsq": 0.267,
        "corpoDir": 0.677,
        "quadro": {
          "x0": 0.041,
          "x1": 0.903,
          "y0": 0.022,
          "y1": 0.78
        }
      },
      "Frente": {
        "src": "img/modelo/feminina-jaguar-frente.jpg",
        "topo": 0.31,
        "base": 0.79,
        "corpoEsq": 0.359,
        "corpoDir": 0.679,
        "quadro": {
          "x0": 0.183,
          "x1": 0.855,
          "y0": 0.017,
          "y1": 0.85
        }
      }
    },
    "Preto": {
      "Costas": {
        "src": "img/modelo/feminina-preto-costas.jpg",
        "topo": 0.3,
        "base": 0.67,
        "corpoEsq": 0.3547,
        "corpoDir": 0.8347,
        "quadro": {
          "x0": 0.091,
          "x1": 1,
          "y0": 0.022,
          "y1": 0.73
        }
      },
      "Frente": {
        "src": "img/modelo/feminina-preto-frente.jpg",
        "topo": 0.38,
        "base": 0.98,
        "corpoEsq": 0.3093,
        "corpoDir": 0.704,
        "quadro": {
          "x0": 0.092,
          "x1": 0.921,
          "y0": 0.111,
          "y1": 1
        }
      }
    }
  },
  "Infantil/Juvenil": {
    "Branco": {
      "Frente": {
        "src": "img/modelo/infantil-branco-frente.jpg",
        "topo": 0.27,
        "base": 0.82,
        "corpoEsq": 0.3547,
        "corpoDir": 0.6893,
        "quadro": {
          "x0": 0.171,
          "x1": 0.873,
          "y0": 0.006,
          "y1": 0.88
        }
      }
    },
    "Preta Jaguar": {
      "Costas": {
        "src": "img/modelo/infantil-jaguar-costas.jpg",
        "topo": 0.29,
        "base": 0.88,
        "corpoEsq": 0.343,
        "corpoDir": 0.657,
        "quadro": {
          "x0": 0.17,
          "x1": 0.83,
          "y0": 0.002,
          "y1": 0.94
        }
      },
      "Frente": {
        "src": "img/modelo/infantil-jaguar-frente.jpg",
        "topo": 0.29,
        "base": 0.92,
        "corpoEsq": 0.314,
        "corpoDir": 0.691,
        "quadro": {
          "x0": 0.107,
          "x1": 0.898,
          "y0": 0.002,
          "y1": 0.98
        }
      }
    },
    "Preto": {
      "Costas": {
        "src": "img/modelo/infantil-preto-costas.jpg",
        "topo": 0.26,
        "base": 0.82,
        "corpoEsq": 0.341,
        "corpoDir": 0.654,
        "quadro": {
          "x0": 0.169,
          "x1": 0.826,
          "y0": 0.006,
          "y1": 0.88
        }
      },
      "Frente": {
        "src": "img/modelo/infantil-preto-frente.jpg",
        "topo": 0.28,
        "base": 0.88,
        "corpoEsq": 0.348,
        "corpoDir": 0.668,
        "quadro": {
          "x0": 0.172,
          "x1": 0.844,
          "y0": 0.003,
          "y1": 0.94
        }
      }
    }
  },
  "Masculina": {
    "Branco": {
      "Costas": {
        "src": "img/modelo/masculina-branco-costas.jpg",
        "topo": 0.24,
        "base": 0.86,
        "corpoEsq": 0.288,
        "corpoDir": 0.6707,
        "quadro": {
          "x0": 0.078,
          "x1": 0.881,
          "y0": 0.006,
          "y1": 0.92
        }
      },
      "Frente": {
        "src": "img/modelo/masculina-branco-frente.jpg",
        "topo": 0.29,
        "base": 0.86,
        "corpoEsq": 0.339,
        "corpoDir": 0.631,
        "quadro": {
          "x0": 0.178,
          "x1": 0.792,
          "y0": 0.014,
          "y1": 0.92
        }
      }
    },
    "Preta Jaguar": {
      "Costas": {
        "src": "img/modelo/masculina-jaguar-costas.jpg",
        "topo": 0.24,
        "base": 0.88,
        "corpoEsq": 0.336,
        "corpoDir": 0.66,
        "quadro": {
          "x0": 0.158,
          "x1": 0.838,
          "y0": 0.009,
          "y1": 0.94
        }
      }
    },
    "Preto": {
      "Costas": {
        "src": "img/modelo/masculina-preto-costas.jpg",
        "topo": 0.26,
        "base": 0.9,
        "corpoEsq": 0.2827,
        "corpoDir": 0.7293,
        "quadro": {
          "x0": 0.037,
          "x1": 0.975,
          "y0": 0.017,
          "y1": 0.96
        }
      },
      "Frente": {
        "src": "img/modelo/masculina-preto-frente.jpg",
        "topo": 0.25,
        "base": 0.89,
        "corpoEsq": 0.315,
        "corpoDir": 0.648,
        "quadro": {
          "x0": 0.132,
          "x1": 0.831,
          "y0": 0,
          "y1": 0.95
        }
      }
    }
  }
};
