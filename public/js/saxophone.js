// 색소폰: 코드가 바뀔 때마다 패드의 음이 그 코드에 어울리는 음으로 바뀐다.
//
// 도움 단계
//   1 쉬움 : 코드 구성음만 보인다 (4~5개의 큰 패드, 무엇을 눌러도 잘 어울림)
//   2 보통 : 9개 패드, 구성음은 크게 표시
//   3 도전 : 9개 패드, 크기 힌트 없음, 박자 보정 없음

import { createSession, h } from './core/session.js';
import { SUNNY } from './core/song.js';
import { art } from './core/art.js';

const NOTES = [
  'E3', 'F3', 'Gb3', 'G3', 'Ab3', 'A3', 'Bb3', 'B3',
  'C4', 'Db4', 'D4', 'Eb4', 'E4', 'F4', 'Gb4', 'G4', 'Ab4', 'A4', 'Bb4', 'B4',
  'C5', 'D5',
];
const MIDI_PADS = { 60: 0, 62: 1, 64: 2, 65: 3, 67: 4, 69: 5, 71: 6, 72: 7, 74: 8 };

const sounds = Object.fromEntries(NOTES.map((n) => [`sax:${n}`, `/assets/sounds/saxophone/${n}.mp3`]));
const session = createSession({ instrument: 'saxophone', sounds });

const pads = Array.from({ length: 9 }, (_, i) => {
  const el = h('button', { class: 'pad sax-pad', 'aria-label': `색소폰 ${i + 1}` },
    art('saxophone'),
    h('span', { class: 'sax-key', text: i + 1 }),
  );
  return { el, note: null, tone: false, voice: null, timer: null, on: false };
});
document.getElementById('stage').append(
  h('div', { class: 'sax-row' }, pads.map((p) => p.el)),
  h('p', { class: 'hint', text: '색소폰을 누르거나 손가락으로 스쳐 보세요. 큰 색소폰이 가장 잘 어울려요' }),
);

let chord = SUNNY.chords[SUNNY.steps[0].chord];

/** 코드나 도움 단계가 바뀌면 패드에 음을 다시 배치한다. 지금 울리는 패드는 건드리지 않는다. */
function layout() {
  pads.forEach((p, i) => {
    if (!p.on) {
      p.note = chord.scale[i];
      p.tone = chord.tones.includes(p.note);
    }
    const showHint = session.assist < 3;
    p.el.classList.toggle('tone', showHint && p.tone);
    p.el.classList.toggle('small', showHint && !p.tone);
    // 쉬움: 구성음이 아닌 패드는 숨긴다 (울리는 중이면 끝날 때까지 둔다)
    p.el.hidden = session.assist === 1 && !p.tone && !p.on;
  });
}

function visiblePads() {
  return pads.filter((p) => !p.el.hidden);
}

function start(p) {
  if (!p || p.on || !session.canPlay()) return;
  const t = session.timing();
  p.on = true;
  p.voice = session.audio.play(`sax:${p.note}`, { delay: t.delay });
  p.timer = setTimeout(() => {
    p.el.classList.add('on');
    if (t.dev != null && Math.abs(t.dev) <= 90) session.sparkle(p.el);
  }, t.delay * 1000);
  session.report(t.dev);
}

function stop(p) {
  if (!p || !p.on) return;
  p.on = false;
  clearTimeout(p.timer);
  if (p.voice) p.voice.stop(0.15);
  p.voice = null;
  p.el.classList.remove('on');
  layout(); // 울리는 동안 코드가 바뀌었으면 이제 새 음으로
}

function stopAll() {
  pads.forEach(stop);
}

// 마우스는 올리기만 해도, 터치는 누르거나 스치면 소리가 난다
pads.forEach((p) => {
  p.el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    // 터치의 포인터 캡처를 풀어야 다른 패드로 미끄러질 때 enter/leave가 온다
    if (p.el.hasPointerCapture(e.pointerId)) p.el.releasePointerCapture(e.pointerId);
    start(p);
  });
  p.el.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse' || e.buttons > 0 || e.pressure > 0) start(p);
  });
  for (const type of ['pointerleave', 'pointerup', 'pointercancel']) p.el.addEventListener(type, () => stop(p));
  p.el.addEventListener('contextmenu', (e) => e.preventDefault());
});

function padFromKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const m = /^[1-9]$/.test(e.key) ? e.key : (/^(?:Digit|Numpad)([1-9])$/.exec(e.code) || [])[1];
  if (!m) return null;
  // 쉬움 단계에서는 보이는 패드만 왼쪽부터 1, 2, 3…
  return visiblePads()[Number(m) - 1] || null;
}

const keyPads = new Map(); // 누른 키 → 그때 울린 패드 (떼는 순간 배치가 달라져도 정확히 끄기 위해)
document.addEventListener('keydown', (e) => {
  const p = padFromKey(e);
  if (!p) return;
  e.preventDefault();
  if (e.repeat || keyPads.has(e.code)) return;
  keyPads.set(e.code, p);
  start(p);
});
document.addEventListener('keyup', (e) => {
  const p = keyPads.get(e.code);
  if (!p) return;
  keyPads.delete(e.code);
  stop(p);
});
window.addEventListener('blur', () => {
  keyPads.clear();
  stopAll();
});

const midiPads = new Map(); // 누른 MIDI 건반 → 그때 울린 패드
session.onMidi((note, on) => {
  if (on) {
    const p = visiblePads()[MIDI_PADS[note]];
    if (!p) return;
    midiPads.set(note, p);
    start(p);
  } else {
    stop(midiPads.get(note));
    midiPads.delete(note);
  }
});

session.on('chord', (loc) => {
  chord = SUNNY.chords[loc.chord];
  layout();
});
session.on('settings', layout);
// 따라 치기 시범: 선생님이 고른 리듬을 코드 구성음으로 들려준다
const CUE_LINE = [0, 1, 2, 1, 2, 3, 2, 1];
session.on('cue', (c) => {
  const tones = session.chordAt(c.pos).tones;
  session.audio.play(`sax:${tones[CUE_LINE[c.slot] % tones.length]}`, { delay: c.delay, gain: 0.8, duration: 0.18, cue: true });
});

session.on('gate', (open) => {
  if (!open) stopAll();
});
layout();
