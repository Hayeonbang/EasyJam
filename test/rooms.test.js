import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager, transportPos } from '../server/rooms.js';

function setup() {
  let now = 1_000_000;
  const mgr = new RoomManager({ now: () => now, random: () => 0.5 });
  const mk = () => {
    const c = { room: null, pid: null, sent: [], closed: false, send(m) { this.sent.push(JSON.parse(JSON.stringify(m))); }, close() { this.closed = true; mgr.handleClose(this); } };
    c.last = (type) => [...c.sent].reverse().find((m) => m.type === type);
    return c;
  };
  const host = mk();
  mgr.handleMessage(host, { type: 'hello', role: 'host', id: 'host-000001' });
  const code = host.last('welcome').room.code;
  const join = (id, name, instrument = 'piano') => {
    const c = mk();
    mgr.handleMessage(c, { type: 'hello', role: 'player', room: code, id, name, instrument });
    return c;
  };
  return { mgr, host, code, join, mk, tick: (ms) => (now += ms), now: () => now };
}

test('진행자가 방을 만들고 참여자가 들어온다', () => {
  const { host, code, join } = setup();
  assert.match(code, /^\d{4}$/);
  const a = join('player-0001', '하늘', 'saxophone');
  const room = a.last('welcome').room;
  assert.equal(room.people.length, 2);
  assert.equal(room.people[1].name, '하늘');
  assert.equal(room.people[1].instrument, 'saxophone');
  assert.deepEqual(host.last('room').room.turn.order, ['player-0001']);
});

test('없는 방에는 들어갈 수 없다', () => {
  const { mgr, mk } = setup();
  const c = mk();
  mgr.handleMessage(c, { type: 'hello', role: 'player', room: '0000', id: 'player-0009', name: 'x' });
  assert.equal(c.last('error').code, 'no-room');
});

test('ping에는 서버 시각으로 답한다', () => {
  const { mgr, mk, now } = setup();
  const c = mk();
  mgr.handleMessage(c, { type: 'ping', t0: 42 });
  assert.deepEqual(c.last('pong'), { type: 'pong', t0: 42, t: now() });
});

test('재생·일시정지·속도 변경에도 위치가 이어진다', () => {
  const { mgr, host, tick, now } = setup();
  mgr.handleMessage(host, { type: 'transport', action: 'play' });
  let t = host.last('room').room.transport;
  assert.equal(t.playing, true);
  assert.equal(t.at, now() + 800); // 모든 기기가 같은 순간에 출발하도록 여유를 둔다
  tick(800 + 10_000);
  assert.ok(Math.abs(transportPos(t, now()) - 10) < 1e-9);

  mgr.handleMessage(host, { type: 'transport', action: 'rate', rate: 0.5 });
  t = host.last('room').room.transport;
  assert.ok(Math.abs(t.pos - 10) < 1e-9, '속도를 바꿔도 위치가 튀지 않는다');
  tick(4000);
  assert.ok(Math.abs(transportPos(t, now()) - 12) < 1e-9);

  mgr.handleMessage(host, { type: 'transport', action: 'pause' });
  t = host.last('room').room.transport;
  assert.equal(t.playing, false);
  assert.ok(Math.abs(t.pos - 12) < 1e-9);
  tick(5000);
  assert.ok(Math.abs(transportPos(t, now()) - 12) < 1e-9);

  mgr.handleMessage(host, { type: 'transport', action: 'rate', rate: 99 });
  assert.equal(host.last('room').room.transport.rate, 1.25);
});

test('참여자는 진행자 명령을 쓸 수 없다', () => {
  const { mgr, host, join } = setup();
  const a = join('player-0001', '하늘');
  const b = join('player-0002', '바다');
  mgr.handleMessage(a, { type: 'transport', action: 'play' });
  mgr.handleMessage(a, { type: 'control', target: 'player-0002', settings: { muted: true } });
  mgr.handleMessage(a, { type: 'remove', target: 'player-0002' });
  const room = host.last('room').room;
  assert.equal(room.transport.playing, false);
  assert.equal(room.people.find((p) => p.id === 'player-0002').settings.muted, false);
  assert.equal(b.closed, false);
});

