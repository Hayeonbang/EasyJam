// 타악기: 화면 왼쪽/오른쪽 악기를 터치·키보드·카메라(머리 움직임)로 연주한다.
//
// 카메라 연주는 손을 쓰기 어려운 참여자를 위한 입력 방식이다. 코가 화면의 왼쪽이나
// 오른쪽 영역으로 들어가면 그쪽 악기가 울리고, 가운데로 돌아와야 다시 울릴 수 있다.
// 카메라가 없거나 모델을 받지 못해도 터치와 키보드로는 항상 연주할 수 있다.
//
// 도움 단계
//   1 쉬움 : 인식 영역이 넓다 (조금만 움직여도 울림) + 박자 보정
//           + 누르고 있으면 박자에 맞춰 계속 울린다 (여러 번 두드리기 어려운 참여자용)
//   2 보통 : 박자 보정
//   3 도전 : 박자 보정 없음
//
// 그루브 (jazz.js): 2박·4박은 세게, 엇박은 여리게 나고, 칠 때마다 음색이 조금씩 달라진다.
// 같은 세기로만 두드려도 기계처럼 들리지 않고 리듬을 타는 것처럼 들린다.

import { createSession, h } from './core/session.js';
import { art } from './core/art.js';
import { SUNNY, nearestGrid } from './core/song.js';
import { grooveHit } from './core/jazz.js';

const KITS = {
  1: {
    instrument: 'percussion1',
    left: { id: 'shaker', name: '셰이커', sound: '/assets/sounds/drum1/shaker.mp3' },
    right: { id: 'triangle', name: '트라이앵글', sound: '/assets/sounds/drum1/triangle.mp3' },
  },
  2: {
    instrument: 'percussion2',
    left: { id: 'conga', name: '콩가', sound: '/assets/sounds/drum2/conga.mp3' },
    right: { id: 'tambourine', name: '탬버린', sound: '/assets/sounds/drum2/tambourine.mp3' },
  },
};

// 버전을 고정해 둔다. (예전에는 최신 버전을 그대로 받아서 어느 날 갑자기 동작이 바뀔 수 있었다.)
const TF_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/posenet@2.2.2/dist/posenet.min.js',
];

const kit = KITS[new URLSearchParams(location.search).get('kit')] || KITS[1];
const session = createSession({
  instrument: kit.instrument,
  sounds: { [kit.left.id]: kit.left.sound, [kit.right.id]: kit.right.sound },
});

const video = h('video', { class: 'cam-video', playsinline: true, muted: true, hidden: true });
video.muted = true;
const tracker = h('div', { class: 'nose-tracker', hidden: true });
const makePad = (side) =>
  h('button', { class: `pad perc-pad ${side}`, 'aria-label': kit[side].name },
    art(kit[side].id),
    h('span', { text: kit[side].name }),
  );
const pads = { left: makePad('left'), right: makePad('right') };
const camBtn = h('button', { class: 'btn', text: '머리 움직임으로 연주하기' });
const hint = h('p', { class: 'hint', text: '악기를 누르거나, 키보드 ← → 를 눌러 보세요' });

document.getElementById('stage').append(
  video,
  h('div', { class: 'perc-row' }, pads.left, pads.right),
  h('div', { class: 'perc-tools' }, camBtn),
  hint,
  tracker,
);

const hitCount = { left: 0, right: 0 };

/** 소리와 화면 반응. 기록은 남기지 않는다 (자동 반복에서도 쓴다). */
function sound(side, t) {
  const g = grooveHit(SUNNY, t.pos, hitCount[side]++, t.dev != null);
  session.audio.play(kit[side].id, { delay: t.delay, gain: g.gain, detune: g.detune });
  const pad = pads[side];
  setTimeout(() => {
    pad.classList.remove('on');
    void pad.offsetWidth; // 연달아 쳐도 애니메이션이 매번 다시 시작되게
    pad.classList.add('on');
    setTimeout(() => pad.classList.remove('on'), 220);
    if (t.dev != null && Math.abs(t.dev) <= 90) session.sparkle(pad);
  }, t.delay * 1000);
}

