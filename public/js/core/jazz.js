// 재즈처럼 들리게 하는 규칙을 한곳에 모았다. 화면이나 오디오에 의존하지 않는 순수 함수라
// 단위 테스트가 가능하다. (색소폰은 원래 방식 그대로 두고, 피아노와 타악기에만 쓴다.)

import { locate } from './song.js';

/** 곡 위치가 박자 안에서 어디인지: 'down'(1·3박) | 'back'(2·4박) | 'off'(엇박) */
export function beatKind(song, pos) {
  const eighth = Math.round(((pos - song.offset) / song.secPerBeat) * 2);
  if (eighth % 2 !== 0) return 'off';
  const beatInBar = (((eighth / 2) % song.beatsPerBar) + song.beatsPerBar) % song.beatsPerBar;
  return beatInBar % 2 === 0 ? 'down' : 'back';
}

/**
 * 피아노 반주: 이 위치에서 누르면 어떤 코드가 나야 하는가.
 * 재즈 반주는 코드가 바뀌기 직전 엇박에서 다음 코드를 미리 친다(당겨 치기).
 * 그렇게 하지 않으면 누른 화음이 바뀐 코드 위에 남아 부딪힌다.
 */
export function compChord(song, pos) {
  const loc = locate(song, pos);
  return loc.phase === 'song' && loc.beatsToNext <= 0.52 ? loc.nextChord : loc.chord;
}

/**
 * 타악기 한 번의 세기와 음색.
 * 2·4박(백비트)은 세게, 1·3박은 보통, 엇박은 여리게. 칠 때마다 음높이를 조금씩 달리해
 * 같은 샘플이 반복되는 기계적인 느낌을 없앤다.
 * @param n 그 악기를 몇 번째 치는지
 * @returns {{gain:number, detune:number}} detune: 센트
 */
export function grooveHit(song, pos, n, rolling = true) {
  const detune = [0, 18, -14, 9, -22, 14][n % 6];
  if (!rolling) return { gain: 1, detune };
  const kind = beatKind(song, pos);
  return { gain: kind === 'back' ? 1 : kind === 'down' ? 0.86 : 0.7, detune };
}
