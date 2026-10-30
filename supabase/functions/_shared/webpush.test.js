import ece from 'http_ece'
import { createECDH, createPublicKey, generateKeyPairSync, randomBytes, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { base64urlToBytes, buildPushRequest, bytesToBase64url, encryptPayload, vapidAuthorization } from './webpush.js'

// A browser's push subscription: its key pair and auth secret.
function fakeDevice() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return {
    ecdh,
    authSecret: randomBytes(16),
    p256dh: bytesToBase64url(ecdh.getPublicKey()),
  }
}

// What the receiving browser does: decrypt with the reference implementation.
function decryptOnDevice(device, body) {
  return ece
    .decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: device.ecdh, authSecret: device.authSecret })
    .toString('utf8')
}

describe('encryptPayload (RFC 8291)', () => {
  it('the device decrypts exactly what was sent', async () => {
    const device = fakeDevice()
    const text = JSON.stringify({ title: 'Call the dentist', body: 'Reminder · 14:00', url: '/#/task/x' })
    const body = await encryptPayload(text, device.p256dh, bytesToBase64url(device.authSecret))
    expect(decryptOnDevice(device, body)).toBe(text)
  })

  it('handles umlauts and emoji, and every message is different', async () => {
    const device = fakeDevice()
    const text = 'Zähne putzen 🦷'
    const a = await encryptPayload(text, device.p256dh, bytesToBase64url(device.authSecret))
    const b = await encryptPayload(text, device.p256dh, bytesToBase64url(device.authSecret))
    expect(decryptOnDevice(device, a)).toBe(text)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })

  it('a different device cannot read it', async () => {
    const device = fakeDevice()
    const other = fakeDevice()
    const body = await encryptPayload('secret', device.p256dh, bytesToBase64url(device.authSecret))
    expect(() => decryptOnDevice({ ...other, authSecret: device.authSecret }, body)).toThrow()
  })

  it('rejects broken subscription keys', async () => {
    await expect(encryptPayload('x', 'AAAA', 'BBBB')).rejects.toThrow('invalid subscription keys')
  })
})

describe('vapidAuthorization (RFC 8292)', () => {
  it('is a valid ES256 token for the push service, signed with our key', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const jwkPublic = publicKey.export({ format: 'jwk' })
    const raw = bytesToBase64url(
      Buffer.concat([Buffer.from([4]), Buffer.from(jwkPublic.x, 'base64url'), Buffer.from(jwkPublic.y, 'base64url')]),
    )
    const d = privateKey.export({ format: 'jwk' }).d

    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', 'https://habits.mkalmutzke.com', raw, d, 1_800_000_000)
    const [, token, key] = header.match(/^vapid t=([^,]+), k=(.+)$/)
    expect(key).toBe(raw)

    const [h, c, s] = token.split('.')
    expect(JSON.parse(Buffer.from(h, 'base64url'))).toEqual({ typ: 'JWT', alg: 'ES256' })
    expect(JSON.parse(Buffer.from(c, 'base64url'))).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: 1_800_000_000 + 12 * 3600,
      sub: 'https://habits.mkalmutzke.com',
    })
    const ok = verify(
      'sha256',
      Buffer.from(`${h}.${c}`),
      { key: createPublicKey({ key: jwkPublic, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
      Buffer.from(s, 'base64url'),
    )
    expect(ok).toBe(true)
  })
})

describe('buildPushRequest', () => {
  it('has the headers push services require', async () => {
    const device = fakeDevice()
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const jwk = publicKey.export({ format: 'jwk' })
    const raw = bytesToBase64url(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]))
    const request = await buildPushRequest(
      { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: device.p256dh, auth: bytesToBase64url(device.authSecret) },
      { title: 'T', body: 'B', url: '/', tag: 'rem-1234' },
      { subject: 'https://habits.mkalmutzke.com', publicKey: raw, privateKey: privateKey.export({ format: 'jwk' }).d },
    )
    expect(request.headers['Content-Encoding']).toBe('aes128gcm')
    expect(request.headers.TTL).toBe('3600')
    expect(request.headers.Topic).toBe('rem-1234')
    expect(request.headers.Authorization).toMatch(/^vapid t=/)
    expect(JSON.parse(decryptOnDevice(device, request.body))).toEqual({ title: 'T', body: 'B', url: '/', tag: 'rem-1234' })
  })

  it('base64url helpers round-trip', () => {
    const bytes = Uint8Array.from([0, 250, 251, 252, 253, 254, 255])
    expect(base64urlToBytes(bytesToBase64url(bytes))).toEqual(bytes)
  })
})
