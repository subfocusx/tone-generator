import type { WaveformType, SweepType } from '../types';

/**
 * Voice - класс отдельного канала (генератора)
 * Управляет одним или двумя источниками звука: oscillator или noise
 * 
 * Логика режимов:
 * - PULSE и SWEEP взаимоисключающие (можно включить только один)
 * - Ping-Pong и Loop взаимоисключающие (в режиме SWEEP один всегда включён)
 * - Smart Module (5-й канал): два осциллятора для Beats (интерференция)
 * - Chaos Mode ("Безумный ремонт"): случайный gap, Triple-Tap Burst
 */
export class Voice {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private voiceGain: GainNode;
  private oscillator: OscillatorNode | null = null;
  private oscillator2: OscillatorNode | null = null; // Второй осциллятор для Beats
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private noiseGenerator: import('./NoiseGenerator').NoiseGenerator;

  private isPlaying: boolean = false;
  
  // Таймеры для PULSE режима
  private pulseTimeoutId: number | null = null;
  
  // Таймеры для непрерывного SWEEP
  private sweepTimeoutId: number | null = null;

  // Параметры канала
  private volume: number = 0.5;
  private frequency: number = 440;
  private waveform: WaveformType = 'sine';

  // Индивидуальные настройки PULSE
  private usePulse: boolean = false;
  private pulseToneDuration: number = 100;
  private pulseGapDuration: number = 200;
  private pulseRandomize: boolean = false;
  private pulseFadeOutDuration: number = 30;

  // Chaos Mode ("Безумный ремонт") - случайный gap, Triple-Tap Burst
  private pulseChaos: boolean = false;

  // Индивидуальные настройки SWEEP
  private useSweep: boolean = false;
  private sweepStartFreq: number = 100;
  private sweepEndFreq: number = 2000;
  private sweepDuration: number = 1;
  private sweepType: SweepType = 'linear';
  private sweepLoop: boolean = true;        // Loop или Ping-Pong всегда включен
  private sweepPingPong: boolean = false;     // Взаимоисключающие с Loop

  // Умный модуль (5-й канал) - Beats (Интерференция)
  private isSmartModule: boolean = false;
  private beatEnabled: boolean = false;
  private beatOffset: number = 1; // Hz

  // Drift Mode (плавающее биение)
  private driftEnabled: boolean = false;
  private driftSpeed: number = 0.1;
  private driftDepth: number = 1.0;
  private lfoOsc: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  // Frequency Hopping (прыгающий резонанс)
  private hopEnabled: boolean = false;
  private hopInterval: number = 300;
  private hopTimeoutId: number | null = null;

  // Время fade-in/fade-out (10мс)
  private readonly FADE_TIME = 0.01;
  
  // Chaos Mode параметры
  private readonly CHAOS_GAP_MIN_MULT = 0.5; // 50% от базового gap
  private readonly CHAOS_GAP_MAX_MULT = 2.0; // 200% от базового gap
  private readonly BURST_CHANCE = 0.1; // 10% шанс Triple-Tap Burst
  private readonly BURST_COUNT = 3; // количество импульсов в burst

  constructor(
    audioContext: AudioContext,
    masterGain: GainNode,
    noiseGenerator: import('./NoiseGenerator').NoiseGenerator
  ) {
    this.audioContext = audioContext;
    this.masterGain = masterGain;
    this.noiseGenerator = noiseGenerator;

    this.voiceGain = this.audioContext.createGain();
    this.voiceGain.gain.value = 0;
    this.voiceGain.connect(this.masterGain);
  }

  // ===== БАЗОВЫЕ ПАРАМЕТРЫ =====

  setVolume(volume: number) {
    this.volume = volume;
    if (this.isPlaying) {
      this.voiceGain.gain.setTargetAtTime(volume, this.audioContext.currentTime, this.FADE_TIME);
    }
  }

  setFrequency(frequency: number) {
    this.frequency = frequency;
    if (this.oscillator && this.isPlaying && !this.useSweep) {
      this.oscillator.frequency.setTargetAtTime(frequency, this.audioContext.currentTime, this.FADE_TIME);
      // Обновляем частоту второго осциллятора (Beats)
      if (this.oscillator2) {
        this.oscillator2.frequency.setTargetAtTime(frequency + this.beatOffset, this.audioContext.currentTime, this.FADE_TIME);
      }
    }
  }

