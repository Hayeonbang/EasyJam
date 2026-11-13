const bpm = 115;
const beatDuration = 60 / bpm;  // 한 박의 시간 (초)
const sixteenthNoteDuration = beatDuration / 2;  // 16분음표의 시간 (초)
const introBeats = 8;  

const chordProgression = [
  { chord: "Am", duration: 4 },
  { chord: "gm", duration: 2 },
  { chord: "C9", duration: 2 },
  { chord: "FM", duration: 4 },
  { chord: "bm", duration: 2 },
  { chord: "EM", duration: 2 },

  { chord: "Am", duration: 4 },
  { chord: "gm", duration: 2 },
  { chord: "C9", duration: 2 },
  { chord: "FM", duration: 4 },
  { chord: "bm", duration: 2 },
  { chord: "EM", duration: 2 },

  { chord: "Am", duration: 4 },
  { chord: "gm", duration: 2 },
  { chord: "C9", duration: 2 },
  { chord: "FM", duration: 4 },
  { chord: "Bb", duration: 4 },    

  { chord: "bm", duration: 4 },
  { chord: "EM", duration: 4 }, 
  { chord: "Am", duration: 4 },
  { chord: "bm", duration: 2 },
  { chord: "EM", duration: 2 }
];
const sounds = {
    Am: ['assets/sounds/piano/Am.ogg', 'assets/sounds/piano/Am_1.ogg', 'assets/sounds/piano/Am_2.ogg'],
    Bb: ['assets/sounds/piano/Bb.ogg', 'assets/sounds/piano/Bb_1.ogg', 'assets/sounds/piano/Bb_2.ogg'],
    bm: ['assets/sounds/piano/Bm.ogg', 'assets/sounds/piano/Bm_1.ogg', 'assets/sounds/piano/Bm_2.ogg'],
    C9: ['assets/sounds/piano/C.ogg', 'assets/sounds/piano/C_1.ogg', 'assets/sounds/piano/C_2.ogg'],
    EM: ['assets/sounds/piano/E9.ogg', 'assets/sounds/piano/E9_1.ogg', 'assets/sounds/piano/E9_2.ogg'],
    FM: ['assets/sounds/piano/F.ogg', 'assets/sounds/piano/F_1.ogg', 'assets/sounds/piano/F_2.ogg'],
    gm: ['assets/sounds/piano/Gm.ogg', 'assets/sounds/piano/Gm_1.ogg', 'assets/sounds/piano/Gm_2.ogg']
  };

  const images = {
    1: 'assets/images/piano/C.png',
    2: 'assets/images/piano/D.png',
    3: 'assets/images/piano/E.png',
    4: 'assets/images/piano/F.png',
    5: 'assets/images/piano/G.png',
    6: 'assets/images/piano/A.png',
    7: 'assets/images/piano/B.png',
    8: 'assets/images/piano/C2.png',
    9: 'assets/images/piano/D2.png'
  };

  let currentChordIndex = 0;
  let trackStarted = false;
  let trackStartTime = 0;
  let currentKeyPressed = 0;

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const buffers = {};
  const activeSources = new Map();

  const totalProgressionDuration = chordProgression.reduce((sum, chord) => sum + chord.duration, 0);

  async function preloadAudioBuffers() {
    const loadBuffer = async (url) => {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await audioContext.decodeAudioData(arrayBuffer);
    };
  
    for (const [chord, urls] of Object.entries(sounds)) {
      buffers[chord] = await Promise.all(urls.map(loadBuffer));
    }
    console.log('All audio buffers loaded');
  }

  // 페이지 로드 시 오디오 버퍼 프리로딩 시작
  preloadAudioBuffers();

  const playPauseBtn = document.getElementById('playPauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  const progressBar = document.getElementById('progress');
  const progressHandle = document.getElementById('progressHandle');
  const backingVolume = document.getElementById('backingVolume');
  const soloVolume = document.getElementById('soloVolume');

  let backingTrack;

  function loadBackingTrack() {
    backingTrack = new Audio('assets/sounds/Sunny_BackingTrack.wav');
    backingTrack.loop = true;
  }

  loadBackingTrack();

  playPauseBtn.addEventListener('click', togglePlay);
  stopBtn.addEventListener('click', stopTrack);
  backingVolume.addEventListener('input', updateBackingVolume);
  soloVolume.addEventListener('input', updateSoloVolume);

// togglePlay 함수 수정
function togglePlay() {
    if (backingTrack.paused) {
      audioContext.resume();
      backingTrack.play();
      trackStartTime = audioContext.currentTime;
      playPauseBtn.textContent = '❚❚';
      setTimeout(() => {
        trackStarted = true;
        console.log("Track started");
        scheduleChords();
      }, introBeats * beatDuration * 1000);
    } else {
      backingTrack.pause();
      playPauseBtn.textContent = '▶';
      stopAllAudioSources();
      trackStarted = false;
    }
  }

// stopTrack 함수 수정
function stopTrack() {
    backingTrack.pause();
    backingTrack.currentTime = 0;
    playPauseBtn.textContent = '▶';
    stopAllAudioSources();
    trackStarted = false;
    // 기본 이미지로 복귀
    document.getElementById('pianoImage').src = 'assets/images/piano/Default.png';
  }

  function updateBackingVolume() {
    backingTrack.volume = backingVolume.value;
  }

  function updateSoloVolume() {
    // 이 함수는 솔로 오디오의 볼륨을 조절합니다.
    // 현재 재생 중인 모든 솔로 오디오의 볼륨을 조절합니다.
    activeSources.forEach((value) => {
      value.gainNode.gain.setValueAtTime(soloVolume.value, audioContext.currentTime);
    });
  }

  function playChord(chord, keyNumber) {
    console.log(`Now playing: ${chord.chord}, Key: ${keyNumber}`);
    if (!buffers[chord.chord]) {
      console.error(`Buffer not loaded for chord: ${chord.chord}`);
      return;
    }
  
    let soundIndex;
    if ([1, 2, 3].includes(keyNumber)) {
      soundIndex = 0;
    } else if ([4, 5, 6].includes(keyNumber)) {
      soundIndex = 1;
    } else if ([7, 8, 9].includes(keyNumber)) {
      soundIndex = 2;
    } else {
      soundIndex = 0;
    }
  
    const source = audioContext.createBufferSource();
    source.buffer = buffers[chord.chord][soundIndex];
    
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(soloVolume.value, audioContext.currentTime);
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    source.start();
    
    activeSources.set(keyNumber, { source, gainNode });
  }
  function stopChord(keyNumber) {
    const activeSource = activeSources.get(keyNumber);
    if (activeSource) {
      const { source, gainNode } = activeSource;
      // 키를 놓자마자 activeSources에서 제거
      activeSources.delete(keyNumber);
  
      const fadeOutTime = 0.3; // 0.3초 페이드 아웃
      gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + fadeOutTime);
      // 페이드 아웃 후 소스를 정지 및 해제
      setTimeout(() => {
        source.stop();
        source.disconnect();
        gainNode.disconnect();
      }, fadeOutTime * 1000);
    }
  }
  

  function stopCurrentAudio() {
    activeSources.forEach((value, key) => {
      stopChord(key);
    });
  }
  

  function changeImage(key) {
    const image = images[key] || 'assets/images/piano/Default.png';
    document.getElementById('pianoImage').src = image;
  }
  
  function scheduleChords() {
    let totalDuration = 0;
    function scheduleNextCycle() {
      chordProgression.forEach((chord, index) => {
        setTimeout(() => {
          currentChordIndex = index;
          console.log(`Scheduled chord: ${chord.chord}`);
        }, totalDuration * 1000);
        totalDuration += chord.duration * beatDuration;
      });
      setTimeout(scheduleNextCycle, totalDuration * 1000);
    }
    scheduleNextCycle();
  }

  function getCurrentChordIndex() {
    const elapsedTime = audioContext.currentTime - trackStartTime - (introBeats * beatDuration);
    const cycleDuration = totalProgressionDuration * beatDuration;
    const currentCycleTime = elapsedTime % cycleDuration;
    
    let accumulatedDuration = 0;
    for (let i = 0; i < chordProgression.length; i++) {
      accumulatedDuration += chordProgression[i].duration * beatDuration;
      if (currentCycleTime < accumulatedDuration) {
        return i;
      }
    }
    return 0;
  }

  function quantizeToSixteenthNote(time) {
    return Math.round(time / sixteenthNoteDuration) * sixteenthNoteDuration;
  }

  document.addEventListener('keydown', function(event) {
    if (!trackStarted) return;
  
    const key = parseInt(event.key);
    if (key >= 1 && key <= 9 && !activeSources.has(key)) {
      currentKeyPressed = key;
      const now = audioContext.currentTime;
      const elapsedTime = now - trackStartTime - (introBeats * beatDuration);
      const quantizedTime = quantizeToSixteenthNote(elapsedTime);
      const delay = (quantizedTime - elapsedTime) * 1000;
  
      setTimeout(() => {
        changeImage(key);
        const chordIndex = getCurrentChordIndex();
        playChord(chordProgression[chordIndex], key);
      }, delay);
    }
  });
  
// keyup 이벤트 리스너 수정
document.addEventListener('keyup', function(event) {
  const key = parseInt(event.key);
  if (key >= 1 && key <= 9) {
    if (!trackStarted) return;
    currentKeyPressed = 0;
    stopChord(key);
    document.getElementById('pianoImage').src = 'assets/images/piano/Default.png';
  }
});

  // 프로그레스 바 업데이트
  function updateProgressBar() {
    if (!backingTrack.paused) {
      const progress = (backingTrack.currentTime / backingTrack.duration) * 100;
      progressBar.style.width = `${progress}%`;
      progressHandle.style.left = `${progress}%`;
      requestAnimationFrame(updateProgressBar);
    }
  }

  backingTrack.addEventListener('play', () => {
    requestAnimationFrame(updateProgressBar);
  });

  // 프로그레스 바 클릭 이벤트
  const progressContainer = document.querySelector('.progress-container');
  progressContainer.addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedTime = (x / rect.width) * backingTrack.duration;
    backingTrack.currentTime = clickedTime;
    if (backingTrack.paused) {
      togglePlay();
    }
  });