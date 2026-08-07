/**
 * V27.0 — Seat & Pixel Mapping oto-simülasyon (10.000 mock client).
 *
 * Çalıştır: npm run test:mapping
 */

import { createIdleMatrixCommand } from '../pixelMapper';
import { sampleTurkishFlag } from '../puzzleChoreography';
import {
  enumerateUniqueTickets,
  SeatOnboardingAuth,
  seatToPixel,
  stadiumSeatCapacity,
  ticketFromLabels,
  TRIBUNE_BANDS,
} from '../seatPixelMap';
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

  // Determinism: same ticket → same XY
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

function testVisualSlicerFlagAt50_50(): SimResult {
  const x = 50;
  const y = 50;
  const gridW = 200;
  const gridH = 200;
  const nx = (x + 0.5) / gridW;
  const ny = (y + 0.5) / gridH;

  const expected = sampleTurkishFlag(nx, ny);
  const sampled = samplePuzzlePixelAt('turkish_flag', x, y, gridW, gridH);
  assert(
    rgbEquals(sampled, { r: expected[0], g: expected[1], b: expected[2] }),
    `flag sample mismatch got ${sampled.r},${sampled.g},${sampled.b} expected ${expected}`,
  );

  const matrix = createIdleMatrixCommand({
    engaged: true,
    puzzlePreset: 'turkish_flag',
    overlayEmoji: null,
  });
  const coord = {
    x,
    y,
    nx,
    ny,
    gridW,
    gridH,
  };
  const frame = sliceVisualForDevice({
    matrix,
    coord,
    nowMs: matrix.t0,
  });
  assert(
    rgbEquals(frame, { r: expected[0], g: expected[1], b: expected[2] }),
    `slicer mismatch ${frame.r},${frame.g},${frame.b}`,
  );
  assert(frame.puzzlePreset === 'turkish_flag', 'preset');
  assert(frame.x === 50 && frame.y === 50, 'coord echo');

  return {
    name: 'Visual slicer unit (X:50 Y:50 Turkish Flag)',
    ok: true,
    detail: `rgb(${frame.r},${frame.g},${frame.b}) lit=${frame.lit}`,
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
  // Center-ish cell for GOL glyph
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
  // Frame boyutu sabit — tam grid değil (sadece 1 piksel meta)
  const matrix = createIdleMatrixCommand({
    engaged: true,
    puzzlePreset: 'turkish_flag',
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
    testVisualSlicerFlagAt50_50,
    testVisualSlicerCupAndGol,
    testSlicerDoesNotSendFullBitmap,
  ];

  console.log('\n=== V27 Seat & Pixel Mapping Simulation ===\n');
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
