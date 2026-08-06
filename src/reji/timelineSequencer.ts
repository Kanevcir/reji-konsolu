/**
 * V14.0 — Makro Senaryo Kaydedici ve Zaman Çizelgesi (Timeline Sequencer).
 * Operatör aksiyonlarını offset(ms) ile kaydeder; setTimeout ile replay eder.
 */

import type { BpmOption, ScenarioId, TribunId } from './types';
import type { RejiMode } from './types';

/** Kaydedilebilir makro olay türleri. */
export type MacroActionType =
  | 'ACTION'
  | 'TRIBUN'
  | 'SCENARIO'
  | 'BPM'
  | 'PAUSE_TOGGLE'
  | 'AUDIO_TOGGLE'
  /** V16.0 — uzamsal bölge bitmask değişimi */
  | 'ZONE'
  /** V17.0 — BLE swarm mesh aç/kapa */
  | 'SWARM_TOGGLE'
  /** V20.0 — pixel matrix engage/stop */
  | 'MATRIX';

export type MacroEventPayload = {
  actionId?: RejiMode | 'reset';
  tribunId?: TribunId;
  scenarioId?: ScenarioId;
  bpm?: BpmOption;
  /** V16 — 4-bit zoneMask (0–15). */
  zoneMask?: number;
  /** V17 — hedef swarm durumu. */
  swarmActive?: boolean;
  /** V20 — matrix engaged flag + effect adı. */
  matrixEngaged?: boolean;
  matrixEffect?: string;
};

/** Tek zaman çizelgesi olayı. */
export type MacroEvent = {
  offsetMs: number;
  type: MacroActionType;
  payload: MacroEventPayload;
};

/** Tam makro JSON dizisi. */
export type MacroSequence = {
  version: 1;
  name: string;
  recordedAt: number;
  durationMs: number;
  events: MacroEvent[];
  /**
   * V22 — oynatma senkronu.
   * wall: PTP/setTimeout (varsayılan)
   * smpte: mutlak / cue-relative SMPTE timecode
   */
  syncMode?: 'wall' | 'smpte';
};

export type MacroPlaybackProgress = {
  /** 0–1 */
  progress: number;
  elapsedMs: number;
  durationMs: number;
};

export const EMPTY_MACRO: MacroSequence = {
  version: 1,
  name: 'Untitled Macro',
  recordedAt: 0,
  durationMs: 0,
  events: [],
};

/** Kayıt: kilitli değilse. */
export function canRecordMacro(isConsoleLocked: boolean, isBlackout: boolean) {
  return !isConsoleLocked && !isBlackout;
}

/** Oynatma: yalnızca LEAD_OPERATOR, kilit/blackout yok. */
export function canPlayMacro(
  role: string,
  isConsoleLocked: boolean,
  isBlackout: boolean,
) {
  return role === 'LEAD_OPERATOR' && !isConsoleLocked && !isBlackout;
}

/** İlerleme 0–1. */
export function computeMacroProgress(elapsedMs: number, durationMs: number) {
  if (durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, elapsedMs / durationMs));
}

/**
 * Timeline Sequencer — kayıt + oynatma zamanlayıcıları.
 * try-catch korumalı; abort tüm timeout’ları temizler.
 */
