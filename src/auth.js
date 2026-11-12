import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

/*
 * The secret that signs panel links. Without SESSION_SECRET in .env it is created once and kept in
 * data/.secret, so links keep working after a restart or an update (a new random secret every start
 * made every older link look "expired").
 */
function loadSecret() {
  if (config.secret) return config.secret;
  const file = path.join(config.dataDir, '.secret');
  try {
    const s = fs.readFileSync(file, 'utf8').trim();
    if (s.length >= 32) return s;
  } catch { /* first start */ }
  const s = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(file, s, { mode: 0o600 });
  } catch { /* read-only: links then only live until the next restart */ }
  return s;
}
const secret = loadSecret();

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

/** Creates a dashboard token bound to one user and one server. */
export function createToken({ userId, guildId, userName, avatar }) {
  const payload = b64(JSON.stringify({
    u: userId, g: guildId, n: userName, a: avatar || null,
    exp: Date.now() + config.sessionHours * 3600_000,
  }));
  return `${payload}.${sign(payload)}`;
}

/**
 * Checks a token. Returns { data } when it is valid, otherwise { reason }:
 * 'missing' (no token), 'invalid' (not signed by this backend) or 'expired'.
 */
export function checkToken(token) {
  if (typeof token !== 'string' || !token) return { reason: 'missing' };
  // links that went through a chat or a mail program sometimes pick up spaces or a trailing dot
  token = token.trim().replace(/\s+/g, '');
  if (!token.includes('.')) return { reason: 'invalid' };
  const [payload, sig] = token.split('.');
  const expected = sign(payload);
  if (!sig || sig.length !== expected.length) return { reason: 'invalid' };
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return { reason: 'invalid' };
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp) return { reason: 'invalid' };
    if (data.exp < Date.now()) return { reason: 'expired', exp: data.exp };
    return { data };
  } catch {
    return { reason: 'invalid' };
  }
}

/** Returns the payload of a valid token or null. */
export function verifyToken(token) {
  return checkToken(token).data || null;
}
