// Own the existing synthesized soundtrack without changing its composition.
export class AudioLifecycle {
  constructor({ mixer, muted, releaseContext }) {
    Object.assign(this, { mixer, muted, releaseContext });
    this.voices = new Set();
    this.timer = undefined;
    this.owner = null;
    this.requested = false;
    let music = mixer.musicVolume,
      sfx = mixer.sfxVolume;
    Object.defineProperty(mixer, "musicVolume", {
      get: () => music,
      set: (value) => {
        music = value;
        this.sync();
      },
    });
    Object.defineProperty(mixer, "sfxVolume", {
      get: () => sfx,
      set: (value) => {
        sfx = value;
        if (!value) mixer.stop();
      },
    });
  }
  blocked() {
    if (!this.owner || this.blurred || document.hidden || this.muted())
      return true;
    try {
      const scene = this.owner.scene.getScene("game");
      return !!(scene?.sys.isActive() && scene.paused);
    } catch {
      return false;
    }
  }
  clearMusic() {
    if (this.timer !== undefined) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
    for (const voice of this.voices) {
      try {
        voice.osc.stop();
      } catch {}
      voice.osc.disconnect();
      voice.gain.disconnect();
    }
    this.voices.clear();
  }
  sync() {
    if (this.blocked()) {
      this.clearMusic();
      this.mixer.stop();
      return;
    }
    if (!this.requested || !(this.mixer.musicVolume > 0)) {
      this.clearMusic();
      return;
    }
    if (this.timer !== undefined) return;
    const tick = () => {
      if (this.blocked() || !(this.mixer.musicVolume > 0)) {
        this.sync();
        return;
      }
      try {
        this.tick();
      } catch {}
    };
    this.timer = window.setInterval(tick, 150);
    tick();
  }
  start(tick) {
    this.tick = tick;
    this.requested = true;
    this.sync();
  }
  stop() {
    this.requested = false;
    this.clearMusic();
  }
  tone(context, frequency, start, duration, type, volume) {
    if (this.blocked() || !(volume > 0)) return;
    const osc = context.createOscillator(),
      gain = context.createGain(),
      voice = { osc, gain };
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, volume),
      start + 0.012,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(context.destination);
    this.voices.add(voice);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
  bind(game, mount, startMusic) {
    this.dispose?.();
    this.owner = game;
    this.blurred = false;
    const interrupt = () => {
      try {
        const scene = game.scene.getScene("game");
        if (scene?.sys.isActive()) scene.autoPause();
      } catch {}
    };
    const sync = () => {
      if (document.hidden) interrupt();
      this.sync();
    };
    const blur = () => {
      this.blurred = true;
      interrupt();
      this.sync();
    };
    const focus = () => {
      this.blurred = false;
      this.sync();
    };
    const gesture = () => {
      if (!this.blocked()) startMusic();
    };
    const key = (event) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName) ||
        event.target?.isContentEditable
      )
        return;
      gesture();
    };
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", sync);
    mount.addEventListener("pointerdown", gesture);
    mount.addEventListener("keydown", key);
    game.events.on("poststep", sync);
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", sync);
      mount.removeEventListener("pointerdown", gesture);
      mount.removeEventListener("keydown", key);
      game.events.off("poststep", sync);
      game.events.off("destroy", dispose);
      if (this.owner === game) {
        this.stop();
        this.mixer.stop();
        this.mixer.last.clear();
        this.mixer.duckUntil = 0;
        this.owner = null;
        this.releaseContext();
      }
    };
    this.dispose = dispose;
    game.events.once("destroy", dispose);
    const destroy = game.destroy;
    game.destroy = function (...args) {
      dispose();
      return destroy.apply(this, args);
    };
  }
}
