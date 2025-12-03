import { getAudio } from './storage.js';

let audioContext;
let audioBuffer;

export async function initAudio() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();

        // Try to load custom audio
        const file = await getAudio();
        if (file) {
            const arrayBuffer = await file.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        } else {
            // Create a simple beep if no audio
            // We won't create a buffer here, we'll generate it on fly in playAudio if buffer is null
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

    const source = audioContext.createBufferSource();

    if (audioBuffer) {
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
    } else {
        // Fallback Beep
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    }
}
