import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { r2Limits, reserveR2Operation, storedBytes, usagePeriod } from '../app/api/_lib/r2-budget.ts';

function createDb() {
  const sqlite = new DatabaseSync(':memory:');
  const dir = new URL('../drizzle/', import.meta.url);
  for (const file of readdirSync(dir).filter(name => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(file, dir), 'utf8'));
  return {
    sqlite,
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      const bound = (...values) => ({ run: async () => statement.run(...values), first: async () => statement.get(...values) ?? null });
      return { ...bound(), bind: bound };
    },
  };
}

test('limits are off for Sites (no variables) and fail closed when partial or malformed', () => {
  assert.equal(r2Limits({}), null);
  assert.deepEqual(r2Limits({ R2_MAX_BYTES: '5000000000', R2_MAX_WRITES_PER_MONTH: '50000', R2_MAX_READS_PER_MONTH: '500000' }), { maxBytes: 5e9, maxWritesPerMonth: 50000, maxReadsPerMonth: 500000 });
  assert.deepEqual(r2Limits({ R2_MAX_BYTES: '5000000000' }), { maxBytes: 5e9, maxWritesPerMonth: 0, maxReadsPerMonth: 0 });
  assert.deepEqual(r2Limits({ R2_MAX_BYTES: 'lots', R2_MAX_WRITES_PER_MONTH: '-1', R2_MAX_READS_PER_MONTH: '1.5' }), { maxBytes: 0, maxWritesPerMonth: 0, maxReadsPerMonth: 0 });
});

test('operations are counted per month and refused exactly at the limit', async () => {
  const db = createDb(), november = Date.parse('2026-11-18T03:00:00Z'), december = Date.parse('2026-12-01T00:00:00Z');
  const results = [];
  for (let index = 0; index < 4; index++) results.push(await reserveR2Operation(db, 'r2-write', 3, november));
  assert.deepEqual(results, [true, true, true, false]);
  assert.equal(await reserveR2Operation(db, 'r2-read', 3, november), true, 'kinds are counted separately');
  assert.equal(await reserveR2Operation(db, 'r2-write', 3, december), true, 'a new month starts again');
  assert.equal(db.sqlite.prepare('SELECT count FROM usage_counters WHERE period = ? AND kind = ?').get(usagePeriod(november), 'r2-write').count, 3);
});

test('a zero limit or a database error refuses the operation', async () => {
  assert.equal(await reserveR2Operation(createDb(), 'r2-read', 0), false);
  const broken = { prepare() { throw new Error('d1 down'); } };
  assert.equal(await reserveR2Operation(broken, 'r2-read', 10), false);
});

test('stored bytes come from the photo metadata', async () => {
  const db = createDb();
  assert.equal(await storedBytes(db), 0);
  const insert = db.sqlite.prepare("INSERT INTO photos (id,trip_date,uploader_id,uploader_label,uploaded_at,object_key,byte_size) VALUES (?, '2026-11-18', 'u', '여행자 A', '2026-11-18T00:00:00.000Z', ?, ?)");
  insert.run('a', 'k1', 4_000_000);
  insert.run('b', 'k2', 45_000_000);
  assert.equal(await storedBytes(db), 49_000_000);
});
