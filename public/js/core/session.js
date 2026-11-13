// 악기 화면 공통 코드: 접속, 반주 동기화, 상단 바, 차례/멈춤 안내, 진행자가 보낸 설정 적용.
// 악기별 파일(piano.js 등)은 "어떤 입력에 어떤 소리를 낼지"만 다룬다.

import { SUNNY, locate, nearestGrid, turnAt, echoAt, cuesBetween, scoreEcho, ECHO_SLOTS } from './song.js';
import { Connection, LocalClock } from './net.js';
import { AudioEngine } from './audio.js';
import { Transport } from './transport.js';
import { art } from './art.js';

export const INSTRUMENT_NAMES = {
  piano: '피아노',
  saxophone: '색소폰',
  percussion1: '셰이커 · 트라이앵글',
  percussion2: '콩가 · 탬버린',
};

const ART = { piano: 'piano', saxophone: 'saxophone', percussion1: 'shaker', percussion2: 'conga' };

const ASSIST_NAMES = { 1: '쉬움', 2: '보통', 3: '도전' };

/** 작은 DOM 헬퍼. 문자열은 항상 textContent로 들어가므로 이름 등에 HTML이 섞여도 안전하다. */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clientId() {
  // 탭마다 고유한 번호. 새로고침해도 유지되어 같은 참여자로 다시 들어간다.
  let id = null;
  try {
    id = sessionStorage.getItem('easyjam.id');
  } catch {
    /* 저장소를 못 쓰는 환경 */
  }
  if (!id) {
    id = 'p' + Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
    try {
      sessionStorage.setItem('easyjam.id', id);
    } catch {
      /* 무시 */
    }
  }
  return id;
}

/**
 * @param {{instrument: string, sounds: Record<string,string>}} opt
 */
