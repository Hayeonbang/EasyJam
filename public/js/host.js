// 진행자(치료사) 화면: 방 만들기, 반주 조작, 참여자별 도움 단계·음량, 차례 정하기, 세션 기록.

import { h, clientId, INSTRUMENT_NAMES } from './core/session.js';
import { SUNNY, turnAt, echoAt, ECHO_SLOTS } from './core/song.js';
import { Connection } from './core/net.js';
import { Transport } from './core/transport.js';

const song = SUNNY;
const id = clientId();

let savedRoom = '';
try {
  savedRoom = sessionStorage.getItem('easyjam.hostRoom') || '';
} catch {
  /* 무시 */
}

const conn = new Connection(() => ({ role: 'host', room: savedRoom, name: '진행자', id }));
const transport = new Transport({ song, clock: conn });
transport.setBacking(true);

let room = null;
let stats = {};
let bucketMs = 10_000;
const cards = new Map(); // 참여자 id → 카드 요소 묶음
const levels = new Map(); // 참여자 id → 최근 연주 세기(0~1), 화면 표시용

const send = (type, data) => {
  if (!conn.send(type, data)) toast('서버와 연결이 끊겨 있어요. 다시 연결하는 중입니다.');
};

// ---- 화면 뼈대 --------------------------------------------------------

const el = {
  code: h('b', { class: 'room-code', text: '····' }),
  urls: h('div', { class: 'room-urls' }),
  conn: h('span', { class: 'pill', text: '연결 중…' }),
  play: h('button', { class: 'btn big icon', 'aria-label': '재생', text: '▶' }),
  stop: h('button', { class: 'btn icon', 'aria-label': '처음으로', text: '■' }),
  progress: h('div', { class: 'progress', role: 'slider', 'aria-label': '곡 위치', tabindex: '0' }, h('i')),
  time: h('span', { class: 'time', text: '0:00' }),
  chord: h('span', { class: 'chord-now', text: '–' }),
  next: h('span', { class: 'chord-next' }),
  dots: h('span', { class: 'beat-dots', 'aria-hidden': 'true' }, [0, 1, 2, 3].map(() => h('i'))),
  tempo: h('input', { type: 'range', min: '0.7', max: '1.1', step: '0.05', value: '1', 'aria-label': '빠르기' }),
  tempoLabel: h('span', { class: 'value', text: '100%' }),
  volume: h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: '1', 'aria-label': '반주 음량' }),
  backing: h('select', { class: 'select', 'aria-label': '반주가 나오는 기기' },
    h('option', { value: 'host', text: '이 기기에서만 (같은 공간)' }),
    h('option', { value: 'all', text: '모든 기기에서 (이어폰·원격)' }),
  ),
  turnAll: h('button', { class: 'btn seg', text: '모두 함께' }),
  turnRotate: h('button', { class: 'btn seg', text: '돌아가며' }),
  turnEcho: h('button', { class: 'btn seg', text: '따라 치기' }),
  pattern: h('div', { class: 'pattern', role: 'group', 'aria-label': '따라 칠 리듬' },
    Array.from({ length: ECHO_SLOTS }, (_, i) => h('button', { class: 'pattern-cell', 'data-i': i, 'aria-label': `${Math.floor(i / 2) + 1}박${i % 2 ? ' 엇박' : ''}`, 'aria-pressed': 'false' }))),
  preset: h('select', { class: 'select', 'aria-label': '리듬 고르기' },
    h('option', { value: '', text: '리듬 고르기…' }),
    [['10101010', '네 박 그대로'], ['10001000', '느리게 두 번'], ['10101000', '하나 둘 셋 (쉼)'], ['10111010', '하나 둘-앤 셋 넷'], ['11101110', '따다단 따다단'], ['10010010', '엇박 (3-3-2)']]
      .map(([v, t]) => h('option', { value: v, text: t }))),
  echoBox: h('div', { class: 'echo-box', hidden: true }),
  bars: h('select', { class: 'select', 'aria-label': '한 사람당 마디 수' },
    [2, 4, 8].map((n) => h('option', { value: n, text: `${n}마디씩`, selected: n === 4 })),
  ),
  turnNow: h('span', { class: 'turn-now' }),
  people: h('div', { class: 'people' }),
  empty: h('p', { class: 'empty', text: '아직 들어온 참여자가 없어요. 위 주소와 방 번호를 알려 주세요.' }),
  report: h('button', { class: 'btn', text: '세션 기록 내려받기 (CSV)' }),
  toast: h('div', { class: 'toast', role: 'alert' }),
};

