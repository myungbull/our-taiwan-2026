import { env } from 'cloudflare:workers';
import { requireAllowedMember, isResponse } from '../../_lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireAllowedMember();
  if (isResponse(member)) return member;
  if (!env.BUCKET) return new Response('Private storage unavailable', { status: 503 });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  try {
    const row = await env.DB!.prepare('SELECT object_key,content_type FROM photos WHERE id=?').bind(id).first<{ object_key: string; content_type: string }>();
    if (!row) return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    const isVideo = row.content_type.startsWith('video/');
    const object = await env.BUCKET.get(row.object_key, isVideo && request.headers.has('range') ? { range: request.headers } : undefined);
    if (!object) return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    const headers = new Headers({
      'Content-Type': row.content_type,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    });
    if (isVideo) headers.set('Accept-Ranges', 'bytes');
    let status = 200;
    if (isVideo && request.headers.has('range') && object.range) {
      const range = object.range;
      const suffix = 'suffix' in range ? range.suffix : undefined;
      const offset = typeof suffix === 'number' ? Math.max(0, object.size - suffix) : ('offset' in range ? range.offset : undefined) ?? 0;
      const length = typeof suffix === 'number' ? Math.min(suffix, object.size) : ('length' in range ? range.length : undefined) ?? object.size - offset;
      headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
      headers.set('Content-Length', String(length));
      status = 206;
    } else headers.set('Content-Length', String(object.size));
    return new Response(object.body, { status, headers });
  } catch {
    return new Response('Photo unavailable', { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
