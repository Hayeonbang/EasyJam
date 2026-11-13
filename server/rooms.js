// 합주 방(room) 상태 관리. 네트워크와 분리된 순수 로직이라 단위 테스트가 가능하다.
//
// 연결 객체(conn)는 { send(obj), close() } 만 있으면 된다.
// 시간은 생성자에 주입한 now()로만 읽는다.

const LEAD_MS = 800; // 재생 명령 후 실제 시작까지의 여유 (모든 기기가 같은 순간에 출발하도록)
const ON_BEAT_MS = 90; // 이 범위 안이면 "박자에 맞음"으로 집계
const BUCKET_MS = 10_000; // 참여도 타임라인 한 칸
const MAX_BUCKETS = 720; // 2시간
const ROOM_IDLE_MS = 30 * 60_000; // 아무도 없는 방 정리
const NOTE_RATE = 30; // 초당 허용 음표 수
const NOTE_BURST = 60;

const INSTRUMENTS = new Set(['piano', 'saxophone', 'percussion1', 'percussion2']);
const TURN_MODES = new Set(['all', 'solo', 'rotate', 'echo']);
const ECHO_SLOTS = 8; // 따라 치기 리듬 한 마디의 칸 수 (8분음표)
const DEFAULT_PATTERN = [1, 0, 1, 0, 1, 0, 1, 0];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  // 제어 문자를 지우고 길이를 제한한다 (화면에는 textContent로만 넣는다)
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);
}

function cleanId(raw) {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(raw) ? raw : null;
}

function cleanPattern(raw) {
  if (!Array.isArray(raw) || raw.length !== ECHO_SLOTS) return null;
  const p = raw.map((v) => (v ? 1 : 0));
  return p.includes(1) ? p : null; // 빈 리듬은 따라 칠 것이 없다
}

function newStats() {
  return {
    notes: 0, onBeat: 0, absDev: 0, timed: 0, cheers: 0, firstAt: 0, lastAt: 0, buckets: [],
    // 따라 치기: 해 본 횟수, 맞춘 칸, 쳐야 했던 칸, 리듬에 없는 칸, 전부 맞춘 횟수
    echoRounds: 0, echoMatched: 0, echoTotal: 0, echoExtra: 0, echoPerfect: 0,
  };
}

export function transportPos(t, now) {
  if (!t.playing) return t.pos;
  return t.pos + (Math.max(0, now - t.at) / 1000) * t.rate;
}

export class RoomManager {
  constructor({ now = Date.now, random = Math.random } = {}) {
    this.now = now;
    this.random = random;
    this.rooms = new Map();
  }

  // ---- 연결 수명 주기 -------------------------------------------------

  handleMessage(conn, msg) {
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

    if (msg.type === 'ping') {
      // 시계 동기화용. 방에 들어오기 전에도 응답한다.
      conn.send({ type: 'pong', t0: msg.t0, t: this.now() });
      return;
    }
    if (msg.type === 'hello') return this.#hello(conn, msg);

    const room = conn.room;
    const me = room && room.people.get(conn.pid);
    if (!me || me.conn !== conn) return; // 아직 입장 전이거나 교체된 옛 연결

    room.touchedAt = this.now();
    switch (msg.type) {
      case 'note':
        return this.#note(room, me, msg);
      case 'echo':
        return this.#echo(room, me, msg);
      case 'transport':
        return me.role === 'host' && this.#transport(room, msg);
      case 'control':
        return me.role === 'host' && this.#control(room, msg);
      case 'turn':
        return me.role === 'host' && this.#turn(room, msg);
      case 'cheer':
        return me.role === 'host' && this.#cheer(room, msg);
      case 'backing':
        return me.role === 'host' && this.#backing(room, msg);
      case 'remove':
        return me.role === 'host' && this.#remove(room, msg);
      default:
        return;
    }
  }

  handleClose(conn) {
    const room = conn.room;
    if (!room) return;
    const me = room.people.get(conn.pid);
    if (!me || me.conn !== conn) return; // 재접속으로 이미 교체된 연결이면 무시
    me.conn = null;
    me.online = false;
    room.touchedAt = this.now();

    // 진행자가 모두 나가면 음악을 멈춘다 (아무도 멈출 수 없는 상태를 막는다)
    if (me.role === 'host' && !this.#hostOnline(room) && room.transport.playing) {
      const t = room.transport;
      room.transport = { playing: false, pos: transportPos(t, this.now()), at: this.now(), rate: t.rate };
    }
    this.#broadcastRoom(room);
  }

  /** 1초마다 호출: 통계 전송, 빈 방 정리 */
  tick() {
    const now = this.now();
    for (const [code, room] of this.rooms) {
      if (room.statsDirty) {
        room.statsDirty = false;
        this.#sendStats(room);
      }
      const anyone = [...room.people.values()].some((p) => p.online);
      if (!anyone && now - room.touchedAt > ROOM_IDLE_MS) this.rooms.delete(code);
    }
  }

  // ---- 입장 -----------------------------------------------------------