document.getElementById('stage').append(
  h('div', { class: 'host-side' },
  h('section', { class: 'panel room' },
    h('div', { class: 'row' }, h('b', { class: 'host-brand', text: 'EasyJam' }), h('span', { class: 'spacer' }), el.conn),
    h('div', {}, h('span', { class: 'label', text: '방 번호' }), el.code),
    el.urls,
  ),
  h('section', { class: 'panel transport' },
    h('div', { class: 'row' }, el.play, el.stop, h('div', { class: 'bar-chord' }, el.dots, el.chord, el.next)),
    el.progress,
    el.time,
    h('div', { class: 'row wrap' },
      h('label', { class: 'field' }, h('span', { text: '빠르기' }), el.tempo, el.tempoLabel),
      h('label', { class: 'field' }, h('span', { text: '반주 음량' }), el.volume),
      h('label', { class: 'field' }, h('span', { text: '반주' }), el.backing),
    ),
  ),
  h('section', { class: 'panel turns' },
    h('span', { class: 'label', text: '연주 방식' }),
    h('div', { class: 'row wrap' }, el.turnAll, el.turnRotate, el.turnEcho, el.bars, el.turnNow),
    el.echoBox,
    h('p', { class: 'help', text: '한 사람만 연주하게 하려면 아래 참여자 카드의 "솔로"를 누르세요. 음악을 일시정지하면 모든 악기가 함께 멈춥니다(멈춤 놀이).' }),
  ),
  ),
  h('div', { class: 'host-main' },
  h('section', { class: 'panel' },
    h('div', { class: 'row' }, h('span', { class: 'label', text: '참여자' }), h('span', { class: 'spacer' }), el.report),
    el.empty,
    el.people,
    h('p', { class: 'help', text: '"박자"는 음악이 나오는 동안 8분음표 격자에서 0.09초 안에 들어온 연주의 비율입니다. 기기와 네트워크에 따라 오차가 있으니 참고용으로 보세요.' }),
  ),
  ),
);
document.body.append(el.toast);

el.echoBox.append(
  h('div', { class: 'row wrap' }, el.pattern, el.preset),
  h('p', { class: 'help', text: '한 마디는 이 리듬이 시범으로 울리고(듣기), 다음 한 마디에 참여자가 따라 칩니다. 칸을 눌러 리듬을 직접 만들 수 있어요. 어떤 음을 누르든 상관없이 리듬만 봅니다.' }),
);

let toastTimer = null;
function toast(text) {
  el.toast.textContent = text;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3500);
}

// 첫 터치로 소리 잠금 해제
const startOverlay = h('div', { class: 'overlay start' },
  h('div', { class: 'card' },
    h('h1', { text: 'EasyJam 진행자 화면' }),
    h('p', { text: '이 기기에서 반주가 나옵니다. 스피커를 연결해 두세요.' }),
    h('button', { class: 'btn big', text: '세션 열기', onclick: () => {
      transport.unlock();
      startOverlay.remove();
    } }),
  ),
);
document.body.append(startOverlay);
document.addEventListener('pointerdown', () => transport.blocked && transport.unlock());

// ---- 조작 -------------------------------------------------------------

