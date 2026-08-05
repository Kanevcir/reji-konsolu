/**
 * V11.0 — Art-Net / DMX512 & sACN Lighting Protocol Translator.
 * Reji aksiyonlarını 512 kanallı Art-Net DMX v4 paketlerine dönüştürür.
 *
 * Universe 1 = Kuzey · 2 = Güney · 3 = Doğu · 4 = Batı
 * Blackout → tüm kanallar 0x00 (FULL OFF).
 */

import { GS_LIGHTS } from './constants';
import type { TribunId } from './types';

/** DMX Universe kimlikleri (1–4). */
export type ArtNetUniverseId = 1 | 2 | 3 | 4;

export const ARTNET_UNIVERSES: ArtNetUniverseId[] = [1, 2, 3, 4];

export const ARTNET_UNIVERSE_LABELS: Record<ArtNetUniverseId, string> = {
  1: 'UNIVERSE 1 — KUZEY',
  2: 'UNIVERSE 2 — GÜNEY',
  3: 'UNIVERSE 3 — DOĞU',
  4: 'UNIVERSE 4 — BATI',
};

/** Universe → tribün grubu. */
export const ARTNET_UNIVERSE_GROUP: Record<ArtNetUniverseId, 'ns' | 'ew'> = {
  1: 'ns',
  2: 'ns',
  3: 'ew',
  4: 'ew',
};

/** Art-Net OpDmx (0x5000). */
export const ARTNET_OP_DMX = 0x5000;

/** DMX kanal sayısı. */
export const DMX_CHANNEL_COUNT = 512;

/** Broadcast hedef FPS (UI telemetri). */
export const ARTNET_BROADCAST_FPS = 30;

export type ArtNetConfig = {
  /** Art-Net Net (0–127). */
  net: number;
  /** Art-Net Subnet (0–15). */
  subnet: number;
  /** Operatörün izlediği universe. */
  selectedUniverse: ArtNetUniverseId;
};

export type ArtNetFrameInput = {
  beat: number;
  bpm: number;
  tribun: TribunId;
  isBlackout: boolean;
  /** Canlı yayın / timer aktif mi. */
  active: boolean;
};

export type ArtNetPacketBundle = {
  /** Universe → 512 kanal. */
  dmx: Record<ArtNetUniverseId, Uint8Array>;
  /** Universe → Art-Net UDP payload. */
  packets: Record<ArtNetUniverseId, Uint8Array>;
  /** Kısa hex önizleme (seçili universe). */
  hexPreview: string;
  sequence: number;
  generatedAt: number;
};

export type ArtNetBridgeStats = {
  broadcasting: boolean;
  fps: number;
  net: number;
  subnet: number;
  selectedUniverse: ArtNetUniverseId;
  lastHexPreview: string;
  lastGeneratedAt: number | null;
  sequence: number;
  /** Son üretim log metni. */
  lastEvent: string;
};

export const DEFAULT_ARTNET_CONFIG: ArtNetConfig = {
  net: 0,
  subnet: 0,
  selectedUniverse: 1,
};

export const DEFAULT_ARTNET_STATS: ArtNetBridgeStats = {
  broadcasting: false,
  fps: 0,
  net: 0,
  subnet: 0,
  selectedUniverse: 1,
  lastHexPreview: '',
  lastGeneratedAt: null,
  sequence: 0,
  lastEvent: 'IDLE',
};

/** Telemetri / Status etiketi. */
export function formatArtNetStatusLabel(stats: ArtNetBridgeStats) {
  if (stats.broadcasting) {
    return `ART-NET DMX: BROADCASTING (${stats.fps} FPS, UNIVERSE 1-4)`;
  }
  if (stats.lastEvent.includes('BLACKOUT') || stats.lastEvent.includes('FULL OFF')) {
    return 'ART-NET DMX: FULL OFF (BLACKOUT)';
  }
  return 'ART-NET DMX: STANDBY';
}

/** Hex string (#RRGGBB) → RGB 0–255. */
export function hexToRgb(hex: string): [number, number, number] {
  try {
    const raw = hex.replace('#', '');
    if (raw.length !== 6) return [0, 0, 0];
    return [
      Number.parseInt(raw.slice(0, 2), 16),
      Number.parseInt(raw.slice(2, 4), 16),
      Number.parseInt(raw.slice(4, 6), 16),
    ];
  } catch {
    return [0, 0, 0];
  }
}

