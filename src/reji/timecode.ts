/**
 * V22.0 — SMPTE / MIDI Timecode (MTC) dinleyici.
 * Quarter-frame + Full-frame SysEx; mutlak stüdyo saati.
 */

export const DEFAULT_SMPTE_FPS = 25;

export type SmpteTime = {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  fps: number;
};

export type TimecodeStatus = {
  /** Dış sinyal alındı mı (son 1.5s içinde). */
  locked: boolean;
  display: string;
  time: SmpteTime;
  totalMs: number;
};

export const ZERO_SMPTE: SmpteTime = {
  hours: 0,
  minutes: 0,
  seconds: 0,
  frames: 0,
  fps: DEFAULT_SMPTE_FPS,
};

export function formatSmpte(time: SmpteTime): string {
  const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
  return `${pad(time.hours)}:${pad(time.minutes)}:${pad(time.seconds)}:${pad(time.frames)}`;
}

export function smpteToMs(time: SmpteTime): number {
  try {
    const fps = time.fps > 0 ? time.fps : DEFAULT_SMPTE_FPS;
    const totalFrames =
      ((((time.hours * 60 + time.minutes) * 60 + time.seconds) * fps) +
        time.frames);
    return Math.round((totalFrames / fps) * 1000);
  } catch {
    return 0;
  }
}

export function msToSmpte(ms: number, fps = DEFAULT_SMPTE_FPS): SmpteTime {
  try {
    const f = Math.max(1, fps);
    let frames = Math.max(0, Math.round((ms / 1000) * f));
    const hours = Math.floor(frames / (f * 3600));
    frames -= hours * f * 3600;
    const minutes = Math.floor(frames / (f * 60));
    frames -= minutes * f * 60;
    const seconds = Math.floor(frames / f);
    frames -= seconds * f;
    return { hours, minutes, seconds, frames, fps: f };
  } catch {
    return { ...ZERO_SMPTE, fps };
  }
}

export function createTimecodeStatus(): TimecodeStatus {
  return {
    locked: false,
    display: formatSmpte(ZERO_SMPTE),
    time: { ...ZERO_SMPTE },
    totalMs: 0,
  };
}

export type TimecodeEngineHandlers = {
  onUpdate?: (status: TimecodeStatus) => void;
};

/**
 * MTC assembler — UI’ya throttle’lı (~10Hz) status basar.
 */
export class TimecodeEngine {
  private time: SmpteTime = { ...ZERO_SMPTE };
  private pieces = new Array<number>(8).fill(0);
  private pieceMask = 0;
  private lastSignalAt = 0;
  private handlers: TimecodeEngineHandlers | null = null;
  private emitTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;
  private locked = false;

  start(handlers: TimecodeEngineHandlers) {
    this.stop();
    this.handlers = handlers;
    this.emitTimer = setInterval(() => {
      try {
        const now = Date.now();
        const wasLocked = this.locked;
        this.locked = this.lastSignalAt > 0 && now - this.lastSignalAt < 1500;
        if (this.dirty || wasLocked !== this.locked) {
          this.dirty = false;
          this.emit();
        }
      } catch {
        // ignore
      }
    }, 100);
    this.emit();
  }

  stop() {
    if (this.emitTimer) {
      clearInterval(this.emitTimer);
      this.emitTimer = null;
    }
    this.handlers = null;
  }

  getStatus(): TimecodeStatus {
    return {
      locked: this.locked,
      display: formatSmpte(this.time),
      time: { ...this.time },
      totalMs: smpteToMs(this.time),
    };
  }

  getTotalMs() {
    return smpteToMs(this.time);
  }

  /** Ham MIDI byte’ları (MTC quarter / full frame). */
  handleMidiBytes(data: Uint8Array) {
    try {
      if (!data || data.length < 1) return;
      const status = data[0]!;

      // Quarter Frame: F1 nn
      if (status === 0xf1 && data.length >= 2) {
        this.ingestQuarterFrame(data[1]!);
        return;
      }

      // Full Frame SysEx: F0 7F 7F 01 01 hr mn sc fr F7
      if (status === 0xf0 && data.length >= 10) {
        if (
          data[1] === 0x7f &&
          data[3] === 0x01 &&
          data[4] === 0x01
        ) {
          const hr = data[5]! & 0x1f;
          const mn = data[6]! & 0x3f;
          const sc = data[7]! & 0x3f;
          const fr = data[8]! & 0x1f;
          this.applyTime({
            hours: hr,
            minutes: mn,
            seconds: sc,
            frames: fr,
            fps: this.decodeFpsFromHourByte(data[5]!),
          });
        }
      }
    } catch {
      // ignore
    }
  }

  /** Test / demo: mutlak SMPTE ayarla. */
  setTime(time: Partial<SmpteTime>) {
    this.applyTime({
      ...this.time,
      ...time,
      fps: time.fps ?? this.time.fps,
    });
  }

  private decodeFpsFromHourByte(hrByte: number): number {
    const rate = (hrByte >> 5) & 0x03;
    if (rate === 0) return 24;
    if (rate === 1) return 25;
    if (rate === 2) return 30; // drop approx
    return 30;
  }

  private ingestQuarterFrame(dataByte: number) {
    const type = (dataByte >> 4) & 0x07;
    const nibble = dataByte & 0x0f;
    this.pieces[type] = nibble;
    this.pieceMask |= 1 << type;
    this.lastSignalAt = Date.now();
    this.locked = true;

    // 8 parça tamamlanınca birleştir (tip 7 sonrası tipik)
    if (this.pieceMask === 0xff || type === 7) {
      const frames = this.pieces[0]! | (this.pieces[1]! << 4);
      const seconds = this.pieces[2]! | (this.pieces[3]! << 4);
      const minutes = this.pieces[4]! | (this.pieces[5]! << 4);
      const hoursLow = this.pieces[6]!;
      const hoursHigh = this.pieces[7]! & 0x01;
      const rateBits = (this.pieces[7]! >> 1) & 0x03;
      let fps = 25;
      if (rateBits === 0) fps = 24;
      else if (rateBits === 1) fps = 25;
      else fps = 30;

      this.applyTime({
        hours: (hoursHigh << 4) | hoursLow,
        minutes: minutes & 0x3f,
        seconds: seconds & 0x3f,
        frames: frames & 0x1f,
        fps,
      });
      if (type === 7) this.pieceMask = 0;
    } else {
      this.dirty = true;
    }
  }

  private applyTime(time: SmpteTime) {
    this.time = {
      hours: Math.min(23, Math.max(0, time.hours)),
      minutes: Math.min(59, Math.max(0, time.minutes)),
      seconds: Math.min(59, Math.max(0, time.seconds)),
      frames: Math.min(Math.max(0, time.fps - 1), Math.max(0, time.frames)),
      fps: time.fps > 0 ? time.fps : DEFAULT_SMPTE_FPS,
    };
    this.lastSignalAt = Date.now();
    this.locked = true;
    this.dirty = true;
  }

  private emit() {
    try {
      this.handlers?.onUpdate?.(this.getStatus());
    } catch {
      // ignore
    }
  }
}
