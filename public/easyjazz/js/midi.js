// MIDI 접근 요청
function requestMIDIAccess() {
    console.log("Requesting MIDI access");
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess({ sysex: false })
            .then(onMIDISuccess, onMIDIFailure)
            .catch(error => {
                console.error("Error requesting MIDI access:", error);
            });
    } else {
        console.warn("No MIDI support in your browser.");
    }
}

// MIDI 접근 성공
function onMIDISuccess(midiAccess) {
    for (var input of midiAccess.inputs.values()) {
        input.onmidimessage = getMIDIMessage;
    }
}

// MIDI 접근 실패
function onMIDIFailure() {
    console.warn("Could not access your MIDI devices.");
}

// MIDI 메시지 처리
function getMIDIMessage(message) {
    var command = message.data[0];
    var note = message.data[1];
    var velocity = (message.data.length > 2) ? message.data[2] : 0;

    switch (command) {
        case 144: // noteOn
            if (velocity > 0) {
                noteOn(note, velocity);
            } else {
                noteOff(note);
            }
            break;
        case 128: // noteOff
            noteOff(note);
            break;
    }
}

// MIDI 노트 번호를 키 매핑으로 변환
function midiNoteToKey(note) {
    // MIDI 노트 60 (C4)를 키 '1'에 매핑
    const midiToKeyMap = {
        60: '1', 62: '2', 64: '3', 65: '4', 67: '5',
        69: '6', 71: '7', 72: '8', 74: '9'
    };
    return midiToKeyMap[note];
}

// 노트 온 이벤트 처리
function noteOn(note, velocity) {
    const key = midiNoteToKey(note);
    if (key) {
        triggerSaxophoneNote(currentNotes[parseInt(key) - 1], true);
    }
}

// 노트 오프 이벤트 처리
function noteOff(note) {
    const key = midiNoteToKey(note);
    if (key) {
        triggerSaxophoneNote(currentNotes[parseInt(key) - 1], false);
    }
}

// 키보드 이벤트 리스너
document.addEventListener('keydown', (event) => {
    const key = parseInt(event.key);
    if (key >= 1 && key <= 9) {
        const index = key - 1;
        if (index < currentNotes.length) {
            const note = currentNotes[index];
            triggerSaxophoneNote(note, true);
        }
    }
});

document.addEventListener('keyup', (event) => {
    const key = parseInt(event.key);
    if (key >= 1 && key <= 9) {
        const index = key - 1;
        if (index < currentNotes.length) {
            const note = currentNotes[index];
            triggerSaxophoneNote(note, false);
        }
    }
});

// 페이지 로드 시 MIDI 접근 요청
window.addEventListener('load', requestMIDIAccess);