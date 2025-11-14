// app.js
import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js';
import {joinRoom} from 'https://esm.run/trystero'


// Waveform gradients (SoundCloud-style)
function createGradients() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = 300;

    // Waveform gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 1.75);
    gradient.addColorStop(0, '#656666');
    gradient.addColorStop((canvas.height * 0.7) / canvas.height, '#656666');
    gradient.addColorStop((canvas.height * 0.7 + 1) / canvas.height, '#ffffff');
    gradient.addColorStop((canvas.height * 0.7 + 2) / canvas.height, '#ffffff');
    gradient.addColorStop((canvas.height * 0.7 + 3) / canvas.height, '#B1B1B1');
    gradient.addColorStop(1, '#B1B1B1');

    // Progress gradient
    const progressGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 1.35);
    progressGradient.addColorStop(0, '#EE772F');
    progressGradient.addColorStop((canvas.height * 0.7) / canvas.height, '#EB4926');
    progressGradient.addColorStop((canvas.height * 0.7 + 1) / canvas.height, '#ffffff');
    progressGradient.addColorStop((canvas.height * 0.7 + 2) / canvas.height, '#ffffff');
    progressGradient.addColorStop((canvas.height * 0.7 + 3) / canvas.height, '#F6B094');
    progressGradient.addColorStop(1, '#F6B094');

    return { gradient, progressGradient };
}

// Global state
let wavesurfer;
let isWaveSurferReady = false; // Custom flag to replace unreliable isReady
let comments = []; // { time, name, text, audioBlob }

// Trystero state
let room = null;
let myName = '';
let sendMessage = null;
let onMessage = null;

// Initialize WaveSurfer (no regions needed)
const { gradient, progressGradient } = createGradients();

wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: gradient,
    progressColor: progressGradient,
    barWidth: 1,
    autoCenter: false
});

console.log('WaveSurfer created'); // Debug: Confirm creation

// Hover effect
const waveform = document.querySelector('#waveform');
const hover = document.querySelector('#hover');
waveform.addEventListener('pointermove', (e) => {
    hover.style.width = `${e.offsetX}px`;
});

function centerOnCurrentTime() {
    if (!isWaveSurferReady) return;
    const duration = wavesurfer.getDuration();
    const currentTime = wavesurfer.getCurrentTime();
    const wrapper = wavesurfer.getWrapper();
    const scrollWidth = wrapper.scrollWidth;
    const containerWidth = document.getElementById('waveform').getBoundingClientRect().width;
    const targetScrollLeft = (currentTime / duration) * scrollWidth - containerWidth / 2;
    wrapper.scrollLeft = Math.max(0, Math.min(targetScrollLeft, scrollWidth - containerWidth));
}

wavesurfer.on('ready', () => {
    console.log('WaveSurfer ready'); // Debug
    isWaveSurferReady = true;
    updateCommentsList(); // In case comments added before ready
});

wavesurfer.on('timeupdate', (currentTime) => {
    document.getElementById('middleTime').textContent = formatTime(currentTime);
});

wavesurfer.on('decode', (duration) => {
    console.log('Decoded, duration:', duration); // Debug
});

wavesurfer.on('play', () => {
    document.getElementById('playPause').textContent = 'Pause';
});

wavesurfer.on('pause', () => {
    document.getElementById('playPause').textContent = 'Play';
});

wavesurfer.on('finish', () => {
    document.getElementById('playPause').textContent = 'Play';
});

// Remove default interaction, handle manually



wavesurfer.on('play', () => {
    document.getElementById('playPause').textContent = 'Pause';
});

wavesurfer.on('pause', () => {
    document.getElementById('playPause').textContent = 'Play';
});

wavesurfer.on('finish', () => {
    document.getElementById('playPause').textContent = 'Play';
});

// Remove default interaction, handle manually

// Single click to seek and play
waveform.addEventListener('click', (e) => {
    console.log('Single click on waveform fired'); // Debug
    if (!isWaveSurferReady) {
        console.log('WaveSurfer not ready yet'); // Debug
        return;
    }
    const rect = waveform.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    wavesurfer.seekTo(relativeX);
    wavesurfer.play();
});

// Spacebar for play/pause
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && isWaveSurferReady && document.getElementById('commentModal').style.display !== 'block') {
        e.preventDefault();
        wavesurfer.playPause();
    }
});

