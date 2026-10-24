// Web Audio API Synthesized Bell & Siren Sound for Zipit App
// 100% reliable, zero external MP3 dependencies, works on all mobile & desktop browsers

let audioCtx = null;
let sirenInterval = null;
let currentOsc = null;
let isPlaying = false;

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

// Unlock AudioContext on user interactions
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (e) {}
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('touchstart', unlockAudio);
}

// Play pleasant Order Bell Chime (Ding-Dong / Notification chime)
export const playBellSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Chime 1 - High bell tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.50, now); // C6 note
    gain1.gain.setValueAtTime(0.75, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.7);

    // Chime 2 - Rich secondary bell tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.18); // E6 note
    gain2.gain.setValueAtTime(0.85, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 1.1);
  } catch (e) {
    console.warn("Bell sound error:", e);
  }
};

export const startSiren = () => {
  if (isPlaying) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  isPlaying = true;
  let toneHigh = true;

  const playPulse = () => {
    if (!isPlaying) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(toneHigh ? 880 : 660, ctx.currentTime);
      toneHigh = !toneHigh;

      gain.gain.setValueAtTime(0.85, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.32);
      currentOsc = osc;
    } catch (e) {
      console.warn("Siren pulse error:", e);
    }
  };

  playPulse();
  sirenInterval = setInterval(playPulse, 340);
};

export const stopSiren = () => {
  isPlaying = false;
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
  if (currentOsc) {
    try {
      currentOsc.stop();
    } catch (e) {}
    currentOsc = null;
  }
};

export const testSiren = () => {
  playBellSound();
};

export const isSirenPlaying = () => isPlaying;
