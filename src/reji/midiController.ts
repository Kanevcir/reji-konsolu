/**
 * V21.0 — Endüstriyel MIDI Fiziksel Kontrol (Tactile Hardware Mapping).
 * Web MIDI API; Note On/Off + CC → Reji komutları.
 * CC güncellemeleri throttle’lı — UI thread korunur.
 *
 * V23.1 — Traktor Kontrol Z1 otomatik donanım profili.
 * V24.0 — Traktor CC rolleri:
 *   1. CC (crossfader) → THEME_MIX
 *   2. CC (fader) → MATRIX_SPEED
 *   3. CC (fader) → STROBE_SENSITIVITY
 *   Note On → BLACKOUT
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const MIDI_STORAGE_KEY = '@pulse/reji-midi-bindings-v1';
export const MIDI_CC_THROTTLE_MS = 50;

/** Otomatik donanım profilleri. */
export type MidiHardwareProfile = 'manual' | 'traktor_z1';

/** Cihaz adı veya manufacturer "Traktor" içeriyorsa otomatik profil. */
export function isTraktorHardware(label: string | null | undefined): boolean {
  if (!label) return false;
  return /traktor/i.test(label);
}

export function formatMidiHardwareProfile(
  profile: MidiHardwareProfile,
): string {
  if (profile === 'traktor_z1') return 'TRAKTOR Z1 AUTO';
  return 'MANUAL / LEARN';
}

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
  | 'MATRIX_INTENSITY'
  | 'THEME_MIX'
  | 'STROBE_SENSITIVITY';

export type MidiBindingKind = 'note' | 'cc';

export type TraktorCcRole = 'THEME_MIX' | 'MATRIX_SPEED' | 'STROBE_SENSITIVITY';

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
  /** V23.1 — otomatik donanım profili (Traktor Z1 vb.). */
  hardwareProfile: MidiHardwareProfile;
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
  'THEME_MIX',
  'STROBE_SENSITIVITY',
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
  { target: 'THEME_MIX', kind: 'cc', channel: 0, number: 8 },
  { target: 'STROBE_SENSITIVITY', kind: 'cc', channel: 0, number: 11 },
];

