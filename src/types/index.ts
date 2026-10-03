// Тип волны или шума
export type WaveformType = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'white-noise' | 'pink-noise';

// Тип свипа
export type SweepType = 'linear' | 'logarithmic';

// Состояние отдельного канала (генератора)
export interface VoiceState {
  id: number;
  isActive: boolean;
  volume: number;
  frequency: number;
  waveform: WaveformType;
  
  // Индивидуальные настройки PULSE
  usePulse: boolean;
  pulseToneDuration: number;    // Длительность тона (мс)
  pulseGapDuration: number;     // Длительность паузы (мс)
  pulseRandomize: boolean;      // Рандомизация ±50%
  pulseFadeOutDuration: number; // Длительность затухания (мс)
  
  // Хаотичный режим ("Безумный ремонт") - случайный gap после каждого цикла
  pulseChaos: boolean;
  
  // Индивидуальные настройки SWEEP
  useSweep: boolean;
  sweepStartFreq: number;       // Стартовая частота (Hz)
  sweepEndFreq: number;         // Конечная частота (Hz)
  sweepDuration: number;        // Длительность свипа (с)
  sweepType: SweepType;         // Тип: линейный/логарифмический
  sweepLoop: boolean;           // Зациклить свип
  sweepPingPong: boolean;       // Режим "туда-обратно"

  // Умный модуль (5-й канал) - Beats (Интерференция)
  isSmartModule: boolean;      // Это умный модуль
  beatEnabled: boolean;         // Включить биения
  beatOffset: number;          // Смещение частоты (0.1 - 20 Hz)

  // Drift Mode (плавающее биение) - для Smart Module
  driftEnabled: boolean;      // Включить плавание
  driftSpeed: number;        // Скорость плавания (0.01 - 1.0)
  driftDepth: number;        // Глубина модуляции (0.1 - 5.0 Hz)

  // Frequency Hopping (прыгающий резонанс) - для Smart Module
  hopEnabled: boolean;      // Включить прыгающий резонанс
  hopInterval: number;      // Интервал смены частоты (секунды)

  // Scheduler (Планировщик)
  scheduleEnabled: boolean;
  scheduleMode: 'clock' | 'timer' | 'cycle';
  clockStart: string;
  clockEnd: string;
  timerDuration: number;
  cycleWork: number;
  cycleRest: number;
  isLooping: boolean;
}

// Глобальные настройки пульсации (для UI)
export interface PulseSettings {
  toneDuration: number;
  gapDuration: number;
  randomize: boolean;
}

// Глобальные настройки свипа (для UI)
export interface SweepSettings {
  startFreq: number;
  endFreq: number;
  duration: number;
  type: SweepType;
}

// Состояние движка
export interface AudioEngineState {
  isInitialized: boolean;
  masterVolume: number;
  voices: VoiceState[];
  pulseSettings: PulseSettings;
  sweepSettings: SweepSettings;
}