el.play.addEventListener('click', () => {
  transport.unlock();
  send('transport', { action: transport.state.playing ? 'pause' : 'play' });
});
el.stop.addEventListener('click', () => send('transport', { action: 'stop' }));
el.tempo.addEventListener('input', () => (el.tempoLabel.textContent = `${Math.round(el.tempo.value * 100)}%`));
el.tempo.addEventListener('change', () => send('transport', { action: 'rate', rate: Number(el.tempo.value) }));
el.volume.addEventListener('input', () => transport.setBackingVolume(Number(el.volume.value)));
el.backing.addEventListener('change', () => send('backing', { mode: el.backing.value }));
el.turnAll.addEventListener('click', () => send('turn', { mode: 'all' }));
el.turnRotate.addEventListener('click', () => send('turn', { mode: 'rotate', bars: Number(el.bars.value) }));
el.turnEcho.addEventListener('click', () => send('turn', { mode: 'echo' }));
el.pattern.addEventListener('click', (e) => {
  const cell = e.target.closest('.pattern-cell');
  if (!cell || !room) return;
  const pattern = [...room.turn.pattern];
  pattern[Number(cell.dataset.i)] ^= 1;
  if (!pattern.includes(1)) return toast('적어도 한 칸은 쳐야 해요');
  send('turn', { mode: 'echo', pattern });
});
el.preset.addEventListener('change', () => {
  if (el.preset.value) send('turn', { mode: 'echo', pattern: [...el.preset.value].map(Number) });
  el.preset.value = '';
});
el.bars.addEventListener('change', () => room && room.turn.mode === 'rotate' && send('turn', { mode: 'rotate', bars: Number(el.bars.value) }));

function seekFromEvent(e) {
  const r = el.progress.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  send('transport', { action: 'seek', pos: ratio * song.duration });
}
el.progress.addEventListener('click', seekFromEvent);
el.progress.addEventListener('keydown', (e) => {
  const step = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
  if (step) send('transport', { action: 'seek', pos: Math.max(0, transport.position() + step) });
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !/^(INPUT|SELECT|BUTTON|TEXTAREA)$/.test(document.activeElement.tagName)) {
    e.preventDefault();
    el.play.click();
  }
});

transport.onChange((what) => {
  if (what === 'ended') send('transport', { action: 'stop' });
  if (what === 'error') toast('반주 음원을 불러오지 못했어요. 다시 시도하고 있어요.');
  if (what === 'blocked' && transport.blocked) toast('화면을 한 번 눌러 주세요. 반주가 켜져요.');
});

// ---- 서버 메시지 ------------------------------------------------------

conn.on('status', (s) => {
  el.conn.textContent = s === 'online' ? '연결됨' : '다시 연결 중…';
  el.conn.classList.toggle('warn', s !== 'online');
});
conn.on('welcome', (m) => {
  savedRoom = m.room.code;
  try {
    sessionStorage.setItem('easyjam.hostRoom', savedRoom);
  } catch {
    /* 무시 */
  }
  applyRoom(m.room);
  showUrls();
});
conn.on('room', (m) => applyRoom(m.room));
conn.on('synced', () => room && transport.setState(room.transport));
conn.on('stats', (m) => {
  stats = m.stats;
  bucketMs = m.bucketMs;
  renderStats();
});
conn.on('note', (m) => levels.set(m.from, 1));
conn.on('error', (m) => {
  if (m.code === 'replaced') {
    conn.close();
    document.body.append(h('div', { class: 'overlay' }, h('div', { class: 'card' }, h('p', { text: '다른 창에서 진행자 화면을 열어서 이 창은 연결이 끊겼어요.' }))));
  }
});

