/**
 * V26.0 — Client Precise Scheduler.
 * targetTimestamp anında milisaniyelik yürütme:
 * uzun gecikmede setTimeout, son pencerede busy-yield spin.
 * Jitter / ping farkı komut anını kaydırmaz (PTP duvar saati).
 */

export type SchedulerClock = () => number;

export type ScheduledHandle = {
  cancel: () => void;
  /** Hedef PTP ms. */
  targetTimestamp: number;
};

export type ScheduleAtOptions = {
  targetTimestamp: number;
  onFire: () => void;
  /** Varsayılan: Date.now — üretimde getSyncedTimestamp verin. */
  now?: SchedulerClock;
  /**
   * Son hassas pencere (ms). Bu süreden kısa kala spin/yield.
   * Varsayılan 6ms.
   */
  precisionWindowMs?: number;
  /** Test için setTimeout override. */
  scheduleLater?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearLater?: (id: ReturnType<typeof setTimeout>) => void;
};

const DEFAULT_PRECISION_WINDOW_MS = 6;

/**
 * targetTimestamp’e kadar bekler, sonra onFire.
 * Erken gelmiş paketler tamponlanır; geç kalmışlar hemen çalışır.
 */
export function scheduleAtPtp(opts: ScheduleAtOptions): ScheduledHandle {
  const nowFn = opts.now ?? (() => Date.now());
  const precisionWindow = opts.precisionWindowMs ?? DEFAULT_PRECISION_WINDOW_MS;
  const scheduleLater = opts.scheduleLater ?? setTimeout;
  const clearLater = opts.clearLater ?? clearTimeout;

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let rafSpin = false;

  const clearTimer = () => {
    if (timer != null) {
      clearLater(timer);
      timer = null;
    }
  };

  const fire = () => {
    if (cancelled) return;
    cancelled = true;
    clearTimer();
    try {
      opts.onFire();
    } catch {
      // istemci UI’yı bozma
    }
  };

  const tick = () => {
    if (cancelled) return;
    const remaining = opts.targetTimestamp - nowFn();
    if (remaining <= 0) {
      fire();
      return;
    }
    if (remaining > precisionWindow) {
      // Erken uyan — precision penceresine yaklaş
      const wait = Math.max(1, remaining - precisionWindow);
      clearTimer();
      timer = scheduleLater(tick, wait);
      return;
    }
    // Hassas pencere: microtask / 0-delay yield ile spin
    rafSpin = true;
    const spin = () => {
      if (cancelled || !rafSpin) return;
      if (nowFn() >= opts.targetTimestamp) {
        fire();
        return;
      }
      timer = scheduleLater(spin, 0);
    };
    spin();
  };

  tick();

  return {
    targetTimestamp: opts.targetTimestamp,
    cancel: () => {
      cancelled = true;
      rafSpin = false;
      clearTimer();
    },
  };
}

/**
 * Birden fazla cue’yu sırayla zamanla.
 * Dönüş: toplu iptal.
 */
export function scheduleCueList(
  cues: Array<{ targetTimestamp: number; id: string }>,
  onCue: (id: string) => void,
  clock?: SchedulerClock,
): { cancelAll: () => void; handles: ScheduledHandle[] } {
  const handles = cues.map((cue) =>
    scheduleAtPtp({
      targetTimestamp: cue.targetTimestamp,
      now: clock,
      onFire: () => onCue(cue.id),
    }),
  );
  return {
    handles,
    cancelAll: () => {
      for (const h of handles) h.cancel();
    },
  };
}

/** Geç kalma hatası (ms) — negatif = erken. */
export function measureScheduleError(
  targetTimestamp: number,
  firedAt: number,
): number {
  return firedAt - targetTimestamp;
}
