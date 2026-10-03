import { useState, useCallback } from 'react';
import type { VoiceState, WaveformType, SweepType } from '../types';

interface ChannelProps {
  id: number;
  state: VoiceState;
  onStateChange: (id: number, state: Partial<VoiceState>) => void;
  onToggle: (id: number) => void;
}

/** Доступные типы волн */
const WAVEFORMS: { value: WaveformType; label: string }[] = [
  { value: 'sine', label: 'SIN' },
  { value: 'square', label: 'SQR' },
  { value: 'triangle', label: 'TRI' },
  { value: 'sawtooth', label: 'SAW' },
  { value: 'white-noise', label: 'БЕЛ' },
  { value: 'pink-noise', label: 'РОЗ' },
];

/**
 * Channel - компонент канала с раскрывающимися настройками PULSE и SWEEP
 * PULSE и SWEEP взаимоисключающие (можно включить только один)
 * Ping-Pong и Loop взаимоисключающие
 * 5-й канал - Умный модуль с Beats (Интерференция)
 */
export function Channel({ id, state, onStateChange, onToggle }: ChannelProps) {
  const [expandedPulse, setExpandedPulse] = useState(false);
  const [expandedSweep, setExpandedSweep] = useState(false);
  const [expandedBeats, setExpandedBeats] = useState(false);
  const [expandedSchedule, setExpandedSchedule] = useState(false);

  // Проверяем является ли канал Умным модулем (5-й канал)
  const isSmartModule = state.isSmartModule || id === 4;

  /** Обработчик изменения громкости */
  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onStateChange(id, { volume: parseFloat(e.target.value) / 100 });
    },
    [id, onStateChange]
  );

  /** Обработчик изменения частоты */
  const handleFrequencyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Math.max(1, Math.min(22000, parseFloat(e.target.value) || 1));
      onStateChange(id, { frequency: value });
    },
    [id, onStateChange]
  );

  /** Обработчик изменения типа волны */
  const handleWaveformChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onStateChange(id, { waveform: e.target.value as WaveformType });
    },
    [id, onStateChange]
  );

  /** Переключение режима PULSE (выключает SWEEP) */
  const togglePulse = useCallback(() => {
    if (state.usePulse) {
      onStateChange(id, { usePulse: false });
      setExpandedPulse(false);
    } else {
      onStateChange(id, { usePulse: true, useSweep: false });
      setExpandedPulse(true);
      setExpandedSweep(false);
    }
  }, [id, onStateChange, state.usePulse]);

  /** Переключение режима SWEEP (выключает PULSE) */
  const toggleSweep = useCallback(() => {
    if (state.useSweep) {
      onStateChange(id, { useSweep: false });
      setExpandedSweep(false);
    } else {
      onStateChange(id, { useSweep: true, usePulse: false });
      setExpandedSweep(true);
      setExpandedPulse(false);
    }
  }, [id, onStateChange, state.useSweep]);

  /** Переключение Beats (Интерференция) */
  const toggleBeats = useCallback(() => {
    if (state.beatEnabled) {
      onStateChange(id, { beatEnabled: false });
      setExpandedBeats(false);
    } else {
      onStateChange(id, { beatEnabled: true });
      setExpandedBeats(true);
    }
  }, [id, onStateChange, state.beatEnabled]);

  /** Переключение Drift Mode */
  const toggleDrift = useCallback(() => {
    onStateChange(id, { driftEnabled: !state.driftEnabled });
  }, [id, onStateChange, state.driftEnabled]);

  /** Переключение Frequency Hopping */
  const toggleHop = useCallback(() => {
    onStateChange(id, { hopEnabled: !state.hopEnabled });
  }, [id, onStateChange, state.hopEnabled]);

  /** Изменение режима Scheduler */
  const handleScheduleModeChange = useCallback((mode: 'clock' | 'timer' | 'cycle') => {
    // Если режим уже активен - выключаем его
    if (state.scheduleEnabled && state.scheduleMode === mode) {
      onStateChange(id, { 
        scheduleMode: mode,
        scheduleEnabled: false
      });
      setExpandedSchedule(false);
    } else {
      // Включаем новый режим
      onStateChange(id, { 
        scheduleMode: mode,
        scheduleEnabled: true
      });
      setExpandedSchedule(true);
    }
  }, [id, onStateChange, state.scheduleEnabled, state.scheduleMode]);

  /** Переключение Loop (выключает Ping-Pong) */
  const toggleLoop = useCallback(() => {
    if (state.sweepLoop) return;
    onStateChange(id, { sweepLoop: true, sweepPingPong: false });
  }, [id, onStateChange, state.sweepLoop]);

  /** Переключение Ping-Pong (выключает Loop) */
  const togglePingPong = useCallback(() => {
    if (state.sweepPingPong) return;
    onStateChange(id, { sweepPingPong: true, sweepLoop: false });
  }, [id, onStateChange, state.sweepPingPong]);

  return (
    <div className={`channel ${state.isActive ? 'active' : ''} ${isSmartModule ? 'smart-module' : ''}`}>
      {/* Основная строка */}
      <div className="channel-row">
        {/* LED индикатор */}
        <div className={`led ${state.isActive ? 'on' : ''}`} />

        {/* Номер канала или SMART */}
        <span className={`channel-num ${isSmartModule ? 'smart' : ''}`}>
          {isSmartModule ? '◈ SMART' : `CH${id + 1}`}
        </span>

        {/* Слайдер громкости */}
        <div className="channel-volume">
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(state.volume * 100)}
            onChange={handleVolumeChange}
          />
          <span className="volume-value">{Math.round(state.volume * 100)}%</span>
        </div>

        {/* Поле частоты */}
        <div className="channel-freq">
          <input
            type="number"
            min="1"
            max="22000"
            step="0.1"
            value={state.frequency}
            onChange={handleFrequencyChange}
          />
          <span className="freq-unit">Hz</span>
        </div>

        {/* Селектор типа волны */}
        <select
          className="channel-waveform"
          value={state.waveform}
          onChange={handleWaveformChange}
        >
          {WAVEFORMS.map((wf) => (
            <option key={wf.value} value={wf.value}>
              {wf.label}
            </option>
          ))}
        </select>

        {/* Кнопки PULSE, SWEEP и BEATS */}
        <div className="channel-modes">
          {/* Кнопки PULSE и SWEEP - скрыты для Smart Module */}
          {!isSmartModule && (
            <>
              <button
                className={`btn-mode ${state.usePulse ? 'active' : ''}`}
                onClick={togglePulse}
                title="PULSE"
              >
                {state.usePulse ? '●' : '◎'}
              </button>
              <button
                className={`btn-mode ${state.useSweep ? 'active' : ''}`}
                onClick={toggleSweep}
                title="SWEEP"
              >
                {state.useSweep ? '●' : '↗'}
              </button>
              <button
                className={`btn-mode ${state.scheduleEnabled && state.scheduleMode === 'clock' ? 'active' : ''}`}
                onClick={() => handleScheduleModeChange('clock')}
                title="Clock"
              >
                🕐
              </button>
              <button
                className={`btn-mode ${state.scheduleEnabled && state.scheduleMode === 'timer' ? 'active' : ''}`}
                onClick={() => handleScheduleModeChange('timer')}
                title="Timer"
              >
                ⏲
              </button>
              <button
                className={`btn-mode ${state.scheduleEnabled && state.scheduleMode === 'cycle' ? 'active' : ''}`}
                onClick={() => handleScheduleModeChange('cycle')}
                title="Cycle"
              >
                🔄
              </button>
            </>
          )}
          {/* Кнопка BEATS только для Smart Module */}
          {isSmartModule && (
            <button
              className={`btn-mode btn-beats ${state.beatEnabled ? 'active' : ''}`}
              onClick={toggleBeats}
              title="Beats (Интерференция)"
            >
              {state.beatEnabled ? '●' : '≈'}
            </button>
          )}
        </div>

        {/* Главная кнопка вкл/выкл */}
        <button
          className={`btn-toggle ${state.isActive ? 'on' : ''}`}
          onClick={() => onToggle(id)}
        >
          {state.isActive ? '●' : '○'}
        </button>
      </div>

      {/* Раскрывающиеся настройки PULSE (не показывать для Smart Module) */}
      {expandedPulse && !isSmartModule && (
        <div className="channel-expanded pulse-settings">
          <div className="expanded-row">
            <label className="expanded-label">
              <span>Тон:</span>
              <input
                type="number"
                min="10"
                max="2000"
                value={state.pulseToneDuration}
                onChange={(e) =>
                  onStateChange(id, { pulseToneDuration: parseInt(e.target.value) || 100 })
                }
                className="inline-number"
              />
              <span className="unit">мс</span>
              <input
                type="range"
                min="10"
                max="2000"
                value={state.pulseToneDuration}
                onChange={(e) =>
                  onStateChange(id, { pulseToneDuration: parseInt(e.target.value) })
                }
                className="inline-slider"
              />
            </label>
          </div>
          <div className="expanded-row">
            <label className="expanded-label">
              <span>Пауза:</span>
              <input
                type="number"
                min="10"
                max="5000"
                value={state.pulseGapDuration}
                onChange={(e) =>
                  onStateChange(id, { pulseGapDuration: parseInt(e.target.value) || 200 })
                }
                className="inline-number"
              />
              <span className="unit">мс</span>
              <input
                type="range"
                min="10"
                max="5000"
                value={state.pulseGapDuration}
                onChange={(e) =>
                  onStateChange(id, { pulseGapDuration: parseInt(e.target.value) })
                }
                className="inline-slider"
              />
            </label>
          </div>
          <div className="expanded-row">
            <label className="expanded-label">
              <span>Затух:</span>
              <input
                type="number"
                min="5"
                max="500"
                value={state.pulseFadeOutDuration ?? 30}
                onChange={(e) =>
                  onStateChange(id, { pulseFadeOutDuration: parseInt(e.target.value) || 30 })
                }
                className="inline-number small"
              />
              <span className="unit">мс</span>
            </label>
          </div>
          <div className="expanded-row">
            <label className="checkbox-mini">
              <input
                type="checkbox"
                checked={state.pulseRandomize}
                onChange={(e) => onStateChange(id, { pulseRandomize: e.target.checked })}
              />
              <span>Рандом ±50%</span>
            </label>
          </div>
          <div className="expanded-row">
            <label className="checkbox-mini">
              <input
                type="checkbox"
                checked={state.pulseChaos}
                onChange={(e) => onStateChange(id, { pulseChaos: e.target.checked })}
              />
              <span>Хаос (50-200%)</span>
            </label>
            <span className="chaos-hint">(10% Triple-Tap)</span>
          </div>
        </div>
      )}

      {/* Раскрывающиеся настройки SWEEP (не показывать для Smart Module) */}
      {expandedSweep && !isSmartModule && (
        <div className="channel-expanded sweep-settings">
          <div className="expanded-row">
            <label className="expanded-label">
              <span>Старт:</span>
              <input
                type="number"
                min="1"
                max="22000"
                step="0.1"
                value={state.sweepStartFreq}
                onChange={(e) =>
                  onStateChange(id, { sweepStartFreq: parseFloat(e.target.value) || 1 })
                }
                className="inline-number"
              />
              <span className="unit">Hz</span>
            </label>
            <span className="arrow">→</span>
            <label className="expanded-label">
              <span>Конец:</span>
              <input
                type="number"
                min="1"
                max="22000"
                step="0.1"
                value={state.sweepEndFreq}
                onChange={(e) =>
                  onStateChange(id, { sweepEndFreq: parseFloat(e.target.value) || 1 })
                }
                className="inline-number"
              />
              <span className="unit">Hz</span>
            </label>
          </div>
          <div className="expanded-row">
            <label className="expanded-label">
              <span>Длит:</span>
              <input
                type="number"
                min="0.1"
                max="60"
                step="0.1"
                value={state.sweepDuration}
                onChange={(e) =>
                  onStateChange(id, { sweepDuration: parseFloat(e.target.value) || 1 })
                }
                className="inline-number small"
              />
              <span className="unit">с</span>
            </label>
            <select
              value={state.sweepType}
              onChange={(e) => onStateChange(id, { sweepType: e.target.value as SweepType })}
              className="sweep-type-select"
            >
              <option value="linear">Линейный</option>
              <option value="logarithmic">Логарифмический</option>
            </select>
          </div>
          <div className="expanded-row">
            <span className="expanded-label">Режим:</span>
            {/* Loop и Ping-Pong взаимоисключающие - radio buttons */}
            <button
              className={`btn-radio ${state.sweepLoop && !state.sweepPingPong ? 'active' : ''}`}
              onClick={toggleLoop}
              title="Loop - повторять свип"
            >
              ↻ Loop
            </button>
            <button
              className={`btn-radio ${state.sweepPingPong && !state.sweepLoop ? 'active' : ''}`}
              onClick={togglePingPong}
              title="Ping-Pong - туда и обратно"
            >
              ↔ Ping-Pong
            </button>
          </div>
        </div>
      )}

      {/* Раскрывающиеся настройки BEATS (только для Smart Module) */}
      {expandedBeats && isSmartModule && (
        <div className="channel-expanded beats-settings">
          <div className="expanded-row">
            <span className="beats-icon">≈</span>
            <span className="expanded-label">Смещение:</span>
            <input
              type="number"
              min="0.1"
              max="20"
              step="0.1"
              value={state.beatOffset ?? 1}
              onChange={(e) =>
                onStateChange(id, { beatOffset: parseFloat(e.target.value) || 1 })
              }
              className="inline-number small"
            />
            <span className="unit">Hz</span>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={state.beatOffset ?? 1}
              onChange={(e) =>
                onStateChange(id, { beatOffset: parseFloat(e.target.value) })
              }
              className="inline-slider"
            />
          </div>
          <div className="expanded-row">
            <label className="checkbox-mini">
              <input
                type="checkbox"
                checked={state.driftEnabled ?? false}
                onChange={toggleDrift}
              />
              <span>Плавание (Drift)</span>
            </label>
          </div>
          {state.driftEnabled && (
            <>
              <div className="expanded-row">
                <span className="expanded-label">Скорость:</span>
                <input
                  type="number"
                  min="0.01"
                  max="1.0"
                  step="0.01"
                  value={state.driftSpeed ?? 0.1}
                  onChange={(e) =>
                    onStateChange(id, { driftSpeed: parseFloat(e.target.value) || 0.1 })
                  }
                  className="inline-number small"
                />
                <span className="unit">Hz</span>
                <input
                  type="range"
                  min="0.01"
                  max="1.0"
                  step="0.01"
                  value={state.driftSpeed ?? 0.1}
                  onChange={(e) =>
                    onStateChange(id, { driftSpeed: parseFloat(e.target.value) })
                  }
                  className="inline-slider"
                />
              </div>
              <div className="expanded-row">
                <span className="expanded-label">Глубина:</span>
                <input
                  type="number"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={state.driftDepth ?? 1.0}
                  onChange={(e) =>
                    onStateChange(id, { driftDepth: parseFloat(e.target.value) || 1.0 })
                  }
                  className="inline-number small"
                />
                <span className="unit">Hz</span>
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={state.driftDepth ?? 1.0}
                  onChange={(e) =>
                    onStateChange(id, { driftDepth: parseFloat(e.target.value) })
                  }
                  className="inline-slider"
                />
              </div>
            </>
          )}
          <div className="expanded-row">
            <label className="checkbox-mini">
              <input
                type="checkbox"
                checked={state.hopEnabled ?? false}
                onChange={toggleHop}
              />
              <span>Прыгающий резонанс</span>
            </label>
          </div>
          {state.hopEnabled && (
            <div className="expanded-row">
              <span className="expanded-label">Интервал:</span>
              <input
                type="number"
                min="10"
                max="1800"
                step="10"
                value={state.hopInterval ?? 300}
                onChange={(e) =>
                  onStateChange(id, { hopInterval: parseInt(e.target.value) || 300 })
                }
                className="inline-number small"
              />
              <span className="unit">сек</span>
            </div>
          )}
          <div className="expanded-row">
            <span className="interference-info">
              Осциллятор 1: <strong>{state.frequency}</strong> Hz
            </span>
          </div>
          <div className="expanded-row">
            <span className="interference-info">
              Осциллятор 2: <strong>{(state.frequency + (state.beatOffset ?? 1)).toFixed(1)}</strong> Hz
            </span>
          </div>
          <div className="expanded-row">
            <span className="interference-rate">
              Частота интерференции: <strong>{(state.beatOffset ?? 1).toFixed(1)}</strong> Hz
            </span>
          </div>
        </div>
      )}

      {/* Раскрывающиеся настройки SCHEDULER (планировщик) */}
      {expandedSchedule && !isSmartModule && (
        <div className="channel-expanded schedule-settings">
          <div className="expanded-row">
            <span className="schedule-icon">⏱</span>
            <span className="expanded-label">Режим:</span>
            <div className="schedule-mode-group">
              <button
                className={`btn-radio ${state.scheduleMode === 'clock' ? 'active' : ''}`}
                onClick={() => handleScheduleModeChange('clock')}
              >
                Часы
              </button>
              <button
                className={`btn-radio ${state.scheduleMode === 'timer' ? 'active' : ''}`}
                onClick={() => handleScheduleModeChange('timer')}
              >
                Таймер
              </button>
              <button
                className={`btn-radio ${state.scheduleMode === 'cycle' ? 'active' : ''}`}
                onClick={() => handleScheduleModeChange('cycle')}
              >
                Цикл
              </button>
            </div>
          </div>

          {state.scheduleMode === 'clock' && (
            <>
              <div className="expanded-row">
                <span className="expanded-label">Начало:</span>
                <input
                  type="time"
                  value={state.clockStart ?? '08:00'}
                  onChange={(e) => onStateChange(id, { clockStart: e.target.value })}
                  className="inline-time"
                />
              </div>
              <div className="expanded-row">
                <span className="expanded-label">Конец:</span>
                <input
                  type="time"
                  value={state.clockEnd ?? '22:00'}
                  onChange={(e) => onStateChange(id, { clockEnd: e.target.value })}
                  className="inline-time"
                />
              </div>
            </>
          )}

          {state.scheduleMode === 'timer' && (
            <div className="expanded-row">
              <span className="expanded-label">Длит:</span>
              <input
                type="number"
                min="1"
                max="180"
                value={state.timerDuration ?? 30}
                onChange={(e) =>
                  onStateChange(id, { timerDuration: parseInt(e.target.value) || 30 })
                }
                className="inline-number small"
              />
              <span className="unit">мин</span>
            </div>
          )}

          {state.scheduleMode === 'cycle' && (
            <>
              <div className="expanded-row">
                <span className="expanded-label">Работа:</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={state.cycleWork ?? 25}
                  onChange={(e) =>
                    onStateChange(id, { cycleWork: parseInt(e.target.value) || 25 })
                  }
                  className="inline-number small"
                />
                <span className="unit">мин</span>
              </div>
              <div className="expanded-row">
                <span className="expanded-label">Отдых:</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={state.cycleRest ?? 5}
                  onChange={(e) =>
                    onStateChange(id, { cycleRest: parseInt(e.target.value) || 5 })
                  }
                  className="inline-number small"
                />
                <span className="unit">мин</span>
              </div>
              <div className="expanded-row">
                <label className="checkbox-mini">
                  <input
                    type="checkbox"
                    checked={state.isLooping ?? false}
                    onChange={(e) => onStateChange(id, { isLooping: e.target.checked })}
                  />
                  <span>Зациклить</span>
                </label>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