  #hello(conn, msg) {
    const role = msg.role === 'host' ? 'host' : 'player';
    const id = cleanId(msg.id);
    if (!id) return conn.send({ type: 'error', code: 'bad-id' });

    let code = typeof msg.room === 'string' ? msg.room.trim() : '';
    let room = this.rooms.get(code);

    if (!room) {
      if (role !== 'host') return conn.send({ type: 'error', code: 'no-room' });
      // 진행자가 새로고침한 경우 같은 방 번호를 다시 쓸 수 있게 한다
      if (!/^\d{4}$/.test(code)) code = this.#newCode();
      room = this.#createRoom(code);
    }

    // 다른 방에 있던 연결이면 먼저 정리
    if (conn.room && conn.room !== room) this.handleClose(conn);

    let me = room.people.get(id);
    if (me) {
      // 재접속: 통계와 설정은 그대로 두고 연결만 바꾼다
      if (me.conn && me.conn !== conn) {
        const old = me.conn;
        me.conn = null;
        old.send({ type: 'error', code: 'replaced' });
        old.close();
      }
    } else {
      me = {
        id,
        role,
        name: '',
        instrument: null,
        online: false,
        conn: null,
        joinedAt: this.now(),
        settings: { assist: 2, volume: 1, muted: false, calm: false },
        stats: newStats(),
        tokens: NOTE_BURST,
        tokenAt: this.now(),
      };
      room.people.set(id, me);
    }
    me.role = role;
    me.name = cleanName(msg.name) || (role === 'host' ? '진행자' : `참여자 ${room.people.size}`);
    if (role === 'player') me.instrument = INSTRUMENTS.has(msg.instrument) ? msg.instrument : 'piano';
    me.conn = conn;
    me.online = true;
    conn.room = room;
    conn.pid = id;
    room.touchedAt = this.now();

    conn.send({ type: 'welcome', id, now: this.now(), room: this.#snapshot(room) });
    this.#broadcastRoom(room, conn);
    if (role === 'host') this.#sendStats(room, conn);
  }

  #newCode() {
    for (let i = 0; i < 10_000; i++) {
      const code = String(Math.floor(this.random() * 9000) + 1000);
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('방 번호를 만들 수 없습니다');
  }

  #createRoom(code) {
    const now = this.now();
    const room = {
      code,
      createdAt: now,
      touchedAt: now,
      people: new Map(),
      transport: { playing: false, pos: 0, at: now, rate: 1 },
      turn: { mode: 'all', target: null, bars: 4, pattern: [...DEFAULT_PATTERN] },
      backing: 'host', // 'host' = 진행자 기기에서만 반주, 'all' = 모든 기기에서 반주
      statsDirty: false,
    };
    this.rooms.set(code, room);
    return room;
  }

  // ---- 진행자 명령 ----------------------------------------------------

