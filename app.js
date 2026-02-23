import { initStorage, getBuzzTimes, addBuzzTime, removeBuzzTime, saveAudio, getAudio, getVolume, saveVolume, saveImage, getImages, removeImage } from './storage.js';
import { initAudio, playAudio, setVolume } from './audio.js';

// State
let buzzTimes = [];
let nextBuzzTime = null;
let isFlashing = false;
let slideshowImages = []; // {key, file, url}
let slideshowIndex = 0;
let slideshowTimer = null;
let slideshowEnabled = false;
let slideshowInterval = 5000;

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
const volumeSlider = document.getElementById('volume-slider');
const volumeDisplay = document.getElementById('volume-display');
const enableSlideshowCheckbox = document.getElementById('enable-slideshow');
const imagesUpload = document.getElementById('images-upload');
const slideshowEl = document.getElementById('slideshow');
const slideshowImagesList = document.getElementById('slideshow-images-list');
const slideshowIntervalInput = document.getElementById('slideshow-interval');

// Initialization
async function init() {
    try {
        await initStorage();
    } catch (e) {
        console.error("Storage init failed (likely browser restriction), continuing:", e);
    }

    // Load Volume
    const savedVolume = getVolume();
    setVolume(savedVolume);
    volumeSlider.value = savedVolume * 100;
    volumeDisplay.textContent = `${Math.round(savedVolume * 100)}%`;

    try {
        await initAudio();
    } catch (e) {
        console.error("Audio init failed:", e);
    }

    buzzTimes = getBuzzTimes();
    renderBuzzTimes();
    updateClock();

    // Check if we have custom audio
    try {
        const audioFile = await getAudio();
        if (audioFile) {
            currentAudioName.textContent = audioFile.name;
        }
    } catch (e) {
        console.log("Could not load custom audio");
    }

    // Load persisted slideshow settings (read before loading images so render works on reload)
    slideshowEnabled = localStorage.getItem('slideshowEnabled') === 'true';
    slideshowInterval = parseInt(localStorage.getItem('slideshowInterval') || '5', 10) * 1000;
    enableSlideshowCheckbox.checked = slideshowEnabled;
    slideshowIntervalInput.value = Math.max(1, slideshowInterval / 1000);

    // Load slideshow images from storage
    try {
        const images = await getImages();
        await loadSlideshowImages(images || []);
    } catch (e) {
        console.warn('Could not load slideshow images', e);
    }

    if (slideshowEnabled && slideshowImages.length > 0) {
        startSlideshow();
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

    // Display in 12-hour format
    let displayHours = now.getHours();
    const ampm = displayHours >= 12 ? 'PM' : 'AM';
    displayHours = displayHours % 12;
    displayHours = displayHours ? displayHours : 12; // the hour '0' should be '12'
    const displayString = `${displayHours}:${minutes}:${seconds} <span style="font-size: 0.5em">${ampm}</span>`;

    currentTimeEl.innerHTML = displayString;

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

    if (!Array.isArray(buzzTimes)) {
        buzzTimes = [];
    }

    if (buzzTimes.length === 0) {
        buzzTimesList.innerHTML = '<li style="padding: 1rem; text-align: center; color: var(--text-secondary);">No buzz times set</li>';
        return;
    }

    const sortedTimes = [...buzzTimes].sort();

    sortedTimes.forEach(time => {
        try {
            if (!time || !time.includes(':')) return;

            // Convert to 12-hour for display
            const [h, m] = time.split(':');
            let hour = parseInt(h);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            hour = hour % 12;
            hour = hour ? hour : 12;
            const displayTime = `${hour}:${m} ${ampm}`;

            const li = document.createElement('li');
            li.className = 'buzz-time-item';
            li.innerHTML = `
                <span class="time-display">${displayTime}</span>
                <input type="time" class="time-edit" value="${time}" style="display: none;">
                <div class="time-actions">
                    <button class="edit-btn" data-time="${time}" aria-label="Edit">Edit</button>
                    <button class="delete-btn" data-time="${time}" aria-label="Delete">Delete</button>
                </div>
            `;
            buzzTimesList.appendChild(li);
        } catch (e) {
            console.error("Error rendering time:", time, e);
        }
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
    } else if (e.target.classList.contains('edit-btn')) {
        const li = e.target.closest('.buzz-time-item');
        const timeDisplay = li.querySelector('.time-display');
        const timeEdit = li.querySelector('.time-edit');
        const editBtn = li.querySelector('.edit-btn');

        if (timeEdit.style.display === 'none') {
            // Enter edit mode
            timeDisplay.style.display = 'none';
            timeEdit.style.display = 'inline-block';
            editBtn.textContent = 'Save';
            editBtn.style.color = 'var(--success-color)';
        } else {
            // Save edit
            const oldTime = e.target.dataset.time;
            const newTime = timeEdit.value;

            if (newTime && newTime !== oldTime) {
                removeBuzzTime(oldTime);
                addBuzzTime(newTime);
                buzzTimes = getBuzzTimes();
            }
            renderBuzzTimes();
        }
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

volumeSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    const volume = value / 100;

    volumeDisplay.textContent = `${value}%`;
    setVolume(volume);
    saveVolume(volume);
});

testAudioBtn.addEventListener('click', () => {
    triggerBuzz();
});

// Slideshow helpers
async function loadSlideshowImages(items) {
    slideshowImages = [];
    for (const it of items) {
        try {
            const file = it.file;
            const url = URL.createObjectURL(file);
            slideshowImages.push({ key: it.key, file, url });
        } catch (e) {
            console.warn('Error loading image item', it, e);
        }
    }
    renderSlideshowList();
    renderSlideshow();
}

function renderSlideshow() {
    slideshowEl.innerHTML = '';
    // Hide container if slideshow is disabled or there are no images
    if (!slideshowEnabled || !slideshowImages || slideshowImages.length === 0) {
        slideshowEl.setAttribute('aria-hidden', 'true');
        slideshowEl.style.display = 'none';
        return;
    }

    slideshowEl.setAttribute('aria-hidden', 'false');
    slideshowEl.style.display = '';
    slideshowImages.forEach((imgObj, idx) => {
        const img = document.createElement('img');
        img.src = imgObj.url;
        img.alt = imgObj.file.name || `slide-${idx}`;
        if (idx === slideshowIndex) img.classList.add('visible');
        slideshowEl.appendChild(img);
    });
}

function renderSlideshowList() {
    slideshowImagesList.innerHTML = '';
    if (!slideshowImages || slideshowImages.length === 0) {
        slideshowImagesList.innerHTML = '<li style="padding: 0.5rem; color: var(--text-secondary);">No images uploaded</li>';
        return;
    }

    slideshowImages.forEach(item => {
        const li = document.createElement('li');
        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        const thumb = document.createElement('img');
        thumb.src = item.url;
        thumb.className = 'thumb';
        const name = document.createElement('span');
        name.textContent = item.file.name || item.key;
        left.appendChild(thumb);
        left.appendChild(name);

        const actions = document.createElement('div');
        actions.className = 'image-actions';
        const del = document.createElement('button');
        del.textContent = 'Delete';
        del.dataset.key = item.key;
        actions.appendChild(del);

        li.appendChild(left);
        li.appendChild(actions);
        slideshowImagesList.appendChild(li);
    });
}

function showSlide(index) {
    const imgs = slideshowEl.querySelectorAll('img');
    imgs.forEach((img, i) => {
        if (i === index) img.classList.add('visible');
        else img.classList.remove('visible');
    });
}

function nextSlide() {
    if (!slideshowImages || slideshowImages.length === 0) return;
    slideshowIndex = (slideshowIndex + 1) % slideshowImages.length;
    showSlide(slideshowIndex);
}

function startSlideshow() {
    if (!slideshowImages || slideshowImages.length === 0) return;
    stopSlideshow();
    // Ensure DOM is rendered before showing slides
    renderSlideshow();
    showSlide(slideshowIndex);
    slideshowTimer = setInterval(nextSlide, slideshowInterval);
}

function stopSlideshow() {
    if (slideshowTimer) {
        clearInterval(slideshowTimer);
        slideshowTimer = null;
    }
}

// Slideshow event handlers
imagesUpload.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
        try {
            const key = await saveImage(file);
            const url = URL.createObjectURL(file);
            slideshowImages.push({ key, file, url });
        } catch (err) {
            console.warn('Failed to save image', err);
        }
    }
    renderSlideshowList();
    renderSlideshow();
    // If user uploads images, enable and start slideshow automatically
    if (!slideshowEnabled && slideshowImages.length > 0) {
        slideshowEnabled = true;
        enableSlideshowCheckbox.checked = true;
        localStorage.setItem('slideshowEnabled', 'true');
    }
    if (slideshowImages.length > 0) {
        slideshowIndex = 0;
        startSlideshow();
    }
    imagesUpload.value = '';
});

