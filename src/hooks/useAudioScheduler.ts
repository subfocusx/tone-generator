import { useEffect, useRef, useCallback } from 'react';
import type { VoiceState } from '../types';

interface UseAudioSchedulerProps {
  voices: VoiceState[];
  onVoiceToggle: (id: number) => void;
}

export function useAudioScheduler({ voices, onVoiceToggle }: UseAudioSchedulerProps) {
  const intervalRef = useRef<number | null>(null);
  
  // Состояния таймеров
  const timerStartTimes = useRef<Map<number, number>>(new Map());
  const cycleStartTimes = useRef<Map<number, number>>(new Map());
  const cyclePhases = useRef<Map<number, 'work' | 'rest'>>(new Map());

  // Преобразование HH:mm в минуты
  const timeToMinutes = useCallback((time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }, []);

  // Проверка: сейчас в диапазоне start-end?
  const isInTimeRange = useCallback((start: string, end: string): boolean => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    
    if (startMinutes > endMinutes) {
      // Ночной диапазон (22:00 - 06:00)
      return nowMinutes >= startMinutes || nowMinutes < endMinutes;
    }
    // Обычный диапазон (08:00 - 22:00)  
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }, [timeToMinutes]);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      voices.forEach((voice) => {
        if (voice.isSmartModule || !voice.scheduleEnabled) return;

        // === CLOCK MODE 🕐 ===
        if (voice.scheduleMode === 'clock') {
          const shouldBeActive = isInTimeRange(
            voice.clockStart || '08:00', 
            voice.clockEnd || '22:00'
          );
          
          // Auto ON когда входим в расписание
          if (shouldBeActive && !voice.isActive) {
            onVoiceToggle(voice.id);
          }
          // Auto OFF когда выходим из расписания
          else if (!shouldBeActive && voice.isActive) {
            onVoiceToggle(voice.id);
          }
        }

        // === TIMER MODE ⏲ ===
        else if (voice.scheduleMode === 'timer') {
          const key = voice.id;
          const durationMs = (voice.timerDuration || 30) * 60 * 1000;
          
          // Таймер работает ТОЛЬКО когда звук играет
          if (voice.isActive) {
            if (!timerStartTimes.current.has(key)) {
              timerStartTimes.current.set(key, Date.now());
              return;
            }

            const startTime = timerStartTimes.current.get(key)!;
            const elapsed = Date.now() - startTime;
            
            if (elapsed >= durationMs) {
              timerStartTimes.current.delete(key);
              // Auto OFF когда таймер истек
              if (voice.isActive) {
                onVoiceToggle(voice.id);
              }
            }
          } else {
            // Сбрасываем если выключили вручную
            timerStartTimes.current.delete(key);
          }
        }

        // === CYCLE MODE 🔄 ===
        else if (voice.scheduleMode === 'cycle') {
          const key = voice.id;
          const workMs = (voice.cycleWork || 1) * 60 * 1000;
          const restMs = (voice.cycleRest || 5) * 60 * 1000;
          const isLooping = voice.isLooping ?? true;
          
          // Цикл работает ТОЛЬКО когда звук играет
          if (voice.isActive) {
            if (!cycleStartTimes.current.has(key)) {
              cycleStartTimes.current.set(key, Date.now());
              cyclePhases.current.set(key, 'work');
              return;
            }

            const startTime = cycleStartTimes.current.get(key)!;
            const phase = cyclePhases.current.get(key)!;
            const targetMs = phase === 'work' ? workMs : restMs;
            const elapsed = Date.now() - startTime;
            
            if (elapsed >= targetMs) {
              if (phase === 'work') {
                // Переход в rest
                onVoiceToggle(voice.id);
                if (isLooping) {
                  cyclePhases.current.set(key, 'rest');
                  cycleStartTimes.current.set(key, Date.now());
                } else {
                  // Остановка
                  cycleStartTimes.current.delete(key);
                  cyclePhases.current.delete(key);
                }
              } else {
                // Переход в work
                if (isLooping) {
                  onVoiceToggle(voice.id);
                  cyclePhases.current.set(key, 'work');
                  cycleStartTimes.current.set(key, Date.now());
                } else {
                  cycleStartTimes.current.delete(key);
                  cyclePhases.current.delete(key);
                }
              }
            }
          } else {
            // Сбрасываем если выключили вручную
            cycleStartTimes.current.delete(key);
            cyclePhases.current.delete(key);
          }
        }
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [voices, isInTimeRange, onVoiceToggle]);

  // Очистка
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      timerStartTimes.current.clear();
      cycleStartTimes.current.clear();
      cyclePhases.current.clear();
    };
  }, []);

  return null;
}