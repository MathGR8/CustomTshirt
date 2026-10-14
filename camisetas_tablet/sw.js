/**
 * Service worker: guarda o app e as bibliotecas para funcionar sem internet.
 * As fontes do Google (textos na camiseta) também ficam guardadas.
 * As artes ficam no IndexedDB do tablet (não passam por aqui).
 * Ao publicar uma versão nova, troque VERSAO para os tablets baixarem os arquivos novos.
 */
const VERSAO = 'camisetas-tablet-v4';
const APP = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/admin.js', 'js/catalog.js', 'js/config.js', 'js/db.js',
  'js/icons.js', 'js/order.js', 'js/shirt.js', 'js/ui.js', 'js/fontes.js',
  'js/medidas.js', 'js/texto.js',
  'icons/icone-192.png', 'icons/icone-512.png'
];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSAO);
    await c.addAll(APP);
    // Bibliotecas: se alguma falhar (sem internet), o app continua instalando
    await Promise.all(LIBS.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSAO) await caches.delete(k);
    self.clients.claim();
  })());
});

// App: rede primeiro (pega atualizações), cache se estiver sem internet.
// Bibliotecas: cache primeiro (não mudam).
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.includes('/api/')) return; // busca/imagens: sempre da rede
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => {
      const copia = r.clone();
      caches.open(VERSAO).then(c => c.put(req, copia));
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  } else if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(resp => {
      const copia = resp.clone();
      caches.open(VERSAO).then(c => c.put(req, copia));
      return resp;
    })));
  }
});