// Silly names
const sillyNames = ['Pixel Pirate', 'Byte Bunny', 'Glitch Goblin', 'Retro Robot', 'Wave Warrior', 'Sound Sprite', 'Echo Elf', 'Tune Troll', 'Beat Bandit', 'Melody Monster'];

function getRandomSillyName() {
    return sillyNames[Math.floor(Math.random() * sillyNames.length)];
}

// Join Trystero room
function joinSession(roomName) {
    room = joinRoom({ appId: 'comment-the-wave' }, roomName);
    [sendMessage, onMessage] = room.makeAction('chat');
    myName = getRandomSillyName();
    document.getElementById('chatContainer').style.display = 'flex';
    document.getElementById('joinSession').textContent = 'Leave Session';
    document.getElementById('roomInput').disabled = true;

    // Send join message
    sendMessage({ type: 'join', name: myName });

    // Handle incoming messages
    onMessage((data, peerId) => {
        if (data.type === 'chat') {
            addChatMessage(data.name, data.message);
        } else if (data.type === 'join') {
            addChatMessage('', `${data.name} joined the session.`);
        } else if (data.type === 'leave') {
            addChatMessage('', `${data.name} left the session.`);
        }
    });

    // Handle peer leave
    room.onPeerLeave(peerId => {
        // Note: Trystero doesn't provide name on leave, so generic message
        addChatMessage('', 'Someone left the session.');
    });

    // Check max peers (approximate)
    setTimeout(() => {
        const peers = room.getPeers();
        if (peers.length >= 3) { // 3 others, total 4
            addChatMessage('', 'Session is full (max 4 people).');
        }
    }, 1000);
}

// Double click for comments
waveform.addEventListener('dblclick', (e) => {
    console.log('Double click on waveform fired'); // Debug
    if (!isWaveSurferReady) {
        console.log('WaveSurfer not ready yet'); // Debug
        return;
    }
    e.preventDefault();
    const wasPlaying = wavesurfer.isPlaying();
    wavesurfer.pause();
    const rect = waveform.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const wrapper = wavesurfer.getWrapper();
    const scrollLeft = wrapper.scrollLeft;
    const containerWidth = rect.width;
    const duration = wavesurfer.getDuration();
    const scrollWidth = wrapper.scrollWidth;
    const visibleStartTime = (scrollLeft / scrollWidth) * duration;
    const visibleDuration = (containerWidth / scrollWidth) * duration;
    const time = visibleStartTime + relativeX * visibleDuration;
    console.log('Double click at relativeX:', relativeX, 'time:', time, 'duration:', wavesurfer.getDuration(), 'scrollLeft:', scrollLeft, 'scrollWidth:', scrollWidth); // Debug
    // Show modal
    document.getElementById('commentModal').style.display = 'block';
    document.getElementById('commentText').value = '';
    document.getElementById('commentText').focus();

    // Store the time and random name for later
    window.currentCommentTime = time;
    window.currentCommentName = getRandomSillyName();
    window.wasPlayingBeforeComment = wasPlaying;
});

// File loading
document.getElementById('fileInput').addEventListener('change', (e) => {
    console.log('File selected'); // Debug
    const file = e.target.files[0];
    if (file && file.size <= 25 * 1024 * 1024) {
        console.log('File valid, loading...'); // Debug
        const reader = new FileReader();
        reader.onload = (evt) => {
            console.log('File read, loading blob'); // Debug
            const arrayBuffer = evt.target.result;
            const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
            wavesurfer.loadBlob(blob);
        };
        reader.readAsArrayBuffer(file);
    } else {
        console.log('File invalid or too large'); // Debug
        alert('File too large or invalid.');
    }
});

// Play/pause button
document.getElementById('playPause').addEventListener('click', () => {
    wavesurfer.playPause();
});

// Join/Leave session
document.getElementById('joinSession').addEventListener('click', () => {
    if (room) {
        // Leave session
        sendMessage({ type: 'leave', name: myName });
        room.leave();
        room = null;
        document.getElementById('chatContainer').style.display = 'none';
        document.getElementById('joinSession').textContent = 'Join Session';
        document.getElementById('chatMessages').innerHTML = '';
    } else {
        const roomName = Math.random().toString(36).substring(2, 15);
        joinSession(roomName);
    }
});

