/**
 * @module db
 * @description Armazenamento no próprio tablet (IndexedDB).
 *
 *  - artes:   catálogo importado pelo administrador (miniatura + prévia)
 *  - pedidos: pedidos finalizados (para o atendente consultar e gerar o PDF)
 *  - config:  configurações da loja e contador de pedidos
 *
 * Os dados ficam só neste aparelho. Para levar o catálogo a outro tablet,
 * use "Exportar catálogo" na área do administrador.
 */

const NOME = 'camisetas-tablet';
const VERSAO = 1;
let conexao = null;

function abrir() {
  if (conexao) return conexao;
  conexao = new Promise((ok, erro) => {
    const req = indexedDB.open(NOME, VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('artes')) {
        const s = db.createObjectStore('artes', { keyPath: 'id' });
        s.createIndex('tema', 'tema');
      }
      if (!db.objectStoreNames.contains('pedidos')) db.createObjectStore('pedidos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('config')) db.createObjectStore('config');
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
  return conexao;
}

/** Executa uma operação numa store e devolve o resultado. */
async function op(store, modo, fn) {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const tx = db.transaction(store, modo);
    const r = fn(tx.objectStore(store));
    tx.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
    tx.onerror = () => erro(tx.error);
    tx.onabort = () => erro(tx.error || new Error('Operação cancelada'));
  });
}

export const DB = {
  todos:    store => op(store, 'readonly', s => s.getAll()),
  pegar:    (store, id) => op(store, 'readonly', s => s.get(id)),
  salvar:   (store, obj, chave) => op(store, 'readwrite', s => (chave === undefined ? s.put(obj) : s.put(obj, chave))),
  apagar:   (store, id) => op(store, 'readwrite', s => s.delete(id)),
  limpar:   store => op(store, 'readwrite', s => s.clear()),

  /** Grava várias de uma vez (uma transação só: bem mais rápido). */
  async salvarVarios(store, lista) {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const tx = db.transaction(store, 'readwrite');
      const s = tx.objectStore(store);
      lista.forEach(o => s.put(o));
      tx.oncomplete = () => ok();
      tx.onerror = () => erro(tx.error);
    });
  },

  /** Lê só os campos leves das artes (sem as imagens), para listas rápidas. */
  /** Miniaturas de todas as artes numa leitura só: Map id → Blob. */
  async miniaturas() {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const mapa = new Map();
      const req = db.transaction('artes', 'readonly').objectStore('artes').openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return ok(mapa);
        if (c.value.miniatura && !c.value.cliente) mapa.set(c.value.id, c.value.miniatura);
        c.continue();
      };
      req.onerror = () => erro(req.error);
    });
  },

  async artesResumo() {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const lista = [];
      const tx = db.transaction('artes', 'readonly');
      const req = tx.objectStore('artes').openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        const { miniatura, previa, ...leve } = c.value;
        lista.push(leve);
        c.continue();
      };
      tx.oncomplete = () => ok(lista);
      tx.onerror = () => erro(tx.error);
    });
  },

  /** Configurações da loja (mescladas com os padrões). */
  async config(padrao) {
    const salvo = await this.pegar('config', 'loja').catch(() => null);
    return { ...padrao, ...(salvo || {}) };
  },
  salvarConfig: cfg => DB.salvar('config', cfg, 'loja'),

  /** Próximo número de pedido (1, 2, 3…). */
  async proximoNumero() {
    const n = ((await this.pegar('config', 'contador')) || 0) + 1;
    await this.salvar('config', n, 'contador');
    return n;
  },

  /** Pede ao navegador para não apagar os dados quando faltar espaço. */
  async persistir() {
    try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch { /* sem suporte */ }
  },

  /** Espaço usado / disponível (bytes). */
  async espaco() {
    try { return await navigator.storage.estimate(); } catch { return null; }
  }
};
