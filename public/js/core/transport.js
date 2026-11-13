// 트랜스포트: "지금 곡의 몇 초인가"를 관리하고, 필요하면 이 기기에서 반주를 재생한다.
//
// 상태는 { playing, pos, at, rate } 한 덩어리다.
//   재생 중일 때의 위치 = pos + (서버시각 - at) × rate
// 방에 들어가 있으면 서버가 이 상태를 모든 기기에 똑같이 보내 주므로,
// 각 기기는 타이머 없이 같은 위치를 계산한다.

import { locate } from './song.js';

const LEAD_MS = 800;

export class Transport {
  /**
   * @param {{song: object, clock: {serverNow: () => number}}} opt
   */
  constructor({ song, clock }) {
    this.song = song;
    this.clock = clock;
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
    const elapsed = Math.max(0, this.clock.serverNow() - s.at) / 1000;
    return Math.min(this.song.duration, s.pos + elapsed * s.rate);
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
      m.currentTime = target;
      m.playbackRate = rate;
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

    // 재생 중: 기준 위치와의 차이를 보정한다
    const err = m.currentTime - target;
    if (Math.abs(err) > 0.2) {
      m.currentTime = target; // 많이 어긋났으면 바로 이동
      m.playbackRate = rate;
    } else if (Math.abs(err) > 0.035) {
      m.playbackRate = rate * (err > 0 ? 0.97 : 1.03); // 조금 어긋났으면 살짝 빠르게/느리게
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
