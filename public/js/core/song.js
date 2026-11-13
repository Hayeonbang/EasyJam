// 곡 데이터와 타임라인 계산.
//
// 모든 악기가 이 한 파일에서 코드 진행을 읽는다. (예전에는 악기마다 따로 적혀 있어
// 색소폰과 피아노의 코드가 서로 어긋났다.)
// 위치(pos)는 항상 "반주 음원 안에서의 초"이고, 타이머가 아니라 위치에서 코드를 계산하므로
// 오래 연주해도 밀리지 않는다.

// 코드별 정보
//   piano : 피아노 코드 샘플 파일 이름 (3가지 보이싱: X, X_1, X_2)
//   scale : 색소폰 패드 9개에 순서대로 놓이는 음 (어느 것을 눌러도 어울리는 음)
//   tones : 그중 특히 잘 어울리는 코드 구성음 (크게 표시)
const CHORDS = {
  Am7: {
    label: 'Am7', piano: 'Am',
    scale: ['C4', 'D4', 'E4', 'Gb4', 'G4', 'A4', 'B4', 'C5', 'D5'],
    tones: ['C4', 'E4', 'G4', 'A4', 'C5'],
  },
  Gm7: {
    label: 'Gm7', piano: 'Gm',
    scale: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5'],
    tones: ['D4', 'F4', 'G4', 'Bb4', 'D5'],
  },
  C7: {
    label: 'C7', piano: 'C',
    scale: ['Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5'],
    tones: ['C4', 'E4', 'G4', 'Bb4', 'C5'],
  },
  FM7: {
    label: 'FM7', piano: 'F',
    scale: ['B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    tones: ['C4', 'E4', 'F4', 'A4', 'C5'],
  },
  Bdim7: {
    label: 'Bdim7', piano: 'Bm',
    scale: ['B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5'],
    tones: ['B3', 'D4', 'F4', 'Ab4'],
  },
  E7b9: {
    label: 'E7♭9', piano: 'E9',
    scale: ['B3', 'C4', 'D4', 'E4', 'F4', 'Ab4', 'A4', 'B4', 'C5'],
    tones: ['B3', 'D4', 'E4', 'Ab4', 'B4'],
  },
  Bb7: {
    label: 'B♭7', piano: 'Bb',
    scale: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5'],
    tones: ['C4', 'E4', 'G4', 'Bb4', 'D5'],
  },
  Bm7: {
    label: 'Bm7', piano: 'Bm',
    scale: ['B3', 'Db4', 'D4', 'E4', 'Gb4', 'G4', 'A4', 'B4', 'D5'],
    tones: ['B3', 'D4', 'Gb4', 'A4', 'B4'],
  },
};

const A_SECTION = [
  ['Am7', 4], ['Gm7', 2], ['C7', 2], ['FM7', 4], ['Bdim7', 2], ['E7b9', 2],
];

export const SUNNY = buildSong({
  id: 'sunny',
  title: 'Sunny',
  src: '/assets/sounds/backing/sunny.mp3',
  bpm: 115,
  offset: 0.043, // 음원 첫 박까지의 시간(초). 음원을 분석해 맞춘 값
  introBeats: 8, // 카운트인
  beatsPerBar: 4,
  choruses: 9,
  duration: 308.7,
  chords: CHORDS,
  progression: [
    ...A_SECTION,
    ...A_SECTION,
    ['Am7', 4], ['Gm7', 2], ['C7', 2], ['FM7', 4], ['Bb7', 4],
    ['Bm7', 4], ['E7b9', 4], ['Am7', 4], ['Bdim7', 2], ['E7b9', 2],
  ],
});

function buildSong(def) {
  let beat = 0;
  const steps = def.progression.map(([chord, beats]) => {
    if (!def.chords[chord]) throw new Error(`알 수 없는 코드: ${chord}`);
    const step = { chord, beats, start: beat };
    beat += beats;
    return step;
  });
  const secPerBeat = 60 / def.bpm;
  const song = { ...def, steps, chorusBeats: beat, secPerBeat };
  // 마지막 코러스가 끝나는 위치(초)
  song.endPos = def.offset + (def.introBeats + beat * def.choruses) * secPerBeat;
  for (const c of Object.values(def.chords)) {
    c.scale.forEach((n) => {
      if (!/^[A-G]b?\d$/.test(n)) throw new Error(`잘못된 음 이름: ${n}`);
    });
    c.tones.forEach((n) => {
      if (!c.scale.includes(n)) throw new Error(`${c.label}: 구성음 ${n}이 스케일에 없습니다`);
    });
  }
  return song;
}

/**
 * 반주 위치(초)가 곡의 어디인지 계산한다.
 * phase: 'intro'(카운트인) | 'song' | 'ended'
 */
export function locate(song, pos) {
  const beat = (pos - song.offset) / song.secPerBeat; // 음원 첫 박 기준 박 번호(소수)
  const songBeat = beat - song.introBeats;
  const total = song.chorusBeats * song.choruses;

  if (songBeat < 0) {
    const first = song.steps[0];
    return {
      phase: 'intro', beat, songBeat, bar: -1, beatInBar: mod(Math.floor(beat), song.beatsPerBar),
      chorus: 0, index: 0, chord: first.chord, nextChord: first.chord, beatsToNext: -songBeat,
      countIn: Math.max(0, Math.ceil(-songBeat)),
    };
  }
  if (songBeat >= total) {
    const last = song.steps[song.steps.length - 1];
    return {
      phase: 'ended', beat, songBeat, bar: Math.floor(total / song.beatsPerBar), beatInBar: 0,
      chorus: song.choruses - 1, index: song.steps.length - 1, chord: last.chord,
      nextChord: last.chord, beatsToNext: 0, countIn: 0,
    };
  }

  const inChorus = songBeat % song.chorusBeats;
  let index = song.steps.length - 1;
  for (let i = 0; i < song.steps.length; i++) {
    const s = song.steps[i];
    if (inChorus < s.start + s.beats) {
      index = i;
      break;
    }
  }
  const step = song.steps[index];
  const next = song.steps[(index + 1) % song.steps.length];
  return {
    phase: 'song',
    beat,
    songBeat,
    bar: Math.floor(songBeat / song.beatsPerBar),
    beatInBar: Math.floor(songBeat) % song.beatsPerBar,
    chorus: Math.floor(songBeat / song.chorusBeats),
    index,
    chord: step.chord,
    nextChord: next.chord,
    beatsToNext: step.start + step.beats - inChorus,
    countIn: 0,
  };
}

/**
 * 가장 가까운 박자 격자를 찾는다. div=2면 8분음표 단위.
 * @returns {{gridPos:number, dev:number}} gridPos: 격자 위치(초), dev: 격자에서 벗어난 시간(초, 늦으면 +)
 */
export function nearestGrid(song, pos, div = 2) {
  const unit = song.secPerBeat / div;
  const k = Math.round((pos - song.offset) / unit);
  const gridPos = song.offset + k * unit;
  return { gridPos, dev: pos - gridPos };
}

/**
 * "돌아가며 연주" 모드에서 지금 누구 차례인지. 곡 위치에서 계산하므로
 * 모든 기기가 메시지를 주고받지 않아도 같은 순간에 차례가 바뀐다.
 * @returns {{current:string|null, next:string|null, barsLeft:number}}
 */
export function turnAt(song, pos, order, barsPerTurn) {
  if (!order || order.length === 0) return { current: null, next: null, barsLeft: 0 };
  const loc = locate(song, pos);
  if (loc.phase !== 'song') return { current: null, next: order[0], barsLeft: 0 };
  const barF = loc.songBeat / song.beatsPerBar;
  const slot = Math.floor(barF / barsPerTurn);
  return {
    current: order[slot % order.length],
    next: order[(slot + 1) % order.length],
    barsLeft: (slot + 1) * barsPerTurn - barF,
  };
}

/** 따라 치기 한 마디의 칸 수 (8분음표 8개) */
export const ECHO_SLOTS = 8;
export const DEFAULT_PATTERN = [1, 0, 1, 0, 1, 0, 1, 0];

/**
 * "따라 치기" 모드에서 지금이 듣는 마디인지 따라 치는 마디인지.
 * 짝수 마디는 시범(call), 홀수 마디는 따라 치기(response). 곡 위치에서 계산하므로
 * 모든 기기가 같은 순간에 바뀐다.
 * @returns {{phase:'call'|'response'|null, round:number, slot:number, barStart:number}}
 *   slot: 마디 안에서의 8분음표 위치(소수), barStart: 그 마디가 시작하는 곡 위치(초)
 */
export function echoAt(song, pos) {
  const songBeat = (pos - song.offset) / song.secPerBeat - song.introBeats + 1e-6;
  const total = song.chorusBeats * song.choruses;
  if (songBeat < 0 || songBeat >= total) return { phase: null, round: -1, slot: 0, barStart: 0 };
  const bar = Math.floor(songBeat / song.beatsPerBar);
  return {
    phase: bar % 2 === 0 ? 'call' : 'response',
    round: Math.floor(bar / 2),
    slot: (songBeat - bar * song.beatsPerBar) * (ECHO_SLOTS / song.beatsPerBar),
    barStart: song.offset + (song.introBeats + bar * song.beatsPerBar) * song.secPerBeat,
  };
}

/** 곡 위치 a(제외)부터 b(포함) 사이에 울려야 하는 시범 음들 */
export function cuesBetween(song, pattern, a, b) {
  const unit = (song.secPerBeat * song.beatsPerBar) / ECHO_SLOTS;
  const out = [];
  for (let k = Math.floor((a - song.offset) / unit) + 1; song.offset + k * unit <= b; k++) {
    const pos = song.offset + k * unit;
    const e = echoAt(song, pos);
    const slot = Math.round(e.slot);
    if (e.phase === 'call' && pattern[slot]) out.push({ pos, slot });
  }
  return out;
}

/** 따라 친 결과 채점: 맞춘 칸, 쳐야 했던 칸, 리듬에 없는 칸을 친 횟수 */
export function scoreEcho(pattern, hits) {
  let matched = 0;
  let total = 0;
  let extra = 0;
  for (let i = 0; i < ECHO_SLOTS; i++) {
    if (pattern[i]) {
      total++;
      if (hits.has(i)) matched++;
    } else if (hits.has(i)) extra++;
  }
  return { matched, total, extra };
}

function mod(a, n) {
  return ((a % n) + n) % n;
}