test('진행자가 도움 단계·음량을 바꾸면 값이 범위 안으로 정리된다', () => {
  const { mgr, host, join } = setup();
  const a = join('player-0001', '하늘');
  mgr.handleMessage(host, { type: 'control', target: 'player-0001', settings: { assist: 9, volume: -3, calm: true, muted: 'yes' } });
  const me = a.last('room').room.people.find((p) => p.id === 'player-0001');
  assert.deepEqual(me.settings, { assist: 3, volume: 0, muted: false, calm: true });
});

test('연주 기록: 박자 통계와 참여도 타임라인', () => {
  const { mgr, host, join, tick } = setup();
  const a = join('player-0001', '하늘');
  mgr.handleMessage(a, { type: 'note', dev: 20 });
  mgr.handleMessage(a, { type: 'note', dev: -150 });
  mgr.handleMessage(a, { type: 'note' }); // 음악이 멈춰 있을 때의 연주
  tick(10_500);
  mgr.handleMessage(a, { type: 'note', dev: 0 });
  mgr.tick();
  const s = host.last('stats').stats['player-0001'];
  assert.equal(s.notes, 4);
  assert.equal(s.timed, 3);
  assert.equal(s.onBeat, 2);
  assert.equal(s.absDev, 170);
  assert.deepEqual(s.buckets, [3, 1]);
  assert.equal(host.sent.filter((m) => m.type === 'note').length, 4);
});

test('음표가 쏟아져도 제한된다', () => {
  const { mgr, host, join } = setup();
  const a = join('player-0001', '하늘');
  for (let i = 0; i < 500; i++) mgr.handleMessage(a, { type: 'note', dev: 0 });
  mgr.tick();
  assert.equal(host.last('stats').stats['player-0001'].notes, 60);
});

test('재접속하면 같은 참여자로 돌아오고 기록이 남는다', () => {
  const { mgr, host, join } = setup();
  const a = join('player-0001', '하늘');
  mgr.handleMessage(a, { type: 'note', dev: 0 });
  mgr.handleMessage(host, { type: 'control', target: 'player-0001', settings: { assist: 1 } });
  mgr.handleClose(a);
  assert.equal(host.last('room').room.people[1].online, false);
  const again = join('player-0001', '하늘');
  const room = again.last('welcome').room;
  assert.equal(room.people.length, 2);
  assert.equal(room.people[1].online, true);
  assert.equal(room.people[1].settings.assist, 1);
  mgr.tick();
  assert.equal(host.last('stats').stats['player-0001'].notes, 1);
});

test('같은 번호로 다른 창에서 들어오면 옛 연결을 닫는다', () => {
  const { host, join } = setup();
  const a = join('player-0001', '하늘');
  const b = join('player-0001', '하늘');
  assert.equal(a.closed, true);
  assert.equal(a.last('error').code, 'replaced');
  assert.equal(b.closed, false);
  assert.equal(host.last('room').room.people[1].online, true, '옛 연결이 닫혀도 새 연결은 접속 중으로 남는다');
});

test('진행자가 나가면 음악이 멈추고, 돌아오면 같은 방을 쓴다', () => {
  const { mgr, host, code, join, mk, tick } = setup();
  const a = join('player-0001', '하늘');
  mgr.handleMessage(host, { type: 'transport', action: 'play' });
  tick(5800);
  mgr.handleClose(host);
  const room = a.last('room').room;
  assert.equal(room.transport.playing, false);
  assert.ok(Math.abs(room.transport.pos - 5) < 1e-9);
  assert.equal(room.hostOnline, false);
  const again = mk();
  mgr.handleMessage(again, { type: 'hello', role: 'host', room: code, id: 'host-000001' });
  assert.equal(again.last('welcome').room.code, code);
  assert.equal(again.last('welcome').room.people.length, 2);
});

