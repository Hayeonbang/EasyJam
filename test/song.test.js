import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUNNY, locate, nearestGrid, turnAt } from '../public/js/core/song.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beat = SUNNY.secPerBeat;
const at = (songBeat) => SUNNY.offset + (SUNNY.introBeats + songBeat) * beat;

test('한 코러스는 16마디(64박)이다', () => {
  assert.equal(SUNNY.chorusBeats, 64);
});

test('카운트인 동안은 intro, 첫 박부터 Am7', () => {
  assert.equal(locate(SUNNY, 0).phase, 'intro');
  assert.equal(locate(SUNNY, at(-0.01)).phase, 'intro');
  const first = locate(SUNNY, at(0.01));
  assert.equal(first.phase, 'song');
  assert.equal(first.chord, 'Am7');
  assert.equal(first.bar, 0);
});

test('2박짜리 코드도 정확한 박에 바뀐다', () => {
  // 예전 색소폰 코드는 모든 코드를 4박으로 넘겨서 여기서 어긋났다
  assert.equal(locate(SUNNY, at(3.99)).chord, 'Am7');
  assert.equal(locate(SUNNY, at(4.01)).chord, 'Gm7');
  assert.equal(locate(SUNNY, at(6.01)).chord, 'C7');
  assert.equal(locate(SUNNY, at(8.01)).chord, 'FM7');
  assert.equal(locate(SUNNY, at(12.01)).chord, 'Bdim7');
  assert.equal(locate(SUNNY, at(14.01)).chord, 'E7b9');
  assert.equal(locate(SUNNY, at(44.01)).chord, 'Bb7');
  assert.equal(locate(SUNNY, at(48.01)).chord, 'Bm7');
});

test('코러스가 반복되어도 밀리지 않는다', () => {
  for (let c = 0; c < SUNNY.choruses; c++) {
    const loc = locate(SUNNY, at(c * 64 + 0.01));
    assert.equal(loc.chord, 'Am7');
    assert.equal(loc.chorus, c);
    assert.equal(locate(SUNNY, at(c * 64 + 63.9)).chord, 'E7b9');
  }
  assert.equal(locate(SUNNY, at(SUNNY.choruses * 64 + 1)).phase, 'ended');
});

test('곡이 음원 길이 안에서 끝난다', () => {
  assert.ok(SUNNY.endPos < SUNNY.duration);
});

test('가장 가까운 8분음표 격자와 오차', () => {
  const g = nearestGrid(SUNNY, at(1) + 0.03, 2);
  assert.ok(Math.abs(g.gridPos - at(1)) < 1e-9);
  assert.ok(Math.abs(g.dev - 0.03) < 1e-9);
  const early = nearestGrid(SUNNY, at(1.5) - 0.05, 2);
  assert.ok(Math.abs(early.dev + 0.05) < 1e-9);
});

test('돌아가며 연주: 4마디마다 다음 사람', () => {
  const order = ['a', 'b', 'c'];
  assert.equal(turnAt(SUNNY, 0, order, 4).current, null); // 카운트인 중에는 아무도 아님
  assert.equal(turnAt(SUNNY, at(0.1), order, 4).current, 'a');
  assert.equal(turnAt(SUNNY, at(15.9), order, 4).current, 'a');
  assert.equal(turnAt(SUNNY, at(16.1), order, 4).current, 'b');
  assert.equal(turnAt(SUNNY, at(32.1), order, 4).current, 'c');
  assert.equal(turnAt(SUNNY, at(48.1), order, 4).current, 'a');
  const t = turnAt(SUNNY, at(12), order, 4);
  assert.equal(t.next, 'b');
  assert.ok(Math.abs(t.barsLeft - 1) < 1e-9);
  assert.equal(turnAt(SUNNY, at(1), [], 4).current, null);
});

test('코드가 쓰는 모든 소리 파일이 실제로 있다', () => {
  for (const c of Object.values(SUNNY.chords)) {
    for (const n of c.scale) {
      assert.ok(fs.existsSync(path.join(ROOT, 'assets/sounds/saxophone', `${n}.mp3`)), `색소폰 ${n}`);
    }
    for (const suffix of ['', '_1', '_2']) {
      assert.ok(fs.existsSync(path.join(ROOT, 'assets/sounds/piano', `${c.piano}${suffix}.mp3`)), `피아노 ${c.piano}${suffix}`);
    }
  }
  assert.ok(fs.existsSync(path.join(ROOT, SUNNY.src)));
});