async function showUrls() {
  let info = { addresses: [], port: location.port, https: location.protocol === 'https:' };
  try {
    info = await (await fetch('/api/info')).json();
  } catch {
    /* 주소를 못 받아도 지금 주소는 보여 줄 수 있다 */
  }
  const scheme = info.https ? 'https' : 'http';
  const hosts = info.addresses.length ? info.addresses.map((a) => `${a}:${info.port}`) : [location.host];
  el.urls.replaceChildren(
    h('span', { class: 'label', text: '참여자 접속 주소' }),
    ...hosts.map((host) => h('code', { text: `${scheme}://${host}/?room=${savedRoom}` })),
    !info.https ? h('span', { class: 'help', text: '카메라 연주(타악기)를 다른 기기에서 쓰려면 https로 실행해야 합니다. README 참고.' }) : null,
  );
}

function applyRoom(r) {
  room = r;
  transport.setState(r.transport);
  el.code.textContent = r.code;
  el.play.textContent = r.transport.playing ? '❚❚' : '▶';
  el.play.setAttribute('aria-label', r.transport.playing ? '일시정지' : '재생');
  if (document.activeElement !== el.tempo) {
    el.tempo.value = String(r.transport.rate);
    el.tempoLabel.textContent = `${Math.round(r.transport.rate * 100)}%`;
  }
  el.backing.value = r.backing;
  el.turnAll.setAttribute('aria-pressed', String(r.turn.mode === 'all'));
  el.turnRotate.setAttribute('aria-pressed', String(r.turn.mode === 'rotate'));
  el.turnEcho.setAttribute('aria-pressed', String(r.turn.mode === 'echo'));
  el.echoBox.hidden = r.turn.mode !== 'echo';
  el.bars.hidden = r.turn.mode === 'echo';
  [...el.pattern.children].forEach((cell, i) => cell.setAttribute('aria-pressed', String(!!r.turn.pattern[i])));
  el.bars.value = String(r.turn.bars);
  renderPeople();
}

// ---- 참여자 카드 ------------------------------------------------------

function makeCard(p) {
  const c = {
    name: h('b', { class: 'p-name' }),
    inst: h('span', { class: 'p-inst' }),
    online: h('span', { class: 'dot' }),
    meter: h('div', { class: 'meter', 'aria-hidden': 'true' }, h('i')),
    stat: h('div', { class: 'p-stat' }),
    spark: h('div', { class: 'spark', 'aria-hidden': 'true' }),
    assist: h('div', { class: 'seg-group', role: 'group', 'aria-label': '도움 단계' },
      [[1, '쉬움'], [2, '보통'], [3, '도전']].map(([n, t]) =>
        h('button', { class: 'btn seg', 'data-n': n, text: t, onclick: () => send('control', { target: p.id, settings: { assist: n } }) })),
    ),
    volume: h('input', { type: 'range', min: '0', max: '1', step: '0.05', 'aria-label': '악기 음량',
      oninput: (e) => send('control', { target: p.id, settings: { volume: Number(e.target.value) } }) }),
    mute: h('button', { class: 'btn', text: '쉬기', onclick: () => send('control', { target: p.id, settings: { muted: !current(p.id).settings.muted } }) }),
    calm: h('button', { class: 'btn', text: '차분한 화면', onclick: () => send('control', { target: p.id, settings: { calm: !current(p.id).settings.calm } }) }),
    solo: h('button', { class: 'btn', text: '솔로', onclick: () => {
      const on = room.turn.mode === 'solo' && room.turn.target === p.id;
      send('turn', on ? { mode: 'all' } : { mode: 'solo', target: p.id });
    } }),
    cheer: h('button', { class: 'btn', text: '칭찬 보내기', onclick: () => {
      send('cheer', { target: p.id });
      toast(`${current(p.id).name} 님에게 칭찬을 보냈어요`);
    } }),
    remove: h('button', { class: 'btn ghost', text: '내보내기', onclick: () => {
      if (confirm(`${current(p.id).name} 님을 방에서 내보낼까요? 기록도 함께 지워집니다.`)) send('remove', { target: p.id });
    } }),
  };
  c.root = h('article', { class: 'person' },
    h('div', { class: 'row' }, c.online, c.name, c.inst, h('span', { class: 'spacer' }), c.meter),
    c.stat,
    c.spark,
    h('div', { class: 'row wrap' }, c.assist, h('label', { class: 'field' }, h('span', { text: '음량' }), c.volume)),
    h('div', { class: 'row wrap' }, c.solo, c.mute, c.calm, c.cheer, h('span', { class: 'spacer' }), c.remove),
  );
  return c;
}

