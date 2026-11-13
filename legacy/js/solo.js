var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
// 재생/일시정지 토글 함수
function togglePlayPause() {
  if (audio.paused) {
    audio.play();
    playTrack();
  } else {
    audio.pause();
    pauseTrack();
  }
}
// 키보드 맵핑
const keyMapping = {
  '1': 0, 'a': 0, 'ㅁ': 0,
  '2': 1, 's': 1, 'ㄴ': 1,
  '3': 2, 'd': 2, 'ㅇ': 2,
  '4': 3, 'f': 3, 'ㄹ': 3,
  '5': 4, 'h': 4, 'ㅗ': 4,
  '6': 5, 'j': 5, 'ㅓ': 5,
  '7': 6, 'k': 6, 'ㅏ': 6,
  '8': 7, 'l': 7, 'ㅣ': 7,
  '9': 8, ';': 8, ';': 8
};

// 현재 활성화된 버튼을 추적
let activeButton = null;

// 키보드 이벤트 리스너 추가
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
// 스페이스바 이벤트 리스너
document.addEventListener('keydown', function(event) {
  if (event.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    event.preventDefault(); // 스페이스바의 기본 동작(스크롤) 방지
    if (audio.paused) {
      audio.play();
      playTrack();
    } else {
      audio.pause();
      pauseTrack();
    }
  }
});
function handleKeyDown(event) {
  const key = event.key;
  if (key in keyMapping) {
    const buttonIndex = keyMapping[key];
    const button = buttons[buttonIndex];
    if (button && button !== activeButton) {
      if (activeButton) {
        unhover(activeButton);
        simulateMouseEvent(activeButton, 'mouseleave');
      }
      hover(button);
      simulateMouseEvent(button, 'mouseenter');
      activeButton = button;
    }
  }
}



function handleKeyUp(event) {
  const key = event.key;
  if (key in keyMapping) {
    const buttonIndex = keyMapping[key];
    const button = buttons[buttonIndex];
    if (button === activeButton) {
      unhover(button);
      simulateMouseEvent(button, 'mouseleave');
      activeButton = null;
    }
  }
}

