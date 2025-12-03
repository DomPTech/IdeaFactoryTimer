import { initStorage, getBuzzTimes, addBuzzTime, removeBuzzTime, saveAudio, getAudio } from './storage.js';
import { initAudio, playAudio } from './audio.js';

// State
let buzzTimes = [];
let nextBuzzTime = null;
let isFlashing = false;

// DOM Elements
const currentTimeEl = document.getElementById('current-time');
const nextBuzzCountdownEl = document.getElementById('next-buzz-countdown');
const flashOverlay = document.getElementById('flash-overlay');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const newTimeInput = document.getElementById('new-time-input');
const addTimeBtn = document.getElementById('add-time-btn');
const buzzTimesList = document.getElementById('buzz-times-list');
const audioUpload = document.getElementById('audio-upload');
const currentAudioName = document.getElementById('current-audio-name');
const testAudioBtn = document.getElementById('test-audio-btn');

// Initialization
async function init() {
    await initStorage();
    await initAudio();
    
    buzzTimes = getBuzzTimes();
    renderBuzzTimes();
    updateClock();
    
    // Check if we have custom audio
    const audioFile = await getAudio();
    if (audioFile) {
        currentAudioName.textContent = audioFile.name;
    }

    // Start Clock Loop
    setInterval(updateClock, 1000);
}

// Clock Logic
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;
    
    currentTimeEl.textContent = timeString;

    // Check for Buzz
    // We only want to trigger exactly at :00 seconds
    if (seconds === '00') {
        const currentHM = `${hours}:${minutes}`;
        if (buzzTimes.includes(currentHM)) {
            triggerBuzz();
        }
    }

    updateNextBuzz(now);
}

function updateNextBuzz(now) {
    if (buzzTimes.length === 0) {
        nextBuzzCountdownEl.textContent = "--:--";
        return;
    }

    // Find next buzz time
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const sortedTimes = [...buzzTimes].sort();
    
    let nextTimeStr = null;
    
    for (const time of sortedTimes) {
        const [h, m] = time.split(':').map(Number);
        const timeMinutes = h * 60 + m;
        if (timeMinutes > currentMinutes) {
            nextTimeStr = time;
            break;
        }
    }

    // If no time found later today, wrap to first time tomorrow
    if (!nextTimeStr) {
        nextTimeStr = sortedTimes[0];
    }

    if (!nextTimeStr) return;

    const [nextH, nextM] = nextTimeStr.split(':').map(Number);
    let target = new Date(now);
    target.setHours(nextH, nextM, 0, 0);
    
    if (target < now) {
        target.setDate(target.getDate() + 1);
    }

    const diff = target - now;
    const diffHrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const diffSecs = Math.floor((diff % (1000 * 60)) / 1000);

    nextBuzzCountdownEl.textContent = `${diffHrs}h ${diffMins}m ${diffSecs}s`;
}

function triggerBuzz() {
    if (isFlashing) return;
    isFlashing = true;
    
    console.log("BUZZ!");
    playAudio();
    
    flashOverlay.classList.add('flashing');
    flashOverlay.style.opacity = '0.5';

    // Stop flashing after 5 seconds (or audio duration if we knew it, but 5s is safe)
    setTimeout(() => {
        flashOverlay.classList.remove('flashing');
        flashOverlay.style.opacity = '0';
        isFlashing = false;
    }, 5000);
}

// UI Logic
function renderBuzzTimes() {
    buzzTimesList.innerHTML = '';
    const sortedTimes = [...buzzTimes].sort();
    
    sortedTimes.forEach(time => {
        const li = document.createElement('li');
        li.className = 'buzz-time-item';
        li.innerHTML = `
            <span>${time}</span>
            <button class="delete-btn" data-time="${time}">&times;</button>
        `;
        buzzTimesList.appendChild(li);
    });
}

// Event Listeners
settingsBtn.addEventListener('click', () => settingsModal.showModal());
closeSettingsBtn.addEventListener('click', () => settingsModal.close());

addTimeBtn.addEventListener('click', () => {
    const time = newTimeInput.value;
    if (time && !buzzTimes.includes(time)) {
        addBuzzTime(time);
        buzzTimes = getBuzzTimes();
        renderBuzzTimes();
        newTimeInput.value = '';
    }
});

buzzTimesList.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const time = e.target.dataset.time;
        removeBuzzTime(time);
        buzzTimes = getBuzzTimes();
        renderBuzzTimes();
    }
});

audioUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        await saveAudio(file);
        currentAudioName.textContent = file.name;
        // Reload audio context with new file
        await initAudio();
    }
});

testAudioBtn.addEventListener('click', () => {
    triggerBuzz();
});

// Start
init();
