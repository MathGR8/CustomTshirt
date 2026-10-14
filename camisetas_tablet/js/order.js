/**
 * @module order
 * @description Pedido: medidas das artes, imagens das camisetas, PDF e texto
 * do resumo (WhatsApp). Os pedidos ficam salvos no tablet para o atendente.
 */

import { modelo, areaImpressao, renderizar, carregarImagem } from './shirt.js';
import { CORES } from './config.js';
import { urlDa, lib } from './catalog.js';
import { DB } from './db.js';
import { qualidade, credito } from './fontes.js';
import { descreverTexto } from './texto.js';
import { valorItem, mostrarPrecos, dinheiro } from './precos.js';

const um = v => Math.round(v * 10) / 10;
const f = v => String(um(v)).replace('.', ',');

/** Proporção altura/largura de uma arte colocada. */
export const proporcao = a => a.h / a.w;

/** Fator para as peças infantis (Infantil/Juvenil): menor entre largura e altura. */
export function escalaInfantil(modeloId) {
  const m = modelo(modeloId);
  return m.infantil ? Math.min(m.infantil.w / m.area.w, m.infantil.h / m.area.h) : null;
}

/** Medidas da arte em cm (e a medida infantil, quando houver). */
export function medidas(modeloId, a) {
  const w = a.cm, h = a.cm * proporcao(a), k = escalaInfantil(modeloId);
  return { w: um(w), h: um(h), inf: k ? { w: um(w * k), h: um(h * k) } : null };
}

/** "25 × 30 cm" (+ " · infantil 16,7 × 20 cm"). */
export function textoMedidas(modeloId, a, curto = false) {
  const m = medidas(modeloId, a), mod = modelo(modeloId);
  const base = `${f(m.w)} × ${f(m.h)} cm`;
  if (!m.inf) return base;
  return curto ? `${base} (inf. ${f(m.inf.w)} × ${f(m.inf.h)})`
               : `${mod.area.nome || ''} ${base} · ${mod.infantil.nome} ${f(m.inf.w)} × ${f(m.inf.h)} cm`.trim();
}

/** Maior largura (cm) que a arte pode ter no modelo (largura e altura máximas). */
export function maxCm(modeloId, a) {
  const m = modelo(modeloId);
  return Math.floor(Math.min(m.area.w, m.area.h / proporcao(a)) * 10) / 10;
}

/** Desenha um lado do item (camiseta + artes) e devolve um JPEG. */
export async function imagemLado(item, lado, largura = 900) {
  const area = areaImpressao(item.modelo, lado);
  const artes = [];
  for (const a of item.artes.filter(x => x.lado === lado)) {
    const url = a.tipo === 'texto' ? a.url : await urlDa(a.artId, 'previa');
    if (!url) continue;
    const img = await carregarImagem(url);
    const wu = a.cm * area.upc, hu = wu * proporcao(a);
    // fx, fy = centro da arte em frações da área de impressão
    artes.push({ img, cx: area.x + a.fx * area.w, cy: area.y + a.fy * area.h, wu, hu });
  }
  const c = await renderizar({ modelo: item.modelo, lado, cor: item.cor, artes }, largura);
  // Fundo claro (o JPEG não tem transparência)
  const fundo = document.createElement('canvas');
  fundo.width = c.width; fundo.height = c.height;
  const x = fundo.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(c, 0, 0);
  return fundo.toDataURL('image/jpeg', 0.86);
}

/** Lados que têm arte (sempre pelo menos a Frente). */
export function ladosDo(item) {
  const l = ['Frente', 'Costas'].filter(lado => item.artes.some(a => a.lado === lado));
  return l.length ? l : ['Frente'];
}

export const totalPecas = item => Object.values(item.quantidades || {}).reduce((s, n) => s + (n || 0), 0);

/**
 * Salva o pedido no tablet (com as imagens já desenhadas).
 * @returns {Promise<Object>} pedido salvo
 */
