
export class TacticalAudio {
  private static context: AudioContext | null = null;

  private static getContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.context;
  }

  static playBlip(freq = 800, duration = 0.1, type: OscillatorType = 'sine') {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context blocked by browser policy until user interaction.");
    }
  }

  static playConfirm() {
    this.playBlip(1200, 0.05);
    setTimeout(() => this.playBlip(1800, 0.08), 50);
  }

  static playError() {
    this.playBlip(400, 0.2, 'square');
    setTimeout(() => this.playBlip(200, 0.2, 'square'), 100);
  }

  static playAlert() {
    this.playBlip(600, 0.3, 'sawtooth');
    setTimeout(() => this.playBlip(600, 0.3, 'sawtooth'), 400);
  }
}
