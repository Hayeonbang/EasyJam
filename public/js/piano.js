// 피아노: 건반 1~9 어느 것을 눌러도 지금 코드에 맞는 화음이 난다.
//
// 도움 단계
//   1 쉬움 : 한 번만 눌러도 화음이 울린다 (누르고 있기 어려운 참여자용) + 박자 보정
//   2 보통 : 누르고 있는 동안만 울린다 + 박자 보정
//   3 도전 : 박자 보정 없음
//
// 재즈 반주처럼 들리게 하는 규칙 (jazz.js)
//   - 당겨 치기: 코드가 바뀌기 직전 엇박에 누르면 다음 코드가 난다 (쉬움·보통)
//   - 코드 따라가기: 건반을 누르고 있는 동안 코드가 바뀌면 새 코드로 이어진다.
//     이전 코드가 새 코드 위에 남아 부딪히는 일이 없다.

import { createSession, h } from './core/session.js';
import { SUNNY } from './core/song.js';
import { compChord } from './core/jazz.js';

const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const BLACK_AFTER = [1, 2, 4, 5, 6, 8]; // 이 흰 건반 오른쪽에 검은 건반이 있다 (도·레·파·솔·라·도)
const MIDI_KEYS = { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5, 69: 6, 71: 7, 72: 8, 74: 9 };
const LETTER_KEYS = { a: 1, s: 2, d: 3, f: 4, g: 5, h: 6, j: 7, k: 8, l: 9 };

// 코드마다 보이싱 3개
const sounds = {};
for (const name of new Set(Object.values(SUNNY.chords).map((c) => c.piano))) {
  sounds[`piano:${name}:0`] = `/assets/sounds/piano/${name}.mp3`;
  sounds[`piano:${name}:1`] = `/assets/sounds/piano/${name}_1.mp3`;
  sounds[`piano:${name}:2`] = `/assets/sounds/piano/${name}_2.mp3`;
}

const session = createSession({ instrument: 'piano', sounds });

// 흰 건반 9개가 곧 버튼이다. 검은 건반은 모양만 있고 터치는 아래 흰 건반으로 전달된다.
const pads = KEYS.map((k) => h('button', { class: 'pad piano-key', 'data-key': k, 'aria-label': `건반 ${k}` }, h('span', { text: k })));
const blacks = BLACK_AFTER.map((i) => {
  const b = h('i', { class: 'black-key', 'aria-hidden': 'true' });
  b.style.left = `${(i / KEYS.length) * 100}%`;
  return b;
});
document.getElementById('stage').append(
  h('div', { class: 'keyboard' }, h('div', { class: 'keyboard-keys' }, pads, blacks)),
  h('p', { class: 'hint', text: '건반을 누르거나, 키보드 숫자 1~9를 눌러 보세요' }),
);

const held = new Map(); // key → { voice, timer, chord, voicing }
const ringing = new Set(); // 쉬움 단계에서 손을 뗀 뒤에도 울리고 있는 화음

function press(key) {
  if (!session.canPlay() || held.has(key)) return;
  const t = session.timing();
  const rolling = t.dev != null;
  const chord = rolling && session.assist < 3 ? SUNNY.chords[compChord(SUNNY, t.pos)] : session.chordAt(t.pos);
  const voicing = key <= 3 ? 0 : key <= 6 ? 1 : 2; // 낮은/가운데/높은 건반마다 다른 보이싱
  const voice = session.audio.play(`piano:${chord.piano}:${voicing}`, { delay: t.delay });
  const entry = { voice, timer: null, chord: chord.piano, voicing };
  held.set(key, entry);

  const pad = pads[key - 1];
  entry.timer = setTimeout(() => {
    pad.classList.add('on');
    if (t.dev != null && Math.abs(t.dev) <= 90) session.sparkle(pad);
  }, t.delay * 1000);

  session.report(t.dev);
}

function release(key) {
  const entry = held.get(key);
  if (!entry) return;
  held.delete(key);
  clearTimeout(entry.timer);
  // 쉬움 단계에서는 손을 떼도 화음이 이어서 울린다 (다음 코드가 오면 잦아든다)
  if (entry.voice && session.assist !== 1) entry.voice.stop(0.3);
  else if (entry.voice) ringing.add(entry.voice);
  pads[key - 1].classList.remove('on');
}

function releaseAll() {
  for (const key of [...held.keys()]) release(key);
}

function keyFromEvent(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (/^[1-9]$/.test(e.key)) return Number(e.key);
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (m) return Number(m[1]);
  return LETTER_KEYS[e.key.toLowerCase()] || null;
}

document.addEventListener('keydown', (e) => {
  const key = keyFromEvent(e);
  if (!key) return;
  e.preventDefault();
  if (!e.repeat) press(key);
});
document.addEventListener('keyup', (e) => {
  const key = keyFromEvent(e);
  if (key) release(key);
});
// 창을 벗어나면 keyup을 못 받으므로 눌린 건반을 모두 놓는다 (소리가 계속 울리는 문제 방지)
window.addEventListener('blur', releaseAll);

pads.forEach((pad, i) => {
  const key = i + 1;
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    press(key);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) pad.addEventListener(type, () => release(key));
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
});

session.onMidi((note, on) => {
  const key = MIDI_KEYS[note];
  if (!key) return;
  if (on) press(key);
  else release(key);
});

// 코드가 바뀌면: 울리던 이전 화음은 잦아들고, 누르고 있는 건반은 새 코드로 이어진다
session.on('chord', (loc) => {
  for (const v of ringing) v.stop(0.35);
  ringing.clear();
  if (loc.phase !== 'song' || !session.transport.rolling) return;
  const next = SUNNY.chords[loc.chord].piano;
  for (const entry of held.values()) {
    if (entry.chord === next) continue; // 당겨 쳐서 이미 새 코드
    if (entry.voice) entry.voice.stop(0.35);
    entry.chord = next;
    entry.voice = session.canPlay() ? session.audio.play(`piano:${next}:${entry.voicing}`, { gain: 0.85 }) : null;
  }
});

// 따라 치기 시범: 선생님이 고른 리듬을 피아노 화음으로 들려준다
session.on('cue', (c) => {
  const chord = session.chordAt(c.pos);
  session.audio.play(`piano:${chord.piano}:1`, { delay: c.delay, gain: 0.8, duration: 0.22, cue: true });
});

session.on('gate', (open) => {
  if (!open) {
    releaseAll();
    ringing.clear(); // 소리는 session이 이미 모두 껐다
  }
});