function simulateMouseEvent(element, eventType) {
  const event = new MouseEvent(eventType, {
    view: window,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(event);
}

var Guitar = function () {
  function Guitar(context, buffer) {
    _classCallCheck(this, Guitar);

    this.context = context;
    this.buffer = buffer;
  }

  _createClass(Guitar, [{
    key: 'setup',
    value: function setup() {
      this.gainNode = this.context.createGain();
      this.source = this.context.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.connect(this.gainNode);
      this.gainNode.connect(this.context.destination);

      this.gainNode.gain.setValueAtTime(0.8, this.context.currentTime);
    }
  }, {
    key: 'play',
    value: function play() {
      this.setup();
      this.source.start(this.context.currentTime);





    }
  }, {
    key: 'stop',
    value: function stop() {
      var ct = this.context.currentTime + 0.5;
      this.gainNode.gain.exponentialRampToValueAtTime(0.001, ct);
      this.source.stop(ct);
      





    }
  }]);

  return Guitar;
}();

var Buffer = function () {
  function Buffer(context, urls) {
    _classCallCheck(this, Buffer);

    this.context = context;
    this.urls = urls;
    this.buffer = [];
  }

  _createClass(Buffer, [{
    key: 'loadSound',
    value: function loadSound(url, index) {
      var request = new XMLHttpRequest();
      request.open('get', url, true);
      request.responseType = 'arraybuffer';
      var thisBuffer = this;
      request.onload = function () {
        // Safari doesn't support promise based syntax
        thisBuffer.context.decodeAudioData(request.response, function (buffer) {
          thisBuffer.buffer[index] = buffer;
          updateProgress(thisBuffer.urls.length);
          if (index == thisBuffer.urls.length - 1) {
            thisBuffer.loaded();
          }
        });
      };
      request.send();
    }
  }, {
    key: 'getBuffer',
    value: function getBuffer() {
      var _this = this;

      this.urls.forEach(function (url, index) {
        _this.loadSound(url, index);
      });
    }
  }, {
    key: 'loaded',
    value: function loaded() {
      document.querySelector('.loading').style.opacity = 0;
      document.querySelector('.loading').style.height = 0;
      document.querySelector('.notes').style.height = "auto";
      document.querySelector('.notes').style.opacity = 1;
      _loaded = true;
    }
  }, {
    key: 'getSound',
    value: function getSound(index) {
      return this.buffer[index];
    }
  }]);

  return Buffer;
}();

var progressBar = document.querySelector('.progress');
var iteration = 0;

function updateProgress(total) {
  progressBar.style.width = ++iteration / total * 100 + '%';
}

var guitar = null;







var preset = 0;








var _loaded = false;

function playGuitar_Cm() {

  var index = parseInt(this.dataset.note) + preset;
  guitar = new Guitar(context, buffer.getSound(index));
  guitar.play();
}

function playGuitar_F7() {

  var index = parseInt(this.dataset.note) + 9 + preset;
  guitar = new Guitar(context, buffer.getSound(index));
  guitar.play();
}

function playGuitar_Bb() {

  var index = parseInt(this.dataset.note) + 18 + preset;
  guitar = new Guitar(context, buffer.getSound(index));
  guitar.play();
}


function playGuitar_Eb() {

  var index = parseInt(this.dataset.note) + 27 + preset;
  guitar = new Guitar(context, buffer.getSound(index));
  guitar.play();
}

function playGuitar_Am() {

  var index = parseInt(this.dataset.note) + 36 + preset;
  guitar = new Guitar(context, buffer.getSound(index));
  guitar.play();
}

function playGuitar_D7alt() {

  var index = parseInt(this.dataset.note) + 45 + preset;
  guitar = new Guitar(context, buffer.getSound(index));
  guitar.play();
}

function playGuitar_Gm() {

  var index = parseInt(this.dataset.note) + 54 + preset;
  guitar = new Guitar(context, buffer.getSound(index));
  guitar.play();
}

function playGuitar_Gbm() {

  var index = parseInt(this.dataset.note) + 63 + preset;
  guitar = new Guitar(context, buffer.getSound(index));
  guitar.play();
}

function playGuitar_Fm() {

  var index = parseInt(this.dataset.note) + 72 + preset;
  guitar = new Guitar(context, buffer.getSound(index));
  guitar.play();
}

function playGuitar_EM7() {

  var index = parseInt(this.dataset.note) + 81 + preset;
  guitar = new Guitar(context, buffer.getSound(index));
  guitar.play();
}

function playGuitar_Bb7() {

  var index = parseInt(this.dataset.note) + 90 + preset;
  guitar = new Guitar(context, buffer.getSound(index));
  guitar.play();
}















///////////////////

function stopGuitar() {
  guitar.stop();
}

var context = new (window.AudioContext || window.webkitAudioContext)();
var now = context.currentTime;
//E3~C5
var sounds = 
['https://ianwonilkim.github.io/Final/audio/gtr/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/C5.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/D5.mp3', 


'https://ianwonilkim.github.io/Final/audio/gtr/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Gb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Ab4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/C5.mp3', 


'https://ianwonilkim.github.io/Final/audio/gtr/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/C5.mp3', 


'https://ianwonilkim.github.io/Final/audio/gtr/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/C5.mp3', 


'https://ianwonilkim.github.io/Final/audio/gtr/A3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb4.mp3', 


'https://ianwonilkim.github.io/Final/audio/gtr/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Gb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Ab4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb4.mp3', 


'https://ianwonilkim.github.io/Final/audio/gtr/G3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/A3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/A4.mp3', 


'https://ianwonilkim.github.io/Final/audio/gtr/Gb3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Ab3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/B3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Db4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/E4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Gb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Ab4.mp3', 


'https://ianwonilkim.github.io/Final/audio/gtr/F3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/G3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Ab3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/G4.mp3', 


'https://ianwonilkim.github.io/Final/audio/gtr/F3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/G3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Ab3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/G4.mp3', 


'https://ianwonilkim.github.io/Final/audio/gtr/Ab3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Ab4.mp3', 'https://ianwonilkim.github.io/Final/audio/gtr/Bb4.mp3',



'https://ianwonilkim.github.io/Final/audio/sax/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/C5.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/D5.mp3', 


'https://ianwonilkim.github.io/Final/audio/sax/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Gb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Ab4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/C5.mp3', 


'https://ianwonilkim.github.io/Final/audio/sax/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/C5.mp3', 


'https://ianwonilkim.github.io/Final/audio/sax/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/C5.mp3', 


'https://ianwonilkim.github.io/Final/audio/sax/A3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb4.mp3', 


'https://ianwonilkim.github.io/Final/audio/sax/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Gb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Ab4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb4.mp3', 


'https://ianwonilkim.github.io/Final/audio/sax/G3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/A3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/A4.mp3', 


'https://ianwonilkim.github.io/Final/audio/sax/Gb3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Ab3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/B3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Db4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/E4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Gb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Ab4.mp3', 


'https://ianwonilkim.github.io/Final/audio/sax/F3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/G3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Ab3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/G4.mp3', 


'https://ianwonilkim.github.io/Final/audio/sax/F3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/G3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Ab3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/G4.mp3', 


'https://ianwonilkim.github.io/Final/audio/sax/Ab3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Ab4.mp3', 'https://ianwonilkim.github.io/Final/audio/sax/Bb4.mp3',






'https://ianwonilkim.github.io/Final/audio/piano/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/C5.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/D5.mp3', 


'https://ianwonilkim.github.io/Final/audio/piano/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Gb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Ab4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/C5.mp3', 


'https://ianwonilkim.github.io/Final/audio/piano/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/C5.mp3', 


'https://ianwonilkim.github.io/Final/audio/piano/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/C5.mp3', 


'https://ianwonilkim.github.io/Final/audio/piano/A3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb4.mp3', 


'https://ianwonilkim.github.io/Final/audio/piano/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Gb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Ab4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/A4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb4.mp3', 


'https://ianwonilkim.github.io/Final/audio/piano/G3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/A3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/A4.mp3', 


'https://ianwonilkim.github.io/Final/audio/piano/Gb3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Ab3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/B3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Db4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/E4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Gb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Ab4.mp3', 


'https://ianwonilkim.github.io/Final/audio/piano/F3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/G3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Ab3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/G4.mp3', 


'https://ianwonilkim.github.io/Final/audio/piano/F3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/G3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Ab3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/G4.mp3', 


'https://ianwonilkim.github.io/Final/audio/piano/Ab3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb3.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/C4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/D4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Eb4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/F4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/G4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Ab4.mp3', 'https://ianwonilkim.github.io/Final/audio/piano/Bb4.mp3',












];



//////////////악보







// var audio = document.getElementById("player");


// // Countup
// audio.addEventListener("timeupdate", function() {
//     var timeline = document.getElementById('duration');
//     var s = parseInt(audio.currentTime % 60);
//     var m = parseInt((audio.currentTime / 60) % 60);
//     if (s < 10) {
//         timeline.innerHTML = m + ':0' + s;
//     }
//     else {
//         timeline.innerHTML = m + ':' + s;
//     }
// }, false);


////////////button

var audio = document.querySelector('audio');
var play = document.querySelector('.play');
var rewind = document.querySelector('.rewind');
var forward = document.querySelector('.forward');
var songchange = document.querySelector('.songchange');
var description = document.querySelector('.description');
var volumeControl = document.getElementById('volumeControl'); // 0722_edited

var GTR = document.querySelector('.GTR');
var SAX = document.querySelector('.SAX');
var PIANO = document.querySelector('.PIANO');
var song = 0;


// function getCurTime() { 

//     console.log(audio.currentTime);
// } 

// function setCurTime1() { 
//     var input = prompt('Message');


//     audio.currentTime = input;
// } 

// function barskip() { 


//   } 





 function resetbutton(){

  buttons.forEach(function (button, index) {
      button.removeEventListener('mouseenter', playGuitar_Cm);
      button.removeEventListener('mouseenter', playGuitar_F7);
      button.removeEventListener('mouseenter', playGuitar_Bb);
      button.removeEventListener('mouseenter', playGuitar_Eb);
      button.removeEventListener('mouseenter', playGuitar_Am);
      button.removeEventListener('mouseenter', playGuitar_D7alt);
      button.removeEventListener('mouseenter', playGuitar_Gm);
      button.removeEventListener('mouseenter', playGuitar_Gbm);
      button.removeEventListener('mouseenter', playGuitar_Fm);
      button.removeEventListener('mouseenter', playGuitar_EM7);
      button.removeEventListener('mouseenter', playGuitar_Bb7);
    })

}







//////png change

var date = new Date();

function hover(element) {
  
  if (preset == 0) {element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/GTRON.svg')};
  if (preset == 99) {element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/SAXON.svg')};  
  if (preset == 198) {element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/PIANOON.svg')}; 
}
function unhover(element) {
  if (preset == 0) {element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/GTROFF.svg')};
  if (preset == 99) {element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/SAXOFF.svg')};  
  if (preset == 198) {element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/PIANOOFF.svg')}; 

}



//////song change




audio.addEventListener('pause', pauseTrack);
audio.addEventListener('play', playTrack);
volumeControl.addEventListener('input', function() {
  audio.volume = this.value;
}); // 0722_edited


play.addEventListener('click', function () {
  if (audio.paused) {
    audio.play();
    playTrack();
  } else {
    audio.pause();
    pauseTrack();
  }
});


function playTrack() {
  play.querySelector('.pause-icon').style.display = "block";
  play.querySelector('.play-icon').style.display = "none";
}

function pauseTrack() {
  play.querySelector('.pause-icon').style.display = "none";
  play.querySelector('.play-icon').style.display = "block";
}




songchange.addEventListener('click', function() { 
  if (song == 0) {
    //console.log(document.getElementById("audio"))
    document.getElementById("audio").setAttribute('src', 'https://ianwonilkim.github.io/Final/audio/backing/JAZZ2.mp3');
    resetbutton();
    song=1;
    pauseTrack();

  }
  else {
    document.getElementById("audio").setAttribute('src', 'https://ianwonilkim.github.io/Final/audio/backing/JAZZ1.mp3');
    resetbutton();
    song=0;    
    pauseTrack();

  };
});







function description_hover(element) {
  

    element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/description_hover.svg')
    
}

function description_unhover(element) {
    
    element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/description_unhover.svg')
    
}



function description_click(element) {

  location.href='description.html'
 

}

  







var track = 1

function songchange_hover(element) {
  

    element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/songchangehover.svg')
    
}

function songchange_unhover(element) {
    if (track == 2) {
    element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/songchange2.svg')
    }
    else {
    element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/songchange1.svg');
    }
}

function songchange_click(element) {
  var song_name = document.getElementById('demo')
  phrase = -4.2

  
  if (track == 2) {
  element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/songchange1.svg')
  track = 1
  document.getElementById('demo').innerHTML = "Autumn leaves 'Funky style'"

  }
  
  else{
  element.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/songchange2.svg')
  track = 2 
  document.getElementById('demo').innerHTML = "Autumn leaves 'Standard Jazz style'"

  };


  
}






rewind.addEventListener('click', function () {
  resetbutton()
  phrase = -4.2
  audio.currentTime = 0;
    
});


forward.addEventListener('click', function () {
  resetbutton()
  console.log(phrase)
  audio.currentTime += 2;
  if (audio.currentTime == 67.8 ){ 
    phrase = 59.8
 
  }


});



audio.volume = volumeControl.value; // 0722_edited




//////////////////////////////////////////preset instrument select


GTR.addEventListener('click', function () {
  
  if (preset != 0){

  GTR.classList.toggle('rock');
    if (preset == 99) {SAX.classList.toggle('rock')}
    else {PIANO.classList.toggle('rock')};
    preset = 0
  /////button누르면 이미ㅈ새로고침
    var buttons = document.querySelectorAll('.notes .note');
    buttons.forEach(function (button) {
      button.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/GTROFF.svg');      
    });

  }
});

SAX.addEventListener('click', function () {

  if (preset != 99){
    SAX.classList.toggle('rock');
    if (preset == 0) {GTR.classList.toggle('rock')}
    else {PIANO.classList.toggle('rock')};
    preset = 99
    var buttons = document.querySelectorAll('.notes .note');
    buttons.forEach(function (button) {
      button.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/SAXOFF.svg');      
    });

  }
});

PIANO.addEventListener('click', function () {
  if (preset != 198){

  PIANO.classList.toggle('rock');

  if (preset == 0) {GTR.classList.toggle('rock')}
  else {SAX.classList.toggle('rock')};
  
  preset = 198
  var buttons = document.querySelectorAll('.notes .note');
    buttons.forEach(function (button) {
      button.setAttribute('src', 'https://ianwonilkim.github.io/Final/source/PIANOOFF.svg');      
    });

  }
});








audio.addEventListener('ended', function () {
  pauseTrack();
});











////////notemaking

function notereset(){

  var x = document.getElementsByClassName('note key');
      while (x && x.length) {
      x[0].className = 'note'
      }

}


function notemaking(name1,name2,name3,name4,name5){

  document.getElementById(name1).className = "note key";
  document.getElementById(name2).className = "note key";
  document.getElementById(name3).className = "note key";
  document.getElementById(name4).className = "note key";
  if (name5 != 0){
    document.getElementById(name5).className = "note key";
  }
  else{
    document.getElementById(name1).className = "note key";
  }

}

//////////




var buffer = new Buffer(context, sounds);
var guitarSound = buffer.getBuffer();

var buttons = document.querySelectorAll('.notes .note');
var phrase = -4.2
////시간계산
window.setInterval(function () {



  

  if (audio.currentTime > 8.0 + phrase && audio.currentTime < 10 + phrase) {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Gm);
      button.addEventListener('mouseenter', playGuitar_Cm);
      button.addEventListener('mouseleave', stopGuitar); 
    });
  }


  if (audio.currentTime > 10 + phrase && audio.currentTime < 12 + phrase)  {
    
    notereset();
    notemaking(1,3,4,7,9);
    

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Cm);
      button.addEventListener('mouseenter', playGuitar_F7);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
   if (audio.currentTime > 12 + phrase && audio.currentTime < 14 + phrase)  {
    notereset();
    notemaking(1,3,5,7,8);


    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_F7);
      button.addEventListener('mouseenter', playGuitar_Bb);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }

   if (audio.currentTime > 14 + phrase && audio.currentTime < 16 + phrase)  {

    notereset();
    notemaking(1,3,4,6,8);


    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Bb);
      button.addEventListener('mouseenter', playGuitar_Eb);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }

   if (audio.currentTime > 16 + phrase && audio.currentTime < 18 + phrase)  {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Eb);
      button.addEventListener('mouseenter', playGuitar_Am);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
   if (audio.currentTime > 18 + phrase && audio.currentTime < 20 + phrase)  {
    notereset();
    notemaking(2,3,6,8,0);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Am);
      button.addEventListener('mouseenter', playGuitar_D7alt);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
   if (audio.currentTime > 20 + phrase && audio.currentTime < 24 + phrase)  {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_D7alt);
      button.addEventListener('mouseenter', playGuitar_Gm);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
////////////Bar 9



  if (audio.currentTime > 24+ phrase && audio.currentTime < 26 + phrase) {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Gm);
      button.addEventListener('mouseenter', playGuitar_Cm);
      button.addEventListener('mouseleave', stopGuitar); 
    });
  }


  if (audio.currentTime > 26+ phrase && audio.currentTime < 28+ phrase)  {
    
    notereset();
    notemaking(1,3,4,7,9);
    

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Cm);
      button.addEventListener('mouseenter', playGuitar_F7);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
   if (audio.currentTime > 28 + phrase&& audio.currentTime < 30+ phrase)  {
    notereset();
    notemaking(1,3,5,7,8);


    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_F7);
      button.addEventListener('mouseenter', playGuitar_Bb);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }

   if (audio.currentTime > 30 + phrase&& audio.currentTime < 32+ phrase)  {

    notereset();
    notemaking(1,3,4,6,8);


    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Bb);
      button.addEventListener('mouseenter', playGuitar_Eb);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }



  //////////////34

   if (audio.currentTime > 32 + phrase&& audio.currentTime < 34+ phrase)  {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Eb);
      button.addEventListener('mouseenter', playGuitar_Am);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
   if (audio.currentTime > 34 + phrase&& audio.currentTime < 36+ phrase)  {
    notereset();
    notemaking(2,3,6,8,0);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Am);
      button.addEventListener('mouseenter', playGuitar_D7alt);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
   if (audio.currentTime > 36 + phrase&& audio.currentTime < 40+ phrase)  {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_D7alt);
      button.addEventListener('mouseenter', playGuitar_Gm);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }

