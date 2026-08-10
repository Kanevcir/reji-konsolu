/**
 * V30.0 — Sanal Stadyum Simülatörü (WebGL 50k point cloud).
 * PTP targetTimestamp ile Reji komutlarını uygular; rAF 60 FPS.
 */

import { createElement, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ensureDefaultFlagTexture } from '../audienceTexture';
import { scheduleAtPtp } from '../clientScheduler';
import { getSyncedTimestamp } from '../clockSync';
import { createIdleMatrixCommand } from '../pixelMapper';
import {
  getLastStadiumLiveFrame,
  subscribeStadiumLive,
  type StadiumLiveFrame,
} from '../stadiumLiveBus';
import {
  drawVisualizerFrame2d,
  StadiumVisualizerEngine,
  VISUALIZER_PHONE_COUNT,
} from '../stadiumVisualizerEngine';

export function StadiumVisualizerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rafRef = useRef(0);
  const cancelScheduleRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [phoneCount, setPhoneCount] = useState(VISUALIZER_PHONE_COUNT);
  const [hud, setHud] = useState('Bağlantı bekleniyor…');
  const [renderMode, setRenderMode] = useState('…');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setHud('Simülatör web (WebGL) üzerinde çalışır');
      return;
    }

    ensureDefaultFlagTexture();

    const engine = new StadiumVisualizerEngine();
    setPhoneCount(engine.count);

    const host = document.getElementById('stadium-sim-host');
    if (!host) {
      setHud('Canvas host bulunamadı');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.borderRadius = '12px';
    host.innerHTML = '';
    host.appendChild(canvas);

    const mode = engine.attachCanvas(canvas);
    setRenderMode(mode === 'webgl' ? 'WebGL' : 'Canvas2D');

    const ctx2d =
      mode === 'canvas2d' ? canvas.getContext('2d') : null;
    if (mode === 'canvas2d' && !ctx2d) {
      setHud('Canvas context yok');
      return;
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = host.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(240, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    setReady(true);
    setHud(`Hazır · ${engine.count.toLocaleString('tr-TR')} telefon · ${mode}`);

    const applyFrame = (frame: StadiumLiveFrame) => {
      cancelScheduleRef.current?.();
      cancelScheduleRef.current = null;

      const payload = frame.payload;
      if (
        payload?.action === 'EMERGENCY_BLACKOUT' ||
        payload?.status === 'SAFE_MODE'
      ) {
        engine.setBlackout(true);
        setHud('BLACKOUT');
        return;
      }

      const matrix = frame.matrix ?? payload?.matrix ?? null;
      const target =
        typeof payload?.targetTimestamp === 'number'
          ? payload.targetTimestamp
          : getSyncedTimestamp();

      const handle = scheduleAtPtp({
        targetTimestamp: target,
        now: getSyncedTimestamp,
        onFire: () => {
          engine.setBlackout(false);
          engine.applyMatrixNow(matrix);
          const label =
            matrix?.overlayEmoji ??
            matrix?.puzzlePreset ??
            payload?.action ??
            'LIVE';
          setHud(`PTP SYNC · ${label}`);
        },
      });
      cancelScheduleRef.current = () => handle.cancel();
    };

    const last = getLastStadiumLiveFrame();
    if (last) {
      applyFrame(last);
    } else {
      engine.applyMatrixNow(
        createIdleMatrixCommand({
          engaged: true,
          puzzlePreset: 'turkish_flag',
          textureId: 'turkish_flag_default',
          effect: 'RADIAL_WAVE',
          themeMix: 0,
          speed: 1,
        }),
      );
      setHud('DEMO FLAG · Reji komutu bekleniyor');
    }

    const unsub = subscribeStadiumLive(applyFrame);

    const loop = () => {
      engine.tick(getSyncedTimestamp());
      if (mode === 'webgl') {
        engine.drawWebGl(canvas);
      } else if (ctx2d) {
        drawVisualizerFrame2d(ctx2d, engine);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      unsub();
      cancelScheduleRef.current?.();
      host.innerHTML = '';
    };
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backBtn}>
          <Text style={styles.backText}>← REJİ</Text>
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>SANAL STADYUM · V30 · 50K WEBGL</Text>
          <Text style={styles.sub}>
            {phoneCount.toLocaleString('tr-TR')} telefon · {renderMode} · texture
            UV unwrap
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{ready ? 'LIVE' : '…'}</Text>
        </View>
      </View>
      <Text style={styles.hud}>{hud}</Text>

      {Platform.OS === 'web' ? (
        <View style={styles.canvasWrap} collapsable={false}>
          {createElement('div', {
            id: 'stadium-sim-host',
            style: { width: '100%', height: '100%' },
          })}
        </View>
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            Stadyum simülatörü performans için web WebGL gerektirir. Tarayıcıda
            /simulator yolunu açın.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#03060C',
    paddingHorizontal: 12,
    gap: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  backText: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 12,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sub: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#14532D',
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  badgeText: {
    color: '#BBF7D0',
    fontSize: 11,
    fontWeight: '900',
  },
  hud: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  canvasWrap: {
    flex: 1,
    minHeight: 320,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.35)',
    overflow: 'hidden',
    backgroundColor: '#070B14',
    marginBottom: 12,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackText: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
  },
});
