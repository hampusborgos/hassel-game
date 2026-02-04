// Sound effects using jsfxr with Web Audio API
import { sfxr } from 'jsfxr';

// Web Audio API context and buffer cache
let audioContext: AudioContext | null = null;
const bufferCache: Map<string, AudioBuffer> = new Map();

// Sound presets using jsfxr object format
const SOUNDS = {
  // Coin pickup - cheerful blip
  coinPickup: {
    oldParams: true,
    wave_type: 1,
    p_env_attack: 0,
    p_env_sustain: 0.009396034744603099,
    p_env_punch: 0.5974163684902583,
    p_env_decay: 0.3254609848184696,
    p_base_freq: 0.8385547879676319,
    p_freq_limit: 0,
    p_freq_ramp: 0,
    p_freq_dramp: 0,
    p_vib_strength: 0,
    p_vib_speed: 0,
    p_arp_mod: 0.23474956942366199,
    p_arp_speed: 0.5876209320649872,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 1,
    p_lpf_ramp: 0,
    p_lpf_resonance: 0,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.25,
    sample_rate: 44100,
    sample_size: 8
  },

  // Hit - short impact
  hit: {
    oldParams: true,
    wave_type: 3,
    p_env_attack: 0,
    p_env_sustain: 0.03180558715275418,
    p_env_punch: 0,
    p_env_decay: 0.20660320652149347,
    p_base_freq: 0.6977557928993304,
    p_freq_limit: 0,
    p_freq_ramp: -0.3484977726831357,
    p_freq_dramp: 0,
    p_vib_strength: 0,
    p_vib_speed: 0,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 1,
    p_lpf_ramp: 0,
    p_lpf_resonance: 0,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.2,
    sample_rate: 44100,
    sample_size: 8
  },

  // Shield pickup - magical powerup
  shieldPickup: {
    oldParams: true,
    wave_type: 1,
    p_env_attack: 0.01,
    p_env_sustain: 0.15,
    p_env_punch: 0.3,
    p_env_decay: 0.4,
    p_base_freq: 0.4,
    p_freq_limit: 0,
    p_freq_ramp: 0.2,
    p_freq_dramp: 0,
    p_vib_strength: 0.1,
    p_vib_speed: 0.3,
    p_arp_mod: 0.5,
    p_arp_speed: 0.3,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0.3,
    p_pha_ramp: 0.1,
    p_lpf_freq: 0.9,
    p_lpf_ramp: 0,
    p_lpf_resonance: 0,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.35,
    sample_rate: 44100,
    sample_size: 8
  },

  // Boss ambiance - deep rumble
  bossAmbiance: {
    oldParams: true,
    wave_type: 3,
    p_env_attack: 0.1,
    p_env_sustain: 0.3,
    p_env_punch: 0,
    p_env_decay: 0.4,
    p_base_freq: 0.08,
    p_freq_limit: 0.05,
    p_freq_ramp: 0,
    p_freq_dramp: 0,
    p_vib_strength: 0.1,
    p_vib_speed: 0.1,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 0.3,
    p_lpf_ramp: 0,
    p_lpf_resonance: 0.5,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.25,
    sample_rate: 44100,
    sample_size: 8
  },

  // Robot telegraph - warning beeps
  robotTelegraph: {
    oldParams: true,
    wave_type: 0,
    p_env_attack: 0,
    p_env_sustain: 0.05,
    p_env_punch: 0,
    p_env_decay: 0.1,
    p_base_freq: 0.8,
    p_freq_limit: 0,
    p_freq_ramp: -0.2,
    p_freq_dramp: 0,
    p_vib_strength: 0,
    p_vib_speed: 0,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0.5,
    p_duty_ramp: 0,
    p_repeat_speed: 0.4,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 0.7,
    p_lpf_ramp: 0,
    p_lpf_resonance: 0,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.3,
    sample_rate: 44100,
    sample_size: 8
  },

  // Robot run - mechanical whirr
  robotRun: {
    oldParams: true,
    wave_type: 2,
    p_env_attack: 0,
    p_env_sustain: 0.1,
    p_env_punch: 0,
    p_env_decay: 0.2,
    p_base_freq: 0.15,
    p_freq_limit: 0,
    p_freq_ramp: 0.15,
    p_freq_dramp: 0,
    p_vib_strength: 0,
    p_vib_speed: 0,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 0.5,
    p_lpf_ramp: 0.2,
    p_lpf_resonance: 0.3,
    p_hpf_freq: 0.1,
    p_hpf_ramp: 0,
    sound_vol: 0.25,
    sample_rate: 44100,
    sample_size: 8
  },

  // Shot fired - laser pew
  shotFired: {
    oldParams: true,
    wave_type: 1,
    p_env_attack: 0,
    p_env_sustain: 0.03,
    p_env_punch: 0.3,
    p_env_decay: 0.08,
    p_base_freq: 0.8,
    p_freq_limit: 0,
    p_freq_ramp: -0.5,
    p_freq_dramp: 0,
    p_vib_strength: 0,
    p_vib_speed: 0,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 0.6,
    p_lpf_ramp: -0.3,
    p_lpf_resonance: 0,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.03,
    sample_rate: 44100,
    sample_size: 8
  },

  // Railgun - powerful zap/discharge sound (Q2 style)
  railgun: {
    oldParams: true,
    wave_type: 3,
    p_env_attack: 0,
    p_env_sustain: 0.15,
    p_env_punch: 0.6,
    p_env_decay: 0.25,
    p_base_freq: 0.9,
    p_freq_limit: 0,
    p_freq_ramp: -0.4,
    p_freq_dramp: 0,
    p_vib_strength: 0.15,
    p_vib_speed: 0.4,
    p_arp_mod: -0.3,
    p_arp_speed: 0.6,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0.2,
    p_pha_ramp: -0.1,
    p_lpf_freq: 0.8,
    p_lpf_ramp: -0.2,
    p_lpf_resonance: 0.3,
    p_hpf_freq: 0.1,
    p_hpf_ramp: 0,
    sound_vol: 0.4,
    sample_rate: 44100,
    sample_size: 8
  },

  // Jump
  jump: {
    oldParams: true,
    wave_type: 0,
    p_env_attack: 0,
    p_env_sustain: 0.08,
    p_env_punch: 0,
    p_env_decay: 0.15,
    p_base_freq: 0.3,
    p_freq_limit: 0,
    p_freq_ramp: 0.3,
    p_freq_dramp: 0,
    p_vib_strength: 0,
    p_vib_speed: 0,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 0.7,
    p_lpf_ramp: 0,
    p_lpf_resonance: 0,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.3,
    sample_rate: 44100,
    sample_size: 8
  },

  // Land
  land: {
    oldParams: true,
    wave_type: 3,
    p_env_attack: 0,
    p_env_sustain: 0.04,
    p_env_punch: 0,
    p_env_decay: 0.12,
    p_base_freq: 0.2,
    p_freq_limit: 0,
    p_freq_ramp: -0.2,
    p_freq_dramp: 0,
    p_vib_strength: 0,
    p_vib_speed: 0,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 0.6,
    p_lpf_ramp: -0.2,
    p_lpf_resonance: 0,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.35,
    sample_rate: 44100,
    sample_size: 8
  },

  // Stomp kill - satisfying squish
  stompKill: {
    oldParams: true,
    wave_type: 3,
    p_env_attack: 0,
    p_env_sustain: 0.08,
    p_env_punch: 0.4,
    p_env_decay: 0.2,
    p_base_freq: 0.25,
    p_freq_limit: 0,
    p_freq_ramp: -0.4,
    p_freq_dramp: 0,
    p_vib_strength: 0,
    p_vib_speed: 0,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 0.7,
    p_lpf_ramp: -0.4,
    p_lpf_resonance: 0,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.5,
    sample_rate: 44100,
    sample_size: 8
  },

  // Shield break - shatter
  shieldBreak: {
    oldParams: true,
    wave_type: 3,
    p_env_attack: 0,
    p_env_sustain: 0.1,
    p_env_punch: 0.5,
    p_env_decay: 0.25,
    p_base_freq: 0.5,
    p_freq_limit: 0,
    p_freq_ramp: -0.3,
    p_freq_dramp: 0,
    p_vib_strength: 0.1,
    p_vib_speed: 0.2,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0.5,
    p_pha_ramp: -0.2,
    p_lpf_freq: 0.8,
    p_lpf_ramp: -0.3,
    p_lpf_resonance: 0,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.4,
    sample_rate: 44100,
    sample_size: 8
  },

  // Stuck in hole - splash
  stuckInHole: {
    oldParams: true,
    wave_type: 3,
    p_env_attack: 0,
    p_env_sustain: 0.1,
    p_env_punch: 0.2,
    p_env_decay: 0.3,
    p_base_freq: 0.3,
    p_freq_limit: 0,
    p_freq_ramp: -0.15,
    p_freq_dramp: 0,
    p_vib_strength: 0,
    p_vib_speed: 0,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 0.4,
    p_lpf_ramp: -0.3,
    p_lpf_resonance: 0.5,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.3,
    sample_rate: 44100,
    sample_size: 8
  },

  // Game over - sad descending
  gameOver: {
    oldParams: true,
    wave_type: 2,
    p_env_attack: 0.05,
    p_env_sustain: 0.3,
    p_env_punch: 0,
    p_env_decay: 0.5,
    p_base_freq: 0.3,
    p_freq_limit: 0,
    p_freq_ramp: -0.15,
    p_freq_dramp: 0,
    p_vib_strength: 0.05,
    p_vib_speed: 0.2,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 0.6,
    p_lpf_ramp: -0.2,
    p_lpf_resonance: 0,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.35,
    sample_rate: 44100,
    sample_size: 8
  },

  // Wave complete - fanfare
  waveComplete: {
    oldParams: true,
    wave_type: 0,
    p_env_attack: 0,
    p_env_sustain: 0.05,
    p_env_punch: 0.4,
    p_env_decay: 0.2,
    p_base_freq: 0.5,
    p_freq_limit: 0,
    p_freq_ramp: 0.15,
    p_freq_dramp: 0,
    p_vib_strength: 0,
    p_vib_speed: 0,
    p_arp_mod: 0.4,
    p_arp_speed: 0.3,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0,
    p_pha_ramp: 0,
    p_lpf_freq: 0.8,
    p_lpf_ramp: 0,
    p_lpf_resonance: 0,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.35,
    sample_rate: 44100,
    sample_size: 8
  },

  // Ender teleport - mystical woosh
  enderTeleport: {
    oldParams: true,
    wave_type: 3,
    p_env_attack: 0.02,
    p_env_sustain: 0.12,
    p_env_punch: 0.3,
    p_env_decay: 0.2,
    p_base_freq: 0.6,
    p_freq_limit: 0,
    p_freq_ramp: -0.35,
    p_freq_dramp: 0.05,
    p_vib_strength: 0.2,
    p_vib_speed: 0.5,
    p_arp_mod: 0.3,
    p_arp_speed: 0.4,
    p_duty: 0,
    p_duty_ramp: 0,
    p_repeat_speed: 0,
    p_pha_offset: 0.4,
    p_pha_ramp: -0.15,
    p_lpf_freq: 0.7,
    p_lpf_ramp: -0.2,
    p_lpf_resonance: 0.4,
    p_hpf_freq: 0.1,
    p_hpf_ramp: 0,
    sound_vol: 0.35,
    sample_rate: 44100,
    sample_size: 8
  },

  // Ender charge - building energy
  enderCharge: {
    oldParams: true,
    wave_type: 1,
    p_env_attack: 0.1,
    p_env_sustain: 0.25,
    p_env_punch: 0,
    p_env_decay: 0.1,
    p_base_freq: 0.15,
    p_freq_limit: 0,
    p_freq_ramp: 0.08,
    p_freq_dramp: 0,
    p_vib_strength: 0.15,
    p_vib_speed: 0.35,
    p_arp_mod: 0,
    p_arp_speed: 0,
    p_duty: 0.5,
    p_duty_ramp: 0.1,
    p_repeat_speed: 0.3,
    p_pha_offset: 0.2,
    p_pha_ramp: 0.1,
    p_lpf_freq: 0.6,
    p_lpf_ramp: 0.15,
    p_lpf_resonance: 0.5,
    p_hpf_freq: 0,
    p_hpf_ramp: 0,
    sound_vol: 0.2,
    sample_rate: 44100,
    sample_size: 8
  },
};