/** Uint8Array → üst hex önizleme (ilk N bayt). */
export function bytesToHexPreview(bytes: Uint8Array, maxBytes = 24): string {
  try {
    const n = Math.min(bytes.length, maxBytes);
    let out = '';
    for (let i = 0; i < n; i += 1) {
      out += bytes[i]!.toString(16).padStart(2, '0').toUpperCase();
      if (i < n - 1) out += ' ';
    }
    if (bytes.length > maxBytes) out += ' …';
    return out;
  } catch {
    return '';
  }
}

/** Universe tribün kapsamında mı? */
export function isUniverseInScope(universe: ArtNetUniverseId, tribun: TribunId) {
  if (tribun === 'all') return true;
  return ARTNET_UNIVERSE_GROUP[universe] === tribun;
}

/**
 * 512 kanallı DMX frame üretir.
 * RGB fixture’lar 3’er kanal: R,G,B — GS sarı/kırmızı/beyaz döngüsü + BPM yoğunluğu.
 * Blackout → tüm kanallar 0x00.
 */
export function buildDmxUniverseFrame(
  universe: ArtNetUniverseId,
  input: ArtNetFrameInput,
): Uint8Array {
  const frame = new Uint8Array(DMX_CHANNEL_COUNT);

  try {
    if (input.isBlackout) {
      // FULL OFF güvenlik katmanı
      return frame;
    }

    if (!input.active || !isUniverseInScope(universe, input.tribun)) {
      return frame;
    }

    const colorHex = GS_LIGHTS[(input.beat + (universe - 1)) % GS_LIGHTS.length] ?? '#FDB913';
    const [r, g, b] = hexToRgb(colorHex);
    // BPM 100–140 → yoğunluk ~0.55–1.0 + beat pulse
    const bpmNorm = Math.min(1, Math.max(0, (input.bpm - 90) / 60));
    const pulse = input.beat % 2 === 0 ? 1 : 0.72;
    const level = 0.55 + bpmNorm * 0.45;
    const scale = level * pulse;

    const rr = Math.min(255, Math.round(r * scale));
    const gg = Math.min(255, Math.round(g * scale));
    const bb = Math.min(255, Math.round(b * scale));

    // 170 RGB fixture (510 kanal) + 2 pad
    for (let ch = 0; ch + 2 < DMX_CHANNEL_COUNT; ch += 3) {
      const fixture = Math.floor(ch / 3);
      // Dalga: universe offset ile kaydırılmış fade
      const wave = 0.65 + 0.35 * Math.sin((fixture + input.beat * 3 + universe) * 0.35);
      frame[ch] = Math.min(255, Math.round(rr * wave));
      frame[ch + 1] = Math.min(255, Math.round(gg * wave));
      frame[ch + 2] = Math.min(255, Math.round(bb * wave));
    }
  } catch {
    frame.fill(0);
  }

  return frame;
}

/**
 * Art-Net 4 OpDmx binary paketi (header + 512 DMX).
 * Port-Address = (Net << 8) | (Subnet << 4) | (Universe - 1)
 */
