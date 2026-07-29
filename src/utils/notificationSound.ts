// Web Audio API Sound Synthesizer for In-App Notifications
// Guaranteed to work in all browsers and iFrames without requiring external MP3 files or push permissions.

let audioCtx: AudioContext | null = null;
let isAudioMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function toggleAudioMute(): boolean {
  isAudioMuted = !isAudioMuted;
  if (typeof window !== 'undefined') {
    localStorage.setItem('aracatuba_audio_muted', isAudioMuted ? 'true' : 'false');
  }
  return isAudioMuted;
}

export function getIsAudioMuted(): boolean {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('aracatuba_audio_muted');
    if (stored !== null) {
      isAudioMuted = stored === 'true';
    }
  }
  return isAudioMuted;
}

/**
 * Plays an acoustic notification chime using the Web Audio API oscillator.
 */
export function playNotificationSound(type: 'chime' | 'success' | 'alert' | 'info' = 'chime') {
  if (getIsAudioMuted()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.15, now); // Soft volume
    masterGain.connect(ctx.destination);

    if (type === 'success' || type === 'chime') {
      // Gentle 2-tone melodic chime (E5 -> A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.1); // A5
      gain2.gain.setValueAtTime(0.2, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.45);
    } else if (type === 'alert') {
      // Alert 3-tone warning chime (G5 -> E5 -> C5)
      const freqs = [783.99, 659.25, 523.25];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.12;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(startTime);
        osc.stop(startTime + 0.2);
      });
    } else {
      // Soft single tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    console.warn("Audio playback not allowed yet or failed:", e);
  }
}
