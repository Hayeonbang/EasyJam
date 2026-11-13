import test from 'node:test';
import assert from 'node:assert/strict';
import { SUNNY, echoAt, cuesBetween, scoreEcho } from '../public/js/core/song.js';
import { beatKind, compChord, grooveHit } from '../public/js/core/jazz.js';

const spb = SUNNY.secPerBeat;
const songStart = SUNNY.offset + SUNNY.introBeats * spb; // 첫 코러스 1마디 1박
const at = (beats) => songStart + beats * spb;

test('박의 종류: 1·3박, 2·4박(백비트), 엇박', () => {
  assert.equal(beatKind(SUNNY, at(0)), 'down');
  assert.equal(beatKind(SUNNY, at(1)), 'back');
  assert.equal(beatKind(SUNNY, at(2)), 'down');
  assert.equal(beatKind(SUNNY, at(2.5)), 'off');
});

test('피아노: 코드가 바뀌기 직전 엇박에 누르면 다음 코드가 난다', () => {
  // Am7(4박) → Gm7(2박) → C7(2박)
  assert.equal(compChord(SUNNY, at(0)), 'Am7');
  assert.equal(compChord(SUNNY, at(3)), 'Am7');
  assert.equal(compChord(SUNNY, at(3.5)), 'Gm7'); // 4박의 엇박: 당겨 치기
  assert.equal(compChord(SUNNY, at(3.8)), 'Gm7');
  assert.equal(compChord(SUNNY, at(4)), 'Gm7');
  assert.equal(compChord(SUNNY, at(5.5)), 'C7');
  // 카운트인 동안에는 첫 코드
  assert.equal(compChord(SUNNY, SUNNY.offset), 'Am7');
});

test('타악기: 백비트는 세게, 엇박은 여리게, 음색은 매번 조금씩 다르게', () => {
  const down = grooveHit(SUNNY, at(0), 0);
  const back = grooveHit(SUNNY, at(1), 1);
  const off = grooveHit(SUNNY, at(1.5), 2);
  assert.ok(back.gain > down.gain && down.gain > off.gain);
  assert.notEqual(grooveHit(SUNNY, at(0), 1).detune, grooveHit(SUNNY, at(0), 2).detune);
  for (let n = 0; n < 12; n++) assert.ok(Math.abs(grooveHit(SUNNY, at(0), n).detune) <= 25);
  // 음악이 멈춰 있으면 세기를 바꾸지 않는다
  assert.equal(grooveHit(SUNNY, at(1.5), 0, false).gain, 1);
});

test('따라 치기: 짝수 마디는 듣기, 홀수 마디는 따라 치기', () => {
  assert.equal(echoAt(SUNNY, SUNNY.offset).phase, null); // 카운트인
  const call = echoAt(SUNNY, at(0));
  assert.equal(call.phase, 'call');
  assert.equal(call.round, 0);
  assert.ok(Math.abs(call.slot) < 1e-3);
  const resp = echoAt(SUNNY, at(4 + 1.5));
  assert.equal(resp.phase, 'response');
  assert.equal(resp.round, 0);
  assert.equal(Math.round(resp.slot), 3);
  assert.equal(echoAt(SUNNY, at(8)).round, 1);
  assert.equal(echoAt(SUNNY, SUNNY.endPos + 1).phase, null);
});

test('시범 음은 듣는 마디의 리듬 칸에서만 울린다', () => {
  const pattern = [1, 0, 0, 1, 0, 0, 1, 0];
  const cues = cuesBetween(SUNNY, pattern, at(0) - 0.01, at(8) - 0.01); // 두 마디
  assert.deepEqual(cues.map((c) => c.slot), [0, 3, 6]);
  assert.ok(cues.every((c) => echoAt(SUNNY, c.pos).phase === 'call'));
  // 구간을 잘게 나눠 불러도 빠지거나 겹치지 않는다 (프레임마다 호출되므로)
  let count = 0;
  for (let t = at(0) - 0.01; t < at(16) - 0.05; t += 0.016) count += cuesBetween(SUNNY, pattern, t, t + 0.016).length;
  assert.equal(count, 6);
});

test('따라 치기 채점', () => {
  const pattern = [1, 0, 1, 0, 1, 0, 1, 0];
  assert.deepEqual(scoreEcho(pattern, new Set([0, 2, 4, 6])), { matched: 4, total: 4, extra: 0 });
  assert.deepEqual(scoreEcho(pattern, new Set([0, 3, 4])), { matched: 2, total: 4, extra: 1 });
  assert.deepEqual(scoreEcho(pattern, new Set()), { matched: 0, total: 4, extra: 0 });
});