function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Voice comment (press 'V')
let mediaRecorder;
let recordedChunks = [];
document.addEventListener('keydown', (e) => {
    if (e.key === 'v' && isWaveSurferReady) {
        console.log('V key pressed, starting/stopping voice'); // Debug
        e.preventDefault();
        const wasPlaying = wavesurfer.isPlaying();
        wavesurfer.pause();
        const time = wavesurfer.getCurrentTime();
        console.log('Voice at time:', time); // Debug
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
                console.log('Mic access granted'); // Debug
                mediaRecorder = new MediaRecorder(stream);
                recordedChunks = [];
                mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
                mediaRecorder.onstop = () => {
                    console.log('Recording stopped'); // Debug
                    const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
                    const comment = { time, name: 'Voice', text: 'Voice comment', audioBlob };
                    comments.push(comment);
                    console.log('Voice comment added'); // Debug
                    updateCommentsList();
                    stream.getTracks().forEach(track => track.stop());
                    if (wasPlaying) {
                        wavesurfer.play();
                    }
                };
                mediaRecorder.start();
                console.log('Recording started'); // Debug
            }).catch(err => console.error('Mic access denied:', err));
        } else {
            mediaRecorder.stop();
        }
    }
});

// Modal close on outside click
document.getElementById('commentModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('commentModal').style.display = 'none';
        if (window.wasPlayingBeforeComment) {
            wavesurfer.play();
        }
    }
});

// Submit comment
const submitComment = () => {
    const text = document.getElementById('commentText').value.trim();
    if (text) {
        console.log('Comment added:', text); // Debug
        const comment = { time: window.currentCommentTime, name: window.currentCommentName, text, audioBlob: null };
        comments.push(comment);
        updateCommentsList();
        document.getElementById('commentModal').style.display = 'none';
        if (window.wasPlayingBeforeComment) {
            wavesurfer.play();
        }
    } else {
        alert('Please enter a comment.');
    }
};

document.getElementById('submitComment').addEventListener('click', submitComment);

// Enter key in textarea
document.getElementById('commentText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitComment();
    }
});

// Export comments
document.getElementById('exportComments').addEventListener('click', () => {
    console.log('Export clicked, comments:', comments.length); // Debug
    const exportData = comments.map(c => ({
        timestamp: c.time,
        name: c.name,
        text: c.text,
        audio: c.audioBlob ? URL.createObjectURL(c.audioBlob) : null
    }));
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comments.json';
    a.click();
    URL.revokeObjectURL(url);
    console.log('Export complete'); // Debug
});

// Chat input
document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && room) {
        const message = e.target.value.trim();
        if (message) {
            sendMessage({ type: 'chat', name: myName, message });
            addChatMessage(myName, message);
            e.target.value = '';
        }
    }
});

// Make chat container draggable
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
const chatContainer = document.getElementById('chatContainer');

chatContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragOffsetX = e.clientX - chatContainer.offsetLeft;
    dragOffsetY = e.clientY - chatContainer.offsetTop;
    chatContainer.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        chatContainer.style.left = `${e.clientX - dragOffsetX}px`;
        chatContainer.style.top = `${e.clientY - dragOffsetY}px`;
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    chatContainer.style.cursor = 'grab';
});

// Update comments list
function updateCommentsList() {
    console.log('Updating comments list, comments:', comments.length); // Debug
    const container = document.getElementById('commentsList');
    container.innerHTML = '';
    comments.forEach((comment, index) => {
        const item = document.createElement('div');
        item.className = 'comment-item';
        const timeStr = formatTime(comment.time);
        item.innerHTML = `<strong>${comment.name}</strong> at ${timeStr}: ${comment.text}`;
        if (comment.audioBlob) {
            const playBtn = document.createElement('button');
            playBtn.textContent = 'Play Voice';
            playBtn.addEventListener('click', () => {
                const audio = new Audio(URL.createObjectURL(comment.audioBlob));
                audio.play();
            });
            item.appendChild(playBtn);
        }
        container.appendChild(item);
    });
}

// Add chat message
function addChatMessage(name, message) {
    const container = document.getElementById('chatMessages');
    const item = document.createElement('div');
    item.className = 'chat-item';
    if (name) {
        item.innerHTML = `<strong>${name}:</strong> ${message}`;
    } else {
        item.innerHTML = message;
    }
    container.appendChild(item);
    container.scrollTop = container.scrollHeight;
}







function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`;
}