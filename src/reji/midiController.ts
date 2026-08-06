/**
 * V21.0 — Endüstriyel MIDI Fiziksel Kontrol (Tactile Hardware Mapping).
 * Web MIDI API; Note On/Off + CC → Reji komutları.
 * CC güncellemeleri throttle’lı — UI thread korunur.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const MIDI_STORAGE_KEY = '@pulse/reji-midi-bindings-v1';
export const MIDI_CC_THROTTLE_MS = 50;

/** Öğrenilebilir / bağlanabilir hedefler. */
export type MidiTarget =
  | 'BLACKOUT'
  | 'ZONE_NORTH'
  | 'ZONE_SOUTH'
  | 'ZONE_EAST'
  | 'ZONE_WEST'
  | 'ZONE_ALL'
  | 'MACRO_PLAY'
  | 'MACRO_STOP'
  | 'MACRO_REC'
  | 'SWARM_TOGGLE'
  | 'MATRIX_ENGAGE'
  | 'MATRIX_STOP'
  | 'MATRIX_SPEED'
  | 'MATRIX_INTENSITY';

export type MidiBindingKind = 'note' | 'cc';

export type MidiBinding = {
  target: MidiTarget;
  kind: MidiBindingKind;
  /** 0–15 */
  channel: number;
  /** note veya CC numarası 0–127 */
  number: number;
};

export type MidiDeviceInfo = {
  id: string;
  name: string;
  manufacturer: string;
};

export type MidiControllerStatus = {
  supported: boolean;
  accessState: 'idle' | 'pending' | 'granted' | 'denied' | 'unavailable';
  deviceName: string | null;
  devices: MidiDeviceInfo[];
  learningTarget: MidiTarget | null;
  bindings: MidiBinding[];
};

export const MIDI_LEARN_TARGETS: readonly MidiTarget[] = [
  'BLACKOUT',
  'ZONE_NORTH',
  'ZONE_SOUTH',
  'ZONE_EAST',
  'ZONE_WEST',
  'ZONE_ALL',
  'MACRO_PLAY',
  'MACRO_STOP',
  'MACRO_REC',
  'SWARM_TOGGLE',
  'MATRIX_ENGAGE',
  'MATRIX_STOP',
  'MATRIX_SPEED',
  'MATRIX_INTENSITY',
] as const;

export const DEFAULT_MIDI_BINDINGS: MidiBinding[] = [
  { target: 'BLACKOUT', kind: 'note', channel: 0, number: 36 },
  { target: 'ZONE_NORTH', kind: 'note', channel: 0, number: 40 },
  { target: 'ZONE_SOUTH', kind: 'note', channel: 0, number: 41 },
  { target: 'ZONE_EAST', kind: 'note', channel: 0, number: 42 },
  { target: 'ZONE_WEST', kind: 'note', channel: 0, number: 43 },
  { target: 'ZONE_ALL', kind: 'note', channel: 0, number: 44 },
  { target: 'MACRO_PLAY', kind: 'note', channel: 0, number: 48 },
  { target: 'MACRO_STOP', kind: 'note', channel: 0, number: 49 },
  { target: 'MACRO_REC', kind: 'note', channel: 0, number: 50 },
  { target: 'SWARM_TOGGLE', kind: 'note', channel: 0, number: 52 },
  { target: 'MATRIX_ENGAGE', kind: 'note', channel: 0, number: 56 },
  { target: 'MATRIX_STOP', kind: 'note', channel: 0, number: 57 },
  { target: 'MATRIX_SPEED', kind: 'cc', channel: 0, number: 1 },
  { target: 'MATRIX_INTENSITY', kind: 'cc', channel: 0, number: 7 },
];

export function formatMidiTargetLabel(target: MidiTarget): string {
  return target.replace(/_/g, ' ');
}

export function formatMidiBinding(b: MidiBinding): string {
  const ch = b.channel + 1;
  return b.kind === 'cc'
    ? `CC${b.number} · Ch${ch}`
    : `Note ${b.number} · Ch${ch}`;
}

export function buildMidiTriggeredMessage(action: string): string {
  return `MIDI_TRIGGERED: ${action}`;
}

/** CC 0–127 → speed 0.25–3 */
export function ccToMatrixSpeed(value: number): number {
  const t = Math.max(0, Math.min(127, value)) / 127;
  return Number((0.25 + t * 2.75).toFixed(2));
}

/** CC 0–127 → intensity 0–1 */
export function ccToMatrixIntensity(value: number): number {
  return Number((Math.max(0, Math.min(127, value)) / 127).toFixed(2));
}