///////////////////////B part

   if (audio.currentTime > 40 + phrase&& audio.currentTime < 42+ phrase)  {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Gm);
      button.addEventListener('mouseenter', playGuitar_Am);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
   if (audio.currentTime > 42+ phrase && audio.currentTime < 44+ phrase)  {
    notereset();
    notemaking(2,3,6,8,0);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Am);
      button.addEventListener('mouseenter', playGuitar_D7alt);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
   if (audio.currentTime > 44+ phrase && audio.currentTime < 48+ phrase)  {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_D7alt);
      button.addEventListener('mouseenter', playGuitar_Gm);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }


  if (audio.currentTime > 48 + phrase&& audio.currentTime < 50+ phrase) {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Gm);
      button.addEventListener('mouseenter', playGuitar_Cm);
      button.addEventListener('mouseleave', stopGuitar); 
    });
  }


  if (audio.currentTime > 50+ phrase && audio.currentTime < 52+ phrase)  {
    
    notereset();
    notemaking(1,3,4,7,9);
    

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Cm);
      button.addEventListener('mouseenter', playGuitar_F7);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
   if (audio.currentTime > 52 + phrase&& audio.currentTime < 54+ phrase)  {
    notereset();
    notemaking(1,3,5,7,8);


    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_F7);
      button.addEventListener('mouseenter', playGuitar_Bb);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }

   if (audio.currentTime > 54 + phrase&& audio.currentTime < 56+ phrase)  {
 

    notereset();
    notemaking(1,3,4,6,8);


    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Bb);
      button.addEventListener('mouseenter', playGuitar_Eb);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