function hit(side) {
  if (!session.canPlay()) return;
  const t = session.timing();
  sound(side, t);
  session.report(t.dev);
}

// ---- 누르고 있으면 계속 울리기 (쉬움 단계) ------------------------------
// 누르고 있는 동안 8분음표마다 박자에 맞춰 다시 울린다. 참여자가 직접 친 것이 아니므로
// 연주 기록에는 처음 누른 한 번만 남는다. 따라 치기 중에는 리듬을 직접 쳐야 하므로 끈다.

const holding = { left: null, right: null }; // 다음에 울릴 곡 위치(초)
const EIGHTH = SUNNY.secPerBeat / 2;

function hold(side) {
  holding[side] = nearestGrid(SUNNY, session.transport.position(), 2).gridPos + EIGHTH;
}
function letGo(side) {
  holding[side] = null;
}

session.on('frame', (loc, rolling) => {
  const echoing = session.room && session.room.turn.mode === 'echo';
  const active = rolling && session.assist === 1 && !echoing && session.canPlay();
  const pos = session.transport.position();
  const rate = session.transport.state.rate;
  for (const side of ['left', 'right']) {
    if (holding[side] == null) continue;
    if (!active) {
      letGo(side);
      continue;
    }
    if (holding[side] < pos - EIGHTH) holding[side] = nearestGrid(SUNNY, pos, 2).gridPos + EIGHTH; // 탭이 잠들었다 깬 경우
    if (holding[side] - pos <= 0.06 * rate) {
      sound(side, { delay: Math.max(0, (holding[side] - pos) / rate), dev: 0, pos: holding[side] });
      holding[side] += EIGHTH;
    }
  }
});

// 따라 치기 시범: 선생님이 고른 리듬을 왼쪽 악기 소리로 들려준다
session.on('cue', (c) => session.audio.play(kit.left.id, { delay: c.delay, gain: 0.8, cue: true }));

// ---- 터치 / 키보드 / MIDI ---------------------------------------------

for (const side of ['left', 'right']) {
  pads[side].addEventListener('pointerdown', (e) => {
    e.preventDefault();
    hit(side);
    hold(side);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) pads[side].addEventListener(type, () => letGo(side));
  pads[side].addEventListener('contextmenu', (e) => e.preventDefault());
}

const KEY_SIDE = { ArrowLeft: 'left', ArrowRight: 'right', f: 'left', j: 'right', 1: 'left', 2: 'right' };
document.addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const side = KEY_SIDE[e.key] || KEY_SIDE[e.key.toLowerCase()];
  if (!side) return;
  e.preventDefault();
  hit(side);
  hold(side);
});
document.addEventListener('keyup', (e) => {
  const side = KEY_SIDE[e.key] || KEY_SIDE[e.key.toLowerCase()];
  if (side) letGo(side);
});
window.addEventListener('blur', () => {
  letGo('left');
  letGo('right');
});

session.onMidi((note, on) => {
  if (on) hit(note < 64 ? 'left' : 'right');
});

// ---- 카메라 (머리 움직임) ---------------------------------------------

let camOn = false;
let stream = null;
let zone = 'center';
let smoothX = 0.5;
let lostFrames = 0;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = h('script', { src, crossorigin: 'anonymous' });
    s.onload = resolve;
    s.onerror = () => reject(new Error(`스크립트를 받지 못했습니다: ${src}`));
    document.head.append(s);
  });
}

