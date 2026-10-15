/**
 * @module config
 * @description Tudo o que a loja pode querer ajustar no app do tablet:
 * modelos de camiseta, malhas, cores, tamanhos e área máxima de estampa.
 *
 * As configurações que mudam no dia a dia (nome da loja, WhatsApp, senha,
 * tempo de inatividade, preços) ficam na área do administrador, dentro do app.
 */

/** Configurações padrão (o administrador pode trocar dentro do app). */
export const PADRAO = {
  loja: 'Estúdio de Camisetas',
  slogan: 'Crie a sua camiseta em poucos toques',
  senha: '1234',           // senha da área do administrador
  inatividadeMin: 3,       // minutos parado até perguntar "Ainda está aí?"
  permitirEnvio: true,     // cliente pode enviar a própria arte
  permitirBusca: true,     // cliente pode buscar imagens na internet
  telaLigada: true,        // não deixa a tela do tablet apagar com o app aberto
};

/**
 * Cores das camisetas. hex = cor na tela; mescla = textura de malha mesclada.
 */
export const CORES = {
  'Branco':         { hex: '#f6f6f3' },
  'Preto':          { hex: '#191919' },
  'Marinho':        { hex: '#1e2a45' },
  'Preta Jaguar':   { hex: '#1d1d1f', mescla: true, nome: 'Preta' },
  'Marinho Índigo': { hex: '#25385c', mescla: true, nome: 'Azul Marinho' },
  'Cinza Mescla':   { hex: '#b9b9b6', mescla: true, nome: 'Cinza Claro' },
  'Cinza Grafite':  { hex: '#47484b', mescla: true, nome: 'Cinza Escuro' }
};

/** Malhas e as cores de cada uma. */
export const MALHAS = [
  { id: '100% algodão',     nome: '100% algodão',     desc: 'Clássica, macia e fresquinha',
    cores: ['Preto', 'Branco', 'Marinho'] },
  { id: 'Premium mesclado', nome: 'Premium mesclado', desc: 'Toque extra macio, visual mesclado',
    cores: ['Preta Jaguar', 'Marinho Índigo', 'Cinza Mescla', 'Cinza Grafite'] }
];

/**
 * Modelos de camiseta.
 *  - corte: desenho usado (ver shirt.js)
 *  - area: tamanho MÁXIMO da estampa em cm (largura × altura)
 *  - infantil: (Infantil/Juvenil) a estampa é montada no tamanho juvenil e,
 *    nas peças infantis, é reduzida na mesma proporção para caber nesta área
 *  - cores: (opcional) limita as cores do modelo
 */
export const MODELOS = [
  { id: 'Masculina', nome: 'Masculina', desc: 'Corte tradicional', corte: 'tradicional',
    area: { w: 38, h: 42 },
    tamanhos: ['P', 'M', 'G', 'GG', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8'] },
  { id: 'Feminina', nome: 'Feminina', desc: 'Baby look, mais ajustada', corte: 'feminino',
    area: { w: 30, h: 35 },
    tamanhos: ['P', 'M', 'G', 'GG'],
    cores: ['Preto', 'Branco', 'Marinho', 'Preta Jaguar'] },
  { id: 'Infantil/Juvenil', nome: 'Infantil / Juvenil', desc: 'Do 01 ao 14', corte: 'infantil',
    area: { w: 30, h: 35, nome: 'Juvenil', tamanhos: ['08', '10', '12', '14'] },
    infantil: { w: 20, h: 24, nome: 'Infantil', tamanhos: ['01', '02', '04', '06'] },
    tamanhos: ['01', '02', '04', '06', '08', '10', '12', '14'] }
];

/** Atalhos de posição (frações da área de impressão). */
export const POSICOES = {
  centro: { nome: 'Centro',   cx: 0.5,  topo: null },
  peito:  { nome: 'Peito',    cx: 0.72, topo: 0.04, cm: 10 },
  alto:   { nome: 'No alto',  cx: 0.5,  topo: 0.02 }
};

/** Bibliotecas externas (o service worker guarda para funcionar sem internet). */
export const LIBS = {
  pdfjs:       'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  jspdf:       'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  autotable:   'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  jszip:       'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
};

/** Tamanhos das imagens geradas na importação (px do lado maior). */
export const IMAGENS = {
  miniatura: 420,     // grade da galeria
  previa: 1600        // camiseta e PDF do pedido
};
