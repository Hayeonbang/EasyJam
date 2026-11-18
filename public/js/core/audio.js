// 오디오 엔진: 샘플 미리 불러오기, 정확한 시각에 재생, 소리 겹침 관리.
//
// 예전 코드는 <audio> 태그를 그대로 재생해서 반응이 늦고, 같은 소리를 연달아 내면 씹혔다.
// 여기서는 Web Audio로 미리 디코딩해 두고 재생한다.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.starts = new Map(); // 샘플마다 앞의 무음 길이(초). 재생할 때 건너뛴다
    this.#loading = new Map();
    this.volume = 1; // 내 악기 음량 (0~1)
    this.gate = 1; // 차례가 아닐 때 0 (음소거)
  }

  #loading;
  #master = null;
  #bus = null;
  #cueBus = null; // 따라 치기 시범 소리용. 차례가 아니어서 내 악기가 막혀 있어도 들려야 한다.
  #voices = new Set();

  #ensure() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('이 브라우저는 Web Audio를 지원하지 않습니다');
    this.ctx = new Ctx({ latencyHint: 'interactive' });
    // 여러 음이 겹쳐도 깨지는 소리가 나지 않도록 마지막에 리미터를 둔다
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    this.#master = this.ctx.createGain();
    this.#master.gain.value = 0.9;
    this.#bus = this.ctx.createGain();
    this.#bus.connect(this.#master).connect(limiter).connect(this.ctx.destination);
    this.#cueBus = this.ctx.createGain();
    this.#cueBus.connect(this.#master);
    this.#applyBus(0);
    // 카메라를 켜거나 다른 앱이 소리를 가져가면 브라우저가 오디오를 멈출 때가 있다(iPad의 'interrupted' 등).
    // 한 번 켠 뒤에는 멈출 때마다 다시 켠다. 터치 없이 카메라로만 연주할 때 소리가 안 나던 문제.
    this.ctx.onstatechange = () => {
      if (this.wanted && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {});
    };
    return this.ctx;
  }

  /** 사용자가 화면을 누른 순간에 호출해야 한다 (브라우저 자동재생 정책) */
  async unlock() {
    const ctx = this.#ensure();
    this.wanted = true;
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        /* 다음 터치에서 다시 시도 */
      }
    }
    return ctx.state === 'running';
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** 여러 샘플을 불러온다. 실패한 것은 두 번 더 시도하고, 끝내 실패한 이름을 돌려준다. */
  async loadAll(map, onProgress) {
    const names = Object.keys(map);
    let done = 0;
    const failed = [];
    await Promise.all(
      names.map(async (name) => {
        try {
          await this.load(name, map[name]);
        } catch (err) {
          console.error(`소리를 불러오지 못했습니다: ${name}`, err);
          failed.push(name);
        }
        done++;
        if (onProgress) onProgress(done / names.length);
      }),
    );
    return failed;
  }

  load(name, url) {
    if (this.buffers.has(name)) return Promise.resolve(this.buffers.get(name));
    if (this.#loading.has(name)) return this.#loading.get(name);
    const p = (async () => {
      const ctx = this.#ensure();
      let lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.arrayBuffer();
          const buf = await ctx.decodeAudioData(data);
          this.buffers.set(name, buf);
          this.starts.set(name, leadingSilence(buf));
          return buf;
        } catch (err) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        }
      }
      throw lastErr;
    })();
    this.#loading.set(name, p);
    p.catch(() => this.#loading.delete(name)); // 실패하면 나중에 다시 시도할 수 있게
    return p;
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    this.#applyBus();
  }

  setGate(g) {
    this.gate = g;
    this.#applyBus();
  }

  #applyBus(ramp = 0.05) {
    if (!this.#bus) return;
    const target = this.volume * this.gate;
    const now = this.ctx.currentTime;
    this.#bus.gain.cancelScheduledValues(now);
    if (ramp > 0) this.#bus.gain.setTargetAtTime(target, now, ramp / 3);
    else this.#bus.gain.setValueAtTime(target, now);
    this.#cueBus.gain.setTargetAtTime(this.volume, now, 0.02);
  }

  /**
   * 샘플을 재생한다.
   * @param {string} name
   * @param {object} [opt]
   *   delay    지금부터 몇 초 뒤(박자 보정용)
   *   duration 이 시간 뒤에 스스로 잦아든다
   *   detune   음높이 조절(센트). 타악기를 칠 때마다 조금씩 다르게 들리게 한다
   *   cue      시범 소리: 차례 음소거와 stopAll의 영향을 받지 않는다
   * @returns {{stop: (fade?: number) => void} | null}
   */
  play(name, { delay = 0, gain = 1, duration = 0, detune = 0, cue = false } = {}) {
    const buf = this.buffers.get(name);
    if (!buf) return null;
    if (!this.running) {
      // 멈춰 있으면 다시 켜 보고, 이번 소리는 켜지는 대로 낸다
      if (!this.wanted) return null;
      this.ctx.resume().catch(() => {});
      if (this.ctx.state === 'closed') return null;
    }
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(cue ? this.#cueBus : this.#bus);
    const when = ctx.currentTime + Math.max(0, delay);
    if (detune && src.detune) src.detune.value = detune; // 지원하지 않는 옛 브라우저에서는 그냥 재생
    // 샘플 앞의 무음은 건너뛴다 (색소폰 샘플은 약 40ms가 비어 있어 누른 뒤 한 박자 늦게 들렸다)
    src.start(when, this.starts.get(name) || 0);
    if (duration > 0) {
      g.gain.setValueAtTime(gain, when + duration);
      g.gain.linearRampToValueAtTime(0, when + duration + 0.08);
      src.stop(when + duration + 0.1);
    }

    const voice = {
      cue,
      stopped: false,
      stop: (fade = 0.12) => {
        if (voice.stopped) return;
        voice.stopped = true;
        const t = Math.max(ctx.currentTime, when);
        try {
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0, t + fade);
          src.stop(t + fade + 0.02);
        } catch {
          /* 이미 끝난 소리 */
        }
      },
    };
    this.#voices.add(voice);
    src.onended = () => {
      voice.stopped = true;
      this.#voices.delete(voice);
      g.disconnect();
    };
    // 소리가 너무 많이 쌓이면 가장 오래된 것부터 정리한다 (저사양 태블릿 보호)
    if (this.#voices.size > 24) {
      const oldest = this.#voices.values().next().value;
      oldest.stop(0.05);
      this.#voices.delete(oldest);
    }
    return voice;
  }

  stopAll(fade = 0.1) {
    for (const v of [...this.#voices]) if (!v.cue) v.stop(fade);
  }
}

/**
 * 샘플이 실제로 소리 나기 시작하는 지점(초). 최고 음량의 2%를 처음 넘는 곳에서
 * 2ms 앞을 시작점으로 잡는다 (소리의 첫 어택은 자르지 않는다).
 */
function leadingSilence(buf) {
  const ch = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  if (peak === 0) return 0;
  const limit = peak * 0.02;
  const max = Math.min(ch.length, Math.floor(buf.sampleRate * 0.2)); // 0.2초 넘게는 찾지 않는다
  for (let i = 0; i < max; i++) {
    if (Math.abs(ch[i]) > limit) return Math.max(0, i / buf.sampleRate - 0.002);
  }
  return 0;
}
