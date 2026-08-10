/**
 * V30.0 — Seat & Pixel Mapping + Texture UV oto-simülasyon.
 *
 * Çalıştır: npm run test:mapping
 */

import {
  DEFAULT_FLAG_TEXTURE_ID,
  ensureDefaultFlagTexture,
  sampleAudienceMappedRgb,
} from '../audienceTexture';
import { createIdleMatrixCommand } from '../pixelMapper';
import {
  enumerateUniqueTickets,
  SeatOnboardingAuth,
  seatToPixel,
  stadiumSeatCapacity,
  ticketFromLabels,
  TRIBUNE_BANDS,
} from '../seatPixelMap';
import { stadiumToTextureUv } from '../tribuneUnwrap';
import {
  rgbEquals,
  samplePuzzlePixelAt,
  sliceVisualForDevice,
} from '../visualSlicer';

type SimResult = { name: string; ok: boolean; detail: string };

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testTicketParsing(): SimResult {
  const t = ticketFromLabels({
    tribuneLabel: 'Doğu',
    block: 102,
    row: 5,
    seat: 12,
  });
  assert(t != null, 'Doğu parse failed');
  assert(t!.tribune === 'EAST', 'Doğu → EAST');
  const coord = seatToPixel(t!);
  assert(coord.x >= TRIBUNE_BANDS.EAST.x0, 'EAST x lower');
  assert(coord.x <= TRIBUNE_BANDS.EAST.x1, 'EAST x upper');
  return {
    name: 'Onboarding ticket parse (Doğu Blok 102)',
    ok: true,
    detail: `EAST block102 r5 s12 → (${coord.x},${coord.y}) nx=${coord.nx.toFixed(3)}`,
  };
}

function test10kUniqueMapping(): SimResult {
  const N = 10_000;
  const cap = stadiumSeatCapacity();
  assert(cap >= N, `stadium capacity ${cap} < ${N}`);

  const tickets = enumerateUniqueTickets(N);
  assert(tickets.length === N, `enumerate got ${tickets.length}`);

  const auth = new SeatOnboardingAuth();
  const pixelKeys = new Set<string>();
  const seatKeys = new Set<string>();

  for (let i = 0; i < tickets.length; i++) {
    const res = auth.authenticate(tickets[i]!, `mock-${i}`);
    assert(res.ok, `auth fail #${i}: ${!res.ok ? res.error : ''}`);
    if (!res.ok) continue;
    assert(!seatKeys.has(res.mapping.seatKey), `seat collision ${res.mapping.seatKey}`);
    assert(
      !pixelKeys.has(res.mapping.pixelKey),
      `pixel collision ${res.mapping.pixelKey}`,
    );
    seatKeys.add(res.mapping.seatKey);
    pixelKeys.add(res.mapping.pixelKey);
  }

  assert(auth.registeredCount === N, `registered ${auth.registeredCount}`);
  assert(pixelKeys.size === N, `unique pixels ${pixelKeys.size}`);
  assert(seatKeys.size === N, `unique seats ${seatKeys.size}`);

  const sample = tickets[1234]!;
  const a = seatToPixel(sample);
  const b = seatToPixel(sample);
  assert(a.x === b.x && a.y === b.y, 'non-deterministic mapping');

  return {
    name: '10,000 mock clients unique Seat→Pixel',
    ok: true,
    detail: `N=${N} uniqueXY=${pixelKeys.size} capacity=${cap} registered=${auth.registeredCount}`,
  };
}

function testCollisionRejection(): SimResult {
  const auth = new SeatOnboardingAuth();
  const ticket = {
    tribune: 'NORTH' as const,
    block: 201,
    row: 3,
    seat: 7,
  };
  const a = auth.authenticate(ticket, 'device-A');
  assert(a.ok, 'first auth');
  const b = auth.authenticate(ticket, 'device-B');
  assert(!b.ok, 'duplicate seat should fail');
  return {
    name: 'Seat collision rejection',
    ok: true,
    detail: !b.ok ? b.error : 'ok',
  };
}

