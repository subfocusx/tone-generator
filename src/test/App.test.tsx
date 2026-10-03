import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../audio/AudioEngine', () => ({
  audioEngine: {
    initialize: vi.fn().mockResolvedValue([
      { deviceId: 'device-1', kind: 'audiooutput', label: 'Speaker' },
    ]),
    getOutputDevices: vi.fn().mockResolvedValue([
      { deviceId: 'device-1', kind: 'audiooutput', label: 'Speaker' },
    ]),
    setOutputDevice: vi.fn(),
    setMasterVolume: vi.fn(),
    updateVoice: vi.fn(),
    startVoice: vi.fn(),
    stopVoice: vi.fn(),
    startAll: vi.fn(),
    stopAll: vi.fn(),
    updatePulseSettings: vi.fn(),
    updateSweepSettings: vi.fn(),
    dispose: vi.fn(),
  },
}));

vi.mock('../audio/WavExporter', () => ({
  wavExporter: {
    exportWav: vi.fn().mockResolvedValue(new Blob(['mock'], { type: 'audio/wav' })),
    downloadBlob: vi.fn(),
  },
}));

import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

describe('Tone Generator App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Вспомогательная функция для запуска приложения
  const startApp = () => {
    const startButton = screen.getByRole('button', { name: /НАЧАТЬ/i });
    fireEvent.click(startButton);
  };

  it('renders start screen initially', async () => {
    render(<App />);
    expect(screen.getByText('TONE GENERATOR')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /НАЧАТЬ/i })).toBeInTheDocument();
    expect(screen.getByText('Нажмите для активации аудио')).toBeInTheDocument();
  });

  it('renders the app after clicking start', async () => {
    render(<App />);
    startApp();
    await screen.findByText('TONE GENERATOR');
    expect(screen.getByText('TONE GENERATOR')).toBeInTheDocument();
  });

  it('renders 4 channels after start', async () => {
    render(<App />);
    startApp();
    await screen.findByText('TONE GENERATOR');
    
    // Ищем CH1, CH2, CH3, CH4
    expect(screen.getByText('CH1')).toBeInTheDocument();
    expect(screen.getByText('CH2')).toBeInTheDocument();
    expect(screen.getByText('CH3')).toBeInTheDocument();
    expect(screen.getByText('CH4')).toBeInTheDocument();
  });

  it('renders PULSE and SWEEP sections', async () => {
    render(<App />);
    startApp();
    await screen.findByText('TONE GENERATOR');
    
    // PULSE и SWEEP есть и в настройках и в заголовке таблицы
    expect(screen.getAllByText('PULSE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SWEEP').length).toBeGreaterThanOrEqual(1);
  });

  it('renders export button', async () => {
    render(<App />);
    startApp();
    await screen.findByText('TONE GENERATOR');
    
    expect(screen.getByText('↩ ЭКСПОРТ WAV')).toBeInTheDocument();
  });
});