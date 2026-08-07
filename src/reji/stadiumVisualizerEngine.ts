/**
 * V29.0 — Stadium Visualizer Engine (20k telefon pikseli).
 * Seat/band koordinatları + evaluatePixel; 200×200 ImageData blit (60 FPS).
 */

import { getSyncedTimestamp } from './clockSync';
import {
  evaluatePixel,
  PIXEL_GRID_H,
  PIXEL_GRID_W,
  type MatrixCommand,
} from './pixelMapper';
import {
  type PuzzlePresetId,
} from './puzzleChoreography';
import { TRIBUNE_BANDS, type StadiumTribuneId } from './seatPixelMap';

export const VISUALIZER_PHONE_COUNT = 20_000;

export type VisualizerPhone = {
  x: number;
  y: number;
  nx: number;
  ny: number;
  tribune: StadiumTribuneId;
  seatLabel: string;
  /** Flat index into RGBA buffer. */
  pixelIndex: number;
};

/**
 * Tribün bantlarındaki pikseller → N telefon (Seat/band geometrisi).
 */
export function buildVisualizerPhones(
  count: number = VISUALIZER_PHONE_COUNT,
): VisualizerPhone[] {
  const phones: VisualizerPhone[] = [];
  const tribunes = Object.keys(TRIBUNE_BANDS) as StadiumTribuneId[];

  for (const tribune of tribunes) {
    if (phones.length >= count) break;
    const band = TRIBUNE_BANDS[tribune];
    let local = 0;
    for (let y = band.y0; y <= band.y1 && phones.length < count; y++) {
      for (let x = band.x0; x <= band.x1 && phones.length < count; x++) {
        const block =
          Math.floor(local / (band.rows * band.seatsPerRow)) % band.blocks;
        const rem = local % (band.rows * band.seatsPerRow);
        const row = Math.floor(rem / band.seatsPerRow) + 1;
        const seat = (rem % band.seatsPerRow) + 1;
        phones.push({
          x,
          y,
          nx: (x + 0.5) / PIXEL_GRID_W,
          ny: (y + 0.5) / PIXEL_GRID_H,
          tribune,
          seatLabel: `${tribune[0]}${block}-R${row}S${seat}`,
          pixelIndex: (y * PIXEL_GRID_W + x) * 4,
        });
        local += 1;
      }
    }
  }

  let fill = 0;
  while (phones.length < count) {
    const x = 40 + (fill % 120);
    const y = 50 + (Math.floor(fill / 120) % 100);
    phones.push({
      x,
      y,
      nx: (x + 0.5) / PIXEL_GRID_W,
      ny: (y + 0.5) / PIXEL_GRID_H,
      tribune: 'NORTH',
      seatLabel: `F-${fill}`,
      pixelIndex: (y * PIXEL_GRID_W + x) * 4,
    });
    fill += 1;
  }

  return phones;
}

export class StadiumVisualizerEngine {
  readonly phones: VisualizerPhone[];
  readonly count: number;
  /** RGBA 200×200 — Canvas blit kaynağı. */
  readonly rgba: Uint8ClampedArray;
  private matrix: MatrixCommand | null = null;
  private pendingMatrix: MatrixCommand | null = null;
  private pendingAt = 0;
  private hasPending = false;
  private blackout = false;
  private fps = 0;
  private frames = 0;
  private fpsAt = 0;

  constructor(phones: VisualizerPhone[] = buildVisualizerPhones()) {
    this.phones = phones;
    this.count = phones.length;
    this.rgba = new Uint8ClampedArray(PIXEL_GRID_W * PIXEL_GRID_H * 4);
    this.clearGrid(12, 16, 28);
  }

  getFps() {
    return this.fps;
  }

  private clearGrid(r: number, g: number, b: number) {
    const d = this.rgba;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }

  scheduleMatrix(matrix: MatrixCommand | null, targetTimestamp: number) {
    this.pendingMatrix = matrix;
    this.pendingAt = targetTimestamp;
    this.hasPending = true;
  }

  applyMatrixNow(matrix: MatrixCommand | null) {
    this.matrix = matrix;
    this.hasPending = false;
    this.pendingMatrix = null;
    this.pendingAt = 0;
    this.blackout = false;
  }

  setBlackout(on: boolean) {
    this.blackout = on;
    if (on) {
      this.matrix = null;
      this.hasPending = false;
      this.pendingMatrix = null;
    }
  }

  getMatrix() {
    return this.matrix;
  }

  getPuzzlePreset(): PuzzlePresetId {
    return this.matrix?.puzzlePreset ?? 'none';
  }

  getOverlayEmoji(): string | null {
    return this.matrix?.overlayEmoji ?? null;
  }

  tick(nowMs: number = getSyncedTimestamp()): number {
    if (this.hasPending && nowMs >= this.pendingAt) {
      this.matrix = this.pendingMatrix;
      this.hasPending = false;
      this.pendingMatrix = null;
      this.pendingAt = 0;
    }

    this.frames += 1;
    if (nowMs - this.fpsAt >= 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.fpsAt = nowMs;
    }

    if (this.blackout || !this.matrix || !this.matrix.engaged) {
      this.clearGrid(12, 16, 28);
      return this.count;
    }

    const cmd = this.matrix;
    const d = this.rgba;
    this.clearGrid(8, 12, 22);

    for (let i = 0; i < this.count; i++) {
      const p = this.phones[i]!;
      const [rr, gg, bb] = evaluatePixel(p.nx, p.ny, nowMs, cmd);
      const o = p.pixelIndex;
      d[o] = rr;
      d[o + 1] = gg;
      d[o + 2] = bb;
      d[o + 3] = 255;
    }
    return this.count;
  }
}

/**
 * 200×200 ImageData → canvas’a nearest-neighbor ölçekle (60 FPS).
 */
export function drawVisualizerFrame(
  ctx: CanvasRenderingContext2D,
  engine: StadiumVisualizerEngine,
  gridCanvas: HTMLCanvasElement,
  opts?: { clear?: string },
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = opts?.clear ?? '#03060C';
  ctx.fillRect(0, 0, w, h);

  const gctx = gridCanvas.getContext('2d');
  if (!gctx) return;
  const img = gctx.createImageData(PIXEL_GRID_W, PIXEL_GRID_H);
  img.data.set(engine.rgba);
  gctx.putImageData(img, 0, 0);

  const pad = Math.floor(Math.min(w, h) * 0.04);
  const drawW = w - pad * 2;
  const drawH = h - pad * 2;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(gridCanvas, pad, pad, drawW, drawH);

  const overlay = engine.getOverlayEmoji();
  if (overlay) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#F8FAFC';
    ctx.font = `bold ${Math.floor(h * 0.14)}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(overlay, w / 2, h / 2);
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(148,163,184,0.9)';
  ctx.font = '12px ui-monospace,monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const preset = engine.getPuzzlePreset();
  ctx.fillText(
    `PHONES ${engine.count} · FPS ${engine.getFps()} · ${preset}${overlay ? ` · ${overlay}` : ''}`,
    pad,
    8,
  );
}
