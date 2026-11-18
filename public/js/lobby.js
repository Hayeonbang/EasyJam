// 첫 화면: 이름과 방 번호를 받고 악기 화면으로 보낸다.

import { art } from './core/art.js';
import { serverAvailable, REPO_URL } from './core/net.js';

for (const slot of document.querySelectorAll('[data-art]')) slot.replaceWith(art(slot.dataset.art));

const nameInput = document.getElementById('name');
const roomInput = document.getElementById('room');
const message = document.getElementById('message');

const params = new URLSearchParams(location.search);
roomInput.value = (params.get('room') || '').replace(/\D/g, '').slice(0, 4);
try {
  nameInput.value = localStorage.getItem('easyjam.name') || '';
} catch {
  /* 저장소를 못 쓰는 환경 */
}

roomInput.addEventListener('input', () => {
  roomInput.value = roomInput.value.replace(/\D/g, '').slice(0, 4);
  message.textContent = '';
});
document.getElementById('join').addEventListener('submit', (e) => e.preventDefault());

for (const btn of document.querySelectorAll('.inst')) {
  btn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const room = roomInput.value.trim();
    if (room && !/^\d{4}$/.test(room)) {
      message.textContent = '방 번호는 숫자 4자리예요.';
      roomInput.focus();
      return;
    }
    if (room && !name) {
      message.textContent = '함께 연주하려면 이름을 적어 주세요.';
      nameInput.focus();
      return;
    }
    try {
      localStorage.setItem('easyjam.name', name);
    } catch {
      /* 무시 */
    }
    const url = new URL(btn.dataset.href, location.href);
    if (room) url.searchParams.set('room', room);
    if (name) url.searchParams.set('name', name);
    location.href = url.toString();
  });
}

// 서버 없이 올린 웹 데모(GitHub Pages)에서는 혼자 연습만 보여 준다
serverAvailable().then((ok) => {
  if (ok) return;
  document.body.classList.add('demo');
  roomInput.value = '';
  document.getElementById('room-field').hidden = true;
  document.getElementById('host-link').hidden = true;
  const note = document.getElementById('demo-note');
  note.append(
    '웹 데모예요. 악기를 골라 반주에 맞춰 혼자 연주해 볼 수 있어요. ',
    '여러 기기가 함께 연주하는 기능(방, 선생님 화면)은 서버를 실행해야 쓸 수 있어요. ',
  );
  const a = document.createElement('a');
  a.href = REPO_URL;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = '실행 방법 보기';
  note.append(a);
  note.hidden = false;
});
