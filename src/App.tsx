import { useState, useEffect, useCallback, useRef } from 'react';
import { Channel } from './components/Channel';
import { audioEngine, wavExporter } from './audio';
import { useAudioScheduler } from './hooks/useAudioScheduler';
import type { VoiceState, WaveformType } from './types';
import './App.css';

/** Создает начальные состояния для 5 каналов (4 обычных + 1 Умный с Beats) */
function createInitialVoices(): VoiceState[] {
  const defaultFrequencies = [440, 880, 1760, 3520];
  const defaultWaveforms: WaveformType[] = ['sine', 'square', 'triangle', 'sawtooth'];
  
  // Первые 4 канала
  const normalChannels = Array.from({ length: 4 }, (_, i) => ({
    id: i,
    isActive: false,
    volume: 0.5,
    frequency: defaultFrequencies[i],
    waveform: defaultWaveforms[i],
    usePulse: false,
    pulseToneDuration: 100,
    pulseGapDuration: 200,
    pulseRandomize: false,
    pulseFadeOutDuration: 30,
    // Chaos Mode ("Безумный ремонт") - случайный gap, Triple-Tap Burst
    pulseChaos: false,
    useSweep: false,
    sweepStartFreq: 100,
    sweepEndFreq: 2000,
    sweepDuration: 1,
    sweepType: 'linear' as const,
    sweepLoop: true,
    sweepPingPong: false,
    // Smart Module параметры (не используются для обычных каналов)
    isSmartModule: false,
    beatEnabled: false,
    beatOffset: 1,
    driftEnabled: false,
    driftSpeed: 0.1,
    driftDepth: 1.0,
    hopEnabled: false,
    hopInterval: 300,
    // Scheduler
    scheduleEnabled: false,
    scheduleMode: 'clock' as const,
    clockStart: '08:00',
    clockEnd: '22:00',
    timerDuration: 30,
    cycleWork: 25,
    cycleRest: 5,
    isLooping: false,
  }));

  // 5-й канал - Умный модуль с Beats
  const smartModule: VoiceState = {
    id: 4,
    isActive: false,
    volume: 0.5,
    frequency: 50, // Низкая частота для вибрации
    waveform: 'sine',
    usePulse: false,
    pulseToneDuration: 100,
    pulseGapDuration: 200,
    pulseRandomize: false,
    pulseFadeOutDuration: 30,
    // Chaos Mode
    pulseChaos: false,
    useSweep: false,
    sweepStartFreq: 20,
    sweepEndFreq: 200,
    sweepDuration: 1,
    sweepType: 'linear' as const,
    sweepLoop: true,
    sweepPingPong: false,
    // Smart Module параметры
    isSmartModule: true,
    beatEnabled: false,
    beatOffset: 1, // 1 Hz смещение для интерференции
    driftEnabled: false,
    driftSpeed: 0.1,
    driftDepth: 1.0,
    hopEnabled: false,
    hopInterval: 300,
    // Scheduler (не используется для Smart Module)
    scheduleEnabled: false,
    scheduleMode: 'clock' as const,
    clockStart: '08:00',
    clockEnd: '22:00',
    timerDuration: 30,
    cycleWork: 25,
    cycleRest: 5,
    isLooping: false,
  };

  return [...normalChannels, smartModule];
}