test('솔로·돌아가며·내보내기', () => {
  const { mgr, host, join } = setup();
  const a = join('player-0001', '하늘');
  join('player-0002', '바다');
  mgr.handleMessage(host, { type: 'turn', mode: 'solo', target: 'player-0001' });
  assert.equal(a.last('room').room.turn.target, 'player-0001');
  mgr.handleMessage(host, { type: 'turn', mode: 'solo', target: 'nobody' });
  assert.equal(a.last('room').room.turn.mode, 'solo');
  mgr.handleMessage(host, { type: 'turn', mode: 'rotate', bars: 2 });
  assert.deepEqual(a.last('room').room.turn, { mode: 'rotate', target: null, bars: 2, pattern: [1, 0, 1, 0, 1, 0, 1, 0], order: ['player-0001', 'player-0002'] });
  mgr.handleMessage(host, { type: 'cheer', target: 'player-0001' });
  assert.ok(a.last('cheer'));
  mgr.handleMessage(host, { type: 'remove', target: 'player-0001' });
  assert.equal(a.closed, true);
  assert.equal(host.last('room').room.people.length, 2);
});

test('이상한 메시지는 무시한다', () => {
  const { mgr, host, join } = setup();
  const a = join('player-0001', '<b>하늘</b>\u0000이름이아주아주아주길어요길어요');
  for (const m of [null, 5, 'x', {}, { type: 7 }, { type: 'transport' }, { type: 'note', dev: 'NaN' }, { type: 'turn', mode: 'zzz' }, { type: 'control' }]) {
    assert.doesNotThrow(() => mgr.handleMessage(a, m));
    assert.doesNotThrow(() => mgr.handleMessage(host, m));
  }
  assert.ok(a.last('welcome').room.people[1].name.length <= 16);
  const bad = { sent: [], send(m) { this.sent.push(m); }, close() {} };
  mgr.handleMessage(bad, { type: 'hello', role: 'host', id: '../../etc' });
  assert.equal(bad.sent[0].code, 'bad-id');
});

test('빈 방은 30분 뒤 정리된다', () => {
  const { mgr, host, code, tick } = setup();
  mgr.handleClose(host);
  tick(29 * 60_000);
  mgr.tick();
  assert.ok(mgr.rooms.has(code));
  tick(2 * 60_000);
  mgr.tick();
  assert.equal(mgr.rooms.has(code), false);
});

test('따라 치기: 리듬을 정하고 결과를 집계한다', () => {
  const { mgr, host, join, tick } = setup();
  const a = join('player-0001', '하늘');
  // 모드가 아닐 때 온 결과는 버린다
  mgr.handleMessage(a, { type: 'echo', matched: 4, total: 4, extra: 0 });
  mgr.handleMessage(host, { type: 'turn', mode: 'echo', pattern: [1, 0, 0, 1, 0, 0, 1, 0] });
  assert.equal(a.last('room').room.turn.mode, 'echo');
  assert.deepEqual(a.last('room').room.turn.pattern, [1, 0, 0, 1, 0, 0, 1, 0]);

  // 잘못된 리듬(빈 리듬, 길이 틀림)은 무시한다
  mgr.handleMessage(host, { type: 'turn', mode: 'echo', pattern: [0, 0, 0, 0, 0, 0, 0, 0] });
  mgr.handleMessage(host, { type: 'turn', mode: 'echo', pattern: [1, 1] });
  assert.deepEqual(a.last('room').room.turn.pattern, [1, 0, 0, 1, 0, 0, 1, 0]);

  mgr.handleMessage(a, { type: 'echo', matched: 3, total: 3, extra: 0 });
  mgr.handleMessage(a, { type: 'echo', matched: 3, total: 3, extra: 0 }); // 너무 잦은 것은 버림
  tick(4000);
  mgr.handleMessage(a, { type: 'echo', matched: 1, total: 3, extra: 2 });
  tick(4000);
  mgr.handleMessage(a, { type: 'echo', matched: 9, total: 3, extra: 0 }); // 말이 안 되는 값
  mgr.tick();
  const s = host.last('stats').stats['player-0001'];
  assert.equal(s.echoRounds, 2);
  assert.equal(s.echoMatched, 4);
  assert.equal(s.echoTotal, 6);
  assert.equal(s.echoExtra, 2);
  assert.equal(s.echoPerfect, 1);

  // 다른 방식으로 바꿔도 리듬은 기억한다
  mgr.handleMessage(host, { type: 'turn', mode: 'all' });
  assert.deepEqual(a.last('room').room.turn.pattern, [1, 0, 0, 1, 0, 0, 1, 0]);
});
