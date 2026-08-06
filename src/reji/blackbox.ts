/**
 * V15.0 — Endüstriyel Karakutu ve Maç Sonu Raporlayıcı
 * (Diagnostic Blackbox & Session Exporter).
 * Kritik olayları PTP timestamp ile rolling log (max 1000) tutar.
 */

import { getSyncedTimestamp } from './clockSync';
import type { TelemetryStats } from './telemetry';

/** Kritik karakutu kategorileri. */
export type BlackboxCategory =
  | 'NETWORK'
  | 'FALLBACK_UDP'
  | 'BLACKOUT'
  | 'AUTH'
  | 'MACRO'
  | 'OFFLINE_QUEUE'
  | 'ZONE'
  | 'SWARM'
  | 'FAILOVER'
  | 'MATRIX'
  | 'MIDI'
  | 'SHOWFILE'
  | 'SYSTEM';

/** Tek karakutu kaydı. */
export type BlackboxEntry = {
  id: string;
  /** PTP senkronize zaman damgası (ms). */
  ts: number;
  category: BlackboxCategory;
  message: string;
};

/** Oturum telemetri özeti (export için). */
export type SessionTelemetrySummary = {
  sampleCount: number;
  avgFps: number;
  maxMemoryMb: number;
  lastFps: number;
  lastMemoryMb: number;
};

/** Maç sonu dışa aktarım raporu. */
export type MatchReport = {
  version: 1;
  exportedAt: number;
  sessionStartedAt: number;
  totalEvents: number;
  telemetry: SessionTelemetrySummary;
  logs: BlackboxEntry[];
};

export const BLACKBOX_MAX_ENTRIES = 1000;
/** Terminal ekranında gösterilen satır sayısı. */
export const BLACKBOX_TERMINAL_LINES = 20;

export const DEFAULT_SESSION_TELEMETRY: SessionTelemetrySummary = {
  sampleCount: 0,
  avgFps: 0,
  maxMemoryMb: 0,
  lastFps: 0,
  lastMemoryMb: 0,
};

/**
 * Konsol log mesajından kritik kategori çıkarır.
 * Eşleşmezse null — karakutuya yazılmaz.
 */
export function classifyBlackboxMessage(message: string): BlackboxCategory | null {
  try {
    const m = message.toUpperCase();

    if (m.includes('BLACKOUT')) return 'BLACKOUT';

    if (
      m.includes('FALLBACK_UDP') ||
      m.includes('UDP_MULTICAST_FALLBACK') ||
      m.includes('UDP_MULTICAST')
    ) {
      return 'FALLBACK_UDP';
    }

    if (
      m.includes('SECURITY_LOCK') ||
      m.includes('SECURITY_UNLOCK') ||
      m.includes('AUTH DENIED') ||
      m.includes('AUTH INVALID')
    ) {
      return 'AUTH';
    }

    if (m.includes('MACRO PLAY')) return 'MACRO';

    if (m.includes('ZONE_CHANGED') || m.includes('ZONE MASK')) {
      return 'ZONE';
    }

    if (m.includes('SWARM_MESH')) {
      return 'SWARM';
    }

    if (m.includes('FAILOVER_TRIGGERED') || m.includes('FAILOVER')) {
      return 'FAILOVER';
    }

    if (m.includes('MATRIX_ENGAGED') || m.includes('MATRIX_DISENGAGED')) {
      return 'MATRIX';
    }

    if (m.includes('MIDI_TRIGGERED') || m.includes('MIDI LEARN')) {
      return 'MIDI';
    }

    if (m.includes('SHOWFILE_LOADED') || m.includes('SHOWFILE_SAVED')) {
      return 'SHOWFILE';
    }

    if (m.includes('OFFLINE QUEUE FLUSH') || m.includes('OFFLINE QUEUE PURGE')) {
      return 'OFFLINE_QUEUE';
    }

    if (
      m.includes('SOCKET DISCONNECTED') ||
      m.includes('SOCKET CONNECTED') ||
      m.includes('TX FAILED')
    ) {
      return 'NETWORK';
    }

    return null;
  } catch {
    return null;
  }
}

/** Terminal satırı — yeşil monolog formatı. */
export function formatBlackboxTerminalLine(entry: BlackboxEntry): string {
  try {
    const t = new Date(entry.ts).toISOString().slice(11, 23);
    return `[${t}] [${entry.category}] ${entry.message}`;
  } catch {
    return entry.message;
  }
}

