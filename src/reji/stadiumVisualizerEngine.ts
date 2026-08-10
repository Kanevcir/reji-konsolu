/**
 * V30.0 — Stadium Visualizer Engine (50k telefon · WebGL point cloud).
 * Tribün halkası noktaları + evaluatePixel; WebGL POINTS (Canvas2D fallback).
 */

import { getSyncedTimestamp } from './clockSync';
import {
  evaluatePixel,
  PIXEL_GRID_H,
  PIXEL_GRID_W,
  type MatrixCommand,
} from './pixelMapper';
import { type PuzzlePresetId } from './puzzleChoreography';
import { TRIBUNE_BANDS, type StadiumTribuneId } from './seatPixelMap';

export const VISUALIZER_PHONE_COUNT = 50_000;

export type VisualizerPhone = {
  x: number;
  y: number;
  nx: number;
  ny: number;
  tribune: StadiumTribuneId;
  seatLabel: string;
};

type BandSpec = {
  tribune: StadiumTribuneId;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  pixels: number;
};

function bandSpecs(): BandSpec[] {
  return (Object.keys(TRIBUNE_BANDS) as StadiumTribuneId[]).map((tribune) => {
    const b = TRIBUNE_BANDS[tribune];
    const pixels = (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
    return {
      tribune,
      x0: b.x0,
      x1: b.x1,
      y0: b.y0,
      y1: b.y1,
      pixels,
    };
  });
}

/**
 * Tribün bantlarına orantılı 50k nokta (alt-piksel yoğunluk).
 */
export function buildVisualizerPhones(
  count: number = VISUALIZER_PHONE_COUNT,
): VisualizerPhone[] {
  const bands = bandSpecs();
  const totalPx = bands.reduce((s, b) => s + b.pixels, 0);
  const phones: VisualizerPhone[] = [];
  let remaining = count;

  for (let bi = 0; bi < bands.length; bi++) {
    const band = bands[bi]!;
    const n =
      bi === bands.length - 1
        ? remaining
        : Math.max(1, Math.round((count * band.pixels) / totalPx));
    const take = Math.min(n, remaining);
    remaining -= take;

    const bw = band.x1 - band.x0 + 1;
    const bh = band.y1 - band.y0 + 1;
    const cols = Math.max(1, Math.ceil(Math.sqrt((take * bw) / bh)));
    const rows = Math.max(1, Math.ceil(take / cols));

    for (let i = 0; i < take; i++) {
      const cx = i % cols;
      const cy = Math.floor(i / cols);
      const x = band.x0 + ((cx + 0.5) / cols) * bw;
      const y = band.y0 + ((cy + 0.5) / rows) * bh;
      const xi = Math.min(band.x1, Math.max(band.x0, Math.floor(x)));
      const yi = Math.min(band.y1, Math.max(band.y0, Math.floor(y)));
      phones.push({
        x,
        y,
        nx: (x + 0.5) / PIXEL_GRID_W,
        ny: (y + 0.5) / PIXEL_GRID_H,
        tribune: band.tribune,
        seatLabel: `${band.tribune[0]}${xi}-${yi}`,
      });
    }
  }

  return phones;
}

const VS_SOURCE = `
attribute vec2 a_pos;
attribute vec3 a_col;
uniform float u_pointSize;
varying vec3 v_col;
void main() {
  v_col = a_col;
  gl_Position = vec4(a_pos, 0.0, 1.0);
  gl_PointSize = u_pointSize;
}
`;

const FS_SOURCE = `
precision mediump float;
varying vec3 v_col;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(v_col, 1.0);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

type GlState = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  posBuf: WebGLBuffer;
  colBuf: WebGLBuffer;
  aPos: number;
  aCol: number;
  uPointSize: WebGLUniformLocation;
  positions: Float32Array;
  colors: Float32Array;
};

function initGl(
  canvas: HTMLCanvasElement,
  phones: VisualizerPhone[],
): GlState | null {
  const gl =
    canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    }) ||
    (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  const n = phones.length;
  const positions = new Float32Array(n * 2);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = phones[i]!;
    // Stadium UV → clip [-1,1], Y flip for GL
    positions[i * 2] = p.nx * 2 - 1;
    positions[i * 2 + 1] = -(p.ny * 2 - 1);
    colors[i * 3] = 0.05;
    colors[i * 3 + 1] = 0.07;
    colors[i * 3 + 2] = 0.1;
  }

  const posBuf = gl.createBuffer();
  const colBuf = gl.createBuffer();
  if (!posBuf || !colBuf) return null;

  const aPos = gl.getAttribLocation(program, 'a_pos');
  const aCol = gl.getAttribLocation(program, 'a_col');
  const uPointSize = gl.getUniformLocation(program, 'u_pointSize');
  if (aPos < 0 || aCol < 0 || !uPointSize) return null;

  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);

  return {
    gl,
    program,
    posBuf,
    colBuf,
    aPos,
    aCol,
    uPointSize,
    positions,
    colors,
  };
}

export class StadiumVisualizerEngine {
  readonly phones: VisualizerPhone[];
  readonly count: number;
  private matrix: MatrixCommand | null = null;
  private pendingMatrix: MatrixCommand | null = null;
  private pendingAt = 0;
  private hasPending = false;
  private blackout = false;
  private fps = 0;
  private frames = 0;
  private fpsAt = 0;
  private glState: GlState | null = null;
  private useWebGl = false;

  constructor(phones: VisualizerPhone[] = buildVisualizerPhones()) {
    this.phones = phones;
    this.count = phones.length;
  }

  /** WebGL context’i canvas’a bağla (web). Başarısızsa Canvas2D fallback. */
  attachCanvas(canvas: HTMLCanvasElement): 'webgl' | 'canvas2d' {
    this.glState = initGl(canvas, this.phones);
    this.useWebGl = this.glState != null;
    return this.useWebGl ? 'webgl' : 'canvas2d';
  }

  getFps() {
    return this.fps;
  }

  getRenderMode() {
    return this.useWebGl ? 'webgl' : 'canvas2d';
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

  isBlackout() {
    return this.blackout;
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

    const colors = this.glState?.colors;
    const n = this.count;

    if (this.blackout || !this.matrix || !this.matrix.engaged) {
      if (colors) {
        for (let i = 0; i < n; i++) {
          colors[i * 3] = 0.04;
          colors[i * 3 + 1] = 0.05;
          colors[i * 3 + 2] = 0.08;
        }
      }
      return n;
    }

    const cmd = this.matrix;
    for (let i = 0; i < n; i++) {
      const p = this.phones[i]!;
      const [rr, gg, bb] = evaluatePixel(p.nx, p.ny, nowMs, cmd);
      if (colors) {
        colors[i * 3] = rr / 255;
        colors[i * 3 + 1] = gg / 255;
        colors[i * 3 + 2] = bb / 255;
      }
    }
    return n;
  }

  /**
   * WebGL point cloud çiz. WebGL yoksa false döner (çağıran 2D fallback kullanır).
   */
  drawWebGl(canvas: HTMLCanvasElement, clear = '#03060C'): boolean {
    const state = this.glState;
    if (!state || !this.useWebGl) return false;
    const { gl, program, posBuf, colBuf, aPos, aCol, uPointSize, colors } =
      state;

    const w = canvas.width;
    const h = canvas.height;
    gl.viewport(0, 0, w, h);

    const r = parseInt(clear.slice(1, 3), 16) / 255;
    const g = parseInt(clear.slice(3, 5), 16) / 255;
    const b = parseInt(clear.slice(5, 7), 16) / 255;
    gl.clearColor(r || 0.01, g || 0.02, b || 0.05, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Kare stadyum letterbox
    const side = Math.min(w, h) * 0.92;
    const ox = (w - side) / 2;
    const oy = (h - side) / 2;
    gl.viewport(ox, oy, side, side);

    gl.useProgram(program);
    const pointSize = Math.max(1.5, Math.min(4.5, side / 280));
    gl.uniform1f(uPointSize, pointSize);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, colors);
    gl.enableVertexAttribArray(aCol);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, this.count);
    return true;
  }
}

/**
 * Canvas2D fallback — düşük yoğunluk örnekleme (50k’nın alt kümesi).
 */
export function drawVisualizerFrame2d(
  ctx: CanvasRenderingContext2D,
  engine: StadiumVisualizerEngine,
  opts?: { clear?: string; maxPoints?: number },
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = opts?.clear ?? '#03060C';
  ctx.fillRect(0, 0, w, h);

  const pad = Math.floor(Math.min(w, h) * 0.04);
  const side = Math.min(w, h) - pad * 2;
  const ox = (w - side) / 2;
  const oy = (h - side) / 2;

  ctx.fillStyle = '#070B14';
  ctx.fillRect(ox, oy, side, side);

  const maxPts = opts?.maxPoints ?? 12_000;
  const step = Math.max(1, Math.ceil(engine.count / maxPts));
  const now = getSyncedTimestamp();
  const cmd = engine.getMatrix();
  const size = Math.max(1, side / 220);

  for (let i = 0; i < engine.count; i += step) {
    const p = engine.phones[i]!;
    let rr = 12;
    let gg = 16;
    let bb = 28;
    if (cmd && cmd.engaged && !engine.isBlackout()) {
      [rr, gg, bb] = evaluatePixel(p.nx, p.ny, now, cmd);
    }
    ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
    const px = ox + p.nx * side;
    const py = oy + p.ny * side;
    ctx.fillRect(px - size / 2, py - size / 2, size, size);
  }

  ctx.fillStyle = 'rgba(148,163,184,0.9)';
  ctx.font = '12px ui-monospace,monospace';
  ctx.fillText(
    `${engine.count.toLocaleString('tr-TR')} phones · ${engine.getFps()} fps · 2D`,
    12,
    20,
  );
}

/** @deprecated Use engine.drawWebGl / drawVisualizerFrame2d */
export function drawVisualizerFrame(
  ctx: CanvasRenderingContext2D,
  engine: StadiumVisualizerEngine,
  _gridCanvas?: HTMLCanvasElement,
  opts?: { clear?: string },
) {
  if (engine.drawWebGl(ctx.canvas, opts?.clear)) {
    const overlay = engine.getOverlayEmoji();
    if (overlay) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#F8FAFC';
      ctx.font = `bold ${Math.floor(ctx.canvas.height * 0.14)}px system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(overlay, ctx.canvas.width / 2, ctx.canvas.height / 2);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.font = '12px ui-monospace,monospace';
    ctx.fillText(
      `${engine.count.toLocaleString('tr-TR')} phones · ${engine.getFps()} fps · WebGL`,
      12,
      20,
    );
    return;
  }
  drawVisualizerFrame2d(ctx, engine, opts);
}
