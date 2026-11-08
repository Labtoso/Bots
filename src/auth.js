import crypto from 'node:crypto';
import { config } from './config.js';

const secret = config.secret || crypto.randomBytes(32).toString('hex');

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

/** Creates a dashboard token bound to one user and one server. */
export function createToken({ userId, guildId, userName, avatar, guest = false }) {
  const payload = b64(JSON.stringify({
    u: userId, g: guildId, n: userName, a: avatar || null, ...(guest ? { s: 1 } : {}),
    exp: Date.now() + config.sessionHours * 3600_000,
  }));
  return `${payload}.${sign(payload)}`;
}

/** Returns the payload of a valid token or null. */
export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = sign(payload);
  if (!sig || sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
