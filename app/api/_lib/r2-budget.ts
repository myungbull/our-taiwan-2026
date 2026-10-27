// Hard R2 usage caps for the standalone deployment, kept far below the R2 free tier
// (10 GB-month storage, 1M Class A, 10M Class B per month) so it never bills.
// Sites leaves these variables unset and keeps its previous behaviour.

export type R2Limits = { maxBytes: number; maxWritesPerMonth: number; maxReadsPerMonth: number };
type LimitEnv = { R2_MAX_BYTES?: string; R2_MAX_WRITES_PER_MONTH?: string; R2_MAX_READS_PER_MONTH?: string };

function positive(value: string | undefined): number | null {
  const number = Number(value);
  return value && Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function r2Limits(env: LimitEnv): R2Limits | null {
  if (!env.R2_MAX_BYTES && !env.R2_MAX_WRITES_PER_MONTH && !env.R2_MAX_READS_PER_MONTH) return null;
  const maxBytes = positive(env.R2_MAX_BYTES), maxWritesPerMonth = positive(env.R2_MAX_WRITES_PER_MONTH), maxReadsPerMonth = positive(env.R2_MAX_READS_PER_MONTH);
  // A partial or malformed configuration allows nothing rather than everything.
  return { maxBytes: maxBytes ?? 0, maxWritesPerMonth: maxWritesPerMonth ?? 0, maxReadsPerMonth: maxReadsPerMonth ?? 0 };
}

export function usagePeriod(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 7);
}

// Atomically counts one operation; returns false (and counts nothing) once the monthly limit is reached.
export async function reserveR2Operation(db: D1Database, kind: 'r2-write' | 'r2-read', limit: number, now = Date.now()): Promise<boolean> {
  if (limit < 1) return false;
  try {
    const row = await db.prepare('INSERT INTO usage_counters (period, kind, count) VALUES (?, ?, 1) ON CONFLICT(period, kind) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count')
      .bind(usagePeriod(now), kind, limit).first<{ count: number }>();
    return row !== null;
  } catch {
    return false;
  }
}

export async function storedBytes(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COALESCE(SUM(byte_size),0) AS used_bytes FROM photos').first<{ used_bytes: number }>();
  return Number(row?.used_bytes ?? 0);
}
