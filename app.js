// app.js
import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js';
import {joinRoom} from 'https://esm.run/trystero/torrent';


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
let myName = '';

// Trystero state
let room = null;
let sendCursor = null;
let onCursor = null;
let sendAudioUrl = null;
let onAudioUrl = null;
let sendAudio = null;
let onAudio = null;
let sendComment = null;
let onComment = null;
let sendComments = null;
let onComments = null;
let cursors = {}; // peerId => cursorElement

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
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('noAudioOverlay').style.display = 'none';
});

wavesurfer.on('loading', (percent) => {
    document.getElementById('loadingOverlay').style.display = 'flex';
    document.getElementById('loadingOverlay').textContent = `Loading audio... ${percent}%`;
});

wavesurfer.on('error', (err) => {
    console.error('WaveSurfer error:', err);
    document.getElementById('loadingOverlay').style.display = 'none';
    alert('Failed to load audio.');
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

// Tab for quick comment
document.addEventListener('keydown', (e) => {
    if (e.code === 'Tab' && isWaveSurferReady && document.getElementById('commentModal').style.display !== 'block') {
        e.preventDefault();
        const text = prompt('Quick comment:');
        if (text && text.trim()) {
            const time = wavesurfer.getCurrentTime();
            const name = room ? myName : getRandomSillyName();
            const comment = { time, name, text: text.trim(), audioBlob: null };
            comments.push(comment);
            updateCommentsList();
            // Share comment
            if (room) {
                sendComment({ time, name, text: text.trim() });
            }
        }
    }
});

// Silly names
const sillyNames = ['Pixel Pirate', 'Byte Bunny', 'Glitch Goblin', 'Retro Robot', 'Wave Warrior', 'Sound Sprite', 'Echo Elf', 'Tune Troll', 'Beat Bandit', 'Melody Monster'];

function getRandomSillyName() {
    return sillyNames[Math.floor(Math.random() * sillyNames.length)];
}

// Load audio from URL
function loadAudioUrl(url) {
    console.log('Loading audio from URL:', url);
    wavesurfer.load(url);
}

// Send audio URL to peers
function sendAudioUrlToPeers(url) {
    if (room) {
        console.log('Sending audio URL:', url);
        sendAudioUrl(url);
    }
}

// Send audio blob to peers
function sendAudioBlob(blob) {
    if (room && blob.size > 0) {
        console.log('Sending audio blob:', blob.size, 'bytes');
        blob.arrayBuffer().then(buffer => {
            sendAudio(buffer);
        });
    }
}

// Join Trystero room for cursors
function joinSession(roomName) {
    console.log('Joining room:', roomName);
    room = joinRoom({ appId: 'comment-the-wave' }, roomName);
    [sendCursor, onCursor] = room.makeAction('cursor');
    [sendAudioUrl, onAudioUrl] = room.makeAction('audioUrl');
    [sendAudio, onAudio] = room.makeAction('audio', { binary: true });
    [sendComment, onComment] = room.makeAction('comment');
    [sendComments, onComments] = room.makeAction('comments');
    console.log('Actions created');
    myName = getRandomSillyName();
    console.log('My name:', myName);
    document.getElementById('joinSession').textContent = 'Leave Session';
    updatePeopleCount(1); // Self

    // Handle incoming cursor positions
    onCursor((data, peerId) => {
        console.log('Received cursor from', peerId, data);
        updateCursor(peerId, data.x, data.y);
    });

    // Handle incoming audio URLs
    onAudioUrl((url, peerId) => {
        console.log('Received audio URL from', peerId, url);
        loadAudioUrl(url);
    });

    // Handle incoming audio blobs
    onAudio((buffer, peerId) => {
        console.log('Received audio blob from', peerId, buffer.byteLength, 'bytes');
        const blob = new Blob([buffer], { type: 'audio/mpeg' });
        wavesurfer.loadBlob(blob);
        playNotificationSound();
    });

    // Handle incoming comments
    onComment((data, peerId) => {
        console.log('Received comment from', peerId, data);
        const comment = { time: data.time, name: data.name, text: data.text, audioBlob: null };
        comments.push(comment);
        updateCommentsList();
        playNotificationSound();
    });

    // Handle incoming comments sync
    onComments((data, peerId) => {
        console.log('Received comments sync from', peerId, data);
        data.forEach(c => {
            if (!comments.some(existing => existing.time === c.time && existing.text === c.text)) {
                comments.push(c);
            }
        });
        updateCommentsList();
    });

    // Handle peer join
    room.onPeerJoin(peerId => {
        console.log('Peer joined:', peerId);
        updatePeopleCount(room.getPeers().length + 1);
        playNotificationSound();
        // Send current comments to new peer
        sendComments(comments);
    });

    // Handle peer leave
    room.onPeerLeave(peerId => {
        console.log('Peer left:', peerId);
        if (cursors[peerId]) {
            cursors[peerId].remove();
            delete cursors[peerId];
        }
        updatePeopleCount(room.getPeers().length + 1);
    });

    // Send cursor on move
    document.addEventListener('mousemove', (e) => {
        if (room) {
            const data = { x: e.clientX, y: e.clientY };
            console.log('Sending cursor:', data);
            sendCursor(data);
        }
    });

    // Check max capacity (8 total)
    setTimeout(() => {
        const peers = room.getPeers();
        console.log('Peers after join:', peers);
        if (peers.length >= 7) { // 7 others, total 8
            alert('Room is full (max 8 people).');
            // Leave
            room.leave();
            room = null;
            document.getElementById('joinSession').textContent = 'Leave Session';
            Object.values(cursors).forEach(el => el.remove());
            cursors = {};
            updatePeopleCount(0);
        } else {
            updatePeopleCount(peers.length + 1);
        }
    }, 1000);
}

// Update cursor position
function updateCursor(peerId, x, y) {
    console.log('Updating cursor for', peerId, 'at', x, y);
    if (!cursors[peerId]) {
        console.log('Creating cursor for', peerId);
        cursors[peerId] = document.createElement('div');
        cursors[peerId].style.position = 'fixed';
        cursors[peerId].style.width = '30px';
        cursors[peerId].style.height = '30px';
        cursors[peerId].style.background = getColorForPeer(peerId);
        cursors[peerId].style.borderRadius = '50%';
        cursors[peerId].style.pointerEvents = 'none';
        cursors[peerId].style.zIndex = '1000';
        cursors[peerId].style.border = '3px solid white';
        cursors[peerId].style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
        cursors[peerId].style.display = 'flex';
        cursors[peerId].style.alignItems = 'center';
        cursors[peerId].style.justifyContent = 'center';
        cursors[peerId].style.fontSize = '12px';
        cursors[peerId].style.fontFamily = '"Press Start 2P", monospace';
        cursors[peerId].style.color = 'white';
        cursors[peerId].style.fontWeight = 'bold';
        cursors[peerId].textContent = getInitialForPeer(peerId);
        document.body.appendChild(cursors[peerId]);
    }
    console.log('Setting cursor position to', x, y);
    cursors[peerId].style.left = `${x - 15}px`;
    cursors[peerId].style.top = `${y - 15}px`;
}

// Get color for peer
function getColorForPeer(peerId) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
    let hash = 0;
    for (let i = 0; i < peerId.length; i++) {
        hash = peerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

// Get initial for peer
function getInitialForPeer(peerId) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let hash = 0;
    for (let i = 0; i < peerId.length; i++) {
        hash = peerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return letters[Math.abs(hash) % letters.length];
}

// Update people count
function updatePeopleCount(count) {
    document.getElementById('peopleCount').textContent = `People: ${count}`;
}

// Play notification sound
function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.log('Audio notification not supported');
    }
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

    // Store the time and name for later
    window.currentCommentTime = time;
    window.currentCommentName = room ? myName : getRandomSillyName();
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
            // Share the audio with peers
            sendAudioBlob(blob);
        };
        reader.readAsArrayBuffer(file);
    } else {
        console.log('File invalid or too large'); // Debug
        alert('File too large or invalid.');
    }
});

// Load URL
document.getElementById('loadUrl').addEventListener('click', () => {
    const url = document.getElementById('audioUrl').value.trim();
    if (url) {
        loadAudioUrl(url);
        if (room) {
            sendAudioUrlToPeers(url);
        }
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
        room.leave();
        room = null;
        document.getElementById('joinSession').textContent = 'Join Session';
        // Remove all cursors
        Object.values(cursors).forEach(el => el.remove());
        cursors = {};
        updatePeopleCount(0);
    } else {
        joinSession('wave-session');
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
        const name = room ? myName : getRandomSillyName(); // Use myName if in session
        const comment = { time: window.currentCommentTime, name, text, audioBlob: null };
        comments.push(comment);
        updateCommentsList();
        // Share comment
        if (room) {
            sendComment({ time: window.currentCommentTime, name, text });
        }
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









function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`;
}