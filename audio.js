import { getAudio } from './storage.js';

let audioContext;
let audioBuffer;
let masterGain;
let currentVolume = 1.0;

export function setVolume(val) {
    currentVolume = val;
    if (masterGain) {
        masterGain.gain.setValueAtTime(val, audioContext.currentTime);
    }
}

export async function initAudio() {
    try {
        // Only create context if it doesn't exist or was closed
        if (!audioContext || audioContext.state === 'closed') {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContext();
        }

        // Create master gain if needed
        if (!masterGain) {
            masterGain = audioContext.createGain();
            masterGain.gain.value = currentVolume;
            masterGain.connect(audioContext.destination);
        }

        // Try to load custom audio
        const file = await getAudio();
        if (file) {
            const arrayBuffer = await file.arrayBuffer();
            // Decode audio data - this requires a new buffer each time we decode
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        } else {
            audioBuffer = null;
        }
    } catch (e) {
        console.error("Audio init error:", e);
    }
}

export function playAudio() {
    if (!audioContext) return;

    // Resume context if suspended (browser policy)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    // Ensure master gain is connected (in case of context reset/issues)
    if (!masterGain) {
        masterGain = audioContext.createGain();
        masterGain.gain.value = currentVolume;
        masterGain.connect(audioContext.destination);
    }

    if (audioBuffer) {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(masterGain);
        source.start(0);
    } else {
        // Fallback Beep
        const oscillator = audioContext.createOscillator();
        const envelopeGain = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1);

        // Envelope for the beep itself
        envelopeGain.gain.setValueAtTime(0.5, audioContext.currentTime);
        envelopeGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.connect(envelopeGain);
        // Connect envelope to master volume
        envelopeGain.connect(masterGain);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    }
}
