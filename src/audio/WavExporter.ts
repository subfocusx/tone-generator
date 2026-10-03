import type { SweepType } from '../types';

/** Настройки экспорта WAV файла */
interface WavExporterOptions {
  duration: number;
  sampleRate?: number;
  bitDepth?: 16 | 24 | 32;
}

/** Данные голоса для экспорта (с индивидуальными настройками) */
interface VoiceData {
  isActive: boolean;
  volume: number;
  frequency: number;
  waveform: string;
  usePulse: boolean;
  pulseToneDuration: number;
  pulseGapDuration: number;
  pulseRandomize: boolean;
  useSweep: boolean;
  sweepStartFreq: number;
  sweepEndFreq: number;
  sweepDuration: number;
  sweepType: SweepType;
}

/**
 * WavExporter - класс для экспорта аудио в формате WAV
 * Использует OfflineAudioContext для рендеринга без воспроизведения
 */
export class WavExporter {
  /**
   * Экспортирует все активные каналы в WAV файл
   * @param voices - массив состояний каналов
   * @param masterVolume - общая громкость
   * @param options - настройки экспорта
   * @param onProgress - callback для отображения прогресса
   * @returns Promise с Blob WAV файла
   */
  async exportWav(
    voices: VoiceData[],
    masterVolume: number,
    options: WavExporterOptions,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const { duration, sampleRate = 44100, bitDepth = 16 } = options;

    // Создаем OfflineAudioContext для рендеринга без воспроизведения
    const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
    
    // Мастер громкость для всех каналов
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(offlineCtx.destination);

    // Получаем только активные каналы
    const activeVoices = voices.filter(v => v.isActive);

    // Создаем треки для каждого активного канала
    for (const voice of activeVoices) {
      if (voice.waveform === 'white-noise' || voice.waveform === 'pink-noise') {
        this.createNoiseTrack(offlineCtx, masterGain, voice, duration);
      } else {
        this.createOscillatorTrack(offlineCtx, masterGain, voice, duration);
      }
    }

    onProgress?.(10);

    // Рендерим аудио
    const renderedBuffer = await offlineCtx.startRendering();
    
    onProgress?.(50);

    // Конвертируем в WAV формат
    const wavBlob = this.bufferToWav(renderedBuffer, bitDepth, onProgress);
    
    return wavBlob;
  }

  /**
   * Создает трек с oscillator для экспорта
   */
  private createOscillatorTrack(
    ctx: OfflineAudioContext,
    masterGain: GainNode,
    voice: VoiceData,
    duration: number
  ): void {
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = voice.volume;
    voiceGain.connect(masterGain);

    if (voice.usePulse) {
      // Пульсирующий режим
      this.createPulsedOscillator(ctx, voiceGain, voice, duration);
    } else {
      // Непрерывный режим
      const osc = ctx.createOscillator();
      osc.type = voice.waveform as OscillatorType;
      
      if (voice.useSweep) {
        this.applySweepToOscillator(osc, voice, duration);
      } else {
        osc.frequency.value = voice.frequency;
      }
      
      osc.connect(voiceGain);
      osc.start();
      osc.stop(duration);
    }
  }

  /**
   * Создает пульсирующий oscillator с envelope
   */
  private createPulsedOscillator(
    ctx: OfflineAudioContext,
    voiceGain: GainNode,
    voice: VoiceData,
    totalDuration: number
  ): void {
    let currentTime = 0;
    const FADE_TIME = 0.01;
    const maxCycles = 1000;

    // Создаем циклы пульсации
    for (let cycle = 0; cycle < maxCycles && currentTime < totalDuration; cycle++) {
      let toneDuration = voice.pulseToneDuration / 1000;
      let gapDuration = (voice.pulseGapDuration * 3) / 1000; // Умножаем на 3

      // Рандомизация если включена
      if (voice.pulseRandomize) {
        toneDuration *= 0.5 + Math.random();
        gapDuration *= 0.5 + Math.random();
      }

      const cycleEnd = currentTime + toneDuration;
      
      if (cycleEnd <= totalDuration) {
        const osc = ctx.createOscillator();
        osc.type = voice.waveform as OscillatorType;
        osc.frequency.value = voice.frequency;

        // SWEEP если включен
        if (voice.useSweep) {
          this.applySweepToOscillator(osc, { ...voice, sweepDuration: toneDuration }, toneDuration);
        }

        // Envelope для fade-in/fade-out
        const envelope = ctx.createGain();
        envelope.gain.setValueAtTime(0, currentTime);
        envelope.gain.linearRampToValueAtTime(voice.volume, currentTime + FADE_TIME);
        envelope.gain.setValueAtTime(voice.volume, cycleEnd - FADE_TIME);
        envelope.gain.linearRampToValueAtTime(0, cycleEnd);

        osc.connect(envelope);
        envelope.connect(voiceGain);
        osc.start(currentTime);
        osc.stop(cycleEnd + 0.001);
      }

      currentTime = cycleEnd + gapDuration;
    }
  }

