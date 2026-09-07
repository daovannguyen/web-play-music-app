/**
 * app.js - Controller chính của ứng dụng Audio Speed
 * - Kết nối các module: StorageService, Visualizer, DemoSynth
 * - Điều khiển luồng sự kiện DOM, giao diện và phần tử Audio HTML5
 */

class AudioApp {
  constructor() {
    this.initElements();
    this.visualizer = new AudioVisualizer('visualizer', {
      barCount: 42,
      activeColor: '#6366f1',
      idleColor: '#475569'
    });

    this.currentSpeed = 1.0;
    this.lastSavedProgress = 0;
    this.pendingResumeTime = null;

    this.bindEvents();
    this.restoreSession();
  }

  /**
   * Khởi tạo các phần tử DOM
   */
  initElements() {
    this.audio = document.getElementById('audioElement');
    this.playBtn = document.getElementById('playBtn');
    this.rewindBtn = document.getElementById('rewindBtn');
    this.forwardBtn = document.getElementById('forwardBtn');
    this.progressBar = document.getElementById('progressBar');
    this.currentTimeEl = document.getElementById('currentTime');
    this.totalDurationEl = document.getElementById('totalDuration');
    this.volumeBar = document.getElementById('volumeBar');
    this.volumeIcon = document.getElementById('volumeIcon');
    this.fileInput = document.getElementById('fileInput');
    this.dropZone = document.getElementById('dropZone');
    this.trackTitle = document.getElementById('trackTitle');
    this.trackMeta = document.getElementById('trackMeta');
    this.vinylDisc = document.getElementById('vinylDisc');
    this.speedDisplay = document.getElementById('speedDisplay');
    this.speedButtons = document.querySelectorAll('.speed-pill');
    this.demoBtn = document.getElementById('demoBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.toast = document.getElementById('toast');
    this.toastText = document.getElementById('toastText');
  }

  /**
   * Đăng ký các sự kiện tương tác
   */
  bindEvents() {
    // 1. Phát / Tạm dừng
    this.playBtn.addEventListener('click', () => this.togglePlay());

    // 2. Tua thời gian (-5s / +5s)
    this.rewindBtn.addEventListener('click', () => this.seekDelta(-5));
    this.forwardBtn.addEventListener('click', () => this.seekDelta(5));

    // 3. Thanh kéo thời gian (Progress Bar)
    this.progressBar.addEventListener('input', () => this.handleSeekInput());

    // 4. Sự kiện phần tử Audio
    this.audio.addEventListener('timeupdate', () => this.handleTimeUpdate());
    this.audio.addEventListener('loadedmetadata', () => this.handleLoadedMetadata());
    this.audio.addEventListener('ended', () => this.handleEnded());

    // 5. Điều khiển âm lượng
    this.volumeBar.addEventListener('input', (e) => this.handleVolumeChange(e.target.value));
    this.volumeIcon.addEventListener('click', () => this.toggleMute());

    // 6. Nút thay đổi tốc độ
    this.speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        this.setSpeed(speed, true);
      });
    });

    // 7. Chọn tệp & Kéo thả (Drag & Drop)
    this.dropZone.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) this.handleFile(e.target.files[0]);
    });
    this.bindDragAndDrop();

    // 8. Nút Demo & Nút Xóa
    this.demoBtn.addEventListener('click', () => this.handleDemoClick());
    this.clearBtn.addEventListener('click', () => this.handleClearClick());
  }

  /**
   * Xử lý kéo thả tệp vào dropzone
   */
  bindDragAndDrop() {
    ['dragenter', 'dragover'].forEach(name => {
      this.dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        this.dropZone.classList.add('border-indigo-500', 'bg-indigo-950/40');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      this.dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        this.dropZone.classList.remove('border-indigo-500', 'bg-indigo-950/40');
      });
    });

    this.dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files.length > 0) {
        this.handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  /**
   * Nạp tệp âm thanh người dùng chọn hoặc thả vào
   */
  async handleFile(file) {
    if (!file || !file.type.startsWith('audio/')) {
      alert('Vui lòng chọn tệp âm thanh hợp lệ (MP3, WAV, M4A, FLAC...).');
      return;
    }

    // Lưu vào IndexedDB & LocalStorage
    await AudioStorage.saveAudioBlob(file);
    AudioStorage.saveMetadata(file.name, file.size, file.type);
    AudioStorage.saveProgress(0);

    this.loadAudioSource(file, file.name, file.size, file.type, 0, true);
  }

  /**
   * Tải nguồn âm thanh vào thẻ audio
   */
  loadAudioSource(blob, name, size, type, resumeProgress = 0, autoPlay = false) {
    if (this.audio.src) {
      URL.revokeObjectURL(this.audio.src);
    }

    this.audio.src = URL.createObjectURL(blob);
    this.audio.playbackRate = this.currentSpeed;
    this.audio.preservesPitch = true;

    this.trackTitle.textContent = name;
    const sizeMB = size ? (size / (1024 * 1024)).toFixed(2) : '0';
    const ext = (type && type.includes('/')) ? type.split('/')[1].toUpperCase() : 'AUDIO';
    this.trackMeta.textContent = `${ext} • ${sizeMB} MB`;
    this.clearBtn.classList.remove('hidden');

    if (resumeProgress > 0) {
      this.pendingResumeTime = resumeProgress;
    }

    if (autoPlay) {
      this.audio.play()
        .then(() => this.updatePlayState(true))
        .catch(() => this.updatePlayState(false));
    }
  }

  /**
   * Bật / tắt phát nhạc
   */
  togglePlay() {
    if (!this.audio.src) {
      this.handleDemoClick();
      return;
    }

    if (this.audio.paused) {
      this.audio.play();
      this.updatePlayState(true);
    } else {
      this.audio.pause();
      this.updatePlayState(false);
    }
  }

  /**
   * Cập nhật trạng thái hiển thị Play / Pause
   */
  updatePlayState(isPlaying) {
    if (isPlaying) {
      this.playBtn.innerHTML = '⏸';
      this.vinylDisc.classList.add('vinyl-spinning');
      this.visualizer.start();
    } else {
      this.playBtn.innerHTML = '▶';
      this.vinylDisc.classList.remove('vinyl-spinning');
      this.visualizer.stop();
    }
  }

  /**
   * Tua thời gian một lượng delta giây
   */
  seekDelta(delta) {
    if (!this.audio.duration) return;
    const target = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + delta));
    this.audio.currentTime = target;
    AudioStorage.saveProgress(target);
  }

  /**
   * Kéo thanh scrubber
   */
  handleSeekInput() {
    if (this.audio.duration) {
      const targetTime = (this.progressBar.value / 100) * this.audio.duration;
      this.audio.currentTime = targetTime;
      AudioStorage.saveProgress(targetTime);
    }
  }

  /**
   * Cập nhật thời gian phát liên tục
   */
  handleTimeUpdate() {
    if (isNaN(this.audio.duration) || this.audio.duration <= 0) return;

    const current = this.audio.currentTime;
    const pct = (current / this.audio.duration) * 100;
    this.progressBar.value = pct;
    this.currentTimeEl.textContent = this.formatTime(current);

    // Lưu tiến trình định kỳ mỗi 1 giây
    if (Math.abs(current - this.lastSavedProgress) >= 1) {
      this.lastSavedProgress = current;
      AudioStorage.saveProgress(current);
    }
  }

  /**
   * Metadata của file audio đã sẵn sàng
   */
  handleLoadedMetadata() {
    this.totalDurationEl.textContent = this.formatTime(this.audio.duration);

    if (this.pendingResumeTime !== null && this.pendingResumeTime > 0 && this.pendingResumeTime < this.audio.duration) {
      this.audio.currentTime = this.pendingResumeTime;
      this.currentTimeEl.textContent = this.formatTime(this.pendingResumeTime);
      this.progressBar.value = (this.pendingResumeTime / this.audio.duration) * 100;
      this.showToast(`Đã khôi phục tại ${this.formatTime(this.pendingResumeTime)}`);
      this.pendingResumeTime = null;
    } else {
      this.currentTimeEl.textContent = '00:00';
      this.progressBar.value = 0;
    }
  }

  /**
   * Khi bài hát phát hết
   */
  handleEnded() {
    this.updatePlayState(false);
    this.progressBar.value = 0;
    this.currentTimeEl.textContent = '00:00';
    AudioStorage.saveProgress(0);
  }

  /**
   * Điều chỉnh tốc độ phát
   */
  setSpeed(speed, shouldSave = true) {
    this.currentSpeed = speed;
    this.audio.playbackRate = this.currentSpeed;
    this.audio.preservesPitch = true;
    this.speedDisplay.textContent = `${this.currentSpeed.toFixed(1)}x`;

    this.speedButtons.forEach(btn => {
      const btnSpeed = parseFloat(btn.dataset.speed);
      if (btnSpeed === this.currentSpeed) {
        btn.classList.add('active', 'bg-indigo-600', 'text-white', 'font-semibold');
        btn.classList.remove('bg-slate-800', 'text-slate-300', 'font-medium');
      } else {
        btn.classList.remove('active', 'bg-indigo-600', 'text-white', 'font-semibold');
        btn.classList.add('bg-slate-800', 'text-slate-300', 'font-medium');
      }
    });

    if (shouldSave) {
      AudioStorage.saveSpeed(this.currentSpeed);
    }
  }

  /**
   * Điều chỉnh âm lượng
   */
  handleVolumeChange(vol) {
    this.audio.volume = vol;
    AudioStorage.saveVolume(vol);
    this.updateVolumeIcon(vol);
  }

  updateVolumeIcon(vol) {
    if (vol == 0) {
      this.volumeIcon.textContent = '🔇';
    } else if (vol < 0.5) {
      this.volumeIcon.textContent = '🔉';
    } else {
      this.volumeIcon.textContent = '🔊';
    }
  }

  toggleMute() {
    if (this.audio.volume > 0) {
      this.audio.dataset.prevVol = this.audio.volume;
      this.audio.volume = 0;
      this.volumeBar.value = 0;
      this.volumeIcon.textContent = '🔇';
    } else {
      const restored = parseFloat(this.audio.dataset.prevVol || '0.85');
      this.audio.volume = restored;
      this.volumeBar.value = restored;
      this.updateVolumeIcon(restored);
    }
    AudioStorage.saveVolume(this.audio.volume);
  }

  /**
   * Tạo âm thanh demo
   */
  handleDemoClick() {
    const demoFile = AudioDemoSynth.createDemoFile('demo-ambient.wav', 8.0);
    this.handleFile(demoFile);
  }

  /**
   * Xóa toàn bộ dữ liệu lưu trữ
   */
  async handleClearClick() {
    this.audio.pause();
    this.audio.src = '';
    this.updatePlayState(false);

    await AudioStorage.clearAll();

    this.trackTitle.textContent = 'Chưa có bài hát';
    this.trackMeta.textContent = 'Sẵn sàng phát nhạc';
    this.progressBar.value = 0;
    this.currentTimeEl.textContent = '00:00';
    this.totalDurationEl.textContent = '00:00';
    this.clearBtn.classList.add('hidden');
    this.showToast('Đã xóa dữ liệu lưu!');
  }

  /**
   * Khôi phục cài đặt & file âm thanh đã lưu từ phiên trước
   */
  async restoreSession() {
    // 1. Khôi phục âm lượng
    const savedVol = AudioStorage.getVolume(0.85);
    this.audio.volume = savedVol;
    this.volumeBar.value = savedVol;
    this.updateVolumeIcon(savedVol);

    // 2. Khôi phục tốc độ
    const savedSpeed = AudioStorage.getSpeed(1.0);
    this.setSpeed(savedSpeed, false);

    // 3. Khôi phục bài hát & tiến trình nghe
    const savedBlob = await AudioStorage.getSavedAudioBlob();
    const meta = AudioStorage.getMetadata();
    const savedProgress = AudioStorage.getProgress();

    if (savedBlob && meta) {
      this.loadAudioSource(savedBlob, meta.name, meta.size, meta.type, savedProgress, false);
    }
  }

  /**
   * Hiển thị thông báo nhỏ Toast
   */
  showToast(message) {
    this.toastText.textContent = message;
    this.toast.classList.remove('opacity-0', '-translate-y-3');
    this.toast.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => {
      this.toast.classList.add('opacity-0', '-translate-y-3');
      this.toast.classList.remove('opacity-100', 'translate-y-0');
    }, 2500);
  }

  /**
   * Định dạng số giây sang mm:ss
   */
  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  }
}

// Khởi chạy ứng dụng khi DOM tải xong
window.addEventListener('DOMContentLoaded', () => {
  window.app = new AudioApp();
});
