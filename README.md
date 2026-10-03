# Tone Generator Pro

Multi-channel tone generator built with Web Audio API and React/TypeScript.

## Features

### Channels
- **4 regular channels** + **1 Smart Module (5th channel)**
- Independent volume, frequency, and waveform settings per channel

### Waveforms
- Sine
- Square
- Triangle
- Sawtooth
- White Noise
- Pink Noise

### Modes

#### PULSE
- Tone duration and pause
- Fade in/out
- Randomization ±50%
- **Chaos (50-200%)** — random gap after each cycle
- **Triple-Tap Burst** — 10% chance of 3 fast pulses

#### SWEEP
- Start and end frequency
- Sweep duration
- Linear/logarithmic type
- Loop/Ping-Pong modes

#### Smart Module (5th channel)
- **Beats (interference)** — two oscillators at ± offset frequency

### Extras
- Output device selection
- WAV export
- Auto-stop timer
- Live parameter sync

## Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build production bundle
npm run build

# Run production preview
npm run preview

# Run tests
npm test
```

## Tech Stack

- React 19
- TypeScript
- Web Audio API
- Vite
- Vitest
- CSS Modules

## File Structure

```
src/
├── audio/
│   ├── AudioEngine.ts    # Core engine
│   ├── Voice.ts          # Single channel
│   ├── NoiseGenerator.ts # Noise generator
│   └── WavExporter.ts    # WAV export
├── components/
│   └── Channel.tsx      # Channel UI
├── types/
│   └── index.ts        # TypeScript types
├── App.tsx              # Main component
├── App.css              # Styles
└── test/
    ├── Voice.test.ts    # Voice tests
    ├── Channel.test.tsx  # UI tests
    └── ...
```

## Changelog

### v1.4 (latest)
- Fixed output device listing
- Improved getOutputDevices fallback

### v1.3 — Fixes and optimization
- Fixed waveform switching bugs
- Live parameter sync
- Comprehensive tests (123 tests)
- Improved UI

### v1.2 — Chaos Mode
- Random gap (50-200%)
- Triple-Tap Burst (10% chance)

### v1.1 — Smart Module and Beats
- 5th channel with Beats (interference)
- Dual oscillators for beat frequencies

### v1.0 — Core features
- 4 channels + Smart Module
- PULSE with settings
- SWEEP with Loop/Ping-Pong
- White and pink noise
- Output device selection
- WAV export
- Auto-stop

## Tests

181 tests passing, covering:
- Basic Voice operations
- PULSE/SWEEP mutual exclusion
- Loop/Ping-Pong mutual exclusion
- Smart Module + Beats
- Chaos Mode
- Complex scenarios
- Edge cases

## Run

1. `npm install`
2. `npm run preview` (after `npm run build`) or `npm run dev`
3. Open http://localhost:5173 (dev) or http://localhost:4173 (preview)

## Known quirks

- `setSinkId` on Windows can be unreliable — restart playback after switching devices
- Web Audio API requires a user gesture to start (the START button)