/** Traktor Kontrol Z1 — UI için bilinen varsayılanlar. */
export const TRAKTOR_Z1_BINDINGS: MidiBinding[] = [
  { target: 'BLACKOUT', kind: 'note', channel: 0, number: 0 },
  { target: 'THEME_MIX', kind: 'cc', channel: 0, number: 1 },
  { target: 'MATRIX_SPEED', kind: 'cc', channel: 0, number: 2 },
  { target: 'STROBE_SENSITIVITY', kind: 'cc', channel: 0, number: 3 },
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
  private hardwareProfile: MidiHardwareProfile = 'manual';
  /** V24 — Traktor CC numarası → rol (ilk görülen XF/fader sırası). */
  private traktorCcRoles = new Map<number, TraktorCcRole>();
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
      hardwareProfile: this.hardwareProfile,
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
    // Traktor auto profilde Learn gerekmez — hardcoded route geçerli.
    if (this.hardwareProfile === 'traktor_z1') {
      this.learningTarget = null;
      this.emitStatus();
      return;
    }
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
    this.traktorCcRoles.clear();
    this.bindings =
      this.hardwareProfile === 'traktor_z1'
        ? TRAKTOR_Z1_BINDINGS.map((b) => ({ ...b }))
        : [...DEFAULT_MIDI_BINDINGS];
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
      this.hardwareProfile = 'manual';
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

    this.applyHardwareProfileFromDevices();
    this.emitStatus();
  }

  /** Adında "Traktor" geçen input → Z1 auto profil + hardcoded map. */
  private applyHardwareProfileFromDevices() {
    const traktorHit = this.devices.find(
      (d) =>
        isTraktorHardware(d.name) ||
        isTraktorHardware(d.manufacturer) ||
        isTraktorHardware(`${d.manufacturer} ${d.name}`),
    );

    if (!traktorHit) {
      if (this.hardwareProfile === 'traktor_z1') {
        this.hardwareProfile = 'manual';
        this.traktorCcRoles.clear();
        this.bindings = [...DEFAULT_MIDI_BINDINGS];
        void this.saveBindings();
        try {
          console.log('[MIDI] TRAKTOR PROFILE OFF · restored manual bindings');
        } catch {
          // ignore
        }
      }
      return;
    }

    const wasManual = this.hardwareProfile !== 'traktor_z1';
    this.hardwareProfile = 'traktor_z1';
    this.learningTarget = null;
    this.deviceName = traktorHit.manufacturer
      ? `${traktorHit.manufacturer} ${traktorHit.name}`.trim()
      : traktorHit.name;

    if (wasManual) {
      this.traktorCcRoles.clear();
      this.bindings = TRAKTOR_Z1_BINDINGS.map((b) => ({ ...b }));
      void this.saveBindings();
      try {
        console.log(
          '[MIDI] TRAKTOR AUTO PROFILE ·',
          this.deviceName,
          '· XF→THEME · Fader→SPEED/STROBE · NoteOn→BLACKOUT',
        );
      } catch {
        // ignore
      }
    }
  }

  private wireInputs() {
    if (!this.access) return;
    for (const input of listInputs(this.access)) {
      const inputLabel =
        input.name?.trim() ||
        input.manufacturer?.trim() ||
        input.id ||
        'MIDI Input';
      input.onmidimessage = (ev) => {
        try {
          this.handleMessage(ev.data, inputLabel);
        } catch {
          // tek mesaj UI’yı bozmaz
        }
      };
    }
  }

  private handleMessage(data: Uint8Array, inputLabel = 'MIDI') {
    if (this.destroyed || !data || data.length < 1) return;
    const status = data[0]!;

    // V22 — MTC quarter frame / SysEx full frame
    if (status === 0xf1 || status === 0xf0) {
      try {
        console.log('[MIDI] RAW/MTC', {
          device: inputLabel,
          bytes: Array.from(data),
        });
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
      try {
        console.log(
          `[MIDI] NoteOn · device="${inputLabel}" · ch=${channel + 1} · note=${number} · vel=${value}`,
        );
      } catch {
        // ignore
      }
      this.resolveEvent('note', channel, number, undefined, inputLabel);
      return;
    }
    // Note Off / Note On vel 0 — learn dışı ignore
    if (cmd === 0x80 || (cmd === 0x90 && value === 0)) {
      try {
        console.log(
          `[MIDI] NoteOff · device="${inputLabel}" · ch=${channel + 1} · note=${number} · vel=${value}`,
        );
      } catch {
        // ignore
      }
      return;
    }
    // Control Change
    if (cmd === 0xb0) {
      try {
        console.log(
          `[MIDI] CC · device="${inputLabel}" · ch=${channel + 1} · cc=${number} · value=${value}`,
        );
      } catch {
        // ignore
      }
      this.resolveEvent('cc', channel, number, value, inputLabel);
    }
  }

  private resolveEvent(
    kind: MidiBindingKind,
    channel: number,
    number: number,
    ccValue?: number,
    inputLabel?: string,
  ) {
    // V23.1 — Traktor Z1: Learn beklemeden hardcoded route
    if (
      this.hardwareProfile === 'traktor_z1' ||
      isTraktorHardware(inputLabel) ||
      isTraktorHardware(this.deviceName)
    ) {
      this.dispatchTraktorAutoProfile(kind, channel, number, ccValue);
      return;
    }

    if (this.learningTarget) {
      const target = this.learningTarget;
      // CC hedefleri CC ile, pad hedefleri note ile tercih
      const prefersCc =
        target === 'MATRIX_SPEED' ||
        target === 'MATRIX_INTENSITY' ||
        target === 'THEME_MIX' ||
        target === 'STROBE_SENSITIVITY';
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

  /**
   * Traktor Kontrol Z1 auto map (V24):
   * - 1. benzersiz CC (crossfader) → THEME_MIX
   * - 2. benzersiz CC → MATRIX_SPEED
   * - 3+ CC → STROBE_SENSITIVITY
   * - Note On → BLACKOUT
   */
  private resolveTraktorCcRole(ccNumber: number): TraktorCcRole {
    const existing = this.traktorCcRoles.get(ccNumber);
    if (existing) return existing;
    const order = this.traktorCcRoles.size;
    const role: TraktorCcRole =
      order === 0
        ? 'THEME_MIX'
        : order === 1
          ? 'MATRIX_SPEED'
          : 'STROBE_SENSITIVITY';
    this.traktorCcRoles.set(ccNumber, role);
    try {
      console.log(
        `[MIDI] TRAKTOR CC${ccNumber} assigned → ${role}` +
          (order === 0 ? ' (crossfader / theme)' : ''),
      );
    } catch {
      // ignore
    }
    return role;
  }

  private dispatchTraktorAutoProfile(
    kind: MidiBindingKind,
    channel: number,
    number: number,
    ccValue?: number,
  ) {
    if (kind === 'cc') {
      const key = bindingKey('cc', channel, number);
      const now = Date.now();
      const last = this.ccLastAt.get(key) ?? 0;
      if (now - last < MIDI_CC_THROTTLE_MS) return;
      this.ccLastAt.set(key, now);
      const role = this.resolveTraktorCcRole(number);
      try {
        console.log(
          `[MIDI] TRAKTOR → ${role} · ch=${channel + 1} · cc=${number} · value=${ccValue ?? 0}`,
        );
        this.handlers?.onAction?.(role, { ccValue });
      } catch {
        // ignore
      }
      return;
    }

    if (kind === 'note') {
      try {
        console.log(
          `[MIDI] TRAKTOR → BLACKOUT · ch=${channel + 1} · note=${number}`,
        );
        this.handlers?.onAction?.('BLACKOUT');
      } catch {
        // ignore
      }
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