/** Kilitliyken yalnızca BLACKOUT geçer. */
export function isMidiAllowedWhenLocked(target: MidiTarget): boolean {
  return target === 'BLACKOUT';
}

export function isMidiSupported(): boolean {
  try {
    if (Platform.OS !== 'web') return false;
    if (typeof navigator === 'undefined') return false;
    return typeof (navigator as Navigator & { requestMIDIAccess?: unknown })
      .requestMIDIAccess === 'function';
  } catch {
    return false;
  }
}

type MidiAccessLike = {
  inputs: unknown;
  onstatechange: ((ev: unknown) => void) | null;
};

type MidiInputLike = {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  state?: string;
  onmidimessage: ((ev: { data: Uint8Array }) => void) | null;
};

export type MidiControllerHandlers = {
  onStatus?: (status: MidiControllerStatus) => void;
  onAction?: (target: MidiTarget, meta?: { ccValue?: number }) => void;
  onLearnComplete?: (binding: MidiBinding) => void;
  /** V22 — ham MIDI (MTC / SysEx) forward. */
  onRawMidi?: (data: Uint8Array) => void;
};

function listInputs(access: MidiAccessLike): MidiInputLike[] {
  try {
    const inputs = access.inputs as {
      values?: () => IterableIterator<MidiInputLike>;
    };
    if (inputs && typeof inputs.values === 'function') {
      return Array.from(inputs.values());
    }
    return [];
  } catch {
    return [];
  }
}

function bindingKey(kind: MidiBindingKind, channel: number, number: number) {
  return `${kind}:${channel}:${number}`;
}

/**
 * Web MIDI motoru — native’de no-op.
 * CC throttle: aynı target için MIDI_CC_THROTTLE_MS.
 */
export class MidiControllerEngine {
  private access: MidiAccessLike | null = null;
  private handlers: MidiControllerHandlers | null = null;
  private bindings: MidiBinding[] = [...DEFAULT_MIDI_BINDINGS];
  private learningTarget: MidiTarget | null = null;
  private deviceName: string | null = null;
  private devices: MidiDeviceInfo[] = [];
  private accessState: MidiControllerStatus['accessState'] = 'idle';
  private ccLastAt = new Map<string, number>();
  private destroyed = false;

  getStatus(): MidiControllerStatus {
    return {
      supported: isMidiSupported(),
      accessState: this.accessState,
      deviceName: this.deviceName,
      devices: [...this.devices],
      learningTarget: this.learningTarget,
      bindings: this.bindings.map((b) => ({ ...b })),
    };
  }

  async start(handlers: MidiControllerHandlers) {
    this.handlers = handlers;
    this.destroyed = false;
    await this.loadBindings();

    if (!isMidiSupported()) {
      this.accessState = 'unavailable';
      this.emitStatus();
      return false;
    }

    try {
      this.accessState = 'pending';
      this.emitStatus();
      const nav = navigator as Navigator & {
        requestMIDIAccess: (opts?: { sysex?: boolean }) => Promise<unknown>;
      };
      const access = (await nav.requestMIDIAccess({
        sysex: false,
      })) as MidiAccessLike;
      this.access = access;
      this.accessState = 'granted';
      access.onstatechange = () => {
        try {
          this.refreshDevices();
          this.wireInputs();
        } catch {
          // ignore
        }
      };
      this.refreshDevices();
      this.wireInputs();
      this.emitStatus();
      return true;
    } catch {
      this.accessState = 'denied';
      this.access = null;
      this.emitStatus();
      return false;
    }
  }

  stop() {
    this.destroyed = true;
    this.learningTarget = null;
    try {
      if (this.access) {
        for (const input of listInputs(this.access)) {
          input.onmidimessage = null;
        }
        this.access.onstatechange = null;
      }
    } catch {
      // ignore
    }
    this.access = null;
    this.handlers = null;
  }

  beginLearn(target: MidiTarget) {
    this.learningTarget = target;
    this.emitStatus();
  }

  cancelLearn() {
    this.learningTarget = null;
    this.emitStatus();
  }

  clearBinding(target: MidiTarget) {
    this.bindings = this.bindings.filter((b) => b.target !== target);
    void this.saveBindings();
    this.emitStatus();
  }

  resetBindings() {
    this.bindings = [...DEFAULT_MIDI_BINDINGS];
    void this.saveBindings();
    this.emitStatus();
  }

