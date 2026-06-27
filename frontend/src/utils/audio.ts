let audioCtx: AudioContext | null = null;
let isMuted = false;

// Attempt to load mute state from local storage
try {
  const savedMuted = localStorage.getItem('cbr_audio_muted');
  if (savedMuted !== null) {
    isMuted = JSON.parse(savedMuted);
  }
} catch (e) {
  console.warn('Failed to load mute state from localStorage', e);
}

function getAudioContext(): AudioContext | null {
  if (isMuted) return null;
  
  if (!audioCtx) {
    // Standard AudioContext initialization
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  
  // Resume if suspended (browser security autoplay policies)
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  return audioCtx;
}

export const audioManager = {
  isMuted: () => isMuted,
  
  toggleMute: () => {
    isMuted = !isMuted;
    try {
      localStorage.setItem('cbr_audio_muted', JSON.stringify(isMuted));
    } catch (e) {
      // ignore
    }
    if (isMuted && audioCtx) {
      audioCtx.close().then(() => {
        audioCtx = null;
      });
    }
    return isMuted;
  },

  // 1. Radar scan ping (rhythmic matchmaking sound)
  playMatchmakingSound: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const time = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.3);

    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.3);
  },

  // 2. Start Game Synth Horn (cyberpunk brass hit)
  playStartSound: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const time = ctx.currentTime;
    
    // We create a fat sound using two saw/triangle oscillators slightly detuned
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(120, time);
    osc1.frequency.linearRampToValueAtTime(80, time + 0.8);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(122, time); // slightly detuned
    osc2.frequency.linearRampToValueAtTime(81, time + 0.8);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.linearRampToValueAtTime(0.001, time + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(time);
    osc2.start(time);
    
    osc1.stop(time + 0.82);
    osc2.stop(time + 0.82);
  },

  // 3. Short high-pitched tick (countdown click)
  playTickSound: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const time = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, time);

    gain.gain.setValueAtTime(0.03, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  },

  // 4. Critical Warning Double Alarm
  playWarningSound: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const time = ctx.currentTime;
    
    const playBeep = (startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, startTime);
      
      gain.gain.setValueAtTime(0.06, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 0.15);
    };

    playBeep(time);
    playBeep(time + 0.18);
  },

  // 5. Victory Arpeggio (major key retro scale)
  playVictorySound: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const time = ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
    
    notes.forEach((freq, idx) => {
      const noteTime = time + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.08, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });
  },

  // 6. Defeat Sweep (descending dramatic sweep)
  playDefeatSound: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const time = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.linearRampToValueAtTime(55, time + 1.2);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.linearRampToValueAtTime(0.001, time + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 1.25);
  }
};