////////last

   if (audio.currentTime > 56+ phrase && audio.currentTime < 58+ phrase)  {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Eb);
      button.addEventListener('mouseenter', playGuitar_Am);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
   if (audio.currentTime > 58 + phrase&& audio.currentTime < 60+ phrase)  {
    notereset();
    notemaking(2,3,6,8,0);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Am);
      button.addEventListener('mouseenter', playGuitar_D7alt);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
   if (audio.currentTime > 60 + phrase&& audio.currentTime < 61+ phrase)  {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_D7alt);
      button.addEventListener('mouseenter', playGuitar_Gm);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
   if (audio.currentTime > 61 + phrase&& audio.currentTime < 62+ phrase)  {
    notereset();
    notemaking(2,4,5,7,9);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Gm);
      button.addEventListener('mouseenter', playGuitar_Gbm);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
  
   if (audio.currentTime > 62 + phrase&& audio.currentTime < 63+ phrase)  {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Gbm);
      button.addEventListener('mouseenter', playGuitar_Fm);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
  
  if (audio.currentTime > 63+ phrase && audio.currentTime < 64+ phrase)  {
    notereset();
    notemaking(2,4,6,8,9);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Fm);
      button.addEventListener('mouseenter', playGuitar_Bb7);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
  
  if (audio.currentTime > 64+ phrase && audio.currentTime < 66+ phrase)  {
    notereset();
    notemaking(2,4,6,7,9);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_Bb7);
      button.addEventListener('mouseenter', playGuitar_EM7);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }


  if (audio.currentTime > 66 + phrase&& audio.currentTime < 68+ phrase)  {
    notereset();
    notemaking(2,3,6,8,0);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_EM7);
      button.addEventListener('mouseenter', playGuitar_D7alt);
      button.addEventListener('mouseleave', stopGuitar);
    });
  }
  if (audio.currentTime > 68 + phrase && audio.currentTime < 72+ phrase)  {
    notereset();
    notemaking(1,3,5,7,8);

    buttons.forEach(function (button, element) {
      button.removeEventListener('mouseenter', playGuitar_D7alt);
      button.addEventListener('mouseenter', playGuitar_Gm);
      button.addEventListener('mouseleave', stopGuitar);
      phrase = 59.8
    });
  }

//////////////////////////////////////////////second 



}, 250);

////악보


