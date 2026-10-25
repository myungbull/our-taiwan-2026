import { env } from 'cloudflare:workers';
import { requireAllowedMember, isResponse } from '../../_lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireAllowedMember();
  if (isResponse(member)) return member;
  if (!env.BUCKET) return new Response('Private storage unavailable', { status: 503 });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  try {
    const row = await env.DB!.prepare('SELECT object_key,content_type FROM photos WHERE id=?').bind(id).first<{ object_key: string; content_type: string }>();
    if (!row) return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    const object = await env.BUCKET.get(row.object_key);
    if (!object) return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    return new Response(object.body, { headers: {
      'Content-Type': row.content_type,
      'Content-Length': String(object.size),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return new Response('Photo unavailable', { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
