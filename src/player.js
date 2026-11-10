import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import {
  AudioPlayerStatus, NoSubscriberBehavior, StreamType, createAudioPlayer, createAudioResource,
} from '@discordjs/voice';
import { bins } from './binaries.js';
import { config } from './config.js';
import { log } from './log.js';
import { forgetStream, prefetchStream, runYtdlp, streamInfo, toTrack } from './resolve.js';

export const FILTERS = {
  none: null,
  bassboost: 'bass=g=8:f=110,volume=-5dB', // fixed headroom instead of a normaliser, so nothing pumps
  nightcore: 'asetrate=48000*1.25,aresample=48000,atempo=1.0',
  vaporwave: 'asetrate=48000*0.8,aresample=48000',
  '8d': 'apulsator=hz=0.08',
  karaoke: 'stereotools=mlev=0.03',
  // heavily overdriven on purpose; the limiter keeps it from clipping into silence
  earrape: 'bass=g=30:f=80,treble=g=12,volume=45dB,acrusher=bits=2:mode=log:aa=0:mix=1,volume=12dB,alimiter=limit=0.99:level=disabled',
  earrapeold: 'bass=g=15:f=90,volume=20dB,acrusher=bits=6:mode=log:aa=1:mix=0.6,alimiter=limit=0.9:level=disabled',
  reverb: 'aecho=0.8:0.9:40|60|90:0.5|0.3|0.2',
};
const SPEED = { nightcore: 1.25, vaporwave: 0.8 };
const LOOPS = ['off', 'track', 'queue'];

export class GuildPlayer extends EventEmitter {
  constructor(guildId, { connect, disconnect } = {}) {
    super();
    this.guildId = guildId;
    this.connectFn = connect;
    this.disconnectFn = disconnect;
    this.queue = [];
    this.history = [];
    this.current = null;
    this.loop = 'off';
    this.volume = config.defaultVolume;
    this.filter = 'none';
    this.rev = 0;
    this.autoplay = false;
    this.channel = null; // { id, name }
    this.error = null;
    this.playId = 0;
    this.seekBase = 0;
    this.resource = null;
    this.ffmpeg = null;
    this.loading = false;
    this.idleTimer = null;
    this.failures = 0;
    this.activity = []; // who did what, newest last

    this.audio = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    this.audio.on('stateChange', (oldS, newS) => {
      if (newS.status === AudioPlayerStatus.Idle && oldS.status !== AudioPlayerStatus.Idle) {
        const id = oldS.resource?.metadata?.playId;
        if (id === this.playId) this.#advance({ finished: true });
      }
      this.changed();
    });
    this.audio.on('error', (err) => {
      log.warn(`Wiedergabefehler (${this.guildId}):`, err.message);
      this.error = err.message;
    });
  }

  get paused() {
    return this.audio.state.status === AudioPlayerStatus.Paused || this.audio.state.status === AudioPlayerStatus.AutoPaused;
  }

  get position() {
    if (!this.current || !this.resource) return 0;
    const speed = SPEED[this.filter] || 1;
    return Math.max(0, this.seekBase + (this.resource.playbackDuration / 1000) * speed);
  }

  changed() {
    this.rev++;
    clearTimeout(this.idleTimer);
    if (!this.current && this.channel) {
      this.idleTimer = setTimeout(() => this.leave(), config.idleMinutes * 60_000);
    }
    this.emit('update', this.state());
    if (this.current && !this.loading) this.#prefetchNext();
  }

  state() {
    return {
      guildId: this.guildId,
      channel: this.channel,
      current: this.current,
      position: Math.round(this.position * 10) / 10,
      paused: this.paused,
      loading: this.loading,
      loop: this.loop,
      volume: this.volume,
      filter: this.filter,
      autoplay: this.autoplay,
      queue: this.queue,
      history: this.history.slice(-20).reverse(),
      activity: this.activity.slice(-40).reverse(),
      error: this.error,
      updatedAt: Date.now(),
      rev: this.rev,
    };
  }

  /** Records who did what, shown in the dashboard's activity list. */
  logActivity(who, action, detail = null) {
    if (!who || who.hidden) return;
    const last = this.activity.at(-1);
    // dragging the volume slider would otherwise fill the list
    if (last && last.action === action && ['volume', 'seek'].includes(action) && last.name === who.name && Date.now() - last.at < 8000) {
      last.detail = detail; last.at = Date.now();
    } else {
      this.activity.push({ at: Date.now(), name: who.name, avatar: who.avatar || null, guest: !!who.guest, action, detail });
      if (this.activity.length > 100) this.activity.shift();
    }
    this.changed();
  }

