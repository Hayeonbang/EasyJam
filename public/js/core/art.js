// 악기 일러스트. 사진 대신 같은 화풍으로 직접 그린 SVG를 쓴다.
// (크기를 키워도 깨지지 않고, 인터넷 없이도 뜨고, 모든 악기가 한 벌처럼 보인다.)

const K = '#17140f'; // 먹색
const P = '#fffdf7'; // 종이색
const GOLD = '#f0b429';
const GOLD_D = '#b07a08';
const WOOD = '#e3b778';
const WOOD_D = '#c4935a';
const RED = '#b8402a';
const RED_D = '#8f2d1b';
const STEEL = '#dcd8cf';

function beads() {
  let out = '';
  for (let row = 0; row < 5; row++) {
    const y = 48 + row * 10;
    for (let x = row % 2 ? 65 : 60; x <= 141; x += 10) out += `<circle cx="${x}" cy="${y}" r="4.3"/>`;
  }
  return out;
}

function jingles() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += `<g transform="rotate(${i * 60 + 30} 100 100) translate(100 34)">
      <rect x="-14" y="-8" width="28" height="16" rx="6" fill="${K}"/>
      <circle cx="-5" r="6.5" fill="${GOLD}"/><circle cx="5" r="6.5" fill="${GOLD}" stroke="${K}" stroke-width="1.5"/>
    </g>`;
  }
  return out;
}

function miniKeys() {
  let out = '';
  for (let i = 0; i < 7; i++) out += `<rect x="${18 + i * 23.6}" y="18" width="21.6" height="86" rx="2" fill="${P}"/>`;
  for (const i of [1, 2, 4, 5, 6]) out += `<rect x="${18 + i * 23.6 - 8}" y="18" width="14" height="52" rx="2" fill="${K}"/>`;
  return out;
}

const ART = {
  piano: `<svg viewBox="0 0 200 122"><rect x="8" y="8" width="184" height="106" rx="8" fill="${K}"/>${miniKeys()}</svg>`,

  saxophone: `<svg viewBox="0 0 170 240" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 31 L13 40" stroke="${K}" stroke-width="10"/>
    <path d="M72 46 Q70 20 50 22 L30 31" stroke="${GOLD}" stroke-width="10"/>
    <path d="M72 46 L86 176" stroke="${GOLD}" stroke-width="21"/>
    <path d="M86 176 Q90 216 120 214 Q148 212 143 174 L138 128" stroke="${GOLD}" stroke-width="27"/>
    <path d="M122 132 L104 92 L162 84 L154 130 Z" fill="${GOLD}" stroke="${GOLD}" stroke-width="4"/>
    <ellipse cx="133" cy="88" rx="30" ry="9" transform="rotate(-8 133 88)" fill="${GOLD_D}" stroke="${GOLD}" stroke-width="4"/>
    <path d="M61 49 L83 46" stroke="${K}" stroke-width="5"/>
    <path d="M73 180 L100 174" stroke="${K}" stroke-width="5"/>
    <g fill="${P}" stroke="${K}" stroke-width="3">
      <circle cx="75" cy="74" r="7"/><circle cx="77.5" cy="96" r="7"/><circle cx="80" cy="118" r="7"/>
      <circle cx="82.5" cy="140" r="7"/><circle cx="84.5" cy="160" r="7"/><circle cx="142" cy="160" r="8.5"/>
    </g>
  </svg>`,

  shaker: `<svg viewBox="0 0 200 200"><g transform="rotate(38 100 104)">
    <rect x="88" y="104" width="24" height="88" rx="12" fill="${WOOD}"/>
    <rect x="52" y="30" width="96" height="76" rx="8" fill="${K}"/>
    <g fill="${STEEL}">${beads()}</g>
    <rect x="45" y="22" width="110" height="15" rx="7.5" fill="${WOOD}"/>
    <rect x="45" y="98" width="110" height="15" rx="7.5" fill="${WOOD_D}"/>
  </g></svg>`,

  triangle: `<svg viewBox="0 0 200 200" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M100 40 L100 12" stroke="${GOLD}" stroke-width="4"/>
    <path d="M113 62 L100 40 L30 164 L170 164 L127 88" stroke="${STEEL}" stroke-width="11"/>
    <path d="M150 52 L186 122" stroke="${STEEL}" stroke-width="7"/>
    <circle cx="147" cy="45" r="7" stroke="${STEEL}" stroke-width="5"/>
  </svg>`,

  conga: `<svg viewBox="0 0 200 240" stroke-linecap="round">
    <path d="M56 44 C40 110 52 180 68 224 L132 224 C148 180 160 110 144 44 Z" fill="${RED}"/>
    <path d="M84 56 C80 120 84 180 90 222 M116 56 C120 120 116 180 110 222" stroke="${RED_D}" stroke-width="3" fill="none"/>
    <path d="M63.500 208 L136.500 208 L132 224 L68 224 Z" fill="${K}"/>
    <path d="M53 60 Q100 80 147 60" stroke="${K}" stroke-width="6" fill="none"/>
    <path d="M63 66 L65 96 M88 73 L89 103 M112 73 L111 103 M137 66 L135 96" stroke="${STEEL}" stroke-width="5" fill="none"/>
    <ellipse cx="100" cy="44" rx="46" ry="13" fill="#f3e6cc" stroke="${K}" stroke-width="6"/>
  </svg>`,

  tambourine: `<svg viewBox="0 0 200 200"><g transform="rotate(-12 100 100)">
    <circle cx="100" cy="100" r="66" fill="#f6ecd6" stroke="${WOOD}" stroke-width="20"/>
    <circle cx="100" cy="100" r="76" fill="none" stroke="${WOOD_D}" stroke-width="2.500"/>
    ${jingles()}
  </g></svg>`,
};

/** 악기 그림 요소를 만든다. 내용은 이 파일 안의 고정된 문자열뿐이다. */
export function art(name, className = '') {
  const tpl = document.createElement('template');
  tpl.innerHTML = (ART[name] || ART.piano).trim();
  const svg = tpl.content.firstElementChild;
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (className) svg.setAttribute('class', className);
  return svg;
}