export async function salvarPedido(itens, cliente, cfg = {}) {
  const numero = await DB.proximoNumero();
  const pedido = {
    id: Date.now(), numero, data: new Date().toISOString(), cliente,
    precos: { mostrar: mostrarPrecos(cfg) }, // o cliente viu os preços?
    itens: [], total: 0
  };
  for (const it of itens) {
    const lados = ladosDo(it);
    const imagens = {};
    for (const l of lados) imagens[l] = await imagemLado(it, l);
    pedido.itens.push({
      modelo: it.modelo, malha: it.malha, cor: it.cor, quantidades: { ...it.quantidades },
      modo: it.modo || 'criar', pronta: it.pronta || null, precoPronta: it.precoPronta || null,
      valor: valorItem(cfg, it),
      // O texto guarda a própria imagem (url); as outras artes ficam no catálogo
      artes: it.artes.map(({ uid, url, ...a }) => ({
        ...a, ...(a.tipo === 'texto' ? { url, descricao: descreverTexto(a) } : {}),
        medidas: textoMedidas(it.modelo, a),
        qualidade: qualidade(a)?.rotulo || null,
        credito: a.fonte ? credito(a.fonte) : null
      })),
      imagens
    });
  }
  pedido.total = pedido.itens.reduce((s, it) => s + (it.valor?.total || 0), 0);
  await DB.salvar('pedidos', pedido);
  return pedido;
}

export const numeroPedido = n => String(n).padStart(4, '0');

/** Texto curto do pedido (WhatsApp). */
export function textoResumo(pedido, loja, comPrecos = true) {
  const linhas = [`*Pedido nº ${numeroPedido(pedido.numero)}* — ${loja}`];
  if (pedido.cliente?.nome) linhas.push(`Cliente: ${pedido.cliente.nome}${pedido.cliente.telefone ? ' · ' + pedido.cliente.telefone : ''}`);
  pedido.itens.forEach((it, i) => {
    const cor = CORES[it.cor]?.nome || it.cor;
    const tam = comPrecos && it.valor?.total ? it.valor.linhas.map(l => `${l.t}×${l.qtd} (${dinheiro(l.unit)})`).join(', ')
      : Object.entries(it.quantidades).filter(([, n]) => n > 0).map(([t, n]) => `${t}×${n}`).join(', ');
    linhas.push('', `*${i + 1}) ${modelo(it.modelo).nome} · ${it.malha} · ${cor}${it.modo === 'pronta' ? ' · camiseta pronta' : ''}*`, `Tamanhos: ${tam}`);
    it.artes.forEach(a => linhas.push(a.tipo === 'texto'
      ? `• ${a.lado}: texto "${a.texto.replace(/\n/g, ' / ')}" (${a.medidas}) — ${a.descricao}`
      : `• ${a.lado}: ${a.nome} (${a.medidas})${a.origem === 'cliente' ? ' — arte do cliente' : a.origem === 'internet' ? ' — imagem da internet' : ''}${a.qualidade ? ` · qualidade ${a.qualidade}` : ''}`));
  });
  const total = pedido.itens.reduce((s, it) => s + totalPecas(it), 0);
  linhas.push('', `Total: ${total} peça${total === 1 ? '' : 's'}${comPrecos && pedido.total ? ` · *${dinheiro(pedido.total)}*` : ''}`);
  if (pedido.cliente?.obs) linhas.push(`Obs.: ${pedido.cliente.obs}`);
  return linhas.join('\n');
}