function App() {
  const [needsUserGesture, setNeedsUserGesture] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<MediaDeviceInfo | null>(null);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [useDropdown, setUseDropdown] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [voices, setVoices] = useState<VoiceState[]>(createInitialVoices);
  const [exportDuration, setExportDuration] = useState(5);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  // Автостоп
  const [autoStopEnabled, setAutoStopEnabled] = useState(false);
  const [autoStopDuration, setAutoStopDuration] = useState(60);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const autoStopTimerRef = useRef<number | null>(null);

  // Запуск приложения после жеста пользователя
  const handleStartApp = async () => {
    try {
      await audioEngine.initialize();
      
      // Синхронизируем начальное состояние каналов с Voice объектами
      voices.forEach((voice) => {
        audioEngine.updateVoice(voice.id, voice);
      });
      
      setIsInitialized(true);
      setNeedsUserGesture(false);
      
      // Всегда получаем список устройств для dropdown
      const devices = await audioEngine.getOutputDevices();
      if (devices.length > 0) {
        setOutputDevices(devices);
        setUseDropdown(true);
      }
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
      setIsInitialized(true);
      setNeedsUserGesture(false);
    }
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      audioEngine.dispose();
      if (autoStopTimerRef.current) {
        clearInterval(autoStopTimerRef.current);
      }
    };
  }, []);

  // Выбор устройства через системный picker или dropdown
  const handleSelectDevice = useCallback(async () => {
    const devices = await audioEngine.selectOutputDevice();
    
    if (devices.length > 0) {
      setOutputDevices(devices);
      setUseDropdown(true);
      
      // Если только одно устройство - выбираем его автоматически
      if (devices.length === 1) {
        setSelectedDevice(devices[0]);
        await audioEngine.setOutputDevice(devices[0].deviceId);
      }
    }
  }, []);

  // Выбор устройства из dropdown
  const handleDeviceChange = useCallback(async (deviceId: string) => {
    const device = outputDevices.find(d => d.deviceId === deviceId);
    if (device) {
      setSelectedDevice(device);
      await audioEngine.setOutputDevice(deviceId);
      
      // Проверяем если есть активные каналы
      const hasActiveChannels = voices.some(v => v.isActive);
      if (hasActiveChannels) {
        // Предупреждаем пользователя что нужно перезапустить воспроизведение
        audioEngine.stopAll();
        setVoices(prev => prev.map(v => ({ ...v, isActive: false })));
        alert('Устройство вывода изменено. Пожалуйста, перезапустите воспроизведение для применения изменений.');
      }
    }
  }, [outputDevices, voices]);

  // Обработчик изменения мастер-громкости
  const handleMasterVolumeChange = useCallback((volume: number) => {
    setMasterVolume(volume);
    audioEngine.setMasterVolume(volume);
  }, []);

  // Обработчик изменения состояния канала
  const handleVoiceStateChange = useCallback((id: number, state: Partial<VoiceState>) => {
    setVoices((prev) => prev.map((v) => (v.id === id ? { ...v, ...state } : v)));
    audioEngine.updateVoice(id, state);
  }, []);

  // Обработчик включения/выключения канала
  const handleVoiceToggle = useCallback((id: number) => {
    setVoices((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          const newIsActive = !v.isActive;
          if (newIsActive) {
            audioEngine.startVoice(id);
          } else {
            audioEngine.stopVoice(id);
          }
          return { ...v, isActive: newIsActive };
        }
        return v;
      })
    );
  }, []);

  // Scheduler для автоматического включения/выключения каналов
  useAudioScheduler({
    voices,
    onVoiceToggle: handleVoiceToggle
  });

  // Запуск всех каналов + таймер автостопа
  const handleStartAll = useCallback(() => {
    setVoices((prev) => prev.map((v) => ({ ...v, isActive: true })));
    audioEngine.startAll();

    // Запускаем таймер автостопа
    if (autoStopEnabled) {
      setTimeRemaining(autoStopDuration);
      
      if (autoStopTimerRef.current) {
        clearInterval(autoStopTimerRef.current);
      }
      
      autoStopTimerRef.current = window.setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
            // Время истекло - останавливаем все
            audioEngine.stopAll();
            setVoices((v) => v.map((voice) => ({ ...voice, isActive: false })));
            
            if (autoStopTimerRef.current) {
              clearInterval(autoStopTimerRef.current);
              autoStopTimerRef.current = null;
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [autoStopEnabled, autoStopDuration]);

  // Остановка всех каналов
  const handleStopAll = useCallback(() => {
    setVoices((prev) => prev.map((v) => ({ ...v, isActive: false })));
    audioEngine.stopAll();
    
    // Останавливаем таймер
    setTimeRemaining(null);
    if (autoStopTimerRef.current) {
      clearInterval(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  // Экспорт в WAV
  const handleExportWav = useCallback(async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      const blob = await wavExporter.exportWav(
        voices,
        masterVolume,
        { duration: exportDuration },
        (progress) => setExportProgress(progress)
      );

      wavExporter.downloadBlob(blob, `tone-generator-${Date.now()}.wav`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Ошибка экспорта: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [voices, masterVolume, exportDuration]);

  // Экран ожидания жеста пользователя (требуется для Web Audio API)
  if (needsUserGesture) {
    return (
      <div className="loading-overlay start-screen">
        <span className="logo-icon">◈</span>
        <h1>TONE GENERATOR</h1>
        <button className="btn btn-primary btn-start" onClick={handleStartApp}>
          ▶ НАЧАТЬ
        </button>
        <p className="hint">Нажмите для активации аудио</p>
      </div>
    );
  }

  // Показываем загрузку если инициализация в процессе
  if (!isInitialized) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Инициализация аудио...</span>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Верхняя панель */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">◈</span>
          <h1>TONE GENERATOR</h1>
        </div>

        <div className="header-controls">
          {/* Выбор устройства вывода */}
          {useDropdown ? (
            /* Dropdown режим (fallback) */
            <div className="device-dropdown-group">
              <select
                className="device-select"
                value={selectedDevice?.deviceId || ''}
                onChange={(e) => handleDeviceChange(e.target.value)}
              >
                <option value="">Выберите устройство...</option>
                {outputDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Устройство ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
              <button 
                className="btn-refresh" 
                onClick={handleSelectDevice}
                title="Перечитать устройства"
              >
                ⟳
              </button>
            </div>
          ) : (
            /* Кнопка выбора (предпочтительный режим) */
            <button 
              className="btn-device"
              onClick={handleSelectDevice}
              title={selectedDevice?.label || 'Выбрать устройство вывода'}
            >
              <span className="device-icon">🔊</span>
              <span className="device-label">
                {selectedDevice?.label || 'Выбрать устройство'}
              </span>
            </button>
          )}

          {/* Мастер громкость */}
          <div className="control-group compact">
            <label>Master</label>
            <div className="slider-inline">
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume * 100}
                onChange={(e) => handleMasterVolumeChange(parseInt(e.target.value) / 100)}
              />
              <span>{Math.round(masterVolume * 100)}%</span>
            </div>
          </div>

          {/* Автостоп */}
          <div className="control-group compact auto-stop-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoStopEnabled}
                onChange={(e) => setAutoStopEnabled(e.target.checked)}
              />
              <span>Автостоп</span>
            </label>
            {autoStopEnabled && (
              <>
                <input
                  type="number"
                  min="1"
                  max="3600"
                  value={autoStopDuration}
                  onChange={(e) => setAutoStopDuration(parseInt(e.target.value) || 60)}
                  className="auto-stop-input"
                />
                <span className="auto-stop-unit">сек</span>
                {timeRemaining !== null && (
                  <span className="time-remaining">{timeRemaining}с</span>
                )}
              </>
            )}
          </div>

          {/* Кнопки управления */}
          <div className="button-group">
            <button className="btn btn-primary" onClick={handleStartAll}>
              ▶
            </button>
            <button className="btn btn-danger" onClick={handleStopAll}>
              ■
            </button>
          </div>
        </div>
      </header>

      {/* Список каналов */}
      <main className="channels-container">
        <div className="channels-header">
          <span></span>
          <span>Канал</span>
          <span>Громкость</span>
          <span>Частота</span>
          <span>Форма</span>
          <span>PULSE</span>
          <span>SWEEP</span>
          <span></span>
        </div>
        
        <div className="channels-list">
          {voices.map((voice) => (
            <Channel
              key={voice.id}
              id={voice.id}
              state={voice}
              onStateChange={handleVoiceStateChange}
              onToggle={handleVoiceToggle}
            />
          ))}
        </div>
      </main>

      {/* Нижняя панель */}
      <footer className="footer">
        <div className="export-section">
          <button
            className="btn btn-secondary"
            onClick={handleExportWav}
            disabled={isExporting}
          >
            {isExporting ? 'РЕНДЕРИНГ...' : '↩ ЭКСПОРТ WAV'}
          </button>

          <div className="control-group compact">
            <label>Длительность</label>
            <input
              type="number"
              min="1"
              max="300"
              value={exportDuration}
              onChange={(e) => setExportDuration(parseInt(e.target.value))}
            />
            <span>сек</span>
          </div>

          {isExporting && (
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${exportProgress}%` }} />
              <span className="progress-text">{Math.round(exportProgress)}%</span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App;