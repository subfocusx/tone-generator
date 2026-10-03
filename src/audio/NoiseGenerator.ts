/**
 * NoiseGenerator - генератор шума для Web Audio API
 * Создает буферы с белым и розовым шумом с кэшированием
 */
export class NoiseGenerator {
  // Кэшированные буферы шума (создаются один раз)
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Создает буфер с белым шумом
   * Белый шум = случайные значения от -1 до 1 (равномерное распределение)
   * Содержит все частоты с одинаковой мощностью
   * @param duration - длительность буфера в секундах (по умолчанию 2с)
   * @returns AudioBuffer с белым шумом
   */
  createWhiteNoiseBuffer(duration: number = 2): AudioBuffer {
    // Возвращаем кэшированный буфер если он достаточно длинный
    if (this.whiteNoiseBuffer && this.whiteNoiseBuffer.duration >= duration) {
      return this.whiteNoiseBuffer;
    }

    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = Math.ceil(sampleRate * duration);
    
    // Создаем стерео буфер
    const buffer = this.audioContext.createBuffer(2, bufferSize, sampleRate);

    // Заполняем оба канала случайными значениями
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < bufferSize; i++) {
        // Math.random() * 2 - 1 = диапазон [-1, 1]
        data[i] = Math.random() * 2 - 1;
      }
    }

    this.whiteNoiseBuffer = buffer;
    return buffer;
  }

  /**
   * Создает буфер с розовым шумом
   * Розовый шум = 1/f спектр (более естественный звук)
   * Высокие частоты приглушены (как в природе)
   * Алгоритм Восса-Маккартни с 7 полюсами
   * @param duration - длительность буфера в секундах
   * @returns AudioBuffer с розовым шумом
   */
  createPinkNoiseBuffer(duration: number = 2): AudioBuffer {
    // Возвращаем кэшированный буфер если он достаточно длинный
    if (this.pinkNoiseBuffer && this.pinkNoiseBuffer.duration >= duration) {
      return this.pinkNoiseBuffer;
    }

    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = Math.ceil(sampleRate * duration);
    
    // Создаем стерео буфер
    const buffer = this.audioContext.createBuffer(2, bufferSize, sampleRate);

    // Генерируем розовый шум с помощью фильтра
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      
      // Коэффициенты для 7-полюсного фильтра (компоненты Пола Келлета)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        // Генерируем белый шум
        const white = Math.random() * 2 - 1;
        
        // Применяем фильтр (каждый полюс добавляет задержку и ослабление)
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        
        // Суммируем все компоненты + остаток
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
        
        data[i] = pink;
      }
    }

    this.pinkNoiseBuffer = buffer;
    return buffer;
  }

  /**
   * Универсальный метод создания шума
   * @param type - тип шума: 'white-noise' или 'pink-noise'
   * @param duration - длительность буфера
   * @returns AudioBuffer с выбранным типом шума
   */
  createNoiseBuffer(type: 'white-noise' | 'pink-noise', duration: number = 2): AudioBuffer {
    return type === 'white-noise' 
      ? this.createWhiteNoiseBuffer(duration)
      : this.createPinkNoiseBuffer(duration);
  }
}