export function encodeArtNetPacket(input: {
  universe: ArtNetUniverseId;
  dmx: Uint8Array;
  sequence: number;
  net: number;
  subnet: number;
}): Uint8Array {
  try {
    const packet = new Uint8Array(18 + DMX_CHANNEL_COUNT);
    // "Art-Net\0"
    const id = [0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00];
    for (let i = 0; i < 8; i += 1) packet[i] = id[i]!;

    // OpCode little-endian 0x5000
    packet[8] = ARTNET_OP_DMX & 0xff;
    packet[9] = (ARTNET_OP_DMX >> 8) & 0xff;

    // ProtVer 14 (Hi, Lo)
    packet[10] = 0x00;
    packet[11] = 0x0e;

    packet[12] = input.sequence & 0xff; // Sequence
    packet[13] = 0x00; // Physical

    const net = Math.max(0, Math.min(127, Math.floor(input.net)));
    const subnet = Math.max(0, Math.min(15, Math.floor(input.subnet)));
    const uni = Math.max(0, Math.min(15, input.universe - 1));
    const portAddress = ((net & 0x7f) << 8) | ((subnet & 0x0f) << 4) | (uni & 0x0f);
    // SubUni / Net — Art-Net: low byte SubUni, high byte Net (little-endian 16-bit)
    packet[14] = portAddress & 0xff;
    packet[15] = (portAddress >> 8) & 0xff;

    // Length big-endian
    packet[16] = (DMX_CHANNEL_COUNT >> 8) & 0xff;
    packet[17] = DMX_CHANNEL_COUNT & 0xff;

    const len = Math.min(DMX_CHANNEL_COUNT, input.dmx.length);
    packet.set(input.dmx.subarray(0, len), 18);
    return packet;
  } catch {
    return new Uint8Array(18 + DMX_CHANNEL_COUNT);
  }
}

/** 4 universe için DMX + Art-Net paket demeti. */
export function generateArtNetBundle(
  input: ArtNetFrameInput,
  config: ArtNetConfig,
  sequence: number,
): ArtNetPacketBundle {
  const dmx = {} as Record<ArtNetUniverseId, Uint8Array>;
  const packets = {} as Record<ArtNetUniverseId, Uint8Array>;

  try {
    for (const universe of ARTNET_UNIVERSES) {
      const frame = buildDmxUniverseFrame(universe, input);
      dmx[universe] = frame;
      packets[universe] = encodeArtNetPacket({
        universe,
        dmx: frame,
        sequence,
        net: config.net,
        subnet: config.subnet,
      });
    }
  } catch {
    for (const universe of ARTNET_UNIVERSES) {
      dmx[universe] = new Uint8Array(DMX_CHANNEL_COUNT);
      packets[universe] = encodeArtNetPacket({
        universe,
        dmx: dmx[universe],
        sequence,
        net: config.net,
        subnet: config.subnet,
      });
    }
  }

  const selected = packets[config.selectedUniverse] ?? packets[1];
  return {
    dmx,
    packets,
    hexPreview: bytesToHexPreview(selected),
    sequence,
    generatedAt: Date.now(),
  };
}

/**
 * Art-Net Bridge Engine — sequence + son paket durumu.
 * Gerçek UDP broadcast Expo Go’da yok; paketler encode edilip UI/log’a verilir.
 */
export class ArtNetEngine {
  private sequence = 0;
  private config: ArtNetConfig = { ...DEFAULT_ARTNET_CONFIG };
  private lastBundle: ArtNetPacketBundle | null = null;

  getConfig() {
    return { ...this.config };
  }

  applyConfig(partial: Partial<ArtNetConfig>) {
    this.config = {
      net: Math.max(0, Math.min(127, Math.floor(partial.net ?? this.config.net))),
      subnet: Math.max(0, Math.min(15, Math.floor(partial.subnet ?? this.config.subnet))),
      selectedUniverse: (partial.selectedUniverse ??
        this.config.selectedUniverse) as ArtNetUniverseId,
    };
  }

  getLastBundle() {
    return this.lastBundle;
  }

  /** Sonraki sequence (1–255, 0 reserved). */
  private nextSequence() {
    this.sequence = this.sequence >= 255 ? 1 : this.sequence + 1;
    return this.sequence;
  }

  /**
   * Frame üret + encode.
   * Blackout’ta FULL OFF (0x00) paketleri.
   */
  generate(input: ArtNetFrameInput): ArtNetPacketBundle {
    try {
      const seq = this.nextSequence();
      const bundle = generateArtNetBundle(input, this.config, seq);
      this.lastBundle = bundle;
      return bundle;
    } catch {
      const empty = generateArtNetBundle(
        { ...input, isBlackout: true },
        this.config,
        this.nextSequence(),
      );
      this.lastBundle = empty;
      return empty;
    }
  }
}

let sharedArtNet: ArtNetEngine | null = null;

export function getArtNetEngine(): ArtNetEngine {
  if (!sharedArtNet) sharedArtNet = new ArtNetEngine();
  return sharedArtNet;
}
