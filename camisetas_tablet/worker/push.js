/**
 * Notificações do navegador (Web Push), sem serviço pago e sem biblioteca:
 * o servidor assina com as próprias chaves VAPID (RFC 8292) e criptografa a
 * mensagem para cada aparelho (RFC 8291, aes128gcm). O navegador do
 * computador/celular do gestor (Chrome, Edge, Firefox, Safari) recebe pelo
 * serviço de push do próprio navegador, de graça.
 */

const enc = new TextEncoder();

export const b64u = buf => {
  let s = ''; for (const x of new Uint8Array(buf)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const deB64u = s => {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '==='.slice((t.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};
const juntar = (...partes) => {
  const out = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let i = 0; for (const p of partes) { out.set(p, i); i += p.length; }
  return out;
};
async function hmac(chave, dados) {
  const k = await crypto.subtle.importKey('raw', chave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, dados));
}

/** Chaves VAPID novas: { publica: base64url (65 bytes), privada: JWK } */
export async function novasChaves() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  return { publica: b64u(await crypto.subtle.exportKey('raw', par.publicKey)), privada: await crypto.subtle.exportKey('jwk', par.privateKey) };
}

/** Cabeçalho Authorization VAPID para o serviço de push do endpoint. */
async function vapid(endpoint, chaves, contato) {
  const cab = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corpo = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: contato })));
  const k = await crypto.subtle.importKey('jwk', chaves.privada, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const ass = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, enc.encode(`${cab}.${corpo}`));
  return `vapid t=${cab}.${corpo}.${b64u(ass)}, k=${chaves.publica}`;
}

/** Criptografa a mensagem para o aparelho (RFC 8291 / RFC 8188, aes128gcm). */
export async function criptografar(texto, p256dh, auth) {
  const uaPub = deB64u(p256dh), segredo = deB64u(auth);
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const comum = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, par.privateKey, 256));
  const prkKey = await hmac(segredo, comum);
  const ikm = await hmac(prkKey, juntar(enc.encode('WebPush: info\0'), uaPub, asPub, [1]));
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, juntar(enc.encode('Content-Encoding: aes128gcm\0'), [1]))).slice(0, 16);
  const nonce = (await hmac(prk, juntar(enc.encode('Content-Encoding: nonce\0'), [1]))).slice(0, 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, juntar(enc.encode(texto), [2])));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return juntar(sal, rs, [asPub.length], asPub, cifrado);
}

/**
 * Manda a notificação para um aparelho.
 * Retorna { ok, status, sumiu } — sumiu = o aparelho cancelou (404/410): apagar a inscrição.
 */
export async function enviarPush(insc, dados, chaves, contato) {
  try {
    const corpo = await criptografar(JSON.stringify(dados), insc.p256dh, insc.auth);
    const r = await fetch(insc.endpoint, {
      method: 'POST',
      headers: {
        authorization: await vapid(insc.endpoint, chaves, contato),
        'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream',
        ttl: String(3 * 24 * 3600), urgency: 'high'
      },
      body: corpo
    });
    const ok = r.status >= 200 && r.status < 300;
    const detalhe = ok ? '' : (await r.text().catch(() => '')).slice(0, 200);
    return { ok, status: r.status, sumiu: r.status === 404 || r.status === 410, detalhe };
  } catch (e) {
    return { ok: false, status: 0, detalhe: String(e && e.message || e) };
  }
}
