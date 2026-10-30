// Web push without third-party packages: the message is
// encrypted for one device (RFC 8291, "aes128gcm" = RFC 8188) and the request
// is signed with our VAPID key (RFC 8292). Only the WebCrypto standard is used,
// which both Deno (Edge Functions) and Node (tests) provide.
// Tested against the reference implementation `http_ece`: webpush.test.js.

const encoder = new TextEncoder()

export function base64urlToBytes(text) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

export function bytesToBase64url(bytes) {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
  return new Uint8Array(bits)
}

const RECORD_SIZE = 4096

// Encrypts `plaintext` (string) for a subscription's keys (base64url p256dh, auth).
// `salt` and `senderKeys` are only passed in by tests; normally they are random.
export async function encryptPayload(plaintext, p256dh, auth, { salt, senderKeys } = {}) {
  const receiverPublic = base64urlToBytes(p256dh)
  const authSecret = base64urlToBytes(auth)
  if (receiverPublic.length !== 65 || authSecret.length !== 16) throw new Error('invalid subscription keys')

  const sender = senderKeys ?? (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']))
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', sender.publicKey))
  const receiverKey = await crypto.subtle.importKey('raw', receiverPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, sender.privateKey, 256))

  // RFC 8291 §3.4: combine the shared secret with the device's auth secret
  const keyInfo = concat(encoder.encode('WebPush: info\0'), receiverPublic, senderPublic)
  const ikm = await hkdf(authSecret, shared, keyInfo, 32)

  // RFC 8188: content key and nonce from a random salt
  const useSalt = salt ?? crypto.getRandomValues(new Uint8Array(16))
  const contentKey = await hkdf(useSalt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(useSalt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)

  // one record: the message plus the "last record" delimiter 0x02
  const record = concat(encoder.encode(plaintext), new Uint8Array([2]))
  if (record.length + 16 > RECORD_SIZE) throw new Error('push message too long')
  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record))

  // header: salt (16) | record size (4, big endian) | key id length (1) | sender public key (65)
  const header = new Uint8Array(16 + 4 + 1 + senderPublic.length)
  header.set(useSalt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = senderPublic.length
  header.set(senderPublic, 21)
  return concat(header, cipher)
}

// VAPID: a short-lived signed token (JWT, ES256) that proves the message
// comes from us. publicKey: base64url raw point (65 bytes), privateKey: base64url d.
export async function vapidAuthorization(endpoint, subject, publicKey, privateKey, nowSeconds = Math.floor(Date.now() / 1000)) {
  const pub = base64urlToBytes(publicKey)
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: privateKey,
    x: bytesToBase64url(pub.slice(1, 33)),
    y: bytesToBase64url(pub.slice(33, 65)),
    ext: true,
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const header = bytesToBase64url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = bytesToBase64url(
    encoder.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSeconds + 12 * 60 * 60, sub: subject })),
  )
  const unsigned = `${header}.${claims}`
  // WebCrypto returns the raw r|s signature (64 bytes) that JWT ES256 expects
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned)))
  return `vapid t=${unsigned}.${bytesToBase64url(signature)}, k=${publicKey}`
}

// The complete HTTP request for the push service.
export async function buildPushRequest(subscription, message, vapid, options = {}) {
  const body = await encryptPayload(JSON.stringify(message), subscription.p256dh, subscription.auth, options)
  return {
    url: subscription.endpoint,
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, vapid.subject, vapid.publicKey, vapid.privateKey),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(options.ttl ?? 3600),
      Urgency: 'high',
      ...(message.tag ? { Topic: String(message.tag).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {}),
    },
    body,
  }
}
