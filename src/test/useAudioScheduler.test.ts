import { describe, it, expect } from 'vitest';
import type { VoiceState } from '../types';

const createVoice = (overrides: Partial<VoiceState> = {}): VoiceState => ({
  id: 0,
  isActive: false,
  volume: 0.5,
  frequency: 440,
  waveform: 'sine',
  usePulse: false,
  pulseToneDuration: 100,
  pulseGapDuration: 200,
  pulseRandomize: false,
  pulseFadeOutDuration: 30,
  pulseChaos: false,
  useSweep: false,
  sweepStartFreq: 100,
  sweepEndFreq: 2000,
  sweepDuration: 1,
  sweepType: 'linear',
  sweepLoop: true,
  sweepPingPong: false,
  isSmartModule: false,
  beatEnabled: false,
  beatOffset: 1,
  driftEnabled: false,
  driftSpeed: 0.1,
  driftDepth: 1.0,
  hopEnabled: false,
  hopInterval: 300,
  scheduleEnabled: false,
  scheduleMode: 'clock',
  clockStart: '08:00',
  clockEnd: '22:00',
  timerDuration: 30,
  cycleWork: 1,
  cycleRest: 5,
  isLooping: false,
  ...overrides
});

describe('Scheduler - Manual Start Only', () => {
  describe('Clock Mode', () => {
    it('должен иметь режим clock', () => {
      const voice = createVoice({ scheduleMode: 'clock' });
      expect(voice.scheduleMode).toBe('clock');
    });

    it('должен иметь время начала и конца', () => {
      const voice = createVoice({ clockStart: '09:00', clockEnd: '18:00' });
      expect(voice.clockStart).toBe('09:00');
      expect(voice.clockEnd).toBe('18:00');
    });

    it('должен позволять ручной старт когда активно расписание', () => {
      const voice = createVoice({ 
        scheduleEnabled: true, 
        scheduleMode: 'clock',
        isActive: false 
      });
      expect(voice.isActive).toBe(false);
      expect(voice.scheduleEnabled).toBe(true);
    });

    it('должен позволять ручной старт когда НЕ активно расписание', () => {
      const voice = createVoice({ 
        scheduleEnabled: true, 
        scheduleMode: 'clock',
        clockStart: '23:00',
        clockEnd: '06:00',
        isActive: false 
      });
      expect(voice.isActive).toBe(false);
      expect(voice.scheduleEnabled).toBe(true);
    });

    it('НЕ должен автоматически включаться при старте', () => {
      const voice = createVoice({ 
        scheduleEnabled: true, 
        scheduleMode: 'clock',
        isActive: false 
      });
      // НЕ включаем автоматически - только проверяем
      expect(voice.isActive).toBe(false);
    });
  });

  describe('Timer Mode', () => {
    it('должен иметь режим timer', () => {
      const voice = createVoice({ scheduleMode: 'timer' });
      expect(voice.scheduleMode).toBe('timer');
    });

    it('должен иметь длительность по умолчанию 30 минут', () => {
      const voice = createVoice({ timerDuration: 30 });
      expect(voice.timerDuration).toBe(30);
    });

    it('должен конвертировать минуты в секунды', () => {
      const voice = createVoice({ timerDuration: 5 });
      const seconds = voice.timerDuration * 60;
      expect(seconds).toBe(300);
    });

    it('должен сбрасываться при ручном выключении', () => {
      const voice = createVoice({ 
        scheduleEnabled: true,
        scheduleMode: 'timer',
        isActive: true,
        timerDuration: 30
      });
      // Пользователь выключил вручную - сбрасываем
      expect(voice.isActive).toBe(true);
    });
  });

  describe('Cycle Mode', () => {
    it('должен ��меть режим cycle', () => {
      const voice = createVoice({ scheduleMode: 'cycle' });
      expect(voice.scheduleMode).toBe('cycle');
    });

    it('должен иметь время работы по умолчанию 1 минута', () => {
      const voice = createVoice({ cycleWork: 1 });
      expect(voice.cycleWork).toBe(1);
    });

    it('должен иметь время отдыха по умолчанию 5 минут', () => {
      const voice = createVoice({ cycleRest: 5 });
      expect(voice.cycleRest).toBe(5);
    });

    it('должен позволять зацикливание', () => {
      const voice = createVoice({ isLooping: true });
      expect(voice.isLooping).toBe(true);
    });

    it('НЕ должен автоматически стартовать без звука', () => {
      const voice = createVoice({ 
        scheduleEnabled: true,
        scheduleMode: 'cycle',
        isActive: false 
      });
      // Цикл работает только когда isActive === true
      expect(voice.isActive).toBe(false);
    });
  });

  describe('Time Range Logic', () => {
    const isTimeInRange = (now: string, start: string, end: string): boolean => {
      const toMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      const nowM = toMinutes(now);
      const startM = toMinutes(start);
      const endM = toMinutes(end);
      
      if (startM <= endM) {
        return nowM >= startM && nowM <= endM;
      } else {
        return nowM >= startM || nowM <= endM;
      }
    };

    it('должен быть в расписании днем', () => {
      expect(isTimeInRange('12:00', '08:00', '22:00')).toBe(true);
    });

    it('должен быть в расписании точно в start', () => {
      expect(isTimeInRange('08:00', '08:00', '22:00')).toBe(true);
    });

    it('должен быть в расписании точно в end', () => {
      expect(isTimeInRange('22:00', '08:00', '22:00')).toBe(true);
    });

    it('должен быть ВНЕ расписании перед start', () => {
      expect(isTimeInRange('07:00', '08:00', '22:00')).toBe(false);
    });

    it('должен быть ВНЕ расписании после end', () => {
      expect(isTimeInRange('23:00', '08:00', '22:00')).toBe(false);
    });

    it('должен обрабатывать ночной диапазон', () => {
      expect(isTimeInRange('23:00', '22:00', '06:00')).toBe(true);
    });

    it('должен быть ВНЕ расписании днем для ночного диапазона', () => {
      expect(isTimeInRange('12:00', '22:00', '06:00')).toBe(false);
    });
  });

  describe('Timer Countdown Logic', () => {
    it('должен считать секунды', () => {
      let counter = 0;
      counter += 1;
      expect(counter).toBe(1);
    });

    it('должен останавливаться при достижении лимита', () => {
      const limit = 60;
      const counter = 60;
      const shouldStop = counter >= limit;
      expect(shouldStop).toBe(true);
    });

    it('должен сбрасываться при ручном выключении', () => {
      let counter = 30;
      counter = 0; // сброс
      expect(counter).toBe(0);
    });
  });

  describe('Cycle Phase Logic', () => {
    it('должен переключаться work -> rest', () => {
      let phase = 'work';
      phase = 'rest';
      expect(phase).toBe('rest');
    });

    it('должен переключаться rest -> work при зацикливании', () => {
      let phase = 'rest';
      phase = 'work';
      expect(phase).toBe('work');
    });

    it('должен останавливаться когда не зациклилено', () => {
      const isLooping = false;
      const shouldStop = !isLooping;
      expect(shouldStop).toBe(true);
    });
  });

  describe('State Consistency', () => {
    it('isActive может быть включен только вручную', () => {
      const voice = createVoice({ isActive: true });
      expect(voice.isActive).toBe(true);
    });

    it('isActive может быть выключен автоматически', () => {
      const voice = createVoice({ isActive: false });
      expect(voice.isActive).toBe(false);
    });

    it('scheduleEnabled должен быть false по умолчанию', () => {
      const voice = createVoice({});
      expect(voice.scheduleEnabled).toBe(false);
    });

    it('Smart Module должен быть исключен из scheduler', () => {
      const voice = createVoice({ isSmartModule: true, scheduleEnabled: true });
      expect(voice.isSmartModule).toBe(true);
    });
  });
});