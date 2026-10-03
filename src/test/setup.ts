import '@testing-library/jest-dom';
import { vi } from 'vitest';

/** Создает мок AudioContext */
const createMockAudioContext = () => ({
  createOscillator: vi.fn(() => ({
    type: 'sine',
    frequency: { value: 440, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    loop: false,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  })),
  createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => ({
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
  })),
  destination: {},
  currentTime: 0,
  sampleRate: 44100,
  close: vi.fn(),
});

/** Создает мок OfflineAudioContext */
const createMockOfflineAudioContext = () => ({
  createOscillator: vi.fn(() => ({
    type: 'sine',
    frequency: { value: 440, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
    context: { currentTime: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    loop: false,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  })),
  createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => ({
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
  })),
  destination: {},
  currentTime: 0,
  sampleRate: 44100,
  startRendering: vi.fn().mockResolvedValue({
    numberOfChannels: 2,
    sampleRate: 44100,
    length: 44100,
    getChannelData: vi.fn(() => new Float32Array(44100)),
  }),
});

// Регистрируем моки глобально
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn(() => createMockAudioContext()),
});

Object.defineProperty(window, 'OfflineAudioContext', {
  writable: true,
  value: vi.fn(() => createMockOfflineAudioContext()),
});

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: vi.fn(() => createMockAudioContext()),
});

// Мок navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    enumerateDevices: vi.fn().mockResolvedValue([
      { deviceId: 'device-1', kind: 'audiooutput', label: 'Speaker' },
    ]),
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [],
    }),
  },
  writable: true,
});