function testTextureUvFlagOnTribune(): SimResult {
  const tex = ensureDefaultFlagTexture();
  assert(tex.id === DEFAULT_FLAG_TEXTURE_ID, 'default id');
  assert(Math.abs(tex.aspect - 1.5) < 0.01, `aspect ${tex.aspect} != 1.5`);

  // Pitch merkezi → UV yok
  const pitchUv = stadiumToTextureUv(0.5, 0.5, tex.aspect);
  assert(pitchUv == null, 'pitch should not map to texture');

  // Batı tribün (hilal tarafı) → texture örneklenmeli
  const west = seatToPixel({
    tribune: 'WEST',
    block: 1,
    row: 12,
    seat: 10,
  });
  const uv = stadiumToTextureUv(west.nx, west.ny, tex.aspect);
  assert(uv != null, 'west seat must have texture UV');

  const rgb = sampleAudienceMappedRgb(west.nx, west.ny, tex);
  assert(rgb[0] + rgb[1] + rgb[2] > 0, 'west sample dark');

  const sampled = samplePuzzlePixelAt(
    'turkish_flag',
    west.x,
    west.y,
    200,
    200,
  );
  assert(
    rgbEquals(sampled, { r: rgb[0], g: rgb[1], b: rgb[2] }),
    `slicer mismatch ${sampled.r},${sampled.g},${sampled.b}`,
  );

  const matrix = createIdleMatrixCommand({
    engaged: true,
    puzzlePreset: 'turkish_flag',
    textureId: DEFAULT_FLAG_TEXTURE_ID,
    overlayEmoji: null,
  });
  const frame = sliceVisualForDevice({
    matrix,
    coord: west,
    nowMs: matrix.t0,
  });
  assert(frame.puzzlePreset === 'turkish_flag', 'preset');
  assert(
    rgbEquals(frame, { r: rgb[0], g: rgb[1], b: rgb[2] }),
    `evaluate mismatch ${frame.r},${frame.g},${frame.b}`,
  );

  return {
    name: 'Texture UV flag on tribune (not pitch)',
    ok: true,
    detail: `west(${west.x},${west.y}) uv=(${uv!.u.toFixed(3)},${uv!.v.toFixed(3)}) rgb(${frame.r},${frame.g},${frame.b})`,
  };
}

function testVisualSlicerCupAndGol(): SimResult {
  const cup = samplePuzzlePixelAt('club_cup', 100, 100, 200, 200);
  assert(cup.r + cup.g + cup.b > 0, 'cup pixel dark?');

  const matrix = createIdleMatrixCommand({
    engaged: true,
    puzzlePreset: 'live_emoji',
    overlayEmoji: 'GOL',
  });
  let litGlyph = 0;
  let dark = 0;
  for (let y = 60; y < 140; y += 4) {
    for (let x = 40; x < 160; x += 4) {
      const frame = sliceVisualForDevice({
        matrix,
        coord: {
          x,
          y,
          nx: (x + 0.5) / 200,
          ny: (y + 0.5) / 200,
          gridW: 200,
          gridH: 200,
        },
        nowMs: matrix.t0,
      });
      if (frame.overlayGlyph === 'GOL') litGlyph += 1;
      else dark += 1;
    }
  }
  assert(litGlyph > 0, 'GOL overlay produced no lit cells');
  assert(dark > 0, 'GOL should not light entire grid');

  return {
    name: 'Visual slicer cup + GOL overlay slice',
    ok: true,
    detail: `cup rgb(${cup.r},${cup.g},${cup.b}) GOL litCells=${litGlyph} dark=${dark}`,
  };
}

function testSlicerDoesNotSendFullBitmap(): SimResult {
  ensureDefaultFlagTexture();
  const matrix = createIdleMatrixCommand({
    engaged: true,
    puzzlePreset: 'turkish_flag',
    textureId: DEFAULT_FLAG_TEXTURE_ID,
  });
  const frame = sliceVisualForDevice({
    matrix,
    coord: seatToPixel({
      tribune: 'SOUTH',
      block: 205,
      row: 10,
      seat: 8,
    }),
    nowMs: matrix.t0,
  });
  const keys = Object.keys(frame);
  assert(keys.includes('r') && keys.includes('x'), 'frame shape');
  assert(!('pixels' in frame), 'must not include full bitmap');
  assert(!('imageData' in frame), 'must not include imageData');
  return {
    name: 'Slicer payload is single-pixel (no full bitmap)',
    ok: true,
    detail: `keys=[${keys.join(',')}] @(${frame.x},${frame.y})`,
  };
}

function main() {
  const tests = [
    testTicketParsing,
    test10kUniqueMapping,
    testCollisionRejection,
    testTextureUvFlagOnTribune,
    testVisualSlicerCupAndGol,
    testSlicerDoesNotSendFullBitmap,
  ];

  console.log('\n=== V30 Seat Mapping + Texture UV Simulation ===\n');
  let failed = 0;
  for (const t of tests) {
    try {
      const r = t();
      console.log(`✔ ${r.name}`);
      console.log(`  ${r.detail}`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✘ ${t.name}`);
      console.log(`  ${msg}`);
    }
  }
  console.log(
    `\n--- ${tests.length - failed}/${tests.length} passed ---\n`,
  );
  if (failed > 0) process.exitCode = 1;
}

main();