  /** Joins a voice channel: the chosen one (dashboard setting) or the one the user is in. */
  async ensureVoice(member, channelId = null) {
    if (this.channel) return;
    if (this.joining) { await this.joining; return; }
    const target = channelId || member?.voiceChannelId;
    if (!target) throw new Error('NOT_IN_VOICE');
    const gen = this.voiceGen = (this.voiceGen || 0) + 1;
    this.joining = this.connectFn(target, this.audio);
    let channel;
    try {
      channel = await this.joining;
    } finally {
      this.joining = null;
    }
    // "Trennen" was pressed while joining: leave right away instead of staying in the channel
    if (gen !== this.voiceGen) { this.disconnectFn?.(); return; }
    this.channel = channel;
    this.changed();
  }

  /** Starts joining without waiting; playback waits for it before sending audio. */
  startVoice(member, channelId = null) {
    if (this.channel || this.joining) return;
    if (!(channelId || member?.voiceChannelId)) throw new Error('NOT_IN_VOICE');
    this.#run(this.ensureVoice(member, channelId).catch((err) => {
      this.error = `Sprachkanal: ${err.message}`;
      this.stop();
      throw err;
    }));
  }

  /** Joins or moves to a specific channel right away. */
  async moveTo(channelId) {
    if (!channelId) throw new Error('NO_CHANNEL');
    if (this.channel?.id === channelId) return;
    this.channel = await this.connectFn(channelId, this.audio);
    this.changed();
  }

  async add(tracks, { next = false, now = false } = {}) {
    const room = config.maxQueue - this.queue.length;
    const list = tracks.slice(0, Math.max(0, room));
    if (next || now) this.queue.unshift(...list);
    else this.queue.push(...list);
    // play now: the current song goes to the history, the rest of the queue stays
    if (now && (this.current || this.loading)) { this.skip(); return list.length; }
    // do not wait for the stream: the dashboard gets an answer at once, playback follows
    if (!this.current && !this.loading) this.#run(this.#advance({}));
    else { this.changed(); this.#prefetchNext(); }
    return list.length;
  }

  #run(promise) {
    promise.catch((err) => log.warn(`Player (${this.guildId}):`, err.message));
  }

  #prefetchNext() {
    if (this.loop === 'track') return;
    prefetchStream(this.queue[0]);
  }

  async #play(track, seek = 0) {
    const id = ++this.playId;
    this.#killFfmpeg();
    this.current = track;
    this.seekBase = seek;
    this.loading = true;
    this.error = null;
    this.changed();
    try {
      // stream lookup and voice join run at the same time
      const [info] = await Promise.all([streamInfo(track), this.joining?.catch(() => null)]);
      if (id !== this.playId) return;
      const args = ['-hide_banner', '-loglevel', 'error'];
      if (/^https?:/.test(info.url)) {
        args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
        const headers = Object.entries(info.headers).map(([k, v]) => `${k}: ${v}\r\n`).join('');
        if (headers) args.push('-headers', headers);
      }
      if (seek > 0 && !info.isLive) args.push('-ss', String(seek));
      args.push('-i', info.url, '-vn');
      const af = FILTERS[this.filter];
      if (af) args.push('-af', af);
      args.push('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');
      const ff = spawn(bins.ffmpeg, args, { windowsHide: true });
      ff.stderr.on('data', (d) => {
        const msg = String(d).trim();
        log.warn('ffmpeg:', msg);
        // stream link expired or was refused: fetch a fresh one once and continue at the same spot
        if (/403|410|Forbidden/i.test(msg) && id === this.playId && !track.retried) {
          track.retried = true;
          forgetStream(track);
          const pos = this.position;
          this.#run(this.#play(track, pos > 1 ? pos : seek));
        }
      });
      ff.on('error', (e) => log.error('ffmpeg start:', e.message));
      ff.stdout.on('error', () => {});
      this.ffmpeg = ff;
      // ~20 s read-ahead buffer: short network hiccups no longer cause jumps or gaps
      const buffer = new PassThrough({ highWaterMark: 4 * 1024 * 1024 });
      ff.stdout.pipe(buffer);
      const resource = createAudioResource(buffer, {
        inputType: StreamType.Raw, inlineVolume: true, metadata: { playId: id },
      });
      resource.volume.setVolume(this.volume / 100);
      this.resource = resource;
      this.loading = false;
      this.audio.play(resource);
      this.failures = 0;
      if (seek === 0 && !track.retried) this.emit('trackStart', track);
      setTimeout(() => { if (id === this.playId) delete track.retried; }, 30_000);
      this.#prefetchNext();
    } catch (err) {
      if (id !== this.playId) return;
      log.warn(`Konnte "${track.title}" nicht abspielen:`, err.message);
      this.loading = false;
      this.error = `${track.title}: ${err.message}`;
      this.history.push(track);
      this.current = null;
      // after several failures in a row stop, instead of emptying the whole queue
      if (++this.failures >= 3) {
        this.failures = 0;
        this.playId++;
        this.changed();
        return;
      }
      await this.#advance({});
    }
  }

  #killFfmpeg() {
    if (this.ffmpeg) {
      try { this.ffmpeg.kill('SIGKILL'); } catch { /* ignore */ }
      this.ffmpeg = null;
    }
  }

  async #advance({ finished = false }) {
    const prev = this.current;
    if (prev && finished && this.loop === 'track') return this.#play(prev);
    if (prev) {
      this.history.push(prev);
      if (this.history.length > 50) this.history.shift();
      if (this.loop === 'queue') this.queue.push({ ...prev, id: `${prev.id}r${Date.now() % 1e5}` });
    }
    this.current = null;
    this.resource = null;
    let next = this.queue.shift();
    if (!next && this.autoplay && prev) next = await this.#related(prev);
    if (!next) {
      this.playId++;
      this.#killFfmpeg();
      this.audio.stop(true);
      this.changed();
      return;
    }
    await this.#play(next);
  }

  async #related(track) {
    try {
      const vid = track.url?.match(/[?&]v=([\w-]{11})/)?.[1];
      if (!vid) return null;
      const out = await runYtdlp(['--flat-playlist', '-J', '--playlist-items', '2:8', `https://www.youtube.com/watch?v=${vid}&list=RD${vid}`]);
      const recent = new Set(this.history.slice(-25).map((t) => t.url));
      const entries = (JSON.parse(out).entries || []).map((e) => toTrack(e)).filter((t) => !recent.has(t.url));
      return entries[0] ? { ...entries[0], autoplay: true } : null;
    } catch (err) {
      log.warn('Autoplay:', err.message);
      return null;
    }
  }

  /* ---------- controls ---------- */
  pause() { this.audio.pause(); this.changed(); }
  resume() { this.audio.unpause(); this.changed(); }
  toggle() { return this.paused ? this.resume() : this.pause(); }
  // skip, previous, jump and seek answer at once; the new track follows via the live updates
  skip() { this.playId++; this.#run(this.#advance({ finished: false })); }

  previous() {
    if (this.current && this.position > 5) return this.seek(0);
    const prev = this.history.pop();
    if (!prev) return this.seek(0);
    if (this.current) this.queue.unshift(this.current);
    this.current = null;
    this.#run(this.#play(prev));
    return undefined;
  }

  seek(seconds) {
    if (!this.current) return;
    const s = Math.max(0, Math.min(Number(seconds) || 0, (this.current.duration || 1e9) - 1));
    const wasPaused = this.paused;
    this.#run(this.#play(this.current, s).then(() => { if (wasPaused) this.pause(); }));
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(150, Math.round(Number(v) || 0)));
    this.resource?.volume?.setVolume(this.volume / 100);
    this.changed();
  }

  setLoop(mode) {
    this.loop = LOOPS.includes(mode) ? mode : LOOPS[(LOOPS.indexOf(this.loop) + 1) % LOOPS.length];
    this.changed();
  }

  async setFilter(name) {
    if (!(name in FILTERS)) throw new Error('Unbekannter Filter');
    const pos = this.position;
    this.filter = name;
    if (this.current && !this.loading) await this.seek(pos);
    else this.changed();
  }

  setAutoplay(on) { this.autoplay = !!on; this.changed(); }

  remove(id) {
    const i = this.queue.findIndex((t) => t.id === id);
    if (i >= 0) this.queue.splice(i, 1);
    this.changed();
  }

  move(id, to) {
    const i = this.queue.findIndex((t) => t.id === id);
    if (i < 0) return;
    const [t] = this.queue.splice(i, 1);
    this.queue.splice(Math.max(0, Math.min(Number(to) || 0, this.queue.length)), 0, t);
    this.changed();
  }

  jump(id) {
    const i = this.queue.findIndex((t) => t.id === id);
    if (i < 0) return;
    const [t] = this.queue.splice(i, 1);
    this.queue.unshift(t);
    this.skip();
  }

  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.changed();
  }

  clear() { this.queue = []; this.changed(); }

  stop() {
    this.queue = [];
    this.playId++;
    if (this.current) this.history.push(this.current);
    this.current = null;
    this.resource = null;
    this.#killFfmpeg();
    this.audio.stop(true);
    this.changed();
  }

  leave() {
    this.voiceGen = (this.voiceGen || 0) + 1;
    this.playId++;
    this.loading = false;
    this.stop();
    this.channel = null;
    this.disconnectFn?.();
    this.changed();
  }

  destroy() {
    this.stop();
    this.removeAllListeners();
  }
}