  /** V22 showfile import. */
  setBindings(bindings: MidiBinding[]) {
    try {
      this.bindings = bindings.map((b) => ({ ...b }));
      void this.saveBindings();
      this.emitStatus();
    } catch {
      // ignore
    }
  }

  getBindings(): MidiBinding[] {
    return this.bindings.map((b) => ({ ...b }));
  }

  private emitStatus() {
    try {
      this.handlers?.onStatus?.(this.getStatus());
    } catch {
      // ignore
    }
  }

  private refreshDevices() {
    if (!this.access) {
      this.devices = [];
      this.deviceName = null;
      return;
    }
    const inputs = listInputs(this.access).filter(
      (i) => !i.state || i.state === 'connected',
    );
    this.devices = inputs.map((i) => ({
      id: i.id,
      name: i.name?.trim() || 'MIDI Input',
      manufacturer: i.manufacturer?.trim() || '',
    }));
    this.deviceName = this.devices[0]
      ? this.devices[0].manufacturer
        ? `${this.devices[0].manufacturer} ${this.devices[0].name}`.trim()
        : this.devices[0].name
      : null;
  }

  private wireInputs() {
    if (!this.access) return;
    for (const input of listInputs(this.access)) {
      input.onmidimessage = (ev) => {
        try {
          this.handleMessage(ev.data);
        } catch {
          // tek mesaj UI’yı bozmaz
        }
      };
    }
  }

  private handleMessage(data: Uint8Array) {
    if (this.destroyed || !data || data.length < 1) return;
    const status = data[0]!;

    // V22 — MTC quarter frame / SysEx full frame
    if (status === 0xf1 || status === 0xf0) {
      try {
        this.handlers?.onRawMidi?.(data);
      } catch {
        // ignore
      }
      return;
    }

    if (data.length < 2) return;
    const cmd = status & 0xf0;
    const channel = status & 0x0f;
    const number = data[1]!;
    const value = data.length > 2 ? data[2]! : 0;

    // Note On
    if (cmd === 0x90 && value > 0) {
      this.resolveEvent('note', channel, number);
      return;
    }
    // Note Off / Note On vel 0 — learn dışı ignore
    if (cmd === 0x80 || (cmd === 0x90 && value === 0)) {
      return;
    }
    // Control Change
    if (cmd === 0xb0) {
      this.resolveEvent('cc', channel, number, value);
    }
  }

  private resolveEvent(
    kind: MidiBindingKind,
    channel: number,
    number: number,
    ccValue?: number,
  ) {
    if (this.learningTarget) {
      const target = this.learningTarget;
      // CC hedefleri CC ile, pad hedefleri note ile tercih
      const prefersCc =
        target === 'MATRIX_SPEED' || target === 'MATRIX_INTENSITY';
      if (prefersCc && kind !== 'cc') return;
      if (!prefersCc && kind !== 'note') return;

      const binding: MidiBinding = { target, kind, channel, number };
      this.bindings = [
        ...this.bindings.filter((b) => b.target !== target),
        binding,
      ];
      this.learningTarget = null;
      void this.saveBindings();
      this.emitStatus();
      try {
        this.handlers?.onLearnComplete?.(binding);
      } catch {
        // ignore
      }
      return;
    }

    const hit = this.bindings.find(
      (b) =>
        b.kind === kind && b.channel === channel && b.number === number,
    );
    if (!hit) return;

    if (kind === 'cc') {
      const key = bindingKey(kind, channel, number);
      const now = Date.now();
      const last = this.ccLastAt.get(key) ?? 0;
      if (now - last < MIDI_CC_THROTTLE_MS) return;
      this.ccLastAt.set(key, now);
      try {
        this.handlers?.onAction?.(hit.target, { ccValue });
      } catch {
        // ignore
      }
      return;
    }

    try {
      this.handlers?.onAction?.(hit.target);
    } catch {
      // ignore
    }
  }

  private async loadBindings() {
    try {
      const raw = await AsyncStorage.getItem(MIDI_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as MidiBinding[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.bindings = parsed.filter(
          (b) =>
            b &&
            typeof b.target === 'string' &&
            (b.kind === 'note' || b.kind === 'cc') &&
            typeof b.channel === 'number' &&
            typeof b.number === 'number',
        );
      }
    } catch {
      // defaults
    }
  }

  private async saveBindings() {
    try {
      await AsyncStorage.setItem(
        MIDI_STORAGE_KEY,
        JSON.stringify(this.bindings),
      );
    } catch {
      // ignore
    }
  }
}
