document.addEventListener("DOMContentLoaded", function() {
    const saxophoneContainer = document.getElementById('saxophones');
    const saxophoneImageSrc = "assets/images/saxophone/saxophone.png";
    const backingTrack = document.getElementById("backingTrack");
    const backingVolumeSlider = document.getElementById('backingVolume');
    const saxophoneVolumeSlider = document.getElementById('saxophoneVolume');


    let saxophoneVolume = 1;
    let audioElements = {}; // Store Audio objects for each note
    let hoverStates = []; // Track interaction states
    let currentChordIndex = 0;
    let intervalID = null;
    const bpm = 115;
    const interval = (60 / bpm) * 1000;
    const beatsPerChord = 4;
    let currentNotes = []; // This will store the current chord's allNotes
    let saxophoneImages = [];
    let imageNotes = []; // Store notes assigned to each image


    const saxophoneSounds = { 
        "E3": "assets/sounds/saxophone/E3.mp3",
        "F3": "assets/sounds/saxophone/F3.mp3",
        "Gb3": "assets/sounds/saxophone/Gb3.mp3",
        "G3": "assets/sounds/saxophone/G3.mp3",
        "Ab3": "assets/sounds/saxophone/Ab3.mp3",
        "A3": "assets/sounds/saxophone/A3.mp3",
        "Bb3": "assets/sounds/saxophone/Bb3.mp3",
        "B3": "assets/sounds/saxophone/B3.mp3",

        "C4": "assets/sounds/saxophone/C4.mp3",
        "Db4": "assets/sounds/saxophone/Db4.mp3",
        "D4": "assets/sounds/saxophone/D4.mp3",
        "Eb4": "assets/sounds/saxophone/Eb4.mp3",
        "E4": "assets/sounds/saxophone/E4.mp3",
        "F4": "assets/sounds/saxophone/F4.mp3",
        "Gb4": "assets/sounds/saxophone/Gb4.mp3",
        "G4": "assets/sounds/saxophone/G4.mp3",
        "Ab4": "assets/sounds/saxophone/Ab4.mp3",
        "A4": "assets/sounds/saxophone/A4.mp3",
        "Bb4": "assets/sounds/saxophone/Bb4.mp3",
        "B4": "assets/sounds/saxophone/B4.mp3",       

        "C5": "assets/sounds/saxophone/C5.mp3",
        "D5": "assets/sounds/saxophone/D5.mp3"
    };



    // 코드 진행 정보
    const chordProgression = [
        { chord: "Am7", duration: 4, highlightNotes: ["C4", "E4", "G4", "A4", "C5"], allNotes: ["C4", "D4", "E4", "Gb4", "G4", "A4", "B4", "C5", "D5"] },  
        { chord: "Gm7", duration: 2, highlightNotes: ["D4", "F4", "G4", "Bb4", "D5"], allNotes: ["C4", "D4", "E4", "F4", "G4", "A4", "Bb4", "C5", "D5"] },    
        { chord: "C7", duration: 2, highlightNotes: ["C4", "E4", "G4", "Bb4", "C5"], allNotes: ["Bb3", "C4", "D4", "E4", "F4", "G4", "A4", "Bb4", "C5"] }, 
        { chord: "FM7", duration: 4, highlightNotes: ["C4", "E4", "F4", "A4", "C5"], allNotes: ["B3", "C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"] },
        { chord: "Bdim7", duration: 2, highlightNotes: ["B3", "D4", "F4", "A4", "B4"], allNotes: ["B3", "C4", "D4", "E4", "F4", "G4", "Ab4", "Bb4", "C5"] },
        { chord: "E7b9", duration: 2, highlightNotes: ["B3", "D4", "E4", "Ab4", "B4"], allNotes: ["B3", "C4", "D4", "E4", "F4", "Ab4", "A4", "B4", "C5"] },

        { chord: "Am7", duration: 4, highlightNotes: ["C4", "E4", "G4", "A4", "C5"], allNotes: ["C4", "D4", "E4", "Gb4", "G4", "A4", "B4", "C5", "D5"] },  
        { chord: "Gm7", duration: 2, highlightNotes: ["D4", "F4", "G4", "Bb4", "D5"], allNotes: ["C4", "D4", "E4", "F4", "G4", "A4", "Bb4", "C5", "D5"] },    
        { chord: "C7", duration: 2, highlightNotes: ["C4", "E4", "G4", "Bb4", "C5"], allNotes: ["Bb3", "C4", "D4", "E4", "F4", "G4", "A4", "Bb4", "C5"] }, 
        { chord: "FM7", duration: 4, highlightNotes: ["C4", "E4", "F4", "A4", "C5"], allNotes: ["B3", "C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"] },
        { chord: "Bdim7", duration: 2, highlightNotes: ["B3", "D4", "F4", "A4", "B4"], allNotes: ["B3", "C4", "D4", "E4", "F4", "G4", "Ab4", "Bb4", "C5"] },
        { chord: "E7b9", duration: 2, highlightNotes: ["B3", "D4", "E4", "Ab4", "B4"], allNotes: ["B3", "C4", "D4", "E4", "F4", "Ab4", "A4", "B4", "C5"] },

        { chord: "Am7", duration: 4, highlightNotes: ["C4", "E4", "G4", "A4", "C5"], allNotes: ["C4", "D4", "E4", "Gb4", "G4", "A4", "B4", "C5", "D5"] },  
        { chord: "Gm7", duration: 2, highlightNotes: ["D4", "F4", "G4", "Bb4", "D5"], allNotes: ["C4", "D4", "E4", "F4", "G4", "A4", "Bb4", "C5", "D5"] },    
        { chord: "C7", duration: 2, highlightNotes: ["C4", "E4", "G4", "Bb4", "C5"], allNotes: ["Bb3", "C4", "D4", "E4", "F4", "G4", "A4", "Bb4", "C5"] }, 
        { chord: "FM7", duration: 4, highlightNotes: ["C4", "E4", "F4", "A4", "C5"], allNotes: ["B3", "C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"] },
        { chord: "Bb7", duration: 4, highlightNotes: ["C4", "E4", "G4", "Bb4", "D5"], allNotes: ["C4", "D4", "E4", "F4", "G4", "A4", "Bb4", "C5", "D5"] },

        { chord: "bm7", duration: 4, highlightNotes: ["B3", "D4", "Gb4", "A4", "B4"], allNotes: ["B3", "Db4", "D4", "E4", "Gb4", "G4", "A4", "B4", "Db5"] },  
        { chord: "E7b9", duration: 2, highlightNotes: ["B3", "D4", "E4", "Ab4", "B4"], allNotes: ["B3", "C4", "D4", "E4", "F4", "Ab4", "A4", "B4", "C5"] },
        { chord: "Am7", duration: 4, highlightNotes: ["C4", "E4", "G4", "A4", "C5"], allNotes: ["C4", "D4", "E4", "Gb4", "G4", "A4", "B4", "C5", "D5"] },  
        { chord: "Bdim7", duration: 2, highlightNotes: ["B3", "D4", "F4", "A4", "B4"], allNotes: ["B3", "C4", "D4", "E4", "F4", "G4", "Ab4", "Bb4", "C5"] },
        { chord: "E7b9", duration: 2, highlightNotes: ["B3", "D4", "E4", "Ab4", "B4"], allNotes: ["B3", "C4", "D4", "E4", "F4", "Ab4", "A4", "B4", "C5"] },

    ];


    const midiToKeyMap = {
        60: '1', 62: '2', 64: '3', 65: '4', 67: '5',
        69: '6', 71: '7', 72: '8', 74: '9'
    };

    const keyToMidiMap = Object.fromEntries(
        Object.entries(midiToKeyMap).map(([midi, key]) => [key, parseInt(midi)])
    );

    const numSaxophones = 9; // 필요한 이미지 수에 맞게 조정
    for (let i = 0; i < numSaxophones; i++) {
        const saxophone = document.createElement('img');
        saxophone.src = saxophoneImageSrc;
        saxophone.classList.add('saxophone');
        saxophoneContainer.appendChild(saxophone);
        saxophoneImages.push(saxophone);
        hoverStates[i] = false;
        imageNotes[i] = null;

        // 이벤트 리스너 할당
        saxophone.addEventListener('mouseenter', () => triggerSaxophoneNoteByIndex(i, true));
        saxophone.addEventListener('mouseleave', () => triggerSaxophoneNoteByIndex(i, false));
    }

    function handleNoteOn(midiNote) {
        const key = midiToKeyMap[midiNote];
        if (key) {
            const index = parseInt(key) - 1;
            if (index >= 0 && index < saxophoneImages.length) {
                triggerSaxophoneNoteByIndex(index, true);
            }
        }
    }

    function handleNoteOff(midiNote) {
        const key = midiToKeyMap[midiNote];
        if (key) {
            const index = parseInt(key) - 1;
            if (index >= 0 && index < saxophoneImages.length) {
                triggerSaxophoneNoteByIndex(index, false);
            }
        }
    }
    // MIDI Access Code
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess()
            .then(onMIDISuccess, onMIDIFailure);
    } else {
        console.log("Web MIDI API is not supported in this browser.");
    }

    function onMIDISuccess(midiAccess) {
        for (var input of midiAccess.inputs.values()) {
            input.onmidimessage = getMIDIMessage;
        }
    }
    function onMIDIFailure() {
        console.log("Could not access your MIDI devices.");
    }

    function getMIDIMessage(message) {
        var command = message.data[0];
        var note = message.data[1];
        var velocity = (message.data.length > 2) ? message.data[2] : 0;

        switch (command) {
            case 144: // noteOn
                if (velocity > 0) {
                    handleNoteOn(note);
                } else {
                    handleNoteOff(note);
                }
                break;
            case 128: // noteOff
                handleNoteOff(note);
                break;
        }
    }


    function updateSaxophoneAppearance(saxophone, isHighlighted) {
        // 이미지 크기를 조정하는 부분
        saxophone.classList.toggle('large', isHighlighted);
        saxophone.classList.toggle('small', !isHighlighted);
    }
    


    function updateSaxophones(currentChord) {
        // 현재 코드의 전체 음 업데이트
        currentNotes = currentChord.allNotes;
        console.log("Current notes:", currentNotes);
    
        for (let i = 0; i < saxophoneImages.length; i++) {
            const saxophone = saxophoneImages[i];
    
            // 상호작용 중이 아닐 때만 새로운 음 할당
            if (!hoverStates[i]) {
                const note = currentNotes[i % currentNotes.length];
                imageNotes[i] = note;
    
                // 이미지를 크게 표시할 음인지 확인하고 크기 조정
                const isHighlighted = currentChord.highlightNotes.includes(note);
                updateSaxophoneAppearance(saxophone, isHighlighted);
            } else {
                // 상호작용 중이면 음은 그대로 유지하고 크기만 업데이트
                const note = imageNotes[i];
                const isHighlighted = currentChord.highlightNotes.includes(note);
                updateSaxophoneAppearance(saxophone, isHighlighted);
            }
        }
    
        // 현재 코드 정보를 표시
        const chordInfoElement = document.getElementById('currentChord');
        if (chordInfoElement) {
            chordInfoElement.textContent = `Current Chord: ${currentChord.chord}`;
        }
    }

    function updateScale() {
        const currentChord = chordProgression[currentChordIndex];
        const currentNotes = currentChord.allNotes.map(note => note.trim());
        const highlightNotes = currentChord.highlightNotes.map(note => note.trim());
    
        for (let i = 0; i < saxophoneImages.length; i++) {
            const saxophone = saxophoneImages[i];
            let note;
    
            if (!hoverStates[i]) {
                // 호버 중이 아닐 때만 노트 업데이트
                note = currentNotes[i % currentNotes.length];
                imageNotes[i] = note;
            } else {
                // 호버 중이면 기존 노트 유지
                note = imageNotes[i];
            }
    
            // 강조 상태는 항상 업데이트
            const isHighlighted = highlightNotes.includes(note);
            updateSaxophoneAppearance(saxophone, isHighlighted);
        }
    
        // 코드 진행 인덱스 업데이트
        currentChordIndex = (currentChordIndex + 1) % chordProgression.length;
    }
    

    
    function startChordProgression() {
        if (!intervalID) {
            intervalID = setInterval(updateScale, interval * beatsPerChord);
        }
    }

    function stopChordProgression() {
        if (intervalID) {
            clearInterval(intervalID);
            intervalID = null;
        }
        // Do not stop playing sounds here to avoid abrupt stops
    }


    backingTrack.addEventListener("play", () => {
        setTimeout(startChordProgression, interval * beatsPerChord * 2); // 8박 대기
    });    backingTrack.addEventListener("pause", stopChordProgression);


    // 볼륨 조절 이벤트 리스너
    backingVolumeSlider.addEventListener('input', function() {
        backingTrack.volume = this.value;
    });

    saxophoneVolumeSlider.addEventListener('input', function() {
        saxophoneVolume = this.value;
        // 현재 재생 중인 모든 색소폰 소리의 볼륨을 조절합니다
        for (const note in audioElements) {
            audioElements[note].volume = saxophoneVolume;
        }
    });

    function createOrUpdateSaxophone(note, isHighlighted) {
        const saxophone = document.createElement('img');
        saxophone.src = saxophoneImage;
        saxophone.id = note;
        saxophone.classList.add('saxophone');
        saxophoneContainer.appendChild(saxophone);

        const audio = new Audio(saxophoneSounds[note]);
        audio.volume = saxophoneVolume; // 초기 볼륨 설정
        audioElements[note] = audio;

        saxophone.addEventListener('mouseenter', () => triggerSaxophoneNote(note, true));
        saxophone.addEventListener('mouseleave', () => triggerSaxophoneNote(note, false));

        saxophone.classList.toggle('large', isHighlighted);
        saxophone.classList.toggle('small', !isHighlighted);
    }


    function triggerSaxophoneNote(note, isOn) {
        const saxophone = document.getElementById(note);
        if (saxophone) {
            if (isOn) {
                hoverStates[note] = true;
                if (audioElements[note].paused) {
                    audioElements[note].currentTime = 0;
                    audioElements[note].volume = saxophoneVolume; // 현재 설정된 볼륨 적용
                    audioElements[note].play().catch(error => console.error(`Audio playback failed: ${error}`));
                }
                saxophone.classList.add('hover');
            } else {
                hoverStates[note] = false;
                if (!audioElements[note].paused) {
                    audioElements[note].pause();
                    audioElements[note].currentTime = 0;
                }
                saxophone.classList.remove('hover');
            }
        }
    }
    
    function updateNoteForImage(index) {
        const saxophone = saxophoneImages[index];
        const currentChord = chordProgression[currentChordIndex];
        const currentNotes = currentChord.allNotes.map(note => note.trim());
        const highlightNotes = currentChord.highlightNotes.map(note => note.trim());
    
        const note = currentNotes[index % currentNotes.length];
        imageNotes[index] = note;
    
        const isHighlighted = highlightNotes.includes(note);
        updateSaxophoneAppearance(saxophone, isHighlighted);
    }
    
    function triggerSaxophoneNoteByIndex(index, isOn) {
        const note = imageNotes[index];
        const saxophone = saxophoneImages[index];

        if (saxophone) {
            if (isOn) {
                hoverStates[index] = true;
                if (!audioElements[note]) {
                    audioElements[note] = new Audio(saxophoneSounds[note]);
                    audioElements[note].volume = saxophoneVolume;
                }

                if (audioElements[note].paused) {
                    audioElements[note].currentTime = 0;
                    audioElements[note].volume = saxophoneVolume;
                    audioElements[note].play().catch(error => console.error(`Audio playback failed: ${error}`));
                }
                saxophone.classList.add('hover');
            } else {
                hoverStates[index] = false;
                if (audioElements[note] && !audioElements[note].paused) {
                    audioElements[note].pause();
                    audioElements[note].currentTime = 0;
                }
                saxophone.classList.remove('hover');
    
                // 호버 해제 시 노트와 강조 상태 업데이트
                updateNoteForImage(index);
            }
        }
    }
    
    document.addEventListener('keydown', (event) => {
        const key = event.key;
        if (key >= '1' && key <= '9') {
            const index = parseInt(key) - 1;
            triggerSaxophoneNoteByIndex(index, true);
        }
    });

    document.addEventListener('keyup', (event) => {
        const key = event.key;
        if (key >= '1' && key <= '9') {
            const index = parseInt(key) - 1;
            triggerSaxophoneNoteByIndex(index, false);
        }
    });


    // 초기 스케일 설정
    updateScale();


});