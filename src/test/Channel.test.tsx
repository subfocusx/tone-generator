import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Channel } from '../components/Channel';
import type { VoiceState } from '../types';

const mockVoiceState: VoiceState = {
  id: 0,
  isActive: false,
  volume: 0.5,
  frequency: 440,
  waveform: 'sine',
  // PULSE
  usePulse: false,
  pulseToneDuration: 100,
  pulseGapDuration: 200,
  pulseRandomize: false,
  pulseFadeOutDuration: 30,
  // Chaos Mode
  pulseChaos: false,
  // SWEEP
  useSweep: false,
  sweepStartFreq: 100,
  sweepEndFreq: 2000,
  sweepDuration: 1,
  sweepType: 'linear',
  sweepLoop: true,
  sweepPingPong: false,
  // Smart Module
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
};

describe('Channel Component', () => {
  it('renders channel number', () => {
    const onStateChange = vi.fn();
    const onToggle = vi.fn();
    render(<Channel id={0} state={mockVoiceState} onStateChange={onStateChange} onToggle={onToggle} />);
    expect(screen.getByText('CH1')).toBeInTheDocument();
  });

  it('renders volume slider', () => {
    const onStateChange = vi.fn();
    const onToggle = vi.fn();
    render(<Channel id={0} state={mockVoiceState} onStateChange={onStateChange} onToggle={onToggle} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('50');
  });

  it('renders frequency input', () => {
    const onStateChange = vi.fn();
    const onToggle = vi.fn();
    render(<Channel id={0} state={mockVoiceState} onStateChange={onStateChange} onToggle={onToggle} />);
    expect(screen.getByDisplayValue('440')).toBeInTheDocument();
  });

  it('renders waveform selector', () => {
    const onStateChange = vi.fn();
    const onToggle = vi.fn();
    render(<Channel id={0} state={mockVoiceState} onStateChange={onStateChange} onToggle={onToggle} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onToggle when toggle button clicked', () => {
    const onStateChange = vi.fn();
    const onToggle = vi.fn();
    render(<Channel id={0} state={mockVoiceState} onStateChange={onStateChange} onToggle={onToggle} />);
    
    const buttons = screen.getAllByText('○');
    fireEvent.click(buttons[0]);
    
    expect(onToggle).toHaveBeenCalledWith(0);
  });

  it('calls onStateChange when volume changes', () => {
    const onStateChange = vi.fn();
    const onToggle = vi.fn();
    render(<Channel id={0} state={mockVoiceState} onStateChange={onStateChange} onToggle={onToggle} />);
    
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '75' } });
    
    expect(onStateChange).toHaveBeenCalledWith(0, { volume: 0.75 });
  });

  it('expands PULSE settings when clicked', () => {
    const onStateChange = vi.fn();
    const onToggle = vi.fn();
    render(<Channel id={0} state={mockVoiceState} onStateChange={onStateChange} onToggle={onToggle} />);
    
    // Нажимаем на кнопку PULSE
    const pulseBtn = screen.getByText('◎');
    fireEvent.click(pulseBtn);
    
    // Проверяем что появились настройки
    expect(screen.getByText('Тон:')).toBeInTheDocument();
    expect(screen.getByText('Пауза:')).toBeInTheDocument();
  });

  it('expands SWEEP settings when clicked', () => {
    const onStateChange = vi.fn();
    const onToggle = vi.fn();
    render(<Channel id={0} state={mockVoiceState} onStateChange={onStateChange} onToggle={onToggle} />);
    
    // Нажимаем на кнопку SWEEP
    const sweepBtn = screen.getByText('↗');
    fireEvent.click(sweepBtn);
    
    // Проверяем что появились настройки
    expect(screen.getByText('Старт:')).toBeInTheDocument();
    expect(screen.getByText('Конец:')).toBeInTheDocument();
  });

  it('displays active state correctly', () => {
    const onStateChange = vi.fn();
    const onToggle = vi.fn();
    const activeState: VoiceState = { ...mockVoiceState, isActive: true };
    render(<Channel id={0} state={activeState} onStateChange={onStateChange} onToggle={onToggle} />);
    
    expect(screen.getByText('●')).toBeInTheDocument();
  });
});