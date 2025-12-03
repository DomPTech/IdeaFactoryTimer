const DB_NAME = 'IdeaFactoryTimerDB';
const DB_VERSION = 1;
const STORE_NAME = 'audio';

let db;

export function initStorage() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

// LocalStorage for Times
export function getBuzzTimes() {
    const times = localStorage.getItem('buzzTimes');
    return times ? JSON.parse(times) : [];
}

export function addBuzzTime(time) {
    const times = getBuzzTimes();
    if (!times.includes(time)) {
        times.push(time);
        localStorage.setItem('buzzTimes', JSON.stringify(times));
    }
}

export function removeBuzzTime(time) {
    let times = getBuzzTimes();
    times = times.filter(t => t !== time);
    localStorage.setItem('buzzTimes', JSON.stringify(times));
}

// IndexedDB for Audio
export function saveAudio(file) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(file, 'customAudio');

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

export function getAudio() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('customAudio');

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}