async function startCamera() {
  if (camOn) return stopCamera();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    // 다른 기기에서 http로 접속하면 브라우저가 카메라를 막는다
    return session.toast('이 주소에서는 카메라를 쓸 수 없어요. https 주소로 접속해 주세요.', 6000);
  }
  camBtn.disabled = true;
  camBtn.textContent = '카메라 준비 중…';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
    video.srcObject = stream;
    await video.play();
    for (const src of TF_SCRIPTS) await loadScript(src);
    const net = await window.posenet.load({ architecture: 'MobileNetV1', outputStride: 16, multiplier: 0.5, inputResolution: 257 });
    camOn = true;
    video.hidden = false;
    document.body.classList.add('cam-on');
    camBtn.textContent = '카메라 끄기';
    hint.textContent = '머리를 왼쪽이나 오른쪽으로 움직이면 악기가 울려요';
    detectLoop(net);
  } catch (err) {
    console.error('카메라를 시작하지 못했습니다', err);
    stopCamera();
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'NotFoundError');
    session.toast(denied ? '카메라를 쓸 수 없어요. 터치나 키보드로 연주해 보세요.' : '머리 인식을 준비하지 못했어요. 터치로 연주해 보세요.', 6000);
  } finally {
    camBtn.disabled = false;
  }
}

function stopCamera() {
  camOn = false;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
  video.hidden = true;
  tracker.hidden = true;
  zone = 'center';
  document.body.classList.remove('cam-on');
  pads.left.classList.remove('near');
  pads.right.classList.remove('near');
  camBtn.textContent = '머리 움직임으로 연주하기';
}

async function detectLoop(net) {
  while (camOn) {
    // 탭이 가려져 있으면 쉬어서 배터리를 아낀다
    if (document.hidden || video.readyState < 2) {
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    try {
      const pose = await net.estimateSinglePose(video, { flipHorizontal: true });
      if (!camOn) break;
      onPose(pose);
    } catch (err) {
      // 한 프레임이 실패해도 멈추지 않는다 (예전에는 여기서 인식이 영영 멈췄다)
      console.warn('자세 인식 실패', err);
      await new Promise((r) => setTimeout(r, 300));
    }
    await new Promise((r) => requestAnimationFrame(r));
  }
}

function onPose(pose) {
  const nose = pose.keypoints.find((k) => k.part === 'nose');
  if (!nose || nose.score < 0.4) {
    // 잠깐 놓친 것은 무시하고, 계속 안 보이면 표시를 숨긴다
    if (++lostFrames > 15) tracker.hidden = true;
    return;
  }
  lostFrames = 0;
  const x = nose.position.x / video.videoWidth;
  const y = nose.position.y / video.videoHeight;
  smoothX += (x - smoothX) * 0.5; // 떨림 줄이기

  // 영상은 화면에 꽉 차게(cover) 그려지므로 같은 방식으로 좌표를 옮긴다
  const r = video.getBoundingClientRect();
  const scale = Math.max(r.width / video.videoWidth, r.height / video.videoHeight);
  const dx = (r.width - video.videoWidth * scale) / 2;
  const dy = (r.height - video.videoHeight * scale) / 2;
  tracker.style.left = `${r.left + dx + smoothX * video.videoWidth * scale}px`;
  tracker.style.top = `${r.top + dy + y * video.videoHeight * scale}px`;
  tracker.hidden = false;

  const screenX = (dx + smoothX * video.videoWidth * scale) / r.width;
  const enter = session.assist === 1 ? 0.42 : 0.35;
  const leave = enter + 0.05; // 경계에서 떨릴 때 연달아 울리지 않도록 나가는 선을 따로 둔다
  let next = zone;
  if (zone === 'center') {
    if (screenX < enter) next = 'left';
    else if (screenX > 1 - enter) next = 'right';
  } else if (zone === 'left' && screenX > leave) next = 'center';
  else if (zone === 'right' && screenX < 1 - leave) next = 'center';

  if (next !== zone) {
    zone = next;
    pads.left.classList.toggle('near', zone === 'left');
    pads.right.classList.toggle('near', zone === 'right');
    if (zone !== 'center') hit(zone);
  }
}

camBtn.addEventListener('click', startCamera);
window.addEventListener('pagehide', stopCamera);
