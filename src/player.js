import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import {
  AudioPlayerStatus, NoSubscriberBehavior, StreamType, createAudioPlayer, createAudioResource,
} from '@discordjs/voice';
import { bins } from './binaries.js';
import { config } from './config.js';
import { log } from './log.js';
import { prefetchStream, runYtdlp, streamInfo, toTrack } from './resolve.js';

export const FILTERS = {
  none: null,
  bassboost: 'bass=g=8:f=110,volume=-5dB', // fixed headroom instead of a normaliser, so nothing pumps
  nightcore: 'asetrate=48000*1.25,aresample=48000,atempo=1.0',
  vaporwave: 'asetrate=48000*0.8,aresample=48000',
  '8d': 'apulsator=hz=0.08',
  karaoke: 'stereotools=mlev=0.03',
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
      error: this.error,
      updatedAt: Date.now(),
    };
  }

  /** Joins a voice channel: the chosen one (dashboard setting) or the one the user is in. */
  async ensureVoice(member, channelId = null) {
    if (this.channel) return;
    const target = channelId || member?.voiceChannelId;
    if (!target) throw new Error('NOT_IN_VOICE');
    this.channel = await this.connectFn(target, this.audio);
    this.changed();
  }

  /** Joins or moves to a specific channel right away. */
  async moveTo(channelId) {
    if (!channelId) throw new Error('NO_CHANNEL');
    if (this.channel?.id === channelId) return;
    this.channel = await this.connectFn(channelId, this.audio);
    this.changed();
  }

  async add(tracks, { next = false } = {}) {
    const room = config.maxQueue - this.queue.length;
    const list = tracks.slice(0, Math.max(0, room));
    if (next) this.queue.unshift(...list);
    else this.queue.push(...list);
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
      const info = await streamInfo(track);
      if (id !== this.playId) return;
      const args = ['-hide_banner', '-loglevel', 'error', '-probesize', '512k', '-analyzeduration', '0'];
      if (/^https?:/.test(info.url)) {
        args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_on_network_error', '1', '-reconnect_delay_max', '5', '-rw_timeout', '15000000');
        const headers = Object.entries(info.headers).map(([k, v]) => `${k}: ${v}\r\n`).join('');
        if (headers) args.push('-headers', headers);
      }
      if (seek > 0 && !info.isLive) args.push('-ss', String(seek));
      args.push('-i', info.url, '-vn');
      const af = FILTERS[this.filter];
      if (af) args.push('-af', af);
      args.push('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');
      const ff = spawn(bins.ffmpeg, args, { windowsHide: true });
      ff.stderr.on('data', (d) => log.warn('ffmpeg:', String(d).trim()));
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
