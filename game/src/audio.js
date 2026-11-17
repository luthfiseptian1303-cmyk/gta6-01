// Sound, all synthesised with WebAudio — no audio files, no network.
// An engine hum that follows the car's speed, a two-tone police siren, one-shot
// effects (punch, gunshot, pickup, crash, mission jingle), and a low-key bass loop
// that plays over the city. Everything is guarded so the game still runs silent
// when the browser blocks audio until the first click.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let enabled = true;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  /** A short bass line on a loop, scheduled a bar at a time. */
  function startMusic() {
    if (musicTimer) return;
    const bassNotes = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
    musicTimer = window.setInterval(() => {
      if (!ctx || !enabled || ctx.state !== 'running') return;
      const note = bassNotes[musicStep % bassNotes.length];
      musicStep += 1;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = note;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }, 450);
  }

  function blip(freq, duration, type, volume) {
    if (!ensure() || !enabled) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume || 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function noise(duration, volume, lowpass) {
    if (!ensure() || !enabled) return;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = ctx.createGain();
    gain.gain.value = volume || 0.25;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    /** Unlock audio on the first user gesture (browsers require one). */
    unlock() {
      if (ensure() && ctx.state === 'suspended') void ctx.resume();
    },
    setMuted(muted) {
      enabled = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    /** Engine pitch follows speed; call every frame while driving. */
    engine(speed, driving) {
      if (!ctx || !enabled) return;
      const target = driving ? 0.05 + Math.min(0.1, Math.abs(speed) / 560 * 0.1) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.16, ctx.currentTime, 0.08);
    },
    /** Siren wail; call every frame, louder with more stars. */
    siren(wanted) {
      if (!ctx || !enabled) return;
      if (wanted > 0) {
        sirenGain.gain.setTargetAtTime(0.03 + wanted * 0.008, ctx.currentTime, 0.1);
        sirenOsc.frequency.setTargetAtTime(650 + Math.sin(Date.now() / 380) * 180, ctx.currentTime, 0.05);
      } else {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      }
    },
    punch() { noise(0.12, 0.3, 900); },
    gunshot() { noise(0.18, 0.4, 2400); blip(160, 0.12, 'square', 0.15); },
    pickup() { blip(880, 0.12, 'sine', 0.22); window.setTimeout(() => blip(1320, 0.18, 'sine', 0.2), 90); },
    crash() { noise(0.3, 0.35, 700); },
    busted() { blip(220, 0.5, 'sawtooth', 0.2); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => blip(f, 0.25, 'sine', 0.22), i * 110));
    },
    missionFailed() { blip(330, 0.3, 'sawtooth', 0.18); window.setTimeout(() => blip(220, 0.4, 'sawtooth', 0.18), 160); },
    click() { blip(660, 0.06, 'sine', 0.15); },
  };
}
