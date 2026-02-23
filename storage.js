const DB_NAME = 'IdeaFactoryTimerDB';
const DB_VERSION = 1;
const STORE_AUDIO = 'audio';
const STORE_IMAGES = 'images';

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
            if (!db.objectStoreNames.contains(STORE_AUDIO)) {
                db.createObjectStore(STORE_AUDIO);
            }
            if (!db.objectStoreNames.contains(STORE_IMAGES)) {
                db.createObjectStore(STORE_IMAGES);
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

export function getVolume() {
    const volume = localStorage.getItem('volume');
    return volume ? parseFloat(volume) : 1.0;
}

export function saveVolume(volume) {
    localStorage.setItem('volume', volume);
}

// IndexedDB for Audio
export function saveAudio(file) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_AUDIO], 'readwrite');
        const store = transaction.objectStore(STORE_AUDIO);
        const request = store.put(file, 'customAudio');

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

export function getAudio() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_AUDIO], 'readonly');
        const store = transaction.objectStore(STORE_AUDIO);
        const request = store.get('customAudio');

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// Images (slideshow) storage helpers
export function saveImage(file) {
    return new Promise((resolve, reject) => {
        try {
            const key = `${Date.now()}_${file.name}`;
            const transaction = db.transaction([STORE_IMAGES], 'readwrite');
            const store = transaction.objectStore(STORE_IMAGES);
            const request = store.put(file, key);

            request.onsuccess = () => resolve(key);
            request.onerror = (e) => reject(e.target.error);
        } catch (e) {
            reject(e);
        }
    });
}

export function getImages() {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction([STORE_IMAGES], 'readonly');
            const store = transaction.objectStore(STORE_IMAGES);
            const items = [];
            const request = store.openCursor();

            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    items.push({ key: cursor.key, file: cursor.value });
                    cursor.continue();
                } else {
                    resolve(items);
                }
            };

            request.onerror = (e) => reject(e.target.error);
        } catch (e) {
            reject(e);
        }
    });
}

export function removeImage(key) {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction([STORE_IMAGES], 'readwrite');
            const store = transaction.objectStore(STORE_IMAGES);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        } catch (e) {
            reject(e);
        }
    });
}
