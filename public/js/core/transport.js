// 트랜스포트: "지금 곡의 몇 초인가"를 관리하고, 필요하면 이 기기에서 반주를 재생한다.
//
// 상태는 { playing, pos, at, rate } 한 덩어리다.
//   재생 중일 때의 위치 = pos + (서버시각 - at) × rate
// 방에 들어가 있으면 서버가 이 상태를 모든 기기에 똑같이 보내 주므로,
// 각 기기는 타이머 없이 같은 위치를 계산한다.
//
// 혼자 연습할 때(followMedia)는 반대로, 실제로 들리는 반주가 기준이 된다. 반주가 늦게 출발하거나
// 잠깐 끊겨도 코드 표시와 박자 보정이 들리는 소리에 그대로 맞춰진다.
// (예전에는 시계를 기준으로 반주를 3%씩 빠르게/느리게 돌려 따라잡게 했는데, 따라잡는 몇 초 동안
//  박자 격자가 들리는 반주보다 앞서 있어서 누른 소리가 다음 박으로 밀렸다.)

import { locate } from './song.js';

const LEAD_MS = 800;
const SEEK_IF = 0.2; // 이보다 크게 어긋나면 바로 이동한다(초)
const NUDGE_IF = 0.01; // 이보다 작으면 그대로 둔다
const NUDGE_MAX = 0.03; // 속도 보정 한도 (3%)

