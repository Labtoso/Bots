import net from 'node:net';
import dgram from 'node:dgram';
import dns from 'node:dns/promises';

/* Minecraft server status without extra packages: Java "Server List Ping" over TCP, Bedrock "Unconnected Ping" over UDP. */

function varint(n) {
  const out = [];
  n >>>= 0;
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return Buffer.from(out);
}

function readVarint(buf, off) {
  let n = 0; let shift = 0; let b;
  do {
    if (off >= buf.length) return null;
    b = buf[off++];
    n |= (b & 0x7f) << shift;
    shift += 7;
    if (shift > 35) throw new Error('VarInt zu lang');
  } while (b & 0x80);
  return [n, off];
}

const str = (s) => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([varint(b.length), b]); };
const packet = (id, ...parts) => { const body = Buffer.concat([varint(id), ...parts]); return Buffer.concat([varint(body.length), body]); };

/** Text of a chat component (MOTD) without § formatting codes. */
export function plain(c) {
  if (c === null || c === undefined) return '';
  if (typeof c === 'string') return c.replace(/§./g, '');
  if (Array.isArray(c)) return c.map(plain).join('');
  return `${plain(c.text || c.translate || '')}${(c.extra || []).map(plain).join('')}`;
}

async function resolveSrv(host) {
  try {
    const [r] = await dns.resolveSrv(`_minecraft._tcp.${host}`);
    if (r) return { host: r.name, port: r.port };
  } catch { /* no SRV record */ }
  return null;
}

export async function pingJava(host, port = 25565, timeout = 5000) {
  let target = { host, port };
  if (!net.isIP(host) && (!port || port === 25565)) target = (await resolveSrv(host)) || { host, port: port || 25565 };
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: target.host, port: target.port });
    let buf = Buffer.alloc(0);
    let sent = 0;
    const done = (err, val) => { clearTimeout(timer); sock.destroy(); if (err) reject(err); else resolve(val); };
    const timer = setTimeout(() => done(new Error('Zeitüberschreitung')), timeout);
    sock.on('error', (e) => done(new Error(e.code === 'ECONNREFUSED' ? 'Verbindung abgelehnt' : e.code === 'ENOTFOUND' ? 'Adresse nicht gefunden' : e.message)));
    sock.on('connect', () => {
      const port16 = Buffer.alloc(2); port16.writeUInt16BE(target.port);
      sock.write(packet(0x00, varint(767), str(host), port16, varint(1)));
      sock.write(packet(0x00));
      sent = Date.now();
    });
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      try {
        const len = readVarint(buf, 0);
        if (!len || buf.length < len[1] + len[0]) return;
        const id = readVarint(buf, len[1]);
        if (id[0] !== 0x00) return done(new Error('Unerwartete Antwort'));
        const sl = readVarint(buf, id[1]);
        const json = JSON.parse(buf.subarray(sl[1], sl[1] + sl[0]).toString('utf8'));
        done(null, {
          online: true, edition: 'java', ping: Date.now() - sent,
          players: json.players?.online ?? 0, max: json.players?.max ?? 0,
          list: (json.players?.sample || []).map((p) => plain(p.name)).filter((n) => n && !/^\s*$/.test(n)).slice(0, 50),
          version: plain(json.version?.name || ''), protocol: json.version?.protocol ?? null,
          motd: plain(json.description).trim(), favicon: typeof json.favicon === 'string' ? json.favicon : null,
        });
      } catch (e) { done(e); }
    });
  });
}

const MAGIC = Buffer.from('00ffff00fefefefefdfdfdfd12345678', 'hex');

export function pingBedrock(host, port = 19132, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const family = net.isIPv6(host) ? 'udp6' : 'udp4';
    const sock = dgram.createSocket(family);
    const done = (err, val) => { clearTimeout(timer); try { sock.close(); } catch { /* closed */ } if (err) reject(err); else resolve(val); };
    const timer = setTimeout(() => done(new Error('Zeitüberschreitung')), timeout);
    const msg = Buffer.alloc(33);
    msg[0] = 0x01;
    msg.writeBigInt64BE(BigInt(Date.now()), 1);
    MAGIC.copy(msg, 9);
    msg.writeBigInt64BE(2n, 25);
    const sent = Date.now();
    sock.on('error', (e) => done(e));
    sock.on('message', (d) => {
      if (d[0] !== 0x1c || d.length < 35) return;
      const len = d.readUInt16BE(33);
      const parts = d.subarray(35, 35 + len).toString('utf8').split(';');
      done(null, {
        online: true, edition: 'bedrock', ping: Date.now() - sent,
        motd: plain([parts[1], parts[7]].filter(Boolean).join('\n')).trim(), protocol: Number(parts[2]) || null, version: parts[3] || '',
        players: Number(parts[4]) || 0, max: Number(parts[5]) || 0, list: [], favicon: null, gamemode: parts[8] || '',
      });
    });
    sock.send(msg, port || 19132, host, (e) => { if (e) done(new Error(e.code === 'ENOTFOUND' ? 'Adresse nicht gefunden' : e.message)); });
  });
}

/** "play.example.com:25566" -> { host, port } */
export function splitAddress(address, edition) {
  const s = String(address || '').trim();
  const m = s.match(/^\[?([^\]]+?)\]?(?::(\d+))?$/);
  const host = m ? m[1] : s;
  const port = m?.[2] ? Number(m[2]) : (edition === 'bedrock' ? 19132 : 25565);
  return { host, port };
}

export async function pingServer({ host, port, edition }) {
  const a = splitAddress(host, edition);
  const p = Number(port) || a.port;
  try {
    return edition === 'bedrock' ? await pingBedrock(a.host, p) : await pingJava(a.host, p);
  } catch (e) {
    return { online: false, error: e.message };
  }
}