// Use event delegation on the settings dialog so the handler still works
// if elements are re-rendered or queried at different times.
settingsModal.addEventListener('change', (e) => {
    const target = e.target;
    if (!target) return;
    if (target.id === 'enable-slideshow') {
        slideshowEnabled = !!target.checked;
        localStorage.setItem('slideshowEnabled', slideshowEnabled);
        if (slideshowEnabled) {
            // reset to first slide when enabling
            slideshowIndex = 0;
            renderSlideshow();
            startSlideshow();
        } else {
            stopSlideshow();
            renderSlideshow();
        }
    }
});

slideshowIntervalInput.addEventListener('input', (e) => {
    const val = Math.max(1, parseInt(e.target.value || '5', 10));
    slideshowInterval = val * 1000;
    localStorage.setItem('slideshowInterval', val.toString());
    if (slideshowTimer) {
        startSlideshow();
    }
});

slideshowImagesList.addEventListener('click', async (e) => {
    if (e.target.tagName === 'BUTTON') {
        const key = e.target.dataset.key;
        if (!key) return;
        try {
            await removeImage(key);
        } catch (err) {
            console.warn('Failed to remove image from DB', err);
        }
        // remove from memory and revoke URL
        const idx = slideshowImages.findIndex(i => i.key === key);
        if (idx !== -1) {
            URL.revokeObjectURL(slideshowImages[idx].url);
            slideshowImages.splice(idx, 1);
            if (slideshowIndex >= slideshowImages.length) slideshowIndex = 0;
        }
        renderSlideshowList();
        renderSlideshow();
        if (slideshowImages.length === 0) stopSlideshow();
    }
});

// Start
init();