const current = (pid) => room.people.find((p) => p.id === pid) || { name: '', settings: {} };

function renderPeople() {
  const players = room.people.filter((p) => p.role === 'player');
  el.empty.hidden = players.length > 0;

  for (const [pid, c] of cards) {
    if (!players.some((p) => p.id === pid)) {
      c.root.remove();
      cards.delete(pid);
    }
  }
  for (const p of players) {
    let c = cards.get(p.id);
    if (!c) {
      c = makeCard(p);
      cards.set(p.id, c);
      el.people.append(c.root);
    }
    c.name.textContent = p.name;
    c.root.dataset.inst = p.instrument;
    c.inst.textContent = INSTRUMENT_NAMES[p.instrument] || '';
    c.root.classList.toggle('offline', !p.online);
    c.online.title = p.online ? '접속 중' : '연결 끊김';
    for (const b of c.assist.children) b.setAttribute('aria-pressed', String(Number(b.dataset.n) === p.settings.assist));
    // 지금 끌고 있는 슬라이더는 덮어쓰지 않는다
    if (document.activeElement !== c.volume) c.volume.value = String(p.settings.volume);
    c.mute.setAttribute('aria-pressed', String(p.settings.muted));
    c.calm.setAttribute('aria-pressed', String(p.settings.calm));
    c.solo.setAttribute('aria-pressed', String(room.turn.mode === 'solo' && room.turn.target === p.id));
  }
  renderStats();
}

function renderStats() {
  for (const [pid, c] of cards) {
    const s = stats[pid];
    if (!s) {
      c.stat.textContent = '아직 연주 기록이 없어요';
      c.spark.replaceChildren();
      continue;
    }
    const beat = s.timed > 0 ? `박자 ${Math.round((s.onBeat / s.timed) * 100)}%` : '박자 –';
    const echo = s.echoTotal > 0 ? ` · 따라 치기 ${Math.round((s.echoMatched / s.echoTotal) * 100)}% (${s.echoRounds}번)` : '';
    c.stat.textContent = `연주 ${s.notes}번 · ${beat}${echo} · 칭찬 ${s.cheers}번`;
    // 최근 5분(10초 단위 30칸)의 참여도
    const last = s.buckets.slice(-30);
    const max = Math.max(4, ...last);
    c.spark.replaceChildren(...last.map((n) => {
      const bar = h('i');
      bar.style.height = `${Math.round((n / max) * 100)}%`;
      return bar;
    }));
  }
}

// ---- 세션 기록 (CSV) --------------------------------------------------