type SoundName = keyof typeof SOUNDS;

// Get or create AudioContext
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Initialize a sound buffer
function initSound(name: SoundName): AudioBuffer {
  const ctx = getAudioContext();
  const params = SOUNDS[name];

  // Get raw sample buffer from jsfxr (cast needed - toBuffer exists but isn't typed)
  const samples = (sfxr as unknown as { toBuffer: (p: typeof params) => number[] }).toBuffer(params);

  // Create AudioBuffer and copy samples
  const buffer = ctx.createBuffer(1, samples.length, params.sample_rate || 44100);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    channelData[i] = samples[i];
  }

  return buffer;
}

// Play a sound using Web Audio API
function playSound(name: SoundName) {
  const buffer = bufferCache.get(name);
  if (!buffer) return;

  const ctx = getAudioContext();

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  // Create source node
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // Create gain node for volume control
  const gain = ctx.createGain();
  gain.gain.value = SOUNDS[name].sound_vol ?? 0.5;

  // Connect and play
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

// Initialize audio on first user interaction
export function initAudio() {
  const ctx = getAudioContext();

  // Resume context if suspended
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  // Pre-initialize all sounds
  for (const name of Object.keys(SOUNDS)) {
    bufferCache.set(name, initSound(name as SoundName));
  }
}

// Export individual sound functions
export function playHit() {
  playSound('hit');
}

export function playCoinPickup() {
  playSound('coinPickup');
}

export function playShieldPickup() {
  playSound('shieldPickup');
}

export function playBossAmbiance() {
  playSound('bossAmbiance');
}

export function playRobotTelegraph() {
  playSound('robotTelegraph');
}

export function playRobotRun() {
  playSound('robotRun');
}

export function playShotFired() {
  playSound('shotFired');
}

export function playRailgun() {
  playSound('railgun');
}

export function playJump() {
  playSound('jump');
}

export function playLand() {
  playSound('land');
}

export function playStompKill() {
  playSound('stompKill');
}

export function playShieldBreak() {
  playSound('shieldBreak');
}

export function playStuckInHole() {
  playSound('stuckInHole');
}

export function playGameOver() {
  playSound('gameOver');
}

export function playWaveComplete() {
  playSound('waveComplete');
}

export function playEnderTeleport() {
  playSound('enderTeleport');
}

export function playEnderCharge() {
  playSound('enderCharge');
}