export class Transport {
  /**
   * @param {{song: object, clock: {serverNow: () => number}}} opt
   */
  constructor({ song, clock, followMedia = false }) {
    this.song = song;
    this.clock = clock;
    this.followMedia = followMedia;
    this.state = { playing: false, pos: 0, at: 0, rate: 1 };
    this.backingEnabled = false;
    this.backingVolume = 1;
    this.blocked = false; // 브라우저가 자동재생을 막은 상태
    this.#listeners = new Set();
    setInterval(() => this.#sync(), 250);
  }

  #listeners;
  #media = null;
  #startTimer = null;
  #endedFor = null;
  #startLag = 0; // 이 기기에서 play()부터 실제로 소리가 나기까지 걸리는 시간(초), 재생할 때마다 배운다
  #startedAt = 0;
  #lagMeasured = true;
  #ct = { value: -1, at: 0, last: 0 }; // 반주 위치 읽기 (부드럽게 이어 붙이기용)

  onChange(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #notify(what) {
    for (const fn of this.#listeners) fn(what);
  }

  // ---- 위치 -----------------------------------------------------------

  position() {
    const s = this.state;
    if (!s.playing) return s.pos;
    if (this.#mediaIsMaster()) return this.#mediaPosition();
    const elapsed = Math.max(0, this.clock.serverNow() - s.at) / 1000;
    return Math.min(this.song.duration, s.pos + elapsed * s.rate);
  }

  #mediaIsMaster() {
    const m = this.#media;
    return this.followMedia && this.backingEnabled && !!m && !m.paused && m.readyState >= 2 && this.clock.serverNow() >= this.state.at;
  }

  /**
   * 반주의 currentTime은 브라우저마다 몇 ms~수십 ms 단위로 끊어서 갱신되므로,
   * 마지막으로 바뀐 순간부터 흐른 시간을 더해 매끄럽게 만든다. 거꾸로 가지 않게 한다.
   */
  #mediaPosition() {
    const m = this.#media;
    const now = performance.now();
    const c = this.#ct;
    const ct = m.currentTime;
    if (ct !== c.value) {
      c.value = ct;
      c.at = now;
    }
    let p = c.value + ((now - c.at) / 1000) * m.playbackRate;
    if (p < c.last && c.last - p < SEEK_IF) p = c.last;
    c.last = p;
    return Math.min(this.song.duration, p);
  }

  /** 재생 명령은 받았지만 아직 출발 전(준비 구간)인가 */
  get pending() {
    return this.state.playing && this.clock.serverNow() < this.state.at;
  }

  /** 실제로 소리가 흐르고 있는가 */
  get rolling() {
    return this.state.playing && !this.pending;
  }

  locate() {
    return locate(this.song, this.position());
  }

  // ---- 상태 변경 ------------------------------------------------------

  /** 서버에서 받은 상태를 적용한다 */
  setState(s) {
    this.state = { playing: !!s.playing, pos: s.pos, at: s.at, rate: s.rate };
    this.#endedFor = null;
    clearTimeout(this.#startTimer);
    if (this.pending) {
      // 출발 시각에 정확히 맞춰 반주를 시작한다
      const wait = this.state.at - this.clock.serverNow();
      this.#startTimer = setTimeout(() => this.#sync(), wait);
    }
    this.#sync();
    this.#notify('state');
  }

  // 방 없이 혼자 쓸 때의 조작. 방에 있을 때는 서버에 명령을 보내고 setState로 돌아온다.
  play() {
    if (this.state.playing) return;
    this.setState({ ...this.state, playing: true, pos: this.position(), at: this.clock.serverNow() + LEAD_MS });
  }

  pause() {
    if (!this.state.playing) return;
    this.setState({ ...this.state, playing: false, pos: this.position(), at: this.clock.serverNow() });
  }

  stop() {
    this.setState({ ...this.state, playing: false, pos: 0, at: this.clock.serverNow() });
  }

  setRate(rate) {
    this.setState({ ...this.state, pos: this.position(), at: this.clock.serverNow(), rate });
  }

  // ---- 반주 재생 ------------------------------------------------------

  setBacking(enabled) {
    this.backingEnabled = enabled;
    if (enabled) this.#ensureMedia();
    this.#sync();
  }

  setBackingVolume(v) {
    this.backingVolume = Math.min(1, Math.max(0, v));
    if (this.#media) this.#media.volume = this.backingVolume;
  }

  /** 사용자가 화면을 누른 순간에 호출: 이후에는 코드에서 재생을 시작할 수 있게 된다 */
  unlock() {
    if (!this.backingEnabled) return;
    const m = this.#ensureMedia();
    if (!m.paused) return;
    const was = m.muted;
    m.muted = true;
    m.play()
      .then(() => {
        if (!this.rolling) m.pause();
        m.muted = was;
        this.blocked = false;
        this.#sync();
        this.#notify('blocked');
      })
      .catch(() => {
        m.muted = was;
      });
  }

  #ensureMedia() {
    if (this.#media) return this.#media;
    const m = new Audio();
    m.preload = 'auto';
    m.src = this.song.src;
    m.volume = this.backingVolume;
    // 속도를 바꿔도 음높이는 그대로 (느리게 연습할 때 조가 바뀌면 안 된다)
    m.preservesPitch = true;
    m.addEventListener('error', () => {
      console.error('반주 음원을 불러오지 못했습니다', m.error);
      this.#notify('error');
      // 네트워크가 잠깐 끊겼을 수 있으니 잠시 뒤 다시 불러온다
      setTimeout(() => {
        if (this.#media === m) m.load();
      }, 2000);
    });
    this.#media = m;
    return m;
  }

  #sync() {
    this.#checkEnded();
    const m = this.#media;
    if (!m) return;

    if (!this.backingEnabled || !this.rolling) {
      if (!m.paused) m.pause();
      // 멈춰 있는 동안 다음 출발 위치로 미리 옮겨 둔다
      if (this.backingEnabled && m.readyState >= 1 && Math.abs(m.currentTime - this.state.pos) > 0.05) {
        m.currentTime = this.state.pos;
      }
      return;
    }

    const target = this.position();
    const rate = this.state.rate;
    if (m.readyState < 1) return; // 아직 길이도 모르는 상태. 다음 주기에 다시.

    if (m.paused) {
      this.#ct.last = 0;
      // 혼자 연습할 때는 반주가 기준이므로 출발 지연을 보정할 필요가 없다
      const lead = this.followMedia ? 0 : this.#startLag * rate;
      m.currentTime = Math.min(this.song.duration, target + lead);
      m.playbackRate = rate;
      this.#startedAt = performance.now();
      this.#lagMeasured = this.followMedia;
      m.play().then(
        () => {
          if (this.blocked) {
            this.blocked = false;
            this.#notify('blocked');
          }
        },
        (err) => {
          if (err && err.name === 'NotAllowedError' && !this.blocked) {
            this.blocked = true;
            this.#notify('blocked');
          }
        },
      );
      return;
    }

    if (this.followMedia) {
      // 반주가 기준: 속도 보정은 하지 않는다. 대신 시계 쪽 기준점을 반주 위치로 옮겨 두어,
      // 반주가 잠깐 버퍼링하느라 기준에서 빠져도 위치가 튀지 않게 한다.
      if (m.playbackRate !== rate) m.playbackRate = rate;
      if (this.#mediaIsMaster()) this.state = { ...this.state, pos: this.#mediaPosition(), at: this.clock.serverNow() };
      return;
    }

    // 여러 기기가 함께할 때: 공통 시계에 반주를 맞춘다 (늦으면 +)
    const late = target - m.currentTime;
    const sinceStart = performance.now() - this.#startedAt;
    if (!this.#lagMeasured && sinceStart > 500) {
      // 출발이 얼마나 늦었는지 배워 두고 다음 재생부터 그만큼 앞에서 출발한다
      this.#lagMeasured = true;
      this.#startLag = Math.min(0.4, Math.max(0, this.#startLag + late / rate));
    }
    if (Math.abs(late) > SEEK_IF) {
      m.currentTime = target; // 많이 어긋났으면 바로 이동
      m.playbackRate = rate;
    } else if (Math.abs(late) > NUDGE_IF) {
      // 어긋난 만큼에 비례해 살짝 빠르게/느리게 (약 1초에 걸쳐 따라잡는다)
      m.playbackRate = rate * (1 + Math.max(-NUDGE_MAX, Math.min(NUDGE_MAX, late)));
    } else if (m.playbackRate !== rate) {
      m.playbackRate = rate;
    }
  }

  #checkEnded() {
    if (!this.state.playing) return;
    if (this.position() >= this.song.duration - 0.05 && this.#endedFor !== this.state) {
      this.#endedFor = this.state;
      this.#notify('ended');
    }
  }
}
