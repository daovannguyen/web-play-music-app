/**
 * storage.js - Quản lý lưu trữ dữ liệu (IndexedDB & LocalStorage)
 * - IndexedDB: Lưu trữ file âm thanh (Blob lớn) an toàn và không bị mất khi F5.
 * - LocalStorage: Lưu cấu hình người dùng (tốc độ, âm lượng khuếch đại, tiến trình phát).
 */

const STORAGE_KEYS = {
  SPEED: 'audio_speed',
  VOLUME: 'audio_volume',
  PROGRESS: 'audio_progress',
  FILE_NAME: 'audio_file_name',
  FILE_SIZE: 'audio_file_size',
  FILE_TYPE: 'audio_file_type'
};

const AudioStorage = {
  dbName: 'AudioSpeedAppDB',
  dbVersion: 1,
  storeName: 'audioStore',

  /**
   * Khởi tạo và mở kết nối IndexedDB
   * @returns {Promise<IDBDatabase>}
   */
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Lưu trữ tệp âm thanh (Blob) vào IndexedDB
   * @param {Blob|File} blob 
   * @returns {Promise<void>}
   */
  async saveAudioBlob(blob) {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(blob, 'lastTrack');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error('[AudioStorage] Lỗi lưu Blob vào IndexedDB:', err);
    }
  },

  /**
   * Lấy tệp âm thanh đã lưu từ IndexedDB
   * @returns {Promise<Blob|null>}
   */
  async getSavedAudioBlob() {
    try {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get('lastTrack');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      console.error('[AudioStorage] Lỗi đọc IndexedDB:', err);
      return null;
    }
  },

  /**
   * Lưu thông tin metadata của file (tên, kích thước, định dạng)
   */
  saveMetadata(name, size, type) {
    localStorage.setItem(STORAGE_KEYS.FILE_NAME, name);
    localStorage.setItem(STORAGE_KEYS.FILE_SIZE, size);
    localStorage.setItem(STORAGE_KEYS.FILE_TYPE, type);
  },

  /**
   * Đọc metadata của file đã lưu
   */
  getMetadata() {
    const name = localStorage.getItem(STORAGE_KEYS.FILE_NAME);
    if (!name) return null;
    return {
      name,
      size: Number(localStorage.getItem(STORAGE_KEYS.FILE_SIZE) || 0),
      type: localStorage.getItem(STORAGE_KEYS.FILE_TYPE) || 'audio/mp3'
    };
  },

  /**
   * Lưu tiến trình giây đang nghe
   */
  saveProgress(seconds) {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, seconds);
  },

  /**
   * Đọc tiến trình giây đã lưu
   */
  getProgress() {
    return parseFloat(localStorage.getItem(STORAGE_KEYS.PROGRESS) || '0');
  },

  /**
   * Lưu và lấy tốc độ phát
   */
  saveSpeed(speed) {
    localStorage.setItem(STORAGE_KEYS.SPEED, speed);
  },
  getSpeed(defaultVal = 1.0) {
    const s = localStorage.getItem(STORAGE_KEYS.SPEED);
    return s !== null ? parseFloat(s) : defaultVal;
  },

  /**
   * Lưu và lấy âm lượng khuếch đại (0x đến 10x, chuẩn 1.0x = 100%)
   */
  saveVolume(vol) {
    localStorage.setItem(STORAGE_KEYS.VOLUME, vol);
  },
  getVolume(defaultVal = 1.0) {
    const v = localStorage.getItem(STORAGE_KEYS.VOLUME);
    if (v === null) return defaultVal;
    const parsed = parseFloat(v);
    return isNaN(parsed) ? defaultVal : Math.max(0, Math.min(10, parsed));
  },

  /**
   * Xóa toàn bộ file và cấu hình đã lưu
   */
  async clearAll() {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete('lastTrack');
    } catch (err) {
      console.error('[AudioStorage] Lỗi xóa IndexedDB:', err);
    }
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }
};

window.AudioStorage = AudioStorage;