/** Telemetri örnekleminden oturum özeti güncelle. */
export function accumulateSessionTelemetry(
  prev: SessionTelemetrySummary,
  sample: TelemetryStats,
): SessionTelemetrySummary {
  try {
    const sampleCount = prev.sampleCount + 1;
    const sumFps = prev.avgFps * prev.sampleCount + sample.fps;
    return {
      sampleCount,
      avgFps: Number((sumFps / sampleCount).toFixed(2)),
      maxMemoryMb: Math.max(prev.maxMemoryMb, sample.memoryMb),
      lastFps: sample.fps,
      lastMemoryMb: sample.memoryMb,
    };
  } catch {
    return { ...prev };
  }
}

/** Detaylı JSON maç raporu. */
export function buildMatchReport(input: {
  logs: BlackboxEntry[];
  telemetry: SessionTelemetrySummary;
  sessionStartedAt: number;
  exportedAt?: number;
}): MatchReport {
  const exportedAt = input.exportedAt ?? getSyncedTimestamp();
  return {
    version: 1,
    exportedAt,
    sessionStartedAt: input.sessionStartedAt,
    totalEvents: input.logs.length,
    telemetry: { ...input.telemetry },
    logs: input.logs.map((e) => ({ ...e })),
  };
}

/** Raporu panoya uygun JSON metni. */
export function serializeMatchReportJson(report: MatchReport): string {
  return JSON.stringify(report, null, 2);
}

/** Raporu CSV metni (özet + log satırları). */
export function serializeMatchReportCsv(report: MatchReport): string {
  const lines: string[] = [
    'section,key,value',
    `meta,version,${report.version}`,
    `meta,exportedAt,${report.exportedAt}`,
    `meta,sessionStartedAt,${report.sessionStartedAt}`,
    `meta,totalEvents,${report.totalEvents}`,
    `telemetry,avgFps,${report.telemetry.avgFps}`,
    `telemetry,maxMemoryMb,${report.telemetry.maxMemoryMb}`,
    `telemetry,sampleCount,${report.telemetry.sampleCount}`,
    '',
    'id,ts,category,message',
  ];
  for (const e of report.logs) {
    const msg = e.message.replace(/"/g, '""');
    lines.push(`${e.id},${e.ts},${e.category},"${msg}"`);
  }
  return lines.join('\n');
}

/**
 * Rolling blackbox — son BLACKBOX_MAX_ENTRIES kritik olay.
 * try-catch korumalı; UI state’i ayrı tutulur.
 */
export class BlackboxEngine {
  private entries: BlackboxEntry[] = [];
  private seq = 0;
  private sessionStartedAt = getSyncedTimestamp();
  private sessionTelemetry: SessionTelemetrySummary = {
    ...DEFAULT_SESSION_TELEMETRY,
  };

  getSessionStartedAt() {
    return this.sessionStartedAt;
  }

  getLogs(): BlackboxEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }

  getTerminalLogs(limit = BLACKBOX_TERMINAL_LINES): BlackboxEntry[] {
    return this.entries.slice(-limit).map((e) => ({ ...e }));
  }

  getEventCount() {
    return this.entries.length;
  }

  getSessionTelemetry(): SessionTelemetrySummary {
    return { ...this.sessionTelemetry };
  }

  /** Kritik olay ekle (PTP ts). */
  append(category: BlackboxCategory, message: string): BlackboxEntry | null {
    try {
      this.seq += 1;
      const entry: BlackboxEntry = {
        id: `bb-${this.seq}`,
        ts: getSyncedTimestamp(),
        category,
        message,
      };
      this.entries = [...this.entries, entry].slice(-BLACKBOX_MAX_ENTRIES);
      return entry;
    } catch {
      return null;
    }
  }

  /** pushLog mesajından otomatik kaydet; kritik değilse null. */
  appendFromMessage(message: string): BlackboxEntry | null {
    const category = classifyBlackboxMessage(message);
    if (!category) return null;
    return this.append(category, message);
  }

  /** Telemetri tick — ortalama FPS / max RAM. */
  sampleTelemetry(stats: TelemetryStats) {
    try {
      this.sessionTelemetry = accumulateSessionTelemetry(
        this.sessionTelemetry,
        stats,
      );
    } catch {
      // ignore
    }
  }

  /** Maç raporu (JSON nesnesi). */
  buildReport(): MatchReport {
    return buildMatchReport({
      logs: this.getLogs(),
      telemetry: this.getSessionTelemetry(),
      sessionStartedAt: this.sessionStartedAt,
      exportedAt: getSyncedTimestamp(),
    });
  }
}