  /**
   * Создает трек с шумом для экспорта
   */
  private createNoiseTrack(
    ctx: OfflineAudioContext,
    masterGain: GainNode,
    voice: VoiceData,
    duration: number
  ): void {
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = voice.volume;
    voiceGain.connect(masterGain);

    // Генерируем буфер шума
    const bufferSize = Math.ceil(ctx.sampleRate * (duration + 1));
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        
        if (voice.waveform === 'pink-noise') {
          // Розовый шум (алгоритм Восса-Маккартни)
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        } else {
          // Белый шум
          data[i] = white;
        }
      }
    }
    
    if (voice.usePulse) {
      // Пульсирующий режим для шума
      let currentTime = 0;
      const FADE_TIME = 0.01;
      const maxCycles = 1000;

      for (let cycle = 0; cycle < maxCycles && currentTime < duration; cycle++) {
        let toneDuration = voice.pulseToneDuration / 1000;
        let gapDuration = (voice.pulseGapDuration * 3) / 1000;

        if (voice.pulseRandomize) {
          toneDuration *= 0.5 + Math.random();
          gapDuration *= 0.5 + Math.random();
        }

        const cycleEnd = currentTime + toneDuration;

        if (cycleEnd <= duration) {
          const noise = ctx.createBufferSource();
          noise.buffer = buffer;

          const envelope = ctx.createGain();
          envelope.gain.setValueAtTime(0, currentTime);
          envelope.gain.linearRampToValueAtTime(voice.volume, currentTime + FADE_TIME);
          envelope.gain.setValueAtTime(voice.volume, cycleEnd - FADE_TIME);
          envelope.gain.linearRampToValueAtTime(0, cycleEnd);

          noise.connect(envelope);
          envelope.connect(voiceGain);
          noise.start(currentTime);
          noise.stop(cycleEnd + 0.001);
        }

        currentTime = cycleEnd + gapDuration;
      }
    } else {
      // Непрерывный шум
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      noise.connect(voiceGain);
      noise.start();
      noise.stop(duration);
    }
  }

  /**
   * Применяет свип к oscillator
   */
  private applySweepToOscillator(
    osc: OscillatorNode,
    voice: VoiceData,
    duration?: number
  ): void {
    const sweepDuration = duration || voice.sweepDuration;
    
    if (voice.sweepType === 'logarithmic') {
      osc.frequency.setValueAtTime(voice.sweepStartFreq, osc.context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(voice.sweepEndFreq, 1),
        osc.context.currentTime + sweepDuration
      );
    } else {
      osc.frequency.setValueAtTime(voice.sweepStartFreq, osc.context.currentTime);
      osc.frequency.linearRampToValueAtTime(
        voice.sweepEndFreq,
        osc.context.currentTime + sweepDuration
      );
    }
  }

  /**
   * Конвертирует AudioBuffer в WAV файл
   */
  private bufferToWav(
    buffer: AudioBuffer,
    bitDepth: number,
    onProgress?: (progress: number) => void
  ): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = bitDepth === 16 ? 1 : bitDepth === 24 ? 1 : 3;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;

    // Создаем ArrayBuffer для WAV файла
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // Функция записи строки в буфер
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    
    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    
    // data chunk
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    // Получаем данные каналов
    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    // Записываем аудио данные
    let offset = 44;
    const maxProgress = 50;
    const progressStep = maxProgress / buffer.length;

    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        // Нормализуем значение в диапазон [-1, 1]
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));

        if (bitDepth === 16) {
          const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          view.setInt16(offset, intSample, true);
        } else if (bitDepth === 24) {
          const intSample = sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF;
          view.setUint8(offset, intSample & 0xFF);
          view.setUint8(offset + 1, (intSample >> 8) & 0xFF);
          view.setUint8(offset + 2, (intSample >> 16) & 0xFF);
        } else {
          view.setFloat32(offset, sample, true);
        }

        offset += bytesPerSample;
      }

      // Обновляем прогресс каждые 10000 сэмплов
      if (i % 10000 === 0) {
        onProgress?.(50 + i * progressStep);
      }
    }

    onProgress?.(100);

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Скачивает Blob как файл
   */
  downloadBlob(blob: Blob, filename: string = 'tone-generator.wav'): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Синглтон экземпляр
export const wavExporter = new WavExporter();