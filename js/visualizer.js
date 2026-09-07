/**
 * visualizer.js - Quản lý vẽ sóng âm thanh trên Canvas
 * - Vẽ dải sóng phẳng khi dừng (idle)
 * - Tạo hiệu ứng sóng hoạt họa động mượt mà khi phát nhạc (start/stop)
 */

class AudioVisualizer {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.barCount = options.barCount || 42;
    this.activeColor = options.activeColor || '#4f46e5';
    this.idleColor = options.idleColor || '#cbd5e1';
    this.animId = null;
    this.drawIdle();
  }

  /**
   * Cập nhật màu sóng khi đổi giao diện Sáng / Tối
   */
  updateColors(activeColor, idleColor) {
    this.activeColor = activeColor;
    this.idleColor = idleColor;
    if (!this.animId) {
      this.drawIdle();
    }
  }

  /**
   * Vẽ sóng âm tĩnh ở trạng thái tạm dừng
   */
  drawIdle() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const barWidth = this.canvas.width / this.barCount - 2;
    const height = 4;

    for (let i = 0; i < this.barCount; i++) {
      this.ctx.fillStyle = this.idleColor;
      this.ctx.fillRect(i * (barWidth + 2), (this.canvas.height - height) / 2, barWidth, height);
    }
  }

  /**
   * Bắt đầu vòng lặp vẽ sóng âm khi phát nhạc
   */
  start() {
    if (!this.ctx) return;
    if (this.animId) cancelAnimationFrame(this.animId);

    const render = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const barWidth = this.canvas.width / this.barCount - 2;
      const time = Date.now() / 150;

      for (let i = 0; i < this.barCount; i++) {
        const wave = Math.sin(time + i * 0.35) * 0.5 + 0.5;
        const height = Math.max(4, wave * (this.canvas.height - 4));
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fillRect(i * (barWidth + 2), (canvasHeight = this.canvas.height - height) / 2, barWidth, height);
      }

      this.animId = requestAnimationFrame(render);
    };

    render();
  }

  /**
   * Dừng vẽ sóng âm và đưa về trạng thái tĩnh
   */
  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.drawIdle();
  }
}

window.AudioVisualizer = AudioVisualizer;