  setWaveform(waveform: WaveformType) {
    this.waveform = waveform;
    if (this.isPlaying && !this.usePulse && !this.useSweep) {
      // Заменяем осцилляторы напрямую без stop/start
      this.replaceOscillators();
    } else if (this.isPlaying && this.useSweep) {
      // Для SWEEP режима нужен полный перезапуск
      this.stop();
      this.start();
    }
  }

  /**
   * Заменяет осцилляторы напрямую во время воспроизведения
   */
  private replaceOscillators() {
    // Останавливаем и удаляем старые осцилляторы
    if (this.oscillator) {
      try { this.oscillator.stop(); } catch { /* oscillator already stopped */ }
      this.oscillator.disconnect();
    }
    if (this.oscillator2) {
      try { this.oscillator2.stop(); } catch { /* oscillator already stopped */ }
      this.oscillator2.disconnect();
    }
    if (this.noiseSource) {
      try { this.noiseSource.stop(); } catch { /* noise source already stopped */ }
      this.noiseSource.disconnect();
      this.noiseSource = null;
    }

    // Создаём новые осцилляторы
    if (this.waveform === 'white-noise' || this.waveform === 'pink-noise') {
      this.startNoiseSource();
    } else {
      this.startOscillatorSource();
    }
  }

  // ===== PULSE (взаимоисключающий с SWEEP) =====

  /**
   * Включает/выключает PULSE
   * При включении PULSE автоматически выключает SWEEP
   */
  setPulseEnabled(enabled: boolean) {
    if (enabled) {
      this.usePulse = true;
      this.useSweep = false; // Выключаем SWEEP
    } else {
      this.usePulse = false;
    }
    if (this.isPlaying) {
      this.stop();
      this.start();
    }
  }

  setPulseToneDuration(duration: number) {
    this.pulseToneDuration = duration;
  }

  setPulseGapDuration(duration: number) {
    this.pulseGapDuration = duration;
  }

  setPulseRandomize(randomize: boolean) {
    this.pulseRandomize = randomize;
  }

  setPulseFadeOutDuration(duration: number) {
    this.pulseFadeOutDuration = Math.max(5, Math.min(500, duration));
  }

  // ===== CHAOS MODE ("Безумный ремонт") =====

  /**
   * Включает/выключает Chaos Mode
   * Хаотичный режим: случайный gap, Triple-Tap Burst
   */
  setPulseChaos(enabled: boolean) {
    this.pulseChaos = enabled;
  }

  // ===== SWEEP (взаимоисключающий с PULSE) =====

  /**
   * Включает/выключает SWEEP
   * При включении SWEEP автоматически выключает PULSE
   */
  setSweepEnabled(enabled: boolean) {
    if (enabled) {
      this.useSweep = true;
      this.usePulse = false; // Выключаем PULSE
    } else {
      this.useSweep = false;
    }
    if (this.isPlaying) {
      this.stop();
      this.start();
    }
  }

  setSweepStartFreq(freq: number) {
    this.sweepStartFreq = freq;
    if (this.useSweep && this.oscillator && this.isPlaying) {
      this.oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    }
  }

  setSweepEndFreq(freq: number) {
    this.sweepEndFreq = freq;
  }

  setSweepDuration(duration: number) {
    this.sweepDuration = duration;
  }

  setSweepType(type: SweepType) {
    this.sweepType = type;
  }

  /**
   * Включает/выключает Loop
   * Loop и Ping-Pong взаимоисключающие - включая Loop выключаем Ping-Pong
   */
  setSweepLoop(enabled: boolean) {
    if (enabled) {
      this.sweepLoop = true;
      this.sweepPingPong = false; // Выключаем Ping-Pong
    } else {
      this.sweepLoop = false;
      this.sweepPingPong = true; // Включаем Ping-Pong
    }
  }

  /**
   * Включает/выключает Ping-Pong
   * Ping-Pong и Loop взаимоисключающие - включая Ping-Pong выключаем Loop
   */
  setSweepPingPong(enabled: boolean) {
    if (enabled) {
      this.sweepPingPong = true;
      this.sweepLoop = false; // Выключаем Loop
    } else {
      this.sweepPingPong = false;
      this.sweepLoop = true; // Включаем Loop
    }
  }

  // ===== SMART MODULE - BEATS (Интерференция) =====

  /**
   * Включает/выключает Smart Module (Beats)
   */
  setIsSmartModule(isSmartModule: boolean) {
    this.isSmartModule = isSmartModule;
    if (this.isPlaying) {
      this.stop();
      this.start();
    }
  }