export class TimelineSequencer {
  private recording = false;
  private playing = false;
  private recordStartedAt = 0;
  private events: MacroEvent[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private playStartedAt = 0;
  private playDurationMs = 0;
  private current: MacroSequence = { ...EMPTY_MACRO, events: [] };

  isRecording() {
    return this.recording;
  }

  isPlaying() {
    return this.playing;
  }

  getSequence(): MacroSequence {
    return {
      ...this.current,
      events: this.events.map((e) => ({
        ...e,
        payload: { ...e.payload },
      })),
    };
  }

  getEventCount() {
    return this.events.length;
  }

  /** Kayıt başlat — önceki taslak temizlenir. */
  startRecording(name = 'Reji Macro') {
    try {
      this.abortPlayback();
      this.recording = true;
      this.playing = false;
      this.recordStartedAt = Date.now();
      this.events = [];
      this.current = {
        version: 1,
        name,
        recordedAt: this.recordStartedAt,
        durationMs: 0,
        events: [],
      };
      return true;
    } catch {
      this.recording = false;
      return false;
    }
  }

  /** Kayıt durdur — sequence finalize. */
  stopRecording(): MacroSequence {
    try {
      this.recording = false;
      const durationMs =
        this.events.length > 0
          ? Math.max(...this.events.map((e) => e.offsetMs))
          : 0;
      this.current = {
        ...this.current,
        durationMs,
        events: this.events.map((e) => ({
          ...e,
          payload: { ...e.payload },
        })),
      };
      return this.getSequence();
    } catch {
      this.recording = false;
      return { ...EMPTY_MACRO, events: [] };
    }
  }

  /** Kayıt sırasında olay ekle (playback kaynaklı değil). */
  recordEvent(type: MacroActionType, payload: MacroEventPayload = {}) {
    if (!this.recording || this.playing) return null;
    try {
      const offsetMs = Math.max(0, Date.now() - this.recordStartedAt);
      const event: MacroEvent = {
        offsetMs,
        type,
        payload: { ...payload },
      };
      this.events.push(event);
      return event;
    } catch {
      return null;
    }
  }

  /**
   * Makroyu oynat.
   * onEvent: her adımda çağrılır (sanal buton).
   * onProgress / onComplete / onAbort opsiyonel.
   */
  play(
    sequence: MacroSequence,
    handlers: {
      onEvent: (event: MacroEvent) => void;
      onProgress?: (progress: MacroPlaybackProgress) => void;
      onComplete?: () => void;
      onAbort?: () => void;
    },
  ): boolean {
    try {
      this.abortPlayback();
      if (!sequence.events.length) return false;

      this.playing = true;
      this.recording = false;
      this.playStartedAt = Date.now();
      const durationMs =
        sequence.durationMs ||
        Math.max(...sequence.events.map((e) => e.offsetMs), 0);
      this.playDurationMs = durationMs;

      for (const event of sequence.events) {
        const timer = setTimeout(() => {
          try {
            if (!this.playing) return;
            handlers.onEvent(event);
          } catch {
            // tek olay hatası oynatmayı bozmaz
          }
        }, Math.max(0, event.offsetMs));
        this.timers.push(timer);
      }

      this.progressTimer = setInterval(() => {
        try {
          if (!this.playing) return;
          const elapsedMs = Date.now() - this.playStartedAt;
          handlers.onProgress?.({
            progress: computeMacroProgress(elapsedMs, this.playDurationMs),
            elapsedMs,
            durationMs: this.playDurationMs,
          });
        } catch {
          // ignore
        }
      }, 100);

      const endTimer = setTimeout(() => {
        try {
          this.clearTimers();
          this.playing = false;
          handlers.onProgress?.({
            progress: 1,
            elapsedMs: this.playDurationMs,
            durationMs: this.playDurationMs,
          });
          handlers.onComplete?.();
        } catch {
          this.playing = false;
        }
      }, durationMs + 40);
      this.timers.push(endTimer);

      return true;
    } catch {
      this.abortPlayback();
      handlers.onAbort?.();
      return false;
    }
  }

  /**
   * V22 — SMPTE Timecode Trigger.
   * Event offsetMs, cue başlangıcına göre SMPTE ms cinsinden yorumlanır.
   * getTimecodeMs: mutlak SMPTE → ms (fps bilinciyle).
   */
  playOnTimecode(
    sequence: MacroSequence,
    handlers: {
      getTimecodeMs: () => number;
      onEvent: (event: MacroEvent) => void;
      onProgress?: (progress: MacroPlaybackProgress) => void;
      onComplete?: () => void;
      onAbort?: () => void;
    },
  ): boolean {
    try {
      this.abortPlayback();
      if (!sequence.events.length) return false;

      this.playing = true;
      this.recording = false;
      const sorted = [...sequence.events].sort((a, b) => a.offsetMs - b.offsetMs);
      const durationMs =
        sequence.durationMs ||
        Math.max(...sorted.map((e) => e.offsetMs), 0);
      this.playDurationMs = durationMs;

      const cueStartMs = handlers.getTimecodeMs();
      let nextIndex = 0;
      const fired = new Set<number>();

      this.progressTimer = setInterval(() => {
        try {
          if (!this.playing) return;
          const nowTc = handlers.getTimecodeMs();
          const elapsedMs = Math.max(0, nowTc - cueStartMs);

          while (nextIndex < sorted.length) {
            const event = sorted[nextIndex]!;
            if (elapsedMs + 0.5 < event.offsetMs) break;
            if (!fired.has(nextIndex)) {
              fired.add(nextIndex);
              try {
                handlers.onEvent(event);
              } catch {
                // ignore
              }
            }
            nextIndex += 1;
          }

          handlers.onProgress?.({
            progress: computeMacroProgress(elapsedMs, this.playDurationMs),
            elapsedMs,
            durationMs: this.playDurationMs,
          });

          if (elapsedMs >= this.playDurationMs && nextIndex >= sorted.length) {
            this.clearTimers();
            this.playing = false;
            handlers.onProgress?.({
              progress: 1,
              elapsedMs: this.playDurationMs,
              durationMs: this.playDurationMs,
            });
            handlers.onComplete?.();
          }
        } catch {
          // tick hatası oynatmayı bozmaz
        }
      }, 40);

      return true;
    } catch {
      this.abortPlayback();
      handlers.onAbort?.();
      return false;
    }
  }

  /** Blackout / STOP — tüm zamanlayıcıları iptal et. */
  abortPlayback() {
    try {
      this.clearTimers();
      this.playing = false;
    } catch {
      this.playing = false;
    }
  }

  stopAll() {
    try {
      if (this.recording) this.stopRecording();
      this.abortPlayback();
    } catch {
      this.recording = false;
      this.playing = false;
    }
  }

  private clearTimers() {
    for (const t of this.timers) {
      clearTimeout(t);
    }
    this.timers = [];
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }
}
