// Web Audio API Synthesized Siren for Village Store Admin
// 100% reliable, zero external MP3 dependencies, loud & clear on any laptop/mobile speaker

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

// Unlock AudioContext on any user gesture
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
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
}

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

      osc.type = 'triangle'; // Crisp, penetrating sound
      // Alternating high and low frequencies (880Hz / 660Hz)
      osc.frequency.setValueAtTime(toneHigh ? 880 : 660, ctx.currentTime);
      toneHigh = !toneHigh;

      // Sharp attack, sustained loud volume
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
  startSiren();
  setTimeout(() => {
    stopSiren();
  }, 1400);
};

export const isSirenPlaying = () => isPlaying;
