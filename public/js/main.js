document.addEventListener('DOMContentLoaded', () => {
    const instruments = document.querySelectorAll('.instrument');
    const playPauseBtn = document.getElementById('play-pause');
    const nextTrackBtn = document.getElementById('next-track');
    let isPlaying = false;
    let currentTrack = 0;
    const tracks = document.addEventListener('DOMContentLoaded', () => {
        const instruments = document.querySelectorAll('.instrument');
        const playPauseBtn = document.getElementById('play-pause');
        const nextTrackBtn = document.getElementById('next-track');
        let isPlaying = false;
        let currentTrack = 0;
        const tracks = ["assets/Sunny_115_Backing_Track.mp3"]; // 예시 트랙 목록
        const audio = new Audio();
    
        // 악기 선택 이벤트
        instruments.forEach(instrument => {
            instrument.addEventListener('click', () => {
                window.location.href = `${instrument.id}.html`;
            });
        });
    
        // 음악 재생/일시정지 기능
        playPauseBtn.addEventListener('click', () => {
            if (isPlaying) {
                audio.pause();
                playPauseBtn.textContent = 'Play';
            } else {
                audio.src = tracks[currentTrack];
                audio.play();
                playPauseBtn.textContent = 'Pause';
            }
            isPlaying = !isPlaying;
        });
    
        // 다음 트랙 재생 기능
        nextTrackBtn.addEventListener('click', () => {
            currentTrack = (currentTrack + 1) % tracks.length;
            if (isPlaying) {
                audio.src = `assets/music/${tracks[currentTrack]}`;
                audio.play();
            }
        });
    
        // WebSocket 초기화 (옵션)
        const socket = new WebSocket('ws://localhost:7777');
    
        socket.onopen = () => {
            console.log('Connected to server');
        };
    
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'tempo') {
                console.log(`Global tempo received: ${data.tempo} BPM`);
            }
        };
    
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    
        socket.onclose = () => {
            console.log('WebSocket connection closed');
        };
    });; // 예시 트랙 목록
    const audio = new Audio();

    // 악기 선택 이벤트
    instruments.forEach(instrument => {
        instrument.addEventListener('click', () => {
            window.location.href = `${instrument.id}.html`;
        });
    });

    // 음악 재생/일시정지 기능
    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            audio.pause();
            playPauseBtn.textContent = 'Play';
        } else {
            audio.src = `assets/music/${tracks[currentTrack]}`;
            audio.play();
            playPauseBtn.textContent = 'Pause';
        }
        isPlaying = !isPlaying;
    });

    // 다음 트랙 재생 기능
    nextTrackBtn.addEventListener('click', () => {
        currentTrack = (currentTrack + 1) % tracks.length;
        if (isPlaying) {
            audio.src = `assets/music/${tracks[currentTrack]}`;
            audio.play();
        }
    });

    // WebSocket 초기화 (옵션)
    const socket = new WebSocket('ws://localhost:7777');

    socket.onopen = () => {
        console.log('Connected to server');
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'tempo') {
            console.log(`Global tempo received: ${data.tempo} BPM`);
        }
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
        console.log('WebSocket connection closed');
    };
});