  /**
   * Включает/выключает Beats (интерференция)
   */
  setBeatEnabled(enabled: boolean) {
    const wasPlaying = this.isPlaying;
    this.beatEnabled = enabled;
    if (wasPlaying) {
      this.stop();
      this.isPlaying = true;
      this.start();
    }
  }

  /**
   * Устанавливает смещение частоты для Beats (0.1 - 20 Hz)
   */
  setBeatOffset(offset: number) {
    this.beatOffset = Math.max(0.1, Math.min(20, offset));
    // Обновляем частоту второго осциллятора на лету если он играет
    if (this.oscillator2 && this.isPlaying) {
      const freq2 = this.frequency + this.beatOffset;
      this.oscillator2.frequency.setValueAtTime(freq2, this.audioContext.currentTime);
    }
  }

  // ===== DRIFT MODE (плавающее биение) =====

  setDriftEnabled(enabled: boolean) {
    this.driftEnabled = enabled;
    if (this.isPlaying) {
      this.updateDriftModulation();
    }
  }

  setDriftSpeed(speed: number) {
    this.driftSpeed = Math.max(0.01, Math.min(1.0, speed));
    if (this.lfoOsc && this.isPlaying) {
      this.lfoOsc.frequency.setValueAtTime(this.driftSpeed, this.audioContext.currentTime);
    }
  }

  setDriftDepth(depth: number) {
    this.driftDepth = Math.max(0.1, Math.min(5.0, depth));
    if (this.lfoGain && this.isPlaying) {
      this.lfoGain.gain.setValueAtTime(this.driftDepth, this.audioContext.currentTime);
    }
  }

  /**
   * Обновляет LFO модуляцию для Drift Mode
   */
  private updateDriftModulation() {
    if (!this.driftEnabled || !this.oscillator2) {
      if (this.lfoOsc) {
        try { this.lfoOsc.stop(); } catch { /* oscillator already stopped */ }
        this.lfoOsc.disconnect();
        this.lfoOsc = null;
      }
      if (this.lfoGain) {
        this.lfoGain.disconnect();
        this.lfoGain = null;
      }
      return;
    }

    // Создаем LFO осциллятор если его нет
    if (!this.lfoOsc) {
      this.lfoOsc = this.audioContext.createOscillator();
      this.lfoOsc.type = 'sine';
      this.lfoOsc.frequency.value = this.driftSpeed;

      this.lfoGain = this.audioContext.createGain();
      this.lfoGain.gain.value = this.driftDepth;

      // LFO -> LFO Gain -> oscillator2.frequency
      this.lfoOsc.connect(this.lfoGain);
      this.lfoGain.connect(this.oscillator2.frequency);
      this.lfoOsc.start();
    }
  }

  // ===== FREQUENCY HOPPING (прыгающий резонанс) =====

  setHopEnabled(enabled: boolean) {
    this.hopEnabled = enabled;
    if (this.isPlaying) {
      if (enabled) {
        this.startHopping();
      } else {
        this.stopHopping();
      }
    }
  }

  setHopInterval(interval: number) {
    this.hopInterval = Math.max(10, Math.min(1800, interval));
    // Перезапустить hopping с новым интервалом если уже запущен
    if (this.hopEnabled && this.isPlaying) {
      this.stopHopping();
      this.startHopping();
    }
  }

  /**
   * Запускает Frequency Hopping
   */
  private startHopping() {
    if (!this.hopEnabled) return;
    this.scheduleHopFrequency();
  }

  /**
   * Планирует следующую смену частоты
   */
  private scheduleHopFrequency() {
    if (!this.isPlaying || !this.hopEnabled) return;

    const newFrequency = this.frequency * (0.9 + Math.random() * 0.2);
    const clampedFreq = Math.max(1, Math.min(22000, newFrequency));

    if (this.oscillator) {
      this.oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(clampedFreq, 1),
        this.audioContext.currentTime + 2
      );
    }
    if (this.oscillator2) {
      this.oscillator2.frequency.exponentialRampToValueAtTime(
        Math.max(clampedFreq + this.beatOffset, 1),
        this.audioContext.currentTime + 2
      );
    }