function csvCell(v) {
  let s = String(v ?? '');
  // 스프레드시트가 수식으로 해석하지 않도록 한다
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const clock = (ms) => (ms ? new Date(ms).toLocaleTimeString('ko-KR', { hour12: false }) : '');

el.report.addEventListener('click', () => {
  if (!room) return;
  const players = room.people.filter((p) => p.role === 'player');
  const rows = [
    ['EasyJam 세션 기록'],
    ['방 번호', room.code],
    ['시작', new Date(room.createdAt).toLocaleString('ko-KR')],
    ['내려받은 시각', new Date().toLocaleString('ko-KR')],
    [],
    ['이름', '악기', '도움 단계', '연주 횟수', '박자 측정 횟수', '박자에 맞은 비율(%)', '평균 박자 오차(ms)', '첫 연주', '마지막 연주', '받은 칭찬',
      '따라 치기 횟수', '따라 친 정확도(%)', '전부 맞춘 횟수', '리듬에 없는 곳을 친 횟수'],
  ];
  for (const p of players) {
    const s = stats[p.id] || { notes: 0, timed: 0, onBeat: 0, absDev: 0, cheers: 0, buckets: [] };
    rows.push([
      p.name, INSTRUMENT_NAMES[p.instrument] || p.instrument, p.settings.assist, s.notes, s.timed,
      s.timed ? Math.round((s.onBeat / s.timed) * 100) : '',
      s.timed ? Math.round(s.absDev / s.timed) : '',
      clock(s.firstAt), clock(s.lastAt), s.cheers,
      s.echoRounds || 0, s.echoTotal ? Math.round((s.echoMatched / s.echoTotal) * 100) : '', s.echoPerfect || 0, s.echoExtra || 0,
    ]);
  }
  const len = Math.max(0, ...players.map((p) => (stats[p.id] ? stats[p.id].buckets.length : 0)));
  rows.push([], [`참여도 타임라인 (${bucketMs / 1000}초마다 연주 횟수)`], ['시각', ...players.map((p) => p.name)]);
  for (let i = 0; i < len; i++) {
    rows.push([clock(room.createdAt + i * bucketMs), ...players.map((p) => (stats[p.id] && stats[p.id].buckets[i]) || 0)]);
  }
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: `easyjam-${room.code}-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// ---- 매 프레임 --------------------------------------------------------

const dots = [...el.dots.children];
const bar = el.progress.firstElementChild;
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
let lastTurnText = '';
let lastCell = -1;

function frame() {
  requestAnimationFrame(frame);
  const pos = transport.position();
  const loc = transport.locate();
  const rolling = transport.rolling;

  bar.style.width = `${(pos / song.duration) * 100}%`;
  el.time.textContent = `${fmt(pos)} / ${fmt(song.duration)}`;
  if (rolling && loc.phase === 'intro') {
    el.chord.textContent = loc.countIn > 4 ? '준비' : String(loc.countIn);
    el.next.textContent = '';
  } else {
    el.chord.textContent = song.chords[loc.chord].label;
    el.next.textContent = loc.nextChord !== loc.chord ? `→ ${song.chords[loc.nextChord].label}` : '';
  }
  const active = rolling ? ((Math.floor(loc.beat) % 4) + 4) % 4 : -1;
  dots.forEach((d, i) => d.classList.toggle('on', i === active));

  // 지금 누구 차례인지
  let turnText = '';
  let turnId = null;
  if (room) {
    const name = (pid) => (room.people.find((p) => p.id === pid) || {}).name || '';
    if (room.turn.mode === 'solo') {
      turnId = room.turn.target;
      turnText = `지금: ${name(turnId)} 솔로`;
    } else if (room.turn.mode === 'echo') {
      const e = rolling ? echoAt(song, pos) : { phase: null };
      turnText = e.phase === 'call' ? '지금: 리듬 듣기' : e.phase === 'response' ? '지금: 따라 치기' : '음악이 시작되면 리듬이 나옵니다';
      const cur = e.phase === 'call' ? Math.floor(e.slot) : -1;
      if (cur !== lastCell) {
        lastCell = cur;
        [...el.pattern.children].forEach((cell, i) => cell.classList.toggle('now', i === cur));
      }
    } else if (room.turn.mode === 'rotate') {
      const t = turnAt(song, pos, room.turn.order, room.turn.bars);
      turnId = rolling ? t.current : null;
      turnText = t.current ? `지금: ${name(t.current)} → 다음: ${name(t.next)}` : '음악이 시작되면 차례가 돌아갑니다';
    }
  }
  if (turnText !== lastTurnText) {
    lastTurnText = turnText;
    el.turnNow.textContent = turnText;
  }

  for (const [pid, c] of cards) {
    const v = (levels.get(pid) || 0) * 0.93; // 서서히 줄어드는 참여 표시
    levels.set(pid, v);
    c.meter.firstElementChild.style.transform = `scaleX(${v.toFixed(3)})`;
    c.root.classList.toggle('turn', pid === turnId);
  }
}
requestAnimationFrame(frame);
