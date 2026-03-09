import crypto from 'node:crypto'
import { ValidationError } from '@shared/errors'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const AUTH_TAG_LEN = 16

export interface EncPayload {
  iv: string
  authTag: string
  ciphertext: string
}

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LEN })
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const payload: EncPayload = {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: enc.toString('base64')
  }
  return JSON.stringify(payload)
}

export function decrypt(encPayloadJson: string, key: Buffer): string {
  let payload: EncPayload
  try {
    payload = JSON.parse(encPayloadJson) as EncPayload
  } catch {
    throw new ValidationError('Geçersiz şifreli veri')
  }
  if (
    typeof payload.iv !== 'string' ||
    typeof payload.authTag !== 'string' ||
    typeof payload.ciphertext !== 'string'
  ) {
    throw new ValidationError('Geçersiz şifreli veri')
  }
  const iv = Buffer.from(payload.iv, 'base64')
  const authTag = Buffer.from(payload.authTag, 'base64')
  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LEN })
  decipher.setAuthTag(authTag)
  try {
    return decipher.update(payload.ciphertext, 'base64', 'utf8') + decipher.final('utf8')
  } catch {
    throw new ValidationError('Şifre çözülemedi')
  }
}