  #transport(room, msg) {
    const now = this.now();
    const t = room.transport;
    const pos = transportPos(t, now);
    switch (msg.action) {
      case 'play':
        if (t.playing) return;
        room.transport = { playing: true, pos, at: now + LEAD_MS, rate: t.rate };
        break;
      case 'pause':
        if (!t.playing) return;
        room.transport = { playing: false, pos, at: now, rate: t.rate };
        break;
      case 'stop':
        room.transport = { playing: false, pos: 0, at: now, rate: t.rate };
        break;
      case 'seek':
        if (!isNum(msg.pos)) return;
        room.transport = {
          playing: t.playing,
          pos: clamp(msg.pos, 0, 3600),
          at: t.playing ? now + LEAD_MS : now,
          rate: t.rate,
        };
        break;
      case 'rate':
        if (!isNum(msg.rate)) return;
        // 속도를 바꿀 때는 현재 위치에서 다시 기준점을 잡아야 위치가 튀지 않는다
        room.transport = { playing: t.playing, pos, at: now, rate: clamp(msg.rate, 0.5, 1.25) };
        break;
      default:
        return;
    }
    this.#broadcastRoom(room);
  }

  #control(room, msg) {
    const target = room.people.get(msg.target);
    const s = msg.settings;
    if (!target || target.role !== 'player' || !s || typeof s !== 'object') return;
    if (isNum(s.assist)) target.settings.assist = clamp(Math.round(s.assist), 1, 3);
    if (isNum(s.volume)) target.settings.volume = clamp(s.volume, 0, 1);
    if (typeof s.muted === 'boolean') target.settings.muted = s.muted;
    if (typeof s.calm === 'boolean') target.settings.calm = s.calm;
    this.#broadcastRoom(room);
  }

  #turn(room, msg) {
    if (!TURN_MODES.has(msg.mode)) return;
    const turn = { mode: msg.mode, target: null, bars: room.turn.bars, pattern: room.turn.pattern };
    if (msg.pattern !== undefined) {
      const pattern = cleanPattern(msg.pattern);
      if (!pattern) return;
      turn.pattern = pattern;
    }
    if (isNum(msg.bars)) turn.bars = clamp(Math.round(msg.bars), 1, 16);
    if (msg.mode === 'solo') {
      const target = room.people.get(msg.target);
      if (!target || target.role !== 'player') return;
      turn.target = target.id;
    }
    room.turn = turn;
    this.#broadcastRoom(room);
  }

  #cheer(room, msg) {
    const target = room.people.get(msg.target);
    if (!target || target.role !== 'player') return;
    target.stats.cheers++;
    room.statsDirty = true;
    if (target.conn) target.conn.send({ type: 'cheer' });
  }

  #backing(room, msg) {
    if (msg.mode !== 'host' && msg.mode !== 'all') return;
    room.backing = msg.mode;
    this.#broadcastRoom(room);
  }

  #remove(room, msg) {
    const target = room.people.get(msg.target);
    if (!target || target.role !== 'player') return;
    if (target.conn) {
      const c = target.conn;
      target.conn = null;
      c.send({ type: 'error', code: 'removed' });
      c.room = null;
      c.close();
    }
    room.people.delete(target.id);
    if (room.turn.target === target.id) room.turn = { ...room.turn, mode: 'all', target: null };
    this.#broadcastRoom(room);
    this.#sendStats(room);
  }

  // ---- 연주 기록 ------------------------------------------------------

  #note(room, me, msg) {
    if (me.role !== 'player') return;
    const now = this.now();

    // 토큰 버킷: 고장난 입력 장치나 눌린 채 고정된 키가 서버를 뒤덮지 못하게 한다
    me.tokens = Math.min(NOTE_BURST, me.tokens + ((now - me.tokenAt) / 1000) * NOTE_RATE);
    me.tokenAt = now;
    if (me.tokens < 1) return;
    me.tokens -= 1;

    const st = me.stats;
    st.notes++;
    if (!st.firstAt) st.firstAt = now;
    st.lastAt = now;
    // dev: 가장 가까운 박자 격자에서 벗어난 정도(ms). 음악이 멈춰 있을 때는 보내지 않는다.
    if (isNum(msg.dev)) {
      const dev = clamp(Math.abs(msg.dev), 0, 1000);
      st.timed++;
      st.absDev += dev;
      if (dev <= ON_BEAT_MS) st.onBeat++;
    }
    const b = Math.floor((now - room.createdAt) / BUCKET_MS);
    if (b >= 0 && b < MAX_BUCKETS) {
      while (st.buckets.length <= b) st.buckets.push(0);
      st.buckets[b]++;
    }
    room.statsDirty = true;

    // 진행자 화면의 실시간 참여 표시용
    for (const p of room.people.values()) {
      if (p.role === 'host' && p.conn) p.conn.send({ type: 'note', from: me.id });
    }
  }

  /** 따라 치기 한 판의 결과 (참여자 기기가 채점해서 보낸다) */
  #echo(room, me, msg) {
    if (me.role !== 'player' || room.turn.mode !== 'echo') return;
    if (![msg.matched, msg.total, msg.extra].every((v) => Number.isInteger(v) && v >= 0 && v <= ECHO_SLOTS)) return;
    if (msg.total < 1 || msg.matched > msg.total) return;
    const now = this.now();
    // 한 판은 두 마디에 한 번뿐이므로 그보다 훨씬 잦으면 버린다
    if (me.echoAt && now - me.echoAt < 1000) return;
    me.echoAt = now;
    const st = me.stats;
    st.echoRounds++;
    st.echoMatched += msg.matched;
    st.echoTotal += msg.total;
    st.echoExtra += msg.extra;
    if (msg.matched === msg.total && msg.extra === 0) st.echoPerfect++;
    room.statsDirty = true;
  }

  // ---- 내보내기 -------------------------------------------------------

  #hostOnline(room) {
    for (const p of room.people.values()) if (p.role === 'host' && p.online) return true;
    return false;
  }

  #snapshot(room) {
    const people = [...room.people.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({
        id: p.id,
        role: p.role,
        name: p.name,
        instrument: p.instrument,
        online: p.online,
        settings: { ...p.settings },
      }));
    return {
      code: room.code,
      createdAt: room.createdAt,
      backing: room.backing,
      transport: { ...room.transport },
      turn: {
        ...room.turn,
        pattern: [...room.turn.pattern],
        // 돌아가며 연주할 순서: 지금 접속해 있는 참여자를 입장 순서대로
        order: people.filter((p) => p.role === 'player' && p.online).map((p) => p.id),
      },
      hostOnline: this.#hostOnline(room),
      people,
    };
  }

  #broadcastRoom(room, except = null) {
    const msg = { type: 'room', now: this.now(), room: this.#snapshot(room) };
    for (const p of room.people.values()) {
      if (p.conn && p.conn !== except) p.conn.send(msg);
    }
  }

  #sendStats(room, only = null) {
    const stats = {};
    for (const p of room.people.values()) {
      if (p.role === 'player') stats[p.id] = { ...p.stats, buckets: [...p.stats.buckets] };
    }
    const msg = { type: 'stats', now: this.now(), bucketMs: BUCKET_MS, stats };
    if (only) return only.send(msg);
    for (const p of room.people.values()) {
      if (p.role === 'host' && p.conn) p.conn.send(msg);
    }
  }
}
