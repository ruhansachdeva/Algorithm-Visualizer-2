/* ============================================================
   Playback engine
   ------------------------------------------------------------
   Algorithms here don't draw anything. They `yield` snapshots
   ("frames") of what they're doing, and this file replays those
   frames like a video: play, pause, step, scrub, rewind.

   Because every frame is stored, stepping BACKWARD is free —
   we just show frame n-1. No need to re-run the algorithm.
   ============================================================ */

/**
 * Run a generator to completion and collect every frame it yields.
 *
 * @param {Generator} gen  a running algorithm generator
 * @param {number} cap     safety limit so a buggy algorithm can't
 *                         freeze the page with an infinite loop
 * @returns {Array} the frames
 */
export function record(gen, cap = 60000) {
  const frames = [];
  let result = gen.next();
  while (!result.done) {
    frames.push(result.value);
    if (frames.length >= cap) {
      frames.push({
        ...result.value,
        _truncated: true,
        note: `stopped early at the ${cap.toLocaleString()}-step limit — this run needs more steps than the app will hold in memory`,
      });
      break;
    }
    result = gen.next();
  }
  return frames;
}

/** Slider position (1–100) -> delay between steps in milliseconds. */
function speedToDelay(slider) {
  const t = (slider - 1) / 99;          // 0 .. 1
  return 500 * Math.pow(0.0085, t);     // 500ms (slow) .. ~4ms (fast)
}

export class Player {
  /**
   * @param {object} opts
   * @param {(frame:object, index:number, total:number)=>void} opts.onFrame
   *        called whenever the visible frame changes
   * @param {(playing:boolean)=>void} opts.onPlayState
   */
  constructor({ onFrame, onPlayState }) {
    this.onFrame = onFrame;
    this.onPlayState = onPlayState;

    this.frames = [];
    this.index = 0;
    this.playing = false;
    this.speed = 55;
    this.loop = false;

    this._raf = null;
    this._lastTick = 0;
    this._carry = 0;    // leftover time, so fractional steps aren't lost
  }

  /** Swap in a fresh set of frames and show the first one. */
  load(frames) {
    this.pause();
    this.frames = frames.length ? frames : [{ note: 'nothing to show' }];
    this.index = 0;
    this.emit();
  }

  get total() { return this.frames.length; }
  get atEnd() { return this.index >= this.frames.length - 1; }

  emit() {
    this.onFrame(this.frames[this.index], this.index, this.frames.length);
  }

  setSpeed(v) { this.speed = v; }

  seek(i) {
    this.index = Math.max(0, Math.min(this.frames.length - 1, i));
    this.emit();
  }

  step(delta = 1) {
    this.pause();
    this.seek(this.index + delta);
  }

  reset() {
    this.pause();
    this.seek(0);
  }

  toEnd() {
    this.pause();
    this.seek(this.frames.length - 1);
  }

  play() {
    if (this.playing || this.frames.length <= 1) return;
    // Hitting play at the very end restarts from the top.
    if (this.atEnd) this.index = 0;

    this.playing = true;
    this.onPlayState(true);
    this._lastTick = performance.now();
    this._carry = 0;
    this._loop();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this.onPlayState(false);
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  _loop() {
    this._raf = requestAnimationFrame((now) => {
      if (!this.playing) return;

      const elapsed = now - this._lastTick;
      this._lastTick = now;

      // At high speeds we owe more than one step per screen refresh,
      // so advance as many as the elapsed time paid for.
      const delay = speedToDelay(this.speed);
      this._carry += elapsed;
      let steps = Math.floor(this._carry / delay);
      this._carry -= steps * delay;

      // Don't let a tab that was backgrounded dump 10,000 steps at once.
      steps = Math.min(steps, 400);

      if (steps > 0) {
        this.index += steps;
        if (this.index >= this.frames.length - 1) {
          this.index = this.frames.length - 1;
          this.emit();
          if (this.loop) {
            // Hold on the final frame briefly so the result is readable,
            // then start over.
            this.index = 0;
            this._carry = 0;
          } else {
            this.pause();
            return;
          }
        }
        this.emit();
      }
      this._loop();
    });
  }
}
