export const playNotificationSound = () => {
  try {
    // A simple short notification beep base64 (public domain/royalty free)
    // Using a tiny data URI to avoid needing an external file
    const beep = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"; // This is just a tiny header, let's use a real audio context instead
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Play a friendly "ding" (two notes)
    osc.type = 'sine';
    
    // First note
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    
    // Second note
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    console.log("Audio not supported or blocked by browser", e);
  }
};

export const triggerHapticFeedback = (pattern = [15]) => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    try {
      window.navigator.vibrate(pattern);
    } catch (e) {
      // Ignore
    }
  }
};

export const playPopSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Play a soft, quick pop sound (simulating a physical button press)
    osc.type = 'sine';
    
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    // Ignore
  }
};
