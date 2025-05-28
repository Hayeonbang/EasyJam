document.addEventListener('DOMContentLoaded', async function() {
    const videoElement = document.getElementById('webcam');
    const canvasElement = document.getElementById('output');
    const canvasContext = canvasElement.getContext('2d');
    const shakerSound = document.getElementById('shakerSound');
    const triangleSound = document.getElementById('triangleSound');
    const shakerImage = document.getElementById('shaker');
    const triangleImage = document.getElementById('triangle');

    let noseTracker = document.createElement('div');
    noseTracker.className = 'nose-tracker';
    document.body.appendChild(noseTracker);

    let lastPlayed = '';

    async function setupWebcam() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resolve(videoElement);
            };
        });
    }

    async function loadAndPredict() {
        const net = await posenet.load();
        const webcam = await setupWebcam();

        // Set canvas size to match video
        canvasElement.width = webcam.videoWidth;
        canvasElement.height = webcam.videoHeight;

        function detectPose() {
            net.estimateSinglePose(webcam, {
                flipHorizontal: false
            }).then(pose => {
                drawPose(pose);
                checkInteraction(pose);
                requestAnimationFrame(detectPose);
            });
        }

        detectPose();
    }

    function drawPose(pose) {
        canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);

        const nose = pose.keypoints.find(point => point.part === 'nose');

        if (nose && nose.score > 0.5) {
            let { y, x } = nose.position;
            x = canvasElement.width - x;

            // Calculate position relative to the window
            const rect = canvasElement.getBoundingClientRect();
            const scaleX = rect.width / canvasElement.width;
            const scaleY = rect.height / canvasElement.height;

            // Update nose tracker position
            noseTracker.style.left = `${rect.left + x * scaleX}px`;
            noseTracker.style.top = `${rect.top + y * scaleY}px`;
            noseTracker.style.display = 'block';
        } else {
            noseTracker.style.display = 'none';
        }
    }

    function checkInteraction(pose) {
        const nose = pose.keypoints.find(point => point.part === 'nose');
        
        if (nose && nose.score > 0.5) {
            let { x } = nose.position;
            x = canvasElement.width - x;
    
            if (x < canvasElement.width * 0.35) {
                if (lastPlayed !== 'shaker') {
                    shakerSound.play();
                    lastPlayed = 'shaker';
                }
                shakerImage.classList.add('active');
                triangleImage.classList.remove('active'); // 여기가 수정된 부분입니다.
                
            } 
            else if (x > canvasElement.width * 0.65) {
                if (lastPlayed !== 'triangle') {
                    triangleSound.play();
                    lastPlayed = 'triangle';
                }
                triangleImage.classList.add('active');
                shakerImage.classList.remove('active'); // 여기서 shakerImage의 active를 제거합니다.
            } 
            else {
                shakerImage.classList.remove('active');
                triangleImage.classList.remove('active');
                lastPlayed = '';
            }
        }
    }
    

    // Function to handle fullscreen
    function toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    // Add fullscreen toggle on double click
    document.addEventListener('dblclick', toggleFullScreen);

    loadAndPredict();
});