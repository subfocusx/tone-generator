import { describe, it, expect, beforeEach, vi } from 'vitest';

const createMockBuffer = () => {
  const data = new Float32Array(44100);
  return {
    numberOfChannels: 2,
    length: 44100,
    sampleRate: 44100,
    getChannelData: () => data,
  };
};

describe('NoiseGenerator', () => {
  let mockContext: any;
  let noiseGenerator: any;

  beforeEach(async () => {
    const { NoiseGenerator } = await import('../audio/NoiseGenerator');
    
    mockContext = {
      sampleRate: 44100,
      createBuffer: vi.fn(() => createMockBuffer()),
    };
    
    noiseGenerator = new NoiseGenerator(mockContext);
  });

  describe('createWhiteNoiseBuffer', () => {
    it('creates a buffer with correct properties', () => {
      const buffer = noiseGenerator.createWhiteNoiseBuffer(1);
      
      expect(mockContext.createBuffer).toHaveBeenCalledWith(2, 44100, 44100);
      expect(buffer.numberOfChannels).toBe(2);
      expect(buffer.sampleRate).toBe(44100);
    });

    it('generates values in range [-1, 1]', () => {
      const buffer = noiseGenerator.createWhiteNoiseBuffer(0.1);
      const channelData = buffer.getChannelData();
      
      for (let i = 0; i < channelData.length; i++) {
        expect(channelData[i]).toBeGreaterThanOrEqual(-1);
        expect(channelData[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('createPinkNoiseBuffer', () => {
    it('creates a buffer with correct properties', () => {
      const buffer = noiseGenerator.createPinkNoiseBuffer(1);
      
      expect(buffer.numberOfChannels).toBe(2);
      expect(buffer.sampleRate).toBe(44100);
    });

    it('generates values within reasonable range', () => {
      const buffer = noiseGenerator.createPinkNoiseBuffer(0.1);
      const channelData = buffer.getChannelData();
      
      for (let i = 0; i < Math.min(100, channelData.length); i++) {
        expect(channelData[i]).toBeGreaterThan(-2);
        expect(channelData[i]).toBeLessThan(2);
      }
    });
  });

  describe('createNoiseBuffer', () => {
    it('creates white noise buffer', async () => {
      const { NoiseGenerator } = await import('../audio/NoiseGenerator');
      const ng = new NoiseGenerator(mockContext);
      const buffer = ng.createNoiseBuffer('white-noise', 1);
      expect(buffer).toBeDefined();
    });

    it('creates pink noise buffer', async () => {
      const { NoiseGenerator } = await import('../audio/NoiseGenerator');
      const ng = new NoiseGenerator(mockContext);
      const buffer = ng.createNoiseBuffer('pink-noise', 1);
      expect(buffer).toBeDefined();
    });
  });
});