    // Планируем следующий hop
    this.hopTimeoutId = window.setTimeout(() => {
      this.scheduleHopFrequency();
    }, this.hopInterval * 1000);
  }

  /**
   * Останавливает Frequency Hopping
   */
  private stopHopping() {
    if (this.hopTimeoutId !== null) {
      clearTimeout(this.hopTimeoutId);
      this.hopTimeoutId = null;
    }
  }

  // ===== PLAY/STOP =====

  private cancelScheduledGain(): void {
    try {
      this.voiceGain.gain.cancelScheduledValues(this.audioContext.currentTime);
    } catch { /* gain node already detached */ }
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Отменяем все запланированные изменения gain
    this.cancelScheduledGain();
    // Сбрасываем gain на 0 и устанавливаем плавное нарастание
    const now = this.audioContext.currentTime;
    this.voiceGain.gain.setValueAtTime(0, now);
    this.voiceGain.gain.linearRampToValueAtTime(this.volume, now + this.FADE_TIME);

    if (this.usePulse) {
      this.startPulseMode();
    } else {
      this.startContinuousMode();
    }
  }

  stop() {
    this.isPlaying = false;
    
    // Отменяем запланированные изменения
    this.cancelScheduledGain();
    
    // Останавливаем Frequency Hopping
    this.stopHopping();

    // Останавливаем LFO
    if (this.lfoOsc) {
      try { this.lfoOsc.stop(); } catch { /* oscillator already stopped */ }
      this.lfoOsc.disconnect();
      this.lfoOsc = null;
    }
    if (this.lfoGain) {
      this.lfoGain.disconnect();
      this.lfoGain = null;
    }

    // Останавливаем все источники звука немедленно
    if (this.oscillator) {
      try { this.oscillator.stop(); } catch { /* oscillator already stopped */ }
      this.oscillator.disconnect();
      this.oscillator = null;
    }
    if (this.oscillator2) {
      try { this.oscillator2.stop(); } catch { /* oscillator already stopped */ }
      this.oscillator2.disconnect();
      this.oscillator2 = null;
    }
    if (this.noiseSource) {
      try { this.noiseSource.stop(); } catch { /* noise source already stopped */ }
      this.noiseSource.disconnect();
      this.noiseSource = null;
    }
    
    // Сбрасываем gain на 0
    this.voiceGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    
    this.stopPulseMode();
    this.stopContinuousMode();
  }

  // ===== PRIVATE METHODS =====

  private startContinuousMode() {
    const startTime = this.audioContext.currentTime;
    
    // Отменяем запланированные изменения и устанавливаем новые
    this.cancelScheduledGain();
    this.voiceGain.gain.setValueAtTime(0, startTime);
    this.voiceGain.gain.linearRampToValueAtTime(this.volume, startTime + this.FADE_TIME);

    if (this.waveform === 'white-noise' || this.waveform === 'pink-noise') {
      this.startNoiseSource();
    } else {
      this.startOscillatorSource();
    }

    if (this.useSweep) {
      this.startSweepLoop();
    }

    // Запускаем Frequency Hopping если включен
    if (this.hopEnabled) {
      this.startHopping();
    }
  }

  private stopContinuousMode() {
    this.stopSweepLoop();
  }

  private startOscillatorSource() {
    // Осциллятор 1 (Carrier) - базовая частота
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = this.waveform as OscillatorType;
    this.oscillator.frequency.value = this.useSweep ? this.sweepStartFreq : this.frequency;
    this.oscillator.connect(this.voiceGain);
    this.oscillator.start();

    // Осциллятор 2 (Beat) - базовая частота + offset
    if (this.beatEnabled) {
      this.oscillator2 = this.audioContext.createOscillator();
      this.oscillator2.type = this.waveform as OscillatorType;
      const freq2 = this.frequency + this.beatOffset;
      this.oscillator2.frequency.value = freq2;
      this.oscillator2.connect(this.voiceGain);
      this.oscillator2.start();

      // Drift Mode: подключаем LFO модуляцию
      if (this.driftEnabled) {
        this.lfoOsc = this.audioContext.createOscillator();
        this.lfoOsc.type = 'sine';
        this.lfoOsc.frequency.value = this.driftSpeed;

        this.lfoGain = this.audioContext.createGain();
        this.lfoGain.gain.value = this.driftDepth;

        this.lfoOsc.connect(this.lfoGain);
        this.lfoGain.connect(this.oscillator2.frequency);
        this.lfoOsc.start();
      }
    }
  }

  private startNoiseSource() {
    this.noiseBuffer = this.noiseGenerator.createNoiseBuffer(
      this.waveform as 'white-noise' | 'pink-noise'
    );
    this.noiseSource = this.audioContext.createBufferSource();
    this.noiseSource.buffer = this.noiseBuffer;
    this.noiseSource.loop = true;
    this.noiseSource.connect(this.voiceGain);
    this.noiseSource.start();
  }

  private startSweepLoop() {
    if (!this.oscillator) return;

    const applySweepIteration = () => {
      if (!this.isPlaying || this.usePulse || !this.useSweep || !this.oscillator) return;

      const startTime = this.audioContext.currentTime;
      const duration = this.sweepDuration;
      const startFreq = this.sweepStartFreq;
      const endFreq = this.sweepEndFreq;

      if (this.sweepPingPong) {
        // Ping-Pong: старт → конец → старт
        if (this.sweepType === 'logarithmic') {
          this.oscillator.frequency.setValueAtTime(startFreq, startTime);
          this.oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(endFreq, 1),
            startTime + duration / 2
          );
          this.oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(startFreq, 1),
            startTime + duration
          );
        } else {
          this.oscillator.frequency.setValueAtTime(startFreq, startTime);
          this.oscillator.frequency.linearRampToValueAtTime(endFreq, startTime + duration / 2);
          this.oscillator.frequency.linearRampToValueAtTime(startFreq, startTime + duration);
        }
      } else {
        // Loop: старт → конец
        if (this.sweepType === 'logarithmic') {
          this.oscillator.frequency.setValueAtTime(startFreq, startTime);
          this.oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(endFreq, 1),
            startTime + duration
          );
        } else {
          this.oscillator.frequency.setValueAtTime(startFreq, startTime);
          this.oscillator.frequency.linearRampToValueAtTime(endFreq, startTime + duration);
        }
      }

      // Loop всегда запланирован (Ping-Pong или Loop один всегда включён)
      this.sweepTimeoutId = window.setTimeout(applySweepIteration, duration * 1000);
    };

    applySweepIteration();
  }

  private stopSweepLoop() {
    if (this.sweepTimeoutId !== null) {
      clearTimeout(this.sweepTimeoutId);
      this.sweepTimeoutId = null;
    }
  }

  // ===== PULSE MODE =====

  private startPulseMode() {
    this.scheduleNextPulse();
  }

  /**
   * Планирует следующий импульс с учётом Chaos Mode
   */
  private scheduleNextPulse() {
    if (!this.isPlaying || !this.usePulse) return;

    const currentFrequency = this.frequency;
    const toneDuration = this.pulseToneDuration;
    let gapDuration: number;

    const baseGap = this.pulseGapDuration * 3;
    
    if (this.pulseChaos) {
      // Chaos Mode: случайный gap (50% - 200% от базового)
      const chaosMult = this.CHAOS_GAP_MIN_MULT + Math.random() * (this.CHAOS_GAP_MAX_MULT - this.CHAOS_GAP_MIN_MULT);
      gapDuration = baseGap * chaosMult;
      
      // 10% шанс Triple-Tap Burst
      if (Math.random() < this.BURST_CHANCE) {
        this.scheduleTripleTapBurst(currentFrequency);
        return;
      }
    } else {
      gapDuration = baseGap;
    }

    const now = this.audioContext.currentTime;
    const toneDurationMs = toneDuration;

    this.startPulseTone(now, currentFrequency);

    this.pulseTimeoutId = window.setTimeout(() => {
      if (!this.isPlaying || !this.usePulse) return;
      
      this.stopPulseTone();
      
      this.pulseTimeoutId = window.setTimeout(() => {
        this.scheduleNextPulse();
      }, gapDuration);
      
    }, Math.max(toneDurationMs - 10, 1));
  }

  /**
   * Triple-Tap Burst: 3 быстрых импульса подряд (для Chaos Mode)
   */
  private scheduleTripleTapBurst(frequency: number) {
    const burstToneDuration = 30; // 30ms между импульсами
    const burstGap = 50; // 50ms между импульсами в burst
    const burstPause = 500; // пауза после burst
    let burstIndex = 0;

    const playBurstPulse = () => {
      if (!this.isPlaying || !this.usePulse || burstIndex >= this.BURST_COUNT) {
        // После burst возвращаемся к обычному расписанию
        this.pulseTimeoutId = window.setTimeout(() => {
          this.scheduleNextPulse();
        }, burstPause);
        return;
      }

      this.startPulseTone(this.audioContext.currentTime, frequency);
      burstIndex++;

      this.pulseTimeoutId = window.setTimeout(() => {
        if (!this.isPlaying || !this.usePulse) return;
        this.stopPulseTone();
        this.pulseTimeoutId = window.setTimeout(playBurstPulse, burstGap);
      }, burstToneDuration - 10);
    };

    playBurstPulse();
  }

  /**
   * Запускает одиночный импульс тона
   */
  private startPulseTone(startTime: number, frequency: number) {
    this.voiceGain.gain.setValueAtTime(0, startTime);
    this.voiceGain.gain.linearRampToValueAtTime(this.volume, startTime + this.FADE_TIME);

    if (this.waveform === 'white-noise' || this.waveform === 'pink-noise') {
      this.startNoiseSource();
    } else {
      // Осциллятор 1 (Carrier)
      this.oscillator = this.audioContext.createOscillator();
      this.oscillator.type = this.waveform as OscillatorType;
      this.oscillator.frequency.value = frequency;
      this.oscillator.connect(this.voiceGain);
      this.oscillator.start();

      // Осциллятор 2 (Beat) - если Beats включен
      if (this.beatEnabled) {
        this.oscillator2 = this.audioContext.createOscillator();
        this.oscillator2.type = this.waveform as OscillatorType;
        this.oscillator2.frequency.value = frequency + this.beatOffset;
        this.oscillator2.connect(this.voiceGain);
        this.oscillator2.start();
      }
    }
  }

  /**
   * Останавливает импульс тона
   */
  private stopPulseTone() {
    const stopTime = this.audioContext.currentTime;
    const fadeOutSec = this.pulseFadeOutDuration / 1000;
    
    this.voiceGain.gain.setValueAtTime(this.voiceGain.gain.value, stopTime);
    this.voiceGain.gain.exponentialRampToValueAtTime(0.001, stopTime + fadeOutSec);

    setTimeout(() => {
      this.cleanupOscillators();
    }, this.pulseFadeOutDuration + 10);
  }

  /**
   * Очищает осцилляторы и noise source
   */
  private cleanupOscillators() {
    if (this.oscillator) {
      try { this.oscillator.stop(); } catch { /* oscillator already stopped */ }
      this.oscillator.disconnect();
      this.oscillator = null;
    }
    if (this.oscillator2) {
      try { this.oscillator2.stop(); } catch { /* oscillator already stopped */ }
      this.oscillator2.disconnect();
      this.oscillator2 = null;
    }
    if (this.noiseSource) {
      try { this.noiseSource.stop(); } catch { /* noise source already stopped */ }
      this.noiseSource.disconnect();
      this.noiseSource = null;
    }
  }

  private stopPulseMode() {
    if (this.pulseTimeoutId !== null) {
      clearTimeout(this.pulseTimeoutId);
      this.pulseTimeoutId = null;
    }
    this.stopPulseTone();
  }

  // ===== CLEANUP =====

  dispose() {
    this.stop();
    this.voiceGain.disconnect();
  }

  // ===== GETTERS =====

  getIsPlaying(): boolean { return this.isPlaying; }
  getUsePulse(): boolean { return this.usePulse; }
  getUseSweep(): boolean { return this.useSweep; }
  getPulseToneDuration(): number { return this.pulseToneDuration; }
  getPulseGapDuration(): number { return this.pulseGapDuration; }
  getPulseRandomize(): boolean { return this.pulseRandomize; }
  getPulseFadeOutDuration(): number { return this.pulseFadeOutDuration; }
  getSweepStartFreq(): number { return this.sweepStartFreq; }
  getSweepEndFreq(): number { return this.sweepEndFreq; }
  getSweepDuration(): number { return this.sweepDuration; }
  getSweepType(): SweepType { return this.sweepType; }
  getSweepLoop(): boolean { return this.sweepLoop; }
  getSweepPingPong(): boolean { return this.sweepPingPong; }
  getFrequency(): number { return this.frequency; }
  getVolume(): number { return this.volume; }
  
  // Chaos Mode getters
  getPulseChaos(): boolean { return this.pulseChaos; }
  
  // Smart Module - Beats getters
  getIsSmartModule(): boolean { return this.isSmartModule; }
  getBeatEnabled(): boolean { return this.beatEnabled; }
  getBeatOffset(): number { return this.beatOffset; }

  // Drift Mode getters
  getDriftEnabled(): boolean { return this.driftEnabled; }
  getDriftSpeed(): number { return this.driftSpeed; }
  getDriftDepth(): number { return this.driftDepth; }

  // Frequency Hopping getters
  getHopEnabled(): boolean { return this.hopEnabled; }
  getHopInterval(): number { return this.hopInterval; }
}