export function createSession({ instrument, sounds }) {
  const params = new URLSearchParams(location.search);
  const roomCode = (params.get('room') || '').trim();
  const myName = (params.get('name') || '').trim().slice(0, 16);
  const inRoom = roomCode !== '';
  const id = clientId();
  const song = SUNNY;

  const audio = new AudioEngine();
  const conn = inRoom
    ? new Connection(() => ({ role: 'player', room: roomCode, name: myName, instrument, id }))
    : null;
  const transport = new Transport({ song, clock: conn || new LocalClock() });

  const session = {
    song,
    audio,
    transport,
    inRoom,
    id,
    assist: Number(localStorage.getItem('easyjam.assist')) || 2,
    calm: localStorage.getItem('easyjam.calm') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches,
    started: false,
    room: null,
  };

  const listeners = { frame: new Set(), chord: new Set(), settings: new Set(), gate: new Set(), cue: new Set() };
  session.on = (type, fn) => listeners[type].add(fn);
  const fire = (type, ...args) => listeners[type].forEach((fn) => fn(...args));

  // ---- 화면 뼈대 ------------------------------------------------------

  const el = {};
  el.conn = h('span', { class: 'pill', text: inRoom ? '연결 중…' : '혼자 연습' });
  el.chord = h('span', { class: 'chord-now', text: '–' });
  el.next = h('span', { class: 'chord-next', text: '' });
  el.dots = h('span', { class: 'beat-dots', 'aria-hidden': 'true' }, [0, 1, 2, 3].map(() => h('i')));
  el.controls = h('div', { class: 'bar-controls' });
  el.prog = h('i');
  el.banner = h('div', { class: 'banner', role: 'status', 'aria-live': 'polite' });
  // 따라 치기 리듬 띠: 한 마디를 8칸으로 보여 준다
  el.echo = h('div', { class: 'echo-strip', hidden: true, 'aria-hidden': 'true' }, Array.from({ length: ECHO_SLOTS }, () => h('i')));
  el.toast = h('div', { class: 'toast', role: 'alert' });
  el.cheer = h('div', { class: 'cheer', 'aria-hidden': 'true' }, h('span', { text: '👏' }), h('b', { text: '잘했어요!' }));

  const bar = h(
    'header',
    { class: 'bar' },
    h('a', { class: 'bar-back', href: '/', 'aria-label': '처음 화면으로', text: '←' }),
    h('div', { class: 'bar-title' }, h('b', { text: INSTRUMENT_NAMES[instrument] || instrument }), el.conn),
    h('div', { class: 'bar-chord' }, el.dots, el.chord, el.next),
    el.controls,
    h('div', { class: 'chord-progress', 'aria-hidden': 'true' }, el.prog),
  );
  document.body.dataset.inst = instrument;
  document.body.prepend(bar, el.banner, el.echo);
  document.body.append(el.toast, el.cheer);
  document.body.classList.toggle('calm', session.calm);

  let toastTimer = null;
  session.toast = (text, ms = 3500) => {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  };

  // 혼자 연습할 때만 보이는 조작 버튼 (방에서는 진행자가 조작한다)
  if (!inRoom) {
    const playBtn = h('button', { class: 'btn icon', 'aria-label': '재생', text: '▶', onclick: () => {
      audio.unlock();
      transport.unlock();
      if (transport.state.playing) transport.pause();
      else transport.play();
    } });
    const stopBtn = h('button', { class: 'btn icon', 'aria-label': '처음으로', text: '■', onclick: () => transport.stop() });
    const tempo = h('select', { class: 'select', 'aria-label': '빠르기', onchange: (e) => transport.setRate(Number(e.target.value)) },
      [['0.7', '느리게'], ['0.85', '조금 느리게'], ['1', '원래 빠르기']].map(([v, t]) => h('option', { value: v, text: t, selected: v === '1' })));
    const level = h('select', { class: 'select', 'aria-label': '도움 단계', onchange: (e) => applySettings({ assist: Number(e.target.value) }, true) },
      [1, 2, 3].map((n) => h('option', { value: n, text: ASSIST_NAMES[n], selected: n === session.assist })));
    const calm = h('button', { class: 'btn', 'aria-pressed': String(session.calm), text: '차분한 화면', onclick: () => {
      applySettings({ calm: !session.calm }, true);
      calm.setAttribute('aria-pressed', String(session.calm));
    } });
    el.controls.append(playBtn, stopBtn, tempo, level, calm);
    transport.onChange(() => {
      playBtn.textContent = transport.state.playing ? '❚❚' : '▶';
      playBtn.setAttribute('aria-label', transport.state.playing ? '일시정지' : '재생');
    });
    transport.setBacking(true);
  }

  // ---- 시작 화면 (첫 터치로 소리 잠금 해제) ----------------------------

  const startBtn = h('button', { class: 'btn big', text: '불러오는 중…', disabled: true });
  const startNote = h('p', { class: 'start-note', text: '소리를 준비하고 있어요' });
  const startOverlay = h(
    'div',
    { class: 'overlay start' },
    h('div', { class: 'card' },
      ART[instrument] ? art(ART[instrument], 'start-art') : null,
      h('h1', { text: INSTRUMENT_NAMES[instrument] || instrument }),
      myName ? h('p', { class: 'hello', text: `${myName} 님, 반가워요!` }) : null,
      startBtn,
      startNote,
    ),
  );
  document.body.append(startOverlay);

  const loaded = audio.loadAll(sounds, (p) => {
    if (!session.started) startBtn.textContent = `불러오는 중… ${Math.round(p * 100)}%`;
  });
  loaded.then((failed) => {
    startBtn.disabled = false;
    startBtn.textContent = '시작하기';
    startNote.textContent = failed.length
      ? `소리 ${failed.length}개를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.`
      : '버튼을 누르면 소리가 켜져요';
    startBtn.focus();
  });
  startBtn.addEventListener('click', async () => {
    await audio.unlock();
    transport.unlock();
    session.started = true;
    startOverlay.remove();
    keepAwake();
    fire('settings');
  });
  // 그 뒤로도 터치할 때마다 확인: 절전 후 오디오가 멈춰 있으면 다시 켠다
  document.addEventListener('pointerdown', () => {
    if (session.started && !audio.running) audio.unlock();
    if (session.started && transport.blocked) transport.unlock();
  });

  // 세션 중 화면이 꺼지지 않게 한다
  let wakeLock = null;
  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch {
      /* 지원하지 않거나 거부됨 */
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && session.started && (!wakeLock || wakeLock.released)) keepAwake();
  });

  // ---- 설정 -----------------------------------------------------------

  function applySettings(s, save = false) {
    if (typeof s.assist === 'number') session.assist = s.assist;
    if (typeof s.calm === 'boolean') session.calm = s.calm;
    if (typeof s.volume === 'number') audio.setVolume(s.volume);
    if (typeof s.muted === 'boolean') session.muted = s.muted;
    document.body.classList.toggle('calm', session.calm);
    document.body.dataset.assist = String(session.assist);
    if (save) {
      try {
        localStorage.setItem('easyjam.assist', String(session.assist));
        localStorage.setItem('easyjam.calm', session.calm ? '1' : '0');
      } catch {
        /* 무시 */
      }
    }
    fire('settings');
  }
  session.muted = false;
  document.body.dataset.assist = String(session.assist);

  // ---- 서버 메시지 ----------------------------------------------------

  function applyRoom(room) {
    session.room = room;
    transport.setState(room.transport);
    transport.setBacking(room.backing === 'all');
    const me = room.people.find((p) => p.id === id);
    if (me) applySettings(me.settings);
  }

  if (conn) {
    conn.on('status', (s) => {
      el.conn.textContent = s === 'online' ? `방 ${roomCode}` : '다시 연결 중…';
      el.conn.classList.toggle('warn', s !== 'online');
    });
    conn.on('welcome', (m) => applyRoom(m.room));
    conn.on('room', (m) => applyRoom(m.room));
    // 시계 보정이 끝나면 위치 계산이 달라지므로 반주를 다시 맞춘다
    conn.on('synced', () => session.room && transport.setState(session.room.transport));
    conn.on('cheer', () => {
      el.cheer.classList.remove('show');
      void el.cheer.offsetWidth; // 애니메이션 다시 시작
      el.cheer.classList.add('show');
      setTimeout(() => el.cheer.classList.remove('show'), 2200);
    });
    conn.on('error', (m) => {
      const text = {
        'no-room': `방 ${roomCode}을(를) 찾을 수 없어요. 번호를 다시 확인해 주세요.`,
        replaced: '다른 창에서 다시 접속해서 이 창은 연결이 끊겼어요.',
        removed: '선생님이 이 방에서 내보냈어요.',
      }[m.code];
      if (!text) return;
      if (m.code === 'no-room' && session.room) {
        // 연주 도중 서버가 다시 시작된 경우: 진행자가 방을 다시 열 때까지 계속 시도한다
        session.toast('방이 다시 열리기를 기다리고 있어요…', 4000);
        conn.reconnect();
        return;
      }
      conn.close();
      document.body.append(
        h('div', { class: 'overlay' }, h('div', { class: 'card' }, h('p', { text }), h('a', { class: 'btn big', href: '/', text: '처음 화면으로' }))),
      );
    });
  }

  transport.onChange((what) => {
    if (what === 'ended' && !inRoom) transport.stop();
    if (what === 'error') session.toast('반주를 불러오지 못했어요. 다시 시도하고 있어요.');
    if (what === 'blocked' && transport.blocked) session.toast('화면을 한 번 눌러 주세요. 반주가 켜져요.', 6000);
  });

  // ---- 연주 도우미 ----------------------------------------------------

  /** 지금 소리를 내도 되는가 (차례, 음소거, 멈춤 놀이) */
  let gateOpen = true;
  let gateReason = '';
  session.canPlay = () => session.started && gateOpen;

  /**
   * 입력이 들어온 순간에 호출한다.
   * @returns {{delay:number, dev:number|null, pos:number}}
   *   delay: 박자에 맞추려면 몇 초 뒤에 소리를 내야 하는지 (도움 단계 3이면 항상 0)
   *   dev  : 가장 가까운 8분음표에서 벗어난 정도(ms). 음악이 멈춰 있으면 null
   *   pos  : 소리가 실제로 나는 곡 위치 (코드 선택용)
   */
  let lastPlayedPos = null; // 가장 최근 연주가 울리는 곡 위치 (따라 치기 채점용)
  session.timing = () => {
    const pos = transport.position();
    lastPlayedPos = null;
    if (!transport.rolling) return { delay: 0, dev: null, pos };
    const rate = transport.state.rate;
    const g = nearestGrid(song, pos, 2);
    const dev = (g.dev / rate) * 1000;
    lastPlayedPos = g.gridPos;
    if (session.assist >= 3) return { delay: 0, dev, pos };
    // 조금 일찍 눌렀으면 격자까지 기다렸다가, 늦게 눌렀으면 바로 낸다
    return g.dev < 0 ? { delay: -g.dev / rate, dev, pos: g.gridPos } : { delay: 0, dev, pos };
  };

  session.chordAt = (pos) => song.chords[locate(song, pos).chord];

  /** 연주 기록을 진행자에게 보낸다 (참여도·박자 통계용) */
  session.report = (dev) => {
    if (conn) conn.send('note', dev == null ? {} : { dev: Math.round(dev) });
    const room = session.room;
    if (room && room.turn.mode === 'echo' && lastPlayedPos != null) {
      const e = echoAt(song, lastPlayedPos);
      const slot = Math.round(e.slot);
      if (e.phase === 'response' && slot < ECHO_SLOTS) echo.hits.add(slot);
    }
  };

  // ---- 따라 치기 ------------------------------------------------------
  // 짝수 마디에는 선생님이 고른 리듬이 시범으로 울리고(듣기), 홀수 마디에 참여자가 따라 친다.
  // 어떤 음을 누르든 상관없이 "언제 쳤는지"만 본다.

  const echo = { key: '', hits: new Set(), cuePos: null, sig: '' };
  const echoCells = [...el.echo.children];
  const CUE_AHEAD = 0.15; // 시범 소리를 이만큼 미리 예약한다(초)

  function echoFrame(rolling) {
    const room = session.room;
    const pos = transport.position();
    const e = room && room.turn.mode === 'echo' && rolling ? echoAt(song, pos) : { phase: null };
    if (!e.phase) {
      if (echo.key) {
        echo.key = '';
        echo.sig = '';
        echo.cuePos = null;
        echo.hits.clear();
        el.echo.hidden = true;
      }
      return;
    }
    const pattern = room.turn.pattern;
    const rate = transport.state.rate;

    // 시범 소리 예약 (악기별 파일이 'cue'를 받아 자기 악기 소리로 낸다)
    const ahead = pos + CUE_AHEAD * rate;
    if (echo.cuePos == null || echo.cuePos > ahead || ahead - echo.cuePos > 1) echo.cuePos = pos;
    if (session.started) {
      for (const c of cuesBetween(song, pattern, echo.cuePos, ahead)) {
        fire('cue', { slot: c.slot, pos: c.pos, delay: Math.max(0, (c.pos - pos) / rate) });
      }
    }
    echo.cuePos = ahead;

    const key = `${e.round}:${e.phase}`;
    if (key !== echo.key) {
      if (echo.key.endsWith(':response')) finishEcho(pattern);
      if (e.phase === 'call') echo.hits.clear();
      echo.key = key;
    }

    const cur = Math.floor(e.slot);
    const sig = `${key}:${cur}:${echo.hits.size}:${pattern.join('')}`;
    if (sig === echo.sig) return;
    echo.sig = sig;
    el.echo.hidden = false;
    el.echo.dataset.phase = e.phase;
    echoCells.forEach((cell, i) => {
      cell.classList.toggle('want', !!pattern[i]);
      cell.classList.toggle('lit', e.phase === 'call' ? !!pattern[i] && i <= cur : echo.hits.has(i));
      cell.classList.toggle('now', i === cur);
    });
  }

  function finishEcho(pattern) {
    if (!session.started || session.muted) return;
    const r = scoreEcho(pattern, echo.hits);
    if (conn) conn.send('echo', r);
    if (r.matched === r.total && r.extra === 0) {
      el.echo.classList.add('perfect');
      setTimeout(() => el.echo.classList.remove('perfect'), 900);
      session.sparkle(el.echo);
    }
  }

  /** 박자에 잘 맞았을 때 반짝이는 효과 (차분한 화면에서는 생략) */
  session.sparkle = (target) => {
    if (session.calm || !target) return;
    const r = target.getBoundingClientRect();
    const s = h('span', { class: 'sparkle', text: '✦' });
    s.style.left = `${r.left + r.width / 2}px`;
    s.style.top = `${r.top + r.height * 0.2}px`;
    document.body.append(s);
    setTimeout(() => s.remove(), 700);
  };

  /** MIDI 건반/스위치 입력. 연결과 해제를 계속 따라간다. */
  session.onMidi = (fn) => {
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess().then((access) => {
      const hook = () => {
        for (const input of access.inputs.values()) {
          input.onmidimessage = (e) => {
            const [status, note, vel = 0] = e.data;
            const cmd = status & 0xf0;
            if (cmd === 0x90 && vel > 0) fn(note, true);
            else if (cmd === 0x80 || cmd === 0x90) fn(note, false);
          };
        }
      };
      hook();
      access.onstatechange = hook;
    }, () => {});
  };

  // ---- 매 프레임: 코드 표시, 박자 점, 차례 안내 -----------------------

  let lastChordKey = '';
  let lastBeat = -1;
  let lastBanner = '';
  const dots = [...el.dots.children];

  function computeGate(loc) {
    if (session.muted) return [false, '🔇 잠시 쉬어요'];
    const room = session.room;
    if (!room) return [true, ''];
    const t = room.transport;
    // 멈춤 놀이: 연주 도중 진행자가 멈추면 모두 함께 멈춘다
    if (!t.playing && t.pos > 0.5) return [false, '✋ 잠깐 멈춤!'];
    if (!t.playing) return [true, room.hostOnline ? '선생님이 시작하면 음악이 나와요' : '선생님을 기다리고 있어요'];
    const name = (pid) => (room.people.find((p) => p.id === pid) || {}).name || '친구';
    if (room.turn.mode === 'solo') {
      return room.turn.target === id ? [true, '🎵 내 차례예요!'] : [false, `👂 ${name(room.turn.target)}의 연주를 들어요`];
    }
    if (room.turn.mode === 'echo' && loc.phase === 'song') {
      // 조금 일찍 열어 둔다: 첫 박을 살짝 빨리 쳐도 놓치지 않게
      const e = echoAt(song, transport.position() + 0.12 * t.rate);
      return e.phase === 'response' ? [true, '🎵 따라 쳐요!'] : [false, '👂 리듬을 잘 들어요'];
    }
    if (room.turn.mode === 'rotate' && loc.phase === 'song') {
      const turn = turnAt(song, transport.position(), room.turn.order, room.turn.bars);
      if (turn.current === id) return [true, '🎵 내 차례예요!'];
      if (turn.next === id && turn.barsLeft <= 1) return [false, '✨ 곧 내 차례예요. 준비!'];
      return [false, `👂 ${name(turn.current)}의 연주를 들어요`];
    }
    return [true, ''];
  }

  function frame() {
    requestAnimationFrame(frame);
    const loc = transport.locate();
    const rolling = transport.rolling;

    const key = `${loc.phase}:${loc.chord}:${loc.nextChord}:${loc.countIn}:${rolling}`;
    if (key !== lastChordKey) {
      lastChordKey = key;
      if (rolling && loc.phase === 'intro') {
        el.chord.textContent = loc.countIn > 4 ? '준비' : String(loc.countIn);
        el.next.textContent = '';
      } else {
        el.chord.textContent = song.chords[loc.chord].label;
        el.next.textContent = loc.nextChord !== loc.chord ? `→ ${song.chords[loc.nextChord].label}` : '';
      }
      fire('chord', loc);
    }

    const beat = rolling ? Math.floor(loc.beat) : -1;
    if (beat !== lastBeat) {
      lastBeat = beat;
      const active = rolling ? ((beat % 4) + 4) % 4 : -1;
      dots.forEach((d, i) => d.classList.toggle('on', i === active));
    }

    // 다음 코드까지 얼마나 남았는지 (코드가 바뀌는 순간을 미리 알 수 있게)
    const span = song.steps[loc.index].beats;
    const frac = rolling && loc.phase === 'song' ? 1 - loc.beatsToNext / span : 0;
    el.prog.style.transform = `scaleX(${Math.min(1, Math.max(0, frac)).toFixed(3)})`;

    const [open, reason] = computeGate(loc);
    if (open !== gateOpen || reason !== gateReason) {
      gateOpen = open;
      gateReason = reason;
      audio.setGate(open ? 1 : 0);
      if (!open) audio.stopAll(0.15);
      document.body.classList.toggle('gated', !open);
      document.body.classList.toggle('my-turn', open && reason.startsWith('🎵'));
      fire('gate', open);
    }
    if (reason !== lastBanner) {
      lastBanner = reason;
      el.banner.textContent = reason;
      el.banner.classList.toggle('show', reason !== '');
    }

    echoFrame(rolling);
    fire('frame', loc, rolling);
  }
  requestAnimationFrame(frame);

  return session;
}
