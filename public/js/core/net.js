// 서버 연결: 자동 재접속 + 시계 동기화.
//
// 합주에서는 모든 기기가 "지금 곡의 몇 초인지"를 똑같이 알아야 한다.
// 기기마다 시계가 다르므로, 서버와 ping/pong을 주고받아 서버 시계와의 차이를 추정한다(NTP 방식).

const localNow = () => performance.timeOrigin + performance.now();

class Emitter {
  #handlers = new Map();
  on(type, fn) {
    if (!this.#handlers.has(type)) this.#handlers.set(type, new Set());
    this.#handlers.get(type).add(fn);
    return () => this.#handlers.get(type).delete(fn);
  }
  emit(type, data) {
    for (const fn of this.#handlers.get(type) || []) {
      try {
        fn(data);
      } catch (err) {
        console.error(`[${type}] 처리 중 오류`, err);
      }
    }
  }
}

/** 방 없이 혼자 연습할 때 쓰는 시계 */
export class LocalClock {
  serverNow() {
    return localNow();
  }
}

export class Connection extends Emitter {
  /**
   * @param {() => object} makeHello 접속할 때마다 보낼 입장 메시지를 만드는 함수
   */
  constructor(makeHello) {
    super();
    this.makeHello = makeHello;
    this.status = 'connecting'; // connecting | online | offline
    this.offset = 0; // 서버 시계 - 내 시계 (ms)
    this.synced = false;
    this.rtt = null;
    this.#samples = [];
    this.#connect();
    // 절전에서 깨어났거나 네트워크가 돌아오면 바로 다시 붙는다
    window.addEventListener('online', () => this.#retrySoon());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.#retrySoon();
    });
  }

  #ws = null;
  #samples;
  #attempt = 0;
  #retryTimer = null;
  #pingTimer = null;
  #lastPong = 0;
  #closed = false;

  serverNow() {
    return localNow() + this.offset;
  }

  send(type, data = {}) {
    if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify({ type, ...data }));
      return true;
    }
    return false;
  }

  /** 지금 연결을 끊고 잠시 뒤 다시 붙는다 */
  reconnect() {
    if (this.#ws) this.#ws.close();
  }

  /** 다시 접속하지 않고 완전히 끊는다 (방에서 내보내졌을 때 등) */
  close() {
    this.#closed = true;
    clearTimeout(this.#retryTimer);
    clearInterval(this.#pingTimer);
    if (this.#ws) this.#ws.close();
    this.#setStatus('offline');
  }

  #setStatus(s) {
    if (this.status === s) return;
    this.status = s;
    this.emit('status', s);
  }

  #connect() {
    if (this.#closed) return;
    clearTimeout(this.#retryTimer);
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    let ws;
    try {
      ws = new WebSocket(`${scheme}://${location.host}/ws`);
    } catch {
      return this.#scheduleRetry();
    }
    this.#ws = ws;

    ws.onopen = () => {
      if (this.#ws !== ws) return;
      this.#attempt = 0;
      this.#lastPong = localNow();
      this.#samples = [];
      this.#startPings();
      this.send('hello', this.makeHello());
    };
    ws.onmessage = (ev) => {
      if (this.#ws !== ws) return;
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'pong') return this.#onPong(msg);
      if (msg.type === 'welcome') this.#setStatus('online');
      this.emit(msg.type, msg);
    };
    ws.onclose = () => {
      if (this.#ws !== ws) return;
      this.#ws = null;
      clearInterval(this.#pingTimer);
      this.#setStatus(this.#closed ? 'offline' : 'connecting');
      this.#scheduleRetry();
    };
    ws.onerror = () => {
      // onclose가 이어서 호출되므로 여기서는 아무것도 하지 않는다
    };
  }

  #scheduleRetry() {
    if (this.#closed) return;
    // 0.5초 → 1초 → 2초 … 최대 5초. 약간의 무작위 값을 섞어 동시에 몰리지 않게 한다
    const delay = Math.min(5000, 500 * 2 ** this.#attempt) * (0.8 + Math.random() * 0.4);
    this.#attempt++;
    clearTimeout(this.#retryTimer);
    this.#retryTimer = setTimeout(() => this.#connect(), delay);
  }

  #retrySoon() {
    if (this.#closed || this.#ws) return;
    this.#attempt = 0;
    this.#connect();
  }

  #startPings() {
    clearInterval(this.#pingTimer);
    let n = 0;
    const ping = () => {
      // 6초 넘게 응답이 없으면 죽은 연결로 보고 새로 붙는다
      if (localNow() - this.#lastPong > 6000 && this.#ws) {
        this.#ws.close();
        return;
      }
      this.send('ping', { t0: localNow() });
      n++;
    };
    // 처음에는 빠르게 여러 번 재서 금방 정확해지게 하고, 그 뒤로는 2초마다
    ping();
    const fast = setInterval(() => {
      ping();
      if (n >= 6) clearInterval(fast);
    }, 150);
    this.#pingTimer = setInterval(ping, 2000);
  }

  #onPong(msg) {
    const t1 = localNow();
    this.#lastPong = t1;
    if (typeof msg.t0 !== 'number' || typeof msg.t !== 'number') return;
    const rtt = t1 - msg.t0;
    if (rtt < 0 || rtt > 3000) return;
    this.#samples.push({ rtt, offset: msg.t + rtt / 2 - t1 });
    if (this.#samples.length > 12) this.#samples.shift();
    // 왕복 시간이 가장 짧았던 측정이 가장 믿을 만하다
    const best = this.#samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    this.offset = best.offset;
    this.rtt = best.rtt;
    if (!this.synced) {
      this.synced = true;
      this.emit('synced');
    }
  }
}