/** Gera o PDF do pedido. @returns {Promise<Blob>} */
export async function pdfPedido(pedido, loja) {
  const jsPDF = await lib('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 210, M = 14;
  const data = new Date(pedido.data);
  const cab = () => {
    pdf.setFillColor(20, 20, 20); pdf.rect(0, 0, L, 24, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.text(loja, M, 11);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
    pdf.text(`Pedido nº ${numeroPedido(pedido.numero)}  ·  ${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, M, 18);
    pdf.setTextColor(20, 20, 20);
  };
  cab();
  let y = 32;
  const c = pedido.cliente || {};
  pdf.setFontSize(10);
  pdf.text(`Cliente: ${c.nome || '—'}${c.telefone ? '   ·   WhatsApp: ' + c.telefone : ''}`, M, y); y += 6;
  if (c.obs) { const t = pdf.splitTextToSize('Observações: ' + c.obs, L - 2 * M); pdf.text(t, M, y); y += t.length * 5; }

  for (const [i, it] of pedido.itens.entries()) {
    if (i > 0 || y > 60) { pdf.addPage(); cab(); y = 32; }
    const cor = CORES[it.cor]?.nome || it.cor;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12);
    pdf.text(`Camiseta ${i + 1} de ${pedido.itens.length} — ${modelo(it.modelo).nome} · ${it.malha} · ${cor}${it.modo === 'pronta' ? ' · PRONTA' : ''}`, M, y + 4);
    pdf.setFont('helvetica', 'normal');
    y += 9;
    // Imagens (Frente / Costas)
    const lados = Object.keys(it.imagens);
    const larg = lados.length > 1 ? (L - 2 * M - 6) / 2 : 100, alt = larg * 1.1;
    lados.forEach((l, k) => {
      const x = lados.length > 1 ? M + k * (larg + 6) : (L - larg) / 2;
      pdf.setDrawColor(225); pdf.roundedRect(x, y, larg, alt, 2, 2);
      pdf.addImage(it.imagens[l], 'JPEG', x + 1, y + 1, larg - 2, alt - 2);
      pdf.setFontSize(9); pdf.setTextColor(110); pdf.text(l.toUpperCase(), x + 3, y + 5); pdf.setTextColor(20);
    });
    y += alt + 6;
    const tam = Object.entries(it.quantidades).filter(([, n]) => n > 0);
    const v = it.valor?.total ? it.valor : null;
    pdf.autoTable({
      startY: y, margin: { left: M, right: L / 2 + 2 }, theme: 'grid',
      head: [v ? ['TAMANHO', 'QTD', 'PREÇO', 'SUBTOTAL'] : ['TAMANHO', 'QTD']],
      body: v ? [...v.linhas.map(l => [l.t, String(l.qtd), dinheiro(l.unit), dinheiro(l.sub)]), ['Total', String(totalPecas(it)), '', dinheiro(v.total)]]
              : [...tam.map(([t, n]) => [t, String(n)]), ['Total', String(totalPecas(it))]],
      styles: { fontSize: 9, cellPadding: 1.8 }, headStyles: { fillColor: [30, 30, 30] }
    });
    const yTam = pdf.lastAutoTable.finalY;
    pdf.autoTable({
      startY: y, margin: { left: L / 2 + 2, right: M }, theme: 'grid',
      head: [['ARTE', 'LADO', 'TAMANHO (L × A)']],
      body: it.artes.length ? it.artes.map(a => [
        a.tipo === 'texto' ? `TEXTO: "${a.texto}"\n${a.descricao}`
          : a.origem === 'cliente' ? `${a.nome}\nARTE DO CLIENTE: ${a.arquivo}${a.qualidade ? '\nQualidade: ' + a.qualidade : ''}`
          : a.origem === 'internet' ? `${a.nome}\nIMAGEM DA INTERNET${a.qualidade ? ' · ' + a.qualidade : ''}\n${a.credito || ''}`
          : `${a.nome}\n${a.tema} · ${a.arquivo}${a.pagina > 1 ? ' (pág. ' + a.pagina + ')' : ''}`,
        a.lado, a.medidas.replace(' · ', '\n')])
                            : [['Camiseta lisa (sem arte)', '—', '—']],
      styles: { fontSize: 8, cellPadding: 1.8 }, headStyles: { fillColor: [30, 30, 30] },
      columnStyles: { 0: { cellWidth: 40 } }
    });
    y = Math.max(yTam, pdf.lastAutoTable.finalY) + 8;
  }
  const total = pedido.itens.reduce((s, it) => s + totalPecas(it), 0);
  if (y > 270) { pdf.addPage(); cab(); y = 32; }
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12);
  pdf.text(`Total do pedido: ${total} peça${total === 1 ? '' : 's'}${pedido.total ? ` · ${dinheiro(pedido.total)}` : ''}`, M, y);
  return pdf.output('blob');
}

/** Baixa um Blob como arquivo. */
export function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
