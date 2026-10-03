import type { VoiceState } from '../types';
import { Voice } from './Voice';
import { NoiseGenerator } from './NoiseGenerator';

/** MediaDevices с нестандартным Chrome-методом выбора устройства вывода */
type MediaDevicesWithOutputSelection = MediaDevices & {
  selectAudioOutput?: () => Promise<MediaDeviceInfo>;
};

/** AudioDestinationNode с нестандартным методом переключения sink-устройства */
type AudioDestinationWithSinkId = AudioDestinationNode & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

/**
 * AudioEngine - основной класс управления аудио-движком
 * Отвечает за инициализацию AudioContext, управление голосами и устройствами вывода
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private voices: Map<number, Voice> = new Map();
  private noiseGenerator: NoiseGenerator | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;

  /**
   * Инициализирует AudioContext и создает голоса (4 канала)
   */
  async initialize(): Promise<MediaDeviceInfo[]> {
    this.audioContext = new AudioContext();
    
    // Принудительно возобновляем контекст (Chrome требует пользовательского взаимодействия)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.8;

    // Safety Layer: Compressor + Highpass Filter
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.highpassFilter = this.audioContext.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.value = 25;
    this.highpassFilter.Q.value = 0.707;

    // Chain: voiceGain -> compressor -> highpass -> masterGain -> destination
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.highpassFilter);
    this.highpassFilter.connect(this.audioContext.destination);

    this.noiseGenerator = new NoiseGenerator(this.audioContext);

    // Создаем 5 каналов (4 обычных + 1 Smart Module)
    for (let i = 0; i < 5; i++) {
      this.createVoice(i);
    }

    // Получаем устройства с таймаутом 3 секунды
    const devices = await Promise.race([
      this.getOutputDevices(),
      new Promise<MediaDeviceInfo[]>(resolve => setTimeout(() => resolve([]), 3000))
    ]);
    return devices;
  }

  /**
   * Создает голос (Voice) для указанного ID канала
   */
  private createVoice(id: number): Voice {
    if (!this.audioContext || !this.masterGain || !this.noiseGenerator) {
      throw new Error('AudioEngine not initialized');
    }

    const voice = new Voice(this.audioContext, this.masterGain, this.noiseGenerator);
    this.voices.set(id, voice);
    return voice;
  }

  /**
   * Получает список устройств вывода звука
   */
  async getOutputDevices(): Promise<MediaDeviceInfo[]> {
    try {
      // Проверяем доступность navigator.mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      
      // Возобновляем AudioContext для получения списка устройств
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audiooutput');
    } catch (e) {
      console.warn('enumerateDevices error:', e);
      return [];
    }
  }

  /**
   * Запрашивает выбор устройства вывода через системный picker Chrome
   * Сначала пробует selectAudioOutput, затем fallback через getUserMedia + enumerateDevices
   * @returns Массив устройств вывода для показа в dropdown
   */
  async selectOutputDevice(): Promise<MediaDeviceInfo[]> {
    if (!this.audioContext) return [];
    
    // Вариант 1: Пробуем selectAudioOutput (Chrome 66+)
    try {
      const mediaDevices = navigator.mediaDevices as MediaDevicesWithOutputSelection | undefined;
      if (mediaDevices && typeof mediaDevices.selectAudioOutput === 'function') {
        const device = await mediaDevices.selectAudioOutput();
        
        // Устанавливаем выбранное устройство как sink
        const destination = this.audioContext.destination as AudioDestinationWithSinkId;
        if (typeof destination.setSinkId === 'function') {
          await destination.setSinkId(device.deviceId);
        }
        
        // Возвращаем массив с одним устройством
        return [device];
      }
    } catch (e) {
      console.warn('selectAudioOutput error:', e);
      // Продолжаем с fallback
    }
    
    // Вариант 2: Fallback через getUserMedia + enumerateDevices
    try {
      console.log('Using fallback: requesting audio permissions...');
      
      // Запрашиваем доступ к микрофону (это запросит разрешения и раскроет устройства)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Получаем список устройств вывода
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputDevices = devices.filter(d => d.kind === 'audiooutput');
      
      // Закрываем поток микрофона (он нам не нужен)
      stream.getTracks().forEach(track => track.stop());
      
      // Возвращаем ВСЕ устройства вывода
      return outputDevices;
    } catch (e) {
      console.warn('Fallback method error:', e);
      return [];
    }
  }

  /**
   * Проверяет доступность selectAudioOutput
   */
  isSelectAudioOutputSupported(): boolean {
    const mediaDevices = navigator.mediaDevices as MediaDevicesWithOutputSelection | undefined;
    return !!(mediaDevices && typeof mediaDevices.selectAudioOutput === 'function');
  }

  /**
   * Устанавливает устройство вывода звука (наушники/динамики)
   * Возвращает true если удалось установить, false если требуется перезапуск
   */
  async setOutputDevice(deviceId: string): Promise<boolean> {
    if (!this.audioContext || !deviceId) return false;
    
    const destination = this.audioContext.destination as AudioDestinationWithSinkId;
    if (typeof destination.setSinkId === 'function') {
      try {
        await destination.setSinkId(deviceId);
        console.log('Output device changed to:', deviceId);
        return true;
      } catch (e) {
        console.warn('setSinkId failed, device change may require restart:', e);
        return false;
      }
    }
    
    console.warn('setSinkId not supported');
    return false;
  }

  /**
   * Устанавливает общую громкость (Master Volume)
   */
  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(volume, this.audioContext!.currentTime, 0.01);
    }
  }

  /**
   * Обновляет параметры конкретного голоса (канала)
   */
  updateVoice(id: number, state: Partial<VoiceState>): void {
    const voice = this.voices.get(id);
    if (!voice) return;

    if (state.volume !== undefined) voice.setVolume(state.volume);
    if (state.frequency !== undefined) voice.setFrequency(state.frequency);
    if (state.waveform !== undefined) voice.setWaveform(state.waveform);
    
    // PULSE настройки
    if (state.usePulse !== undefined) voice.setPulseEnabled(state.usePulse);
    if (state.pulseToneDuration !== undefined) voice.setPulseToneDuration(state.pulseToneDuration);
    if (state.pulseGapDuration !== undefined) voice.setPulseGapDuration(state.pulseGapDuration);
    if (state.pulseRandomize !== undefined) voice.setPulseRandomize(state.pulseRandomize);
    if (state.pulseFadeOutDuration !== undefined) voice.setPulseFadeOutDuration(state.pulseFadeOutDuration);
    
    // Chaos Mode ("Безумный ремонт")
    if (state.pulseChaos !== undefined) voice.setPulseChaos(state.pulseChaos);
    
    // SWEEP настройки
    if (state.useSweep !== undefined) voice.setSweepEnabled(state.useSweep);
    if (state.sweepStartFreq !== undefined) voice.setSweepStartFreq(state.sweepStartFreq);
    if (state.sweepEndFreq !== undefined) voice.setSweepEndFreq(state.sweepEndFreq);
    if (state.sweepDuration !== undefined) voice.setSweepDuration(state.sweepDuration);
    if (state.sweepType !== undefined) voice.setSweepType(state.sweepType);
    if (state.sweepLoop !== undefined) voice.setSweepLoop(state.sweepLoop);
    if (state.sweepPingPong !== undefined) voice.setSweepPingPong(state.sweepPingPong);

    // Smart Module - Beats настройки
    if (state.isSmartModule !== undefined) voice.setIsSmartModule(state.isSmartModule);
    if (state.beatEnabled !== undefined) voice.setBeatEnabled(state.beatEnabled);
    if (state.beatOffset !== undefined) voice.setBeatOffset(state.beatOffset);

    // Drift Mode настройки
    if (state.driftEnabled !== undefined) voice.setDriftEnabled(state.driftEnabled);
    if (state.driftSpeed !== undefined) voice.setDriftSpeed(state.driftSpeed);
    if (state.driftDepth !== undefined) voice.setDriftDepth(state.driftDepth);

    // Frequency Hopping настройки
    if (state.hopEnabled !== undefined) voice.setHopEnabled(state.hopEnabled);
    if (state.hopInterval !== undefined) voice.setHopInterval(state.hopInterval);
  }

  /**
   * Запускает конкретный канал
   */
  startVoice(id: number): void {
    // Resume audioContext для Windows/Tauri после долгого простоя
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    const voice = this.voices.get(id);
    if (voice) voice.start();
  }

  /**
   * Останавливает конкретный канал
   */
  stopVoice(id: number): void {
    const voice = this.voices.get(id);
    if (voice) voice.stop();
  }

  /**
   * Запускает все активные каналы
   */
  startAll(): void {
    // Resume audioContext для Windows/Tauri
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    this.voices.forEach(voice => voice.start());
  }

  /**
   * Останавливает все каналы
   */
  stopAll(): void {
    this.voices.forEach(voice => voice.stop());
  }

  /**
   * Возвращает текущий AudioContext (для отладки)
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Освобождает все ресурсы AudioContext
   */
  dispose(): void {
    this.voices.forEach(voice => voice.dispose());
    this.voices.clear();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Синглтон экземпляр
export const audioEngine = new AudioEngine();