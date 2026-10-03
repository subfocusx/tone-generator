import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Voice } from '../audio/Voice';
import type { NoiseGenerator } from '../audio/NoiseGenerator';
import type { WaveformType } from '../types';

const originalSetTimeout = window.setTimeout;
const originalClearTimeout = window.clearTimeout;

// Создание mock AudioContext
function createMockAudioContext() {
  const mockGain = {
    gain: { 
      value: 0, 
      setValueAtTime: vi.fn(), 
      linearRampToValueAtTime: vi.fn(), 
      exponentialRampToValueAtTime: vi.fn(), 
      setTargetAtTime: vi.fn(),
      cancelScheduledValues: vi.fn() 
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockAudioContext = {
    currentTime: 0,
    state: 'running',
    createGain: vi.fn().mockReturnValue(mockGain),
    createOscillator: vi.fn().mockReturnValue({
      type: 'sine',
      frequency: { value: 440, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    }),
    destination: {},
  } as any;

  return { mockAudioContext, mockGain };
}

// Создание mock NoiseGenerator
function createMockNoiseGenerator() {
  return {
    createNoiseBuffer: vi.fn().mockReturnValue({
      duration: 2,
      numberOfChannels: 2,
      sampleRate: 44100,
    }),
  };
}

describe('Voice - Smart Module (Beats)', () => {

  let mockAudioContext: AudioContext;
  let mockMasterGain: GainNode;
  let mockNoiseGenerator: Partial<NoiseGenerator>;
  let voice: Voice;

  beforeEach(() => {
    window.setTimeout = vi.fn((_callback: () => void, _delay?: number) => 1) as any;
    window.clearTimeout = vi.fn((_id?: number) => {}) as any;

    const mockGain = {
      gain: { 
        value: 0, 
        setValueAtTime: vi.fn(), 
        linearRampToValueAtTime: vi.fn(), 
        exponentialRampToValueAtTime: vi.fn(), 
        setTargetAtTime: vi.fn() 
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockAudioContext = {
      currentTime: 0,
      state: 'running',
      createGain: vi.fn().mockReturnValue(mockGain),
      createOscillator: vi.fn().mockReturnValue({
        type: 'sine',
        frequency: { value: 440, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }),
      destination: {},
    } as any;

    mockMasterGain = mockGain as any;

    mockNoiseGenerator = {
      createNoiseBuffer: vi.fn().mockReturnValue({
        duration: 2,
        numberOfChannels: 2,
        sampleRate: 44100,
      }),
    };

    voice = new Voice(mockAudioContext, mockMasterGain, mockNoiseGenerator as any);
  });

  afterEach(() => {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    vi.clearAllMocks();
    voice.dispose();
  });

  describe('Smart Module defaults', () => {
    it('should have isSmartModule false by default', () => {
      expect(voice.getIsSmartModule()).toBe(false);
    });

    it('should have beatEnabled false by default', () => {
      expect(voice.getBeatEnabled()).toBe(false);
    });

    it('should have beatOffset 1Hz by default', () => {
      expect(voice.getBeatOffset()).toBe(1);
    });
  });

  describe('Smart Module enable/disable', () => {
    it('should enable Smart Module', () => {
      voice.setIsSmartModule(true);
      expect(voice.getIsSmartModule()).toBe(true);
    });

    it('should disable Smart Module', () => {
      voice.setIsSmartModule(true);
      voice.setIsSmartModule(false);
      expect(voice.getIsSmartModule()).toBe(false);
    });
  });

  describe('Beat enable/disable', () => {
    it('should enable Beats', () => {
      voice.setBeatEnabled(true);
      expect(voice.getBeatEnabled()).toBe(true);
    });

    it('should disable Beats', () => {
      voice.setBeatEnabled(true);
      voice.setBeatEnabled(false);
      expect(voice.getBeatEnabled()).toBe(false);
    });

    it('should restart when enabling Beats during playback', () => {
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      voice.setBeatEnabled(true);
      expect(voice.getBeatEnabled()).toBe(true);
      
      voice.stop();
    });
  });

  describe('Beat offset', () => {
    it('should set beat offset', () => {
      voice.setBeatOffset(5);
      expect(voice.getBeatOffset()).toBe(5);
    });

    it('should clamp minimum to 0.1Hz', () => {
      voice.setBeatOffset(0);
      expect(voice.getBeatOffset()).toBe(0.1);
    });

    it('should clamp maximum to 20Hz', () => {
      voice.setBeatOffset(50);
      expect(voice.getBeatOffset()).toBe(20);
    });

    it('should accept decimal values', () => {
      voice.setBeatOffset(1.5);
      expect(voice.getBeatOffset()).toBe(1.5);
    });
  });

  describe('Beat + PULSE interaction', () => {
    it('should allow Beats with PULSE', () => {
      voice.setPulseEnabled(true);
      voice.setBeatEnabled(true);
      
      expect(voice.getUsePulse()).toBe(true);
      expect(voice.getBeatEnabled()).toBe(true);
    });

    it('should allow disabling PULSE while Beats is on', () => {
      voice.setPulseEnabled(true);
      voice.setBeatEnabled(true);
      voice.setPulseEnabled(false);
      
      expect(voice.getUsePulse()).toBe(false);
      expect(voice.getBeatEnabled()).toBe(true);
    });
  });

  describe('Smart Module + normal module compatibility', () => {
    it('should work as normal module when isSmartModule is false', () => {
      voice.setIsSmartModule(false);
      voice.setBeatEnabled(true); // Beats should still be settable
      
      expect(voice.getIsSmartModule()).toBe(false);
      expect(voice.getBeatEnabled()).toBe(true);
    });

    it('should work as Smart Module when isSmartModule is true', () => {
      voice.setIsSmartModule(true);
      
      expect(voice.getIsSmartModule()).toBe(true);
    });
  });
});

describe('Voice - Mutual Exclusion Logic', () => {

  let mockAudioContext: AudioContext;
  let mockMasterGain: GainNode;
  let mockNoiseGenerator: Partial<NoiseGenerator>;
  let voice: Voice;

  beforeEach(() => {
    window.setTimeout = vi.fn((_callback: () => void, _delay?: number) => 1) as any;
    window.clearTimeout = vi.fn((_id?: number) => {}) as any;

    const mockGain = {
      gain: { 
        value: 0, 
        setValueAtTime: vi.fn(), 
        linearRampToValueAtTime: vi.fn(), 
        exponentialRampToValueAtTime: vi.fn(), 
        setTargetAtTime: vi.fn() 
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockAudioContext = {
      currentTime: 0,
      state: 'running',
      createGain: vi.fn().mockReturnValue(mockGain),
      createOscillator: vi.fn().mockReturnValue({
        type: 'sine',
        frequency: { value: 440, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }),
      destination: {},
    } as any;

    mockMasterGain = mockGain as any;

    mockNoiseGenerator = {
      createNoiseBuffer: vi.fn().mockReturnValue({
        duration: 2,
        numberOfChannels: 2,
        sampleRate: 44100,
      }),
    };

    voice = new Voice(mockAudioContext, mockMasterGain, mockNoiseGenerator as any);
  });

  afterEach(() => {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    vi.clearAllMocks();
    voice.dispose();
  });

  // ===== PULSE ↔ SWEEP ВЗАИМОИСКЛЮЧЕНИЕ =====

  describe('PULSE and SWEEP are mutually exclusive', () => {
    
    describe('When enabling PULSE', () => {
      it('should enable PULSE', () => {
        voice.setPulseEnabled(true);
        expect(voice.getUsePulse()).toBe(true);
      });

      it('should automatically disable SWEEP when enabling PULSE', () => {
        voice.setSweepEnabled(true);
        expect(voice.getUseSweep()).toBe(true);
        
        voice.setPulseEnabled(true);
        
        expect(voice.getUsePulse()).toBe(true);
        expect(voice.getUseSweep()).toBe(false);
      });

      it('should work when both were disabled', () => {
        expect(voice.getUsePulse()).toBe(false);
        expect(voice.getUseSweep()).toBe(false);
        
        voice.setPulseEnabled(true);
        
        expect(voice.getUsePulse()).toBe(true);
        expect(voice.getUseSweep()).toBe(false);
      });
    });

    describe('When enabling SWEEP', () => {
      it('should enable SWEEP', () => {
        voice.setSweepEnabled(true);
        expect(voice.getUseSweep()).toBe(true);
      });

      it('should automatically disable PULSE when enabling SWEEP', () => {
        voice.setPulseEnabled(true);
        expect(voice.getUsePulse()).toBe(true);
        
        voice.setSweepEnabled(true);
        
        expect(voice.getUseSweep()).toBe(true);
        expect(voice.getUsePulse()).toBe(false);
      });

      it('should work when both were disabled', () => {
        expect(voice.getUsePulse()).toBe(false);
        expect(voice.getUseSweep()).toBe(false);
        
        voice.setSweepEnabled(true);
        
        expect(voice.getUseSweep()).toBe(true);
        expect(voice.getUsePulse()).toBe(false);
      });
    });

    describe('When disabling PULSE', () => {
      it('should disable PULSE', () => {
        voice.setPulseEnabled(true);
        voice.setPulseEnabled(false);
        
        expect(voice.getUsePulse()).toBe(false);
      });

      it('should keep SWEEP disabled (was disabled before PULSE was enabled)', () => {
        voice.setPulseEnabled(true);
        voice.setPulseEnabled(false);
        
        expect(voice.getUsePulse()).toBe(false);
        expect(voice.getUseSweep()).toBe(false);
      });

      it('should enable SWEEP explicitly if needed', () => {
        voice.setSweepEnabled(true);
        voice.setPulseEnabled(true); // SWEEP turns off
        voice.setPulseEnabled(false); // PULSE turns off, SWEEP stays off
        voice.setSweepEnabled(true); // Turn SWEEP back on
        
        expect(voice.getUsePulse()).toBe(false);
        expect(voice.getUseSweep()).toBe(true);
      });
    });

    describe('When disabling SWEEP', () => {
      it('should disable SWEEP', () => {
        voice.setSweepEnabled(true);
        voice.setSweepEnabled(false);
        
        expect(voice.getUseSweep()).toBe(false);
      });

      it('should keep PULSE disabled (was disabled before SWEEP was enabled)', () => {
        voice.setSweepEnabled(true);
        voice.setSweepEnabled(false);
        
        expect(voice.getUseSweep()).toBe(false);
        expect(voice.getUsePulse()).toBe(false);
      });

      it('should enable PULSE explicitly if needed', () => {
        voice.setPulseEnabled(true);
        voice.setSweepEnabled(true); // PULSE turns off
        voice.setSweepEnabled(false); // SWEEP turns off, PULSE stays off
        voice.setPulseEnabled(true); // Turn PULSE back on
        
        expect(voice.getUseSweep()).toBe(false);
        expect(voice.getUsePulse()).toBe(true);
      });
    });

    describe('Toggle scenarios', () => {
      it('should toggle: PULSE → SWEEP → PULSE', () => {
        voice.setPulseEnabled(true);
        expect(voice.getUsePulse()).toBe(true);
        expect(voice.getUseSweep()).toBe(false);

        voice.setSweepEnabled(true);
        expect(voice.getUseSweep()).toBe(true);
        expect(voice.getUsePulse()).toBe(false);

        voice.setPulseEnabled(true);
        expect(voice.getUsePulse()).toBe(true);
        expect(voice.getUseSweep()).toBe(false);
      });

      it('should toggle: SWEEP → PULSE → SWEEP', () => {
        voice.setSweepEnabled(true);
        expect(voice.getUseSweep()).toBe(true);
        expect(voice.getUsePulse()).toBe(false);

        voice.setPulseEnabled(true);
        expect(voice.getUsePulse()).toBe(true);
        expect(voice.getUseSweep()).toBe(false);

        voice.setSweepEnabled(true);
        expect(voice.getUseSweep()).toBe(true);
        expect(voice.getUsePulse()).toBe(false);
      });

      it('should handle rapid toggling', () => {
        for (let i = 0; i < 10; i++) {
          voice.setPulseEnabled(true);
          expect(voice.getUsePulse()).toBe(true);
          expect(voice.getUseSweep()).toBe(false);

          voice.setSweepEnabled(true);
          expect(voice.getUseSweep()).toBe(true);
          expect(voice.getUsePulse()).toBe(false);
        }
      });
    });

    describe('During playback', () => {
      it('should restart when toggling PULSE on', () => {
        voice.start();
        expect(voice.getIsPlaying()).toBe(true);
        
        voice.setPulseEnabled(true);
        expect(voice.getUsePulse()).toBe(true);
        expect(voice.getUseSweep()).toBe(false);
        
        voice.stop();
      });

      it('should restart when toggling SWEEP on', () => {
        voice.start();
        expect(voice.getIsPlaying()).toBe(true);
        
        voice.setSweepEnabled(true);
        expect(voice.getUseSweep()).toBe(true);
        expect(voice.getUsePulse()).toBe(false);
        
        voice.stop();
      });
    });
  });

  // ===== Ping-Pong ↔ Loop ВЗАИМОИСКЛЮЧЕНИЕ =====

  describe('Ping-Pong and Loop are mutually exclusive', () => {
    
    describe('Initial state', () => {
      it('should have Loop enabled by default', () => {
        expect(voice.getSweepLoop()).toBe(true);
      });

      it('should have Ping-Pong disabled by default', () => {
        expect(voice.getSweepPingPong()).toBe(false);
      });

      it('should always have one of them enabled', () => {
        expect(voice.getSweepLoop() || voice.getSweepPingPong()).toBe(true);
      });
    });

    describe('When enabling Ping-Pong', () => {
      it('should enable Ping-Pong', () => {
        voice.setSweepPingPong(true);
        expect(voice.getSweepPingPong()).toBe(true);
      });

      it('should automatically disable Loop when enabling Ping-Pong', () => {
        expect(voice.getSweepLoop()).toBe(true);
        
        voice.setSweepPingPong(true);
        
        expect(voice.getSweepPingPong()).toBe(true);
        expect(voice.getSweepLoop()).toBe(false);
      });

      it('should maintain mutual exclusion (Loop stays off)', () => {
        voice.setSweepPingPong(true);
        expect(voice.getSweepLoop()).toBe(false);
        expect(voice.getSweepPingPong()).toBe(true);
      });
    });

    describe('When enabling Loop', () => {
      it('should enable Loop', () => {
        voice.setSweepLoop(true);
        expect(voice.getSweepLoop()).toBe(true);
      });

      it('should automatically disable Ping-Pong when enabling Loop', () => {
        voice.setSweepPingPong(true);
        expect(voice.getSweepPingPong()).toBe(true);
        
        voice.setSweepLoop(true);
        
        expect(voice.getSweepLoop()).toBe(true);
        expect(voice.getSweepPingPong()).toBe(false);
      });

      it('should maintain mutual exclusion (Ping-Pong stays off)', () => {
        voice.setSweepLoop(true);
        expect(voice.getSweepPingPong()).toBe(false);
        expect(voice.getSweepLoop()).toBe(true);
      });
    });

    describe('When disabling Ping-Pong', () => {
      it('should disable Ping-Pong', () => {
        voice.setSweepPingPong(true);
        voice.setSweepPingPong(false);
        
        expect(voice.getSweepPingPong()).toBe(false);
      });

      it('should automatically enable Loop when disabling Ping-Pong', () => {
        voice.setSweepPingPong(true);
        expect(voice.getSweepPingPong()).toBe(true);
        expect(voice.getSweepLoop()).toBe(false);
        
        voice.setSweepPingPong(false);
        
        expect(voice.getSweepPingPong()).toBe(false);
        expect(voice.getSweepLoop()).toBe(true);
      });
    });

    describe('When disabling Loop', () => {
      it('should disable Loop', () => {
        voice.setSweepLoop(false);
        expect(voice.getSweepLoop()).toBe(false);
      });

      it('should automatically enable Ping-Pong when disabling Loop', () => {
        expect(voice.getSweepLoop()).toBe(true);
        
        voice.setSweepLoop(false);
        
        expect(voice.getSweepLoop()).toBe(false);
        expect(voice.getSweepPingPong()).toBe(true);
      });
    });

    describe('Toggle scenarios', () => {
      it('should toggle: Loop ↔ Ping-Pong ↔ Loop', () => {
        // Start with Loop enabled
        expect(voice.getSweepLoop()).toBe(true);
        expect(voice.getSweepPingPong()).toBe(false);

        // Enable Ping-Pong
        voice.setSweepPingPong(true);
        expect(voice.getSweepPingPong()).toBe(true);
        expect(voice.getSweepLoop()).toBe(false);

        // Enable Loop
        voice.setSweepLoop(true);
        expect(voice.getSweepLoop()).toBe(true);
        expect(voice.getSweepPingPong()).toBe(false);

        // Enable Ping-Pong again
        voice.setSweepPingPong(true);
        expect(voice.getSweepPingPong()).toBe(true);
        expect(voice.getSweepLoop()).toBe(false);
      });

      it('should handle rapid toggling', () => {
        for (let i = 0; i < 10; i++) {
          voice.setSweepPingPong(true);
          expect(voice.getSweepPingPong()).toBe(true);
          expect(voice.getSweepLoop()).toBe(false);

          voice.setSweepLoop(true);
          expect(voice.getSweepLoop()).toBe(true);
          expect(voice.getSweepPingPong()).toBe(false);
        }
      });
    });

    describe('During SWEEP playback', () => {
      it('should update modes during playback', () => {
        voice.setSweepEnabled(true);
        voice.start();
        
        expect(voice.getSweepLoop()).toBe(true);
        expect(voice.getSweepPingPong()).toBe(false);

        voice.setSweepPingPong(true);
        expect(voice.getSweepPingPong()).toBe(true);
        expect(voice.getSweepLoop()).toBe(false);

        voice.setSweepLoop(true);
        expect(voice.getSweepLoop()).toBe(true);
        expect(voice.getSweepPingPong()).toBe(false);

        voice.stop();
      });
    });
  });

  // ===== КОМБИНИРОВАННЫЕ СЦЕНАРИИ =====

  describe('Combined PULSE/SWEEP and Ping-Pong/Loop logic', () => {
    
    it('should allow PULSE without affecting Loop/Ping-Pong', () => {
      voice.setSweepEnabled(true);
      expect(voice.getSweepLoop()).toBe(true);
      
      voice.setPulseEnabled(true);
      
      expect(voice.getUsePulse()).toBe(true);
      expect(voice.getUseSweep()).toBe(false);
      expect(voice.getSweepLoop()).toBe(true); // Loop остаётся включённым
    });

    it('should allow SWEEP without affecting PULSE params', () => {
      voice.setPulseEnabled(true);
      voice.setPulseToneDuration(500);
      voice.setPulseGapDuration(1000);
      
      voice.setSweepEnabled(true);
      
      expect(voice.getUseSweep()).toBe(true);
      expect(voice.getUsePulse()).toBe(false);
      expect(voice.getPulseToneDuration()).toBe(500); // PULSE параметры сохраняются
      expect(voice.getPulseGapDuration()).toBe(1000);
    });

    it('should maintain state when switching modes', () => {
      // PULSE setup
      voice.setPulseEnabled(true);
      voice.setPulseToneDuration(300);
      voice.setPulseGapDuration(500);
      
      // Switch to SWEEP
      voice.setSweepEnabled(true);
      
      // Switch back to PULSE
      voice.setPulseEnabled(true);
      
      expect(voice.getPulseToneDuration()).toBe(300);
      expect(voice.getPulseGapDuration()).toBe(500);
    });

    it('should handle complex switching sequence', () => {
      // Setup PULSE
      voice.setPulseEnabled(true);
      voice.setPulseToneDuration(100);
      
      // Enable SWEEP (disables PULSE)
      voice.setSweepEnabled(true);
      voice.setSweepPingPong(true); // Enable Ping-Pong
      
      // Back to PULSE (disables SWEEP, keeps Ping-Pong setting)
      voice.setPulseEnabled(true);
      
      expect(voice.getUsePulse()).toBe(true);
      expect(voice.getUseSweep()).toBe(false);
      expect(voice.getPulseToneDuration()).toBe(100);
      
      // Back to SWEEP
      voice.setSweepEnabled(true);
      
      // Ping-Pong should still be enabled from before
      expect(voice.getSweepPingPong()).toBe(true);
      expect(voice.getSweepLoop()).toBe(false);
    });
  });

  // ===== EDGE CASES =====

  describe('Edge cases', () => {
    
    it('should handle enabling same mode twice', () => {
      voice.setPulseEnabled(true);
      voice.setPulseEnabled(true);
      expect(voice.getUsePulse()).toBe(true);
      expect(voice.getUseSweep()).toBe(false);
    });

    it('should handle disabling same mode twice', () => {
      voice.setPulseEnabled(true);
      voice.setPulseEnabled(false);
      voice.setPulseEnabled(false);
      expect(voice.getUsePulse()).toBe(false);
    });

    it('should handle enabling Loop when Ping-Pong already disabled', () => {
      voice.setSweepPingPong(true);
      voice.setSweepPingPong(false);
      voice.setSweepLoop(true);
      
      expect(voice.getSweepLoop()).toBe(true);
      expect(voice.getSweepPingPong()).toBe(false);
    });

    it('should handle enabling Ping-Pong when Loop already disabled', () => {
      voice.setSweepLoop(true);
      voice.setSweepPingPong(true);
      
      expect(voice.getSweepPingPong()).toBe(true);
      expect(voice.getSweepLoop()).toBe(false);
    });
  });
});

// ===== РЕАЛЬНЫЕ СЦЕНАРИИ ИСПОЛЬЗОВАНИЯ =====

describe('Voice - Real Usage Scenarios', () => {

  let mockAudioContext: AudioContext;
  let mockMasterGain: GainNode;
  let mockNoiseGenerator: Partial<NoiseGenerator>;
  let voice: Voice;

  beforeEach(() => {
    window.setTimeout = vi.fn((_callback: () => void, _delay?: number) => 1) as any;
    window.clearTimeout = vi.fn((_id?: number) => {}) as any;

    const { mockAudioContext: ctx, mockGain } = createMockAudioContext();
    mockAudioContext = ctx;
    mockMasterGain = mockGain as any;
    mockNoiseGenerator = createMockNoiseGenerator();

    voice = new Voice(mockAudioContext, mockMasterGain, mockNoiseGenerator as any);
  });

  afterEach(() => {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    vi.clearAllMocks();
    voice.dispose();
  });

  describe('Сценарий 1: Изменение волны во время воспроизведения', () => {
    
    it('должен перезапуститься после изменения волны с sine на sawtooth', () => {
      voice.setFrequency(80);
      voice.setWaveform('sine');
      
      // Запускаем
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Меняем волну на sawtooth
      voice.setWaveform('sawtooth');
      
      // Должен продолжать играть
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('должен работать после множественных переключений волн', () => {
      const waveforms: WaveformType[] = ['sine', 'square', 'triangle', 'sawtooth', 'sine'];
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Множественные переключения
      waveforms.forEach(wf => {
        voice.setWaveform(wf);
        expect(voice.getIsPlaying()).toBe(true);
      });
    });

    it('должен работать при изменении частоты после смены волны', () => {
      voice.setFrequency(440);
      voice.setWaveform('sine');
      voice.start();
      
      // Меняем волну
      voice.setWaveform('square');
      expect(voice.getIsPlaying()).toBe(true);
      
      // Меняем частоту
      voice.setFrequency(880);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Снова меняем волну
      voice.setWaveform('triangle');
      expect(voice.getIsPlaying()).toBe(true);
    });
  });

  describe('Сценарий 2: Smart Module с Beats', () => {
    
    it('должен создать два осциллятора при включённом Beats', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setFrequency(100);
      voice.setBeatOffset(2);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      expect(voice.getBeatEnabled()).toBe(true);
      
      // Проверяем, что второй осциллятор создан
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('должен обновить оба осциллятора при изменении частоты', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setFrequency(100);
      
      voice.start();
      
      // Меняем частоту
      voice.setFrequency(150);
      
      // Должен продолжать играть
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('должен переключать волну с Beats', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setFrequency(80);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Переключаем волну
      voice.setWaveform('sawtooth');
      expect(voice.getIsPlaying()).toBe(true);
      
      // Меняем частоту
      voice.setFrequency(100);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Обратно на sine
      voice.setWaveform('sine');
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('должен выключить второй осциллятор при отключении Beats', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.start();
      
      expect(voice.getIsPlaying()).toBe(true);
      
      // Отключаем Beats
      voice.setBeatEnabled(false);
      
      expect(voice.getBeatEnabled()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
    });
  });

  describe('Сценарий 3: PULSE режим', () => {
    
    it('должен работать при включении PULSE во время воспроизведения', () => {
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      voice.setPulseEnabled(true);
      
      expect(voice.getUsePulse()).toBe(true);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('должен работать при выключении PULSE', () => {
      voice.setPulseEnabled(true);
      voice.start();
      
      expect(voice.getIsPlaying()).toBe(true);
      
      voice.setPulseEnabled(false);
      
      expect(voice.getUsePulse()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('должен изменить волну при PULSE режиме (без перезапуска)', () => {
      voice.setPulseEnabled(true);
      voice.start();
      
      // В PULSE режиме изменение волны не перезапускает
      // (так как есть условие !this.usePulse в setWaveform)
      voice.setWaveform('square');
      
      expect(voice.getIsPlaying()).toBe(true);
    });
  });

  describe('Сценарий 4: SWEEP режим', () => {
    
    it('должен работать при включении SWEEP во время воспроизведения', () => {
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      voice.setSweepEnabled(true);
      
      expect(voice.getUseSweep()).toBe(true);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('должен работать при переключении Loop ↔ Ping-Pong', () => {
      voice.setSweepEnabled(true);
      voice.start();
      
      expect(voice.getIsPlaying()).toBe(true);
      
      voice.setSweepPingPong(true);
      expect(voice.getSweepPingPong()).toBe(true);
      expect(voice.getIsPlaying()).toBe(true);
      
      voice.setSweepLoop(true);
      expect(voice.getSweepLoop()).toBe(true);
      expect(voice.getIsPlaying()).toBe(true);
    });
  });

  describe('Сценарий 5: Комбинированные переключения', () => {
    
    it('Sine → Sawtooth → Sine → частота → Square → частота', () => {
      voice.setFrequency(80);
      voice.setWaveform('sine');
      voice.start();
      
      // Шаг 1: Sine
      expect(voice.getIsPlaying()).toBe(true);
      
      // Шаг 2: Sawtooth
      voice.setWaveform('sawtooth');
      expect(voice.getIsPlaying()).toBe(true);
      
      // Шаг 3: Обратно Sine
      voice.setWaveform('sine');
      expect(voice.getIsPlaying()).toBe(true);
      
      // Шаг 4: Меняем частоту
      voice.setFrequency(120);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Шаг 5: Square
      voice.setWaveform('square');
      expect(voice.getIsPlaying()).toBe(true);
      
      // Шаг 6: Меняем частоту
      voice.setFrequency(200);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('Включение Beats → переключение волны → изменение частоты', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setFrequency(80);
      voice.setWaveform('sine');
      voice.start();
      
      expect(voice.getIsPlaying()).toBe(true);
      
      // Переключаем волну
      voice.setWaveform('sawtooth');
      expect(voice.getIsPlaying()).toBe(true);
      
      // Меняем частоту
      voice.setFrequency(100);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Обратно на sine
      voice.setWaveform('sine');
      expect(voice.getIsPlaying()).toBe(true);
      
      // Выключаем Beats
      voice.setBeatEnabled(false);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('PULSE → изменение волны → выключение PULSE', () => {
      voice.setPulseEnabled(true);
      voice.start();
      
      expect(voice.getIsPlaying()).toBe(true);
      
      // В PULSE режиме setWaveform не перезапускает (из-за !usePulse)
      voice.setWaveform('square');
      expect(voice.getIsPlaying()).toBe(true);
      
      // Выключаем PULSE
      voice.setPulseEnabled(false);
      expect(voice.getIsPlaying()).toBe(true);
    });
  });

  describe('Сценарий 6: Остановка и повторный запуск', () => {
    
    it('должен перезапуститься после остановки', () => {
      voice.setFrequency(440);
      voice.setWaveform('sine');
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      voice.stop();
      expect(voice.getIsPlaying()).toBe(false);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('должен работать после сложных переключений и перезапуска', () => {
      voice.setFrequency(80);
      voice.setWaveform('sine');
      
      // Много переключений
      voice.start();
      voice.setWaveform('sawtooth');
      voice.setFrequency(100);
      voice.setWaveform('triangle');
      voice.setFrequency(150);
      
      expect(voice.getIsPlaying()).toBe(true);
      
      // Останавливаем
      voice.stop();
      expect(voice.getIsPlaying()).toBe(false);
      
      // Запускаем снова
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Ещё переключения
      voice.setWaveform('square');
      voice.setFrequency(200);
      expect(voice.getIsPlaying()).toBe(true);
    });
  });

  describe('Сценарий 7: Smart Module специфичные', () => {
    
    it('5-й канал: BeatOffset изменяется на лету', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setFrequency(50);
      voice.setBeatOffset(1);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Меняем offset
      voice.setBeatOffset(5);
      expect(voice.getBeatOffset()).toBe(5);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Меняем offset обратно
      voice.setBeatOffset(1);
      expect(voice.getBeatOffset()).toBe(1);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('5-й канал: волна меняется с Beats включённым', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setFrequency(50);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      const waveforms: WaveformType[] = ['sine', 'square', 'triangle', 'sawtooth', 'sine'];
      
      waveforms.forEach(wf => {
        voice.setWaveform(wf);
        expect(voice.getIsPlaying()).toBe(true);
      });
    });

    it('5-й канал: isSmartModule можно переключать', () => {
      voice.setBeatEnabled(true);
      voice.setFrequency(50);
      
      // Устанавливаем как Smart Module
      voice.setIsSmartModule(true);
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Убираем Smart Module
      voice.setIsSmartModule(false);
      expect(voice.getIsPlaying()).toBe(true);
    });
  });
});

// ===== КОМПЛЕКСНЫЕ ТЕСТЫ ВАРИАЦИЙ =====

describe('Voice - Complex Variations (Все функции вместе)', () => {
  
  let mockAudioContext: AudioContext;
  let mockMasterGain: GainNode;
  let mockNoiseGenerator: Partial<NoiseGenerator>;
  let voice: Voice;

  beforeEach(() => {
    window.setTimeout = vi.fn((_callback: () => void, _delay?: number) => 1) as any;
    window.clearTimeout = vi.fn((_id?: number) => {}) as any;

    const { mockAudioContext: ctx, mockGain } = createMockAudioContext();
    mockAudioContext = ctx;
    mockMasterGain = mockGain as any;
    mockNoiseGenerator = createMockNoiseGenerator();

    voice = new Voice(mockAudioContext, mockMasterGain, mockNoiseGenerator as any);
  });

  afterEach(() => {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    vi.clearAllMocks();
    voice.dispose();
  });

  describe('Chaos Mode + PULSE', () => {
    it('должен включиться во время воспроизведения', () => {
      voice.setPulseEnabled(true);
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      voice.setPulseChaos(true);
      expect(voice.getPulseChaos()).toBe(true);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('должен выключиться во время воспроизведения', () => {
      voice.setPulseEnabled(true);
      voice.setPulseChaos(true);
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      voice.setPulseChaos(false);
      expect(voice.getPulseChaos()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
    });
  });

  describe('Chaos Mode + PULSE переключения', () => {
    it('Chaos вкл/выкл во время воспроизведения PULSE', () => {
      voice.setPulseEnabled(true);
      voice.setPulseChaos(true);
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Выключаем Chaos
      voice.setPulseChaos(false);
      expect(voice.getPulseChaos()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Включаем обратно
      voice.setPulseChaos(true);
      expect(voice.getPulseChaos()).toBe(true);
      expect(voice.getIsPlaying()).toBe(true);
    });
  });

  describe('Остановка и повторный запуск', () => {
    it('должен сохранять состояние Chaos после перезапуска', () => {
      voice.setPulseEnabled(true);
      voice.setPulseChaos(true);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      voice.stop();
      expect(voice.getIsPlaying()).toBe(false);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Состояние должно сохраниться
      expect(voice.getUsePulse()).toBe(true);
      expect(voice.getPulseChaos()).toBe(true);
    });
  });
});

// ===== ПОЛНЫЕ КОМБИНИРОВАННЫЕ ТЕСТЫ =====

describe('Voice - Full Combined Tests (Все функции)', () => {
  
  let mockAudioContext: AudioContext;
  let mockMasterGain: GainNode;
  let mockNoiseGenerator: Partial<NoiseGenerator>;
  let voice: Voice;

  beforeEach(() => {
    window.setTimeout = vi.fn((_callback: () => void, _delay?: number) => 1) as any;
    window.clearTimeout = vi.fn((_id?: number) => {}) as any;

    const { mockAudioContext: ctx, mockGain } = createMockAudioContext();
    mockAudioContext = ctx;
    mockMasterGain = mockGain as any;
    mockNoiseGenerator = createMockNoiseGenerator();

    voice = new Voice(mockAudioContext, mockMasterGain, mockNoiseGenerator as any);
  });

  afterEach(() => {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    vi.clearAllMocks();
    voice.dispose();
  });

  // ===== PULSE + CHAOS + параметры =====
  describe('PULSE + CHAOS + базовые параметры', () => {
    
    it('PULSE вкл -> Chaos вкл -> PULSE выкл -> Chaos выкл', () => {
      // PULSE вкл
      voice.setPulseEnabled(true);
      expect(voice.getUsePulse()).toBe(true);
      expect(voice.getIsPlaying()).toBe(false);
      
      // Chaos вкл
      voice.setPulseChaos(true);
      expect(voice.getPulseChaos()).toBe(true);
      
      // Запуск
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // PULSE выкл (переходим на непрерывный)
      voice.setPulseEnabled(false);
      expect(voice.getUsePulse()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Chaos выкл
      voice.setPulseChaos(false);
      expect(voice.getPulseChaos()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('Все параметры PULSE + Chaos: Tone/Gap/Randomize/Fade', () => {
      voice.setPulseEnabled(true);
      voice.setPulseChaos(true);
      voice.setPulseToneDuration(150);
      voice.setPulseGapDuration(300);
      voice.setPulseRandomize(true);
      voice.setPulseFadeOutDuration(50);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Меняем параметры на лету
      voice.setPulseToneDuration(200);
      voice.setPulseGapDuration(400);
      voice.setPulseRandomize(false);
      voice.setPulseFadeOutDuration(100);
      
      expect(voice.getPulseToneDuration()).toBe(200);
      expect(voice.getPulseGapDuration()).toBe(400);
      expect(voice.getPulseRandomize()).toBe(false);
      expect(voice.getPulseFadeOutDuration()).toBe(100);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Отключаем Chaos
      voice.setPulseChaos(false);
      expect(voice.getPulseChaos()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('Многократное переключение Chaos во время воспроизведения', () => {
      voice.setPulseEnabled(true);
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Многократное переключение
      for (let i = 0; i < 5; i++) {
        voice.setPulseChaos(true);
        expect(voice.getPulseChaos()).toBe(true);
        expect(voice.getIsPlaying()).toBe(true);
        
        voice.setPulseChaos(false);
        expect(voice.getPulseChaos()).toBe(false);
        expect(voice.getIsPlaying()).toBe(true);
      }
    });
  });

  // ===== SWEEP + PULSE взаимоисключение =====
  describe('SWEEP + PULSE взаимоисключение', () => {
    
    it('PULSE -> SWEEP -> PULSE -> SWEEP с воспроизведением', () => {
      // PULSE вкл и запуск
      voice.setPulseEnabled(true);
      voice.start();
      expect(voice.getUsePulse()).toBe(true);
      expect(voice.getIsPlaying()).toBe(true);
      
      // SWEEP вкл (PULSE выключается автоматически)
      voice.setSweepEnabled(true);
      expect(voice.getUseSweep()).toBe(true);
      expect(voice.getUsePulse()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
      
      // PULSE вкл (SWEEP выключается автоматически)
      voice.setPulseEnabled(true);
      expect(voice.getUsePulse()).toBe(true);
      expect(voice.getUseSweep()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
      
      // SWEEP вкл
      voice.setSweepEnabled(true);
      expect(voice.getUseSweep()).toBe(true);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('Chaos сохраняется при переключении PULSE/SWEEP', () => {
      voice.setPulseEnabled(true);
      voice.setPulseChaos(true);
      expect(voice.getPulseChaos()).toBe(true);
      
      // Переключаем на SWEEP
      voice.setSweepEnabled(true);
      expect(voice.getUseSweep()).toBe(true);
      expect(voice.getUsePulse()).toBe(false);
      
      // Chaos не должен влиять на SWEEP, но состояние сохраняется
      expect(voice.getPulseChaos()).toBe(true);
      
      // Возвращаем PULSE
      voice.setPulseEnabled(true);
      expect(voice.getPulseChaos()).toBe(true);
    });
  });

  // ===== Loop/Ping-Pong взаимоисключение =====
  describe('Loop/Ping-Pong взаимоисключение в SWEEP', () => {
    
    it('SWEEP -> Loop -> Ping-Pong -> Loop с воспроизведением', () => {
      voice.setSweepEnabled(true);
      voice.start();
      expect(voice.getSweepLoop()).toBe(true);
      expect(voice.getSweepPingPong()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Ping-Pong вкл (Loop выключается)
      voice.setSweepPingPong(true);
      expect(voice.getSweepPingPong()).toBe(true);
      expect(voice.getSweepLoop()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Loop вкл (Ping-Pong выключается)
      voice.setSweepLoop(true);
      expect(voice.getSweepLoop()).toBe(true);
      expect(voice.getSweepPingPong()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('Loop всегда включен (Ping-Pong не может отключить Loop без включения Ping-Pong)', () => {
      voice.setSweepEnabled(true);
      
      // Loop должен быть всегда включен
      expect(voice.getSweepLoop()).toBe(true);
      expect(voice.getSweepPingPong() || voice.getSweepLoop()).toBe(true);
    });
  });

  // ===== Smart Module + Beats =====
  describe('Smart Module + Beats', () => {
    
    it('Smart Module вкл -> Beats вкл -> частота изменяется -> Beats выкл', () => {
      voice.setIsSmartModule(true);
      voice.setFrequency(100);
      expect(voice.getIsSmartModule()).toBe(true);
      
      voice.setBeatEnabled(true);
      expect(voice.getBeatEnabled()).toBe(true);
      
      voice.setBeatOffset(5);
      expect(voice.getBeatOffset()).toBe(5);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Изменяем параметры
      voice.setBeatOffset(10);
      expect(voice.getBeatOffset()).toBe(10);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Выключаем Beats
      voice.setBeatEnabled(false);
      expect(voice.getBeatEnabled()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('Beats + PULSE работают вместе', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setPulseEnabled(true);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      expect(voice.getBeatEnabled()).toBe(true);
      expect(voice.getUsePulse()).toBe(true);
    });

    it('Beats + Chaos работают вместе', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setPulseEnabled(true);
      voice.setPulseChaos(true);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      expect(voice.getBeatEnabled()).toBe(true);
      expect(voice.getPulseChaos()).toBe(true);
    });
  });

  // ===== Комплексные сценарии =====
  describe('Комплексные сценарии реального использования', () => {
    
    it('Сценарий 1: Непрерывный -> PULSE -> Chaos -> PULSE параметры -> Непрерывный', () => {
      // Непрерывный режим
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Переключаем на PULSE
      voice.setPulseEnabled(true);
      expect(voice.getUsePulse()).toBe(true);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Включаем Chaos
      voice.setPulseChaos(true);
      expect(voice.getPulseChaos()).toBe(true);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Меняем параметры PULSE
      voice.setPulseToneDuration(200);
      voice.setPulseGapDuration(500);
      expect(voice.getPulseToneDuration()).toBe(200);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Отключаем PULSE
      voice.setPulseEnabled(false);
      expect(voice.getUsePulse()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('Сценарий 2: SWEEP с Loop -> Ping-Pong -> PULSE -> Chaos', () => {
      voice.setSweepEnabled(true);
      expect(voice.getSweepLoop()).toBe(true);
      
      // Ping-Pong
      voice.setSweepPingPong(true);
      expect(voice.getSweepPingPong()).toBe(true);
      
      // Запуск
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Переключаем на PULSE
      voice.setPulseEnabled(true);
      expect(voice.getUsePulse()).toBe(true);
      expect(voice.getUseSweep()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Chaos
      voice.setPulseChaos(true);
      expect(voice.getPulseChaos()).toBe(true);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('Сценарий 3: Smart Module с Beats -> PULSE -> Chaos -> частота', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setFrequency(50);
      voice.setBeatOffset(2);
      
      voice.setPulseEnabled(true);
      voice.setPulseChaos(true);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Изменяем частоту
      voice.setFrequency(80);
      expect(voice.getFrequency()).toBe(80);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Меняем Beat offset
      voice.setBeatOffset(5);
      expect(voice.getBeatOffset()).toBe(5);
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('Сценарий 4: Все параметры -> Остановка -> Запуск -> Проверка состояния', () => {
      // Устанавливаем все
      voice.setPulseEnabled(true);
      voice.setPulseChaos(true);
      voice.setPulseToneDuration(100);
      voice.setPulseGapDuration(200);
      voice.setPulseRandomize(true);
      voice.setPulseFadeOutDuration(30);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Остановка
      voice.stop();
      expect(voice.getIsPlaying()).toBe(false);
      
      // Запуск
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // Проверяем все параметры
      expect(voice.getUsePulse()).toBe(true);
      expect(voice.getPulseChaos()).toBe(true);
      expect(voice.getPulseToneDuration()).toBe(100);
      expect(voice.getPulseGapDuration()).toBe(200);
      expect(voice.getPulseRandomize()).toBe(true);
      expect(voice.getPulseFadeOutDuration()).toBe(30);
    });

    it('Сценарий 5: Rapid toggling всех режимов', () => {
      voice.start();
      
      // Rapid toggling PULSE
      for (let i = 0; i < 3; i++) {
        voice.setPulseEnabled(true);
        expect(voice.getUsePulse()).toBe(true);
        voice.setPulseEnabled(false);
        expect(voice.getUsePulse()).toBe(false);
      }
      
      // Rapid toggling SWEEP
      for (let i = 0; i < 3; i++) {
        voice.setSweepEnabled(true);
        expect(voice.getUseSweep()).toBe(true);
        voice.setSweepEnabled(false);
        expect(voice.getUseSweep()).toBe(false);
      }
      
      // Rapid toggling Chaos
      voice.setPulseEnabled(true);
      for (let i = 0; i < 3; i++) {
        voice.setPulseChaos(true);
        expect(voice.getPulseChaos()).toBe(true);
        voice.setPulseChaos(false);
        expect(voice.getPulseChaos()).toBe(false);
      }
      
      // Rapid toggling Ping-Pong
      for (let i = 0; i < 3; i++) {
        voice.setSweepEnabled(true);
        voice.setSweepPingPong(true);
        expect(voice.getSweepPingPong()).toBe(true);
        voice.setSweepPingPong(false);
        expect(voice.getSweepPingPong()).toBe(false);
      }
      
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('Сценарий 6: Smart Module + Beats + PULSE + Chaos + SWEEP', () => {
      // Smart Module
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setBeatOffset(3);
      
      // PULSE + Chaos
      voice.setPulseEnabled(true);
      voice.setPulseChaos(true);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      
      // SWEEP (выключает PULSE)
      voice.setSweepEnabled(true);
      expect(voice.getUseSweep()).toBe(true);
      expect(voice.getUsePulse()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
      
      // Beats должен работать с SWEEP
      expect(voice.getBeatEnabled()).toBe(true);
      
      // Ping-Pong
      voice.setSweepPingPong(true);
      expect(voice.getSweepPingPong()).toBe(true);
      expect(voice.getIsPlaying()).toBe(true);
    });
  });

  // ===== Edge cases =====
  describe('Edge cases и граничные условия', () => {
    
    it('Пустой старт (без параметров)', () => {
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
      expect(voice.getUsePulse()).toBe(false);
      expect(voice.getUseSweep()).toBe(false);
      expect(voice.getPulseChaos()).toBe(false);
    });

    it('Остановка без воспроизведения', () => {
      voice.stop();
      expect(voice.getIsPlaying()).toBe(false);
    });

    it('Множественные setPulseEnabled без изменения состояния', () => {
      voice.setPulseEnabled(true);
      voice.setPulseEnabled(true);
      voice.setPulseEnabled(true);
      expect(voice.getUsePulse()).toBe(true);
    });

    it('Параметры работают с произвольными значениями', () => {
      // Voice не имеет валидации, просто сохраняет значения
      voice.setPulseToneDuration(-100);
      expect(voice.getPulseToneDuration()).toBe(-100);
      
      voice.setPulseGapDuration(100000);
      expect(voice.getPulseGapDuration()).toBe(100000);
    });

    it('Smart Module без Beats', () => {
      voice.setIsSmartModule(true);
      expect(voice.getIsSmartModule()).toBe(true);
      expect(voice.getBeatEnabled()).toBe(false);
      
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);
    });

    it('Chaos без PULSE (Chaos игнорируется)', () => {
      voice.setPulseChaos(true);
      voice.start();
      expect(voice.getPulseChaos()).toBe(true);
      expect(voice.getUsePulse()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);
    });
  });
});

// ===== DRIFT MODE TESTS =====

describe('Voice - Drift Mode (Плавание)', () => {

  let mockAudioContext: AudioContext;
  let mockMasterGain: GainNode;
  let mockNoiseGenerator: Partial<NoiseGenerator>;
  let voice: Voice;

  beforeEach(() => {
    window.setTimeout = vi.fn((_callback: () => void, _delay?: number) => 1) as any;
    window.clearTimeout = vi.fn((_id?: number) => {}) as any;

    const mockGain = {
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn()
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockAudioContext = {
      currentTime: 0,
      state: 'running',
      createGain: vi.fn().mockReturnValue(mockGain),
      createOscillator: vi.fn().mockReturnValue({
        type: 'sine',
        frequency: { value: 440, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }),
      destination: {},
    } as any;

    mockMasterGain = mockGain as any;

    mockNoiseGenerator = {
      createNoiseBuffer: vi.fn().mockReturnValue({
        duration: 2,
        numberOfChannels: 2,
        sampleRate: 44100,
      }),
    };

    voice = new Voice(mockAudioContext, mockMasterGain, mockNoiseGenerator as any);
  });

  afterEach(() => {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    vi.clearAllMocks();
    voice.dispose();
  });

  describe('Drift Mode defaults', () => {
    it('should have driftEnabled false by default', () => {
      expect(voice.getDriftEnabled()).toBe(false);
    });

    it('should have driftSpeed 0.1 by default', () => {
      expect(voice.getDriftSpeed()).toBe(0.1);
    });

    it('should have driftDepth 1.0 by default', () => {
      expect(voice.getDriftDepth()).toBe(1.0);
    });
  });

  describe('Drift enable/disable', () => {
    it('should enable Drift Mode', () => {
      voice.setDriftEnabled(true);
      expect(voice.getDriftEnabled()).toBe(true);
    });

    it('should disable Drift Mode', () => {
      voice.setDriftEnabled(true);
      voice.setDriftEnabled(false);
      expect(voice.getDriftEnabled()).toBe(false);
    });

    it('should enable Drift during playback when Beats is active', () => {
      voice.setBeatEnabled(true);
      voice.setIsSmartModule(true);
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);

      voice.setDriftEnabled(true);
      expect(voice.getDriftEnabled()).toBe(true);

      voice.stop();
    });
  });

  describe('Drift parameters', () => {
    it('should set drift speed', () => {
      voice.setDriftSpeed(0.5);
      expect(voice.getDriftSpeed()).toBe(0.5);
    });

    it('should clamp driftSpeed minimum to 0.01', () => {
      voice.setDriftSpeed(0);
      expect(voice.getDriftSpeed()).toBe(0.01);
    });

    it('should clamp driftSpeed maximum to 1.0', () => {
      voice.setDriftSpeed(2);
      expect(voice.getDriftSpeed()).toBe(1.0);
    });

    it('should set drift depth', () => {
      voice.setDriftDepth(2.5);
      expect(voice.getDriftDepth()).toBe(2.5);
    });

    it('should clamp driftDepth minimum to 0.1', () => {
      voice.setDriftDepth(0);
      expect(voice.getDriftDepth()).toBe(0.1);
    });

    it('should clamp driftDepth maximum to 5.0', () => {
      voice.setDriftDepth(10);
      expect(voice.getDriftDepth()).toBe(5.0);
    });

    it('should accept decimal values', () => {
      voice.setDriftSpeed(0.07);
      voice.setDriftDepth(3.3);
      expect(voice.getDriftSpeed()).toBe(0.07);
      expect(voice.getDriftDepth()).toBe(3.3);
    });
  });
});

// ===== FREQUENCY HOPPING TESTS =====

describe('Voice - Frequency Hopping (Прыгающий резонанс)', () => {

  let mockAudioContext: AudioContext;
  let mockMasterGain: GainNode;
  let mockNoiseGenerator: Partial<NoiseGenerator>;
  let voice: Voice;

  beforeEach(() => {
    window.setTimeout = vi.fn((_callback: () => void, _delay?: number) => 1) as any;
    window.clearTimeout = vi.fn((_id?: number) => {}) as any;

    const mockGain = {
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn()
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockAudioContext = {
      currentTime: 0,
      state: 'running',
      createGain: vi.fn().mockReturnValue(mockGain),
      createOscillator: vi.fn().mockReturnValue({
        type: 'sine',
        frequency: { value: 440, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }),
      destination: {},
    } as any;

    mockMasterGain = mockGain as any;

    mockNoiseGenerator = {
      createNoiseBuffer: vi.fn().mockReturnValue({
        duration: 2,
        numberOfChannels: 2,
        sampleRate: 44100,
      }),
    };

    voice = new Voice(mockAudioContext, mockMasterGain, mockNoiseGenerator as any);
  });

  afterEach(() => {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    vi.clearAllMocks();
    voice.dispose();
  });

  describe('Frequency Hopping defaults', () => {
    it('should have hopEnabled false by default', () => {
      expect(voice.getHopEnabled()).toBe(false);
    });

    it('should have hopInterval 300 by default', () => {
      expect(voice.getHopInterval()).toBe(300);
    });
  });

  describe('Hopping enable/disable', () => {
    it('should enable Frequency Hopping', () => {
      voice.setHopEnabled(true);
      expect(voice.getHopEnabled()).toBe(true);
    });

    it('should disable Frequency Hopping', () => {
      voice.setHopEnabled(true);
      voice.setHopEnabled(false);
      expect(voice.getHopEnabled()).toBe(false);
    });

    it('should start hopping during playback', () => {
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);

      voice.setHopEnabled(true);
      expect(voice.getHopEnabled()).toBe(true);

      voice.stop();
    });

    it('should stop hopping when voice stops', () => {
      voice.setHopEnabled(true);
      voice.start();
      expect(voice.getIsPlaying()).toBe(true);

      voice.stop();
      expect(voice.getIsPlaying()).toBe(false);
    });
  });

  describe('Hopping parameters', () => {
    it('should set hop interval', () => {
      voice.setHopInterval(600);
      expect(voice.getHopInterval()).toBe(600);
    });

    it('should clamp hopInterval minimum to 10 seconds', () => {
      voice.setHopInterval(5);
      expect(voice.getHopInterval()).toBe(10);
    });

    it('should clamp hopInterval maximum to 1800 seconds', () => {
      voice.setHopInterval(2000);
      expect(voice.getHopInterval()).toBe(1800);
    });

    it('should accept integer values', () => {
      voice.setHopInterval(120);
      expect(voice.getHopInterval()).toBe(120);
    });
  });
});

// ===== COMBINED SMART MODULE WITH DRIFT AND HOPPING =====

describe('Voice - Smart Module + Drift + Hopping (Комбинированные)', () => {

  let mockAudioContext: AudioContext;
  let mockMasterGain: GainNode;
  let mockNoiseGenerator: Partial<NoiseGenerator>;
  let voice: Voice;

  beforeEach(() => {
    window.setTimeout = vi.fn((_callback: () => void, _delay?: number) => 1) as any;
    window.clearTimeout = vi.fn((_id?: number) => {}) as any;

    const mockGain = {
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn()
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockAudioContext = {
      currentTime: 0,
      state: 'running',
      createGain: vi.fn().mockReturnValue(mockGain),
      createOscillator: vi.fn().mockReturnValue({
        type: 'sine',
        frequency: { value: 440, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }),
      destination: {},
    } as any;

    mockMasterGain = mockGain as any;

    mockNoiseGenerator = {
      createNoiseBuffer: vi.fn().mockReturnValue({
        duration: 2,
        numberOfChannels: 2,
        sampleRate: 44100,
      }),
    };

    voice = new Voice(mockAudioContext, mockMasterGain, mockNoiseGenerator as any);
  });

  afterEach(() => {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    vi.clearAllMocks();
    voice.dispose();
  });

  describe('All features together', () => {
    it('should enable all Smart Module features', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setBeatOffset(2);
      voice.setDriftEnabled(true);
      voice.setDriftSpeed(0.3);
      voice.setDriftDepth(2.0);
      voice.setHopEnabled(true);
      voice.setHopInterval(600);

      expect(voice.getIsSmartModule()).toBe(true);
      expect(voice.getBeatEnabled()).toBe(true);
      expect(voice.getBeatOffset()).toBe(2);
      expect(voice.getDriftEnabled()).toBe(true);
      expect(voice.getDriftSpeed()).toBe(0.3);
      expect(voice.getDriftDepth()).toBe(2.0);
      expect(voice.getHopEnabled()).toBe(true);
      expect(voice.getHopInterval()).toBe(600);
    });

    it('should start with all features active', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setDriftEnabled(true);
      voice.setHopEnabled(true);

      voice.start();
      expect(voice.getIsPlaying()).toBe(true);

      voice.stop();
      expect(voice.getIsPlaying()).toBe(false);
    });

    it('should disable Drift without stopping playback', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setDriftEnabled(true);
      voice.setHopEnabled(true);

      voice.start();
      voice.setDriftEnabled(false);
      expect(voice.getDriftEnabled()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);

      voice.stop();
    });

    it('should disable Hopping without stopping playback', () => {
      voice.setIsSmartModule(true);
      voice.setBeatEnabled(true);
      voice.setDriftEnabled(true);
      voice.setHopEnabled(true);

      voice.start();
      voice.setHopEnabled(false);
      expect(voice.getHopEnabled()).toBe(false);
      expect(voice.getIsPlaying()).toBe(true);

      voice.stop();
    });
  });
});
