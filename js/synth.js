/**
 * synth.js - Bộ tổng hợp âm thanh thử nghiệm (Web Audio Synthesizer)
 * - Tự động tạo đoạn nhạc ambient nhẹ nhàng không cần tải file ngoài
 * - Mã hóa mảng mẫu âm thanh (Float32Array) thành file WAV 16-bit PCM chuẩn
 */

const AudioDemoSynth = {
  /**
   * Tạo file âm thanh WAV thử nghiệm
   * @param {string} filename 
   * @param {number} duration Thời lượng tính theo giây
   * @returns {File}
   */
  createDemoFile(filename = 'demo-ambient.wav', duration = 8.0) {
    const sampleRate = 22050;
    const totalSamples = sampleRate * duration;
    const buffer = new Float32Array(totalSamples);
    
    // Thang âm ngũ cung thư giãn (C4, D4, E4, G4, A4, C5)
    const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const noteIdx = Math.floor(t * 3) % notes.length;
      const freq = notes[noteIdx];
      const env = Math.exp(-3 * ((t * 3) % 1));
      buffer[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.4;
    }

    const wavBytes = this.encodeWav(buffer, sampleRate);
    const blob = new Blob([wavBytes], { type: 'audio/wav' });
    return new File([blob], filename, { type: 'audio/wav' });
  },

  /**
   * Đóng gói mảng mẫu âm thanh thành chuẩn cấu trúc WAV header
   */
  encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // RIFF Chunk Descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');

    // "fmt " Sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);          // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);           // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true);           // NumChannels (1 = Mono)
    view.setUint32(24, sampleRate, true);  // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 2, true);           // BlockAlign
    view.setUint16(34, 16, true);          // BitsPerSample (16 bits)

    // "data" Sub-chunk
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return buffer;
  }
};

window.AudioDemoSynth = AudioDemoSynth;
