// audio.js — every sound is synthesized with WebAudio: no audio files, no
// network. Footsteps tick with the player's stride, the alert sting marks a
// raised alarm, and a low room tone keeps the museum feeling alive.

export function createAudio() {
  const audio = {
    context: null,
    master: null,
    ambient: null,
    lastStep: 0,
    enabled: true,
  };

  audio.unlock = function unlock() {
    if (audio.context) {
      if (audio.context.state === 'suspended') audio.context.resume();
      return;
    }
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      audio.context = new Context();
      audio.master = audio.context.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.context.destination);
      startRoomTone(audio);
    } catch {
      audio.enabled = false;
    }
  };

  audio.step = function step(sneaking, running) {
    if (!audio.context || !audio.enabled) return;
    const now = audio.context.currentTime;
    if (now - audio.lastStep < (sneaking ? 0.42 : 0.26)) return;
    audio.lastStep = now;
    const volume = sneaking ? 0.05 : running ? 0.16 : 0.1;
    playNoiseBurst(audio, 90 + Math.random() * 60, 0.07, volume);
  };

  audio.pebble = function pebble() {
    if (!audio.context || !audio.enabled) return;
    playNoiseBurst(audio, 1400, 0.05, 0.2);
    setTimeout(() => playNoiseBurst(audio, 900, 0.06, 0.14), 90);
  };

  audio.pickup = function pickup() {
    if (!audio.context || !audio.enabled) return;
    playTone(audio, 660, 0.12, 0.16, 'sine');
    setTimeout(() => playTone(audio, 990, 0.18, 0.16, 'sine'), 90);
  };

  audio.alert = function alert() {
    if (!audio.context || !audio.enabled) return;
    playTone(audio, 220, 0.16, 0.22, 'sawtooth');
    setTimeout(() => playTone(audio, 311, 0.22, 0.22, 'sawtooth'), 140);
  };

  audio.caught = function caught() {
    if (!audio.context || !audio.enabled) return;
    playTone(audio, 196, 0.3, 0.22, 'sawtooth');
    setTimeout(() => playTone(audio, 147, 0.45, 0.22, 'sawtooth'), 220);
  };

  audio.win = function win() {
    if (!audio.context || !audio.enabled) return;
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => playTone(audio, freq, 0.22, 0.16, 'triangle'), i * 120);
    });
  };

  audio.exitOpen = function exitOpen() {
    if (!audio.context || !audio.enabled) return;
    playTone(audio, 440, 0.15, 0.14, 'triangle');
    setTimeout(() => playTone(audio, 587, 0.2, 0.14, 'triangle'), 110);
  };

  return audio;
}

function startRoomTone(audio) {
  const osc = audio.context.createOscillator();
  const gain = audio.context.createGain();
  osc.type = 'sine';
  osc.frequency.value = 55;
  gain.gain.value = 0.035;
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  audio.ambient = osc;
}

function playTone(audio, freq, duration, volume, type) {
  const osc = audio.context.createOscillator();
  const gain = audio.context.createGain();
  const now = audio.context.currentTime;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playNoiseBurst(audio, cutoff, duration, volume) {
  const length = Math.floor(audio.context.sampleRate * duration);
  const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const source = audio.context.createBufferSource();
  source.buffer = buffer;
  const filter = audio.context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = audio.context.createGain();
  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  source.start();
}
