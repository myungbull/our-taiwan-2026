import { env } from 'cloudflare:workers';
import { requireAllowedMember, isResponse, sameOrigin, travelerLabel, isTripDate } from '../_lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const member = await requireAllowedMember();
  if (isResponse(member)) return member;
  const date = new URL(request.url).searchParams.get('date');
  if (date && !isTripDate(date)) return Response.json({ error: '여행 날짜를 확인해 주세요.' }, { status: 400 });
  try {
    const query = date
      ? env.DB!.prepare('SELECT id, trip_date, place, caption, uploader_label, uploaded_at, byte_size, content_type FROM photos WHERE trip_date=? ORDER BY uploaded_at DESC LIMIT 100').bind(date)
      : env.DB!.prepare('SELECT id, trip_date, place, caption, uploader_label, uploaded_at, byte_size, content_type FROM photos ORDER BY uploaded_at DESC LIMIT 100');
    const [result, usage] = await Promise.all([
      query.all(),
      env.DB!.prepare('SELECT COUNT(*) AS file_count, COALESCE(SUM(byte_size),0) AS used_bytes FROM photos').first<{ file_count: number; used_bytes: number }>(),
    ]);
    const photos = (result.results ?? []).map((row: any) => ({
      id: row.id,
      date: row.trip_date,
      place: row.place,
      caption: row.caption,
      uploader: row.uploader_label,
      uploadedAt: row.uploaded_at,
      byteSize: row.byte_size,
      contentType: row.content_type,
      imageUrl: `/api/photos/${row.id}`,
    }));
    return Response.json({
      photos,
      viewerLabel: travelerLabel(member.memberIndex),
      usage: { usedBytes: Number(usage?.used_bytes ?? 0), fileCount: Number(usage?.file_count ?? 0), referenceBytes: 10 * 1024 ** 3 },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: '사진 기록을 불러오지 못했습니다.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

export async function POST(request: Request) {
  const member = await requireAllowedMember();
  if (isResponse(member)) return member;
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (!env.BUCKET) return Response.json({ error: '비공개 사진 저장소를 사용할 수 없습니다.' }, { status: 503 });
  let objectKey: string | null = null;
  try {
    const form = await request.formData();
    const date = form.get('date');
    const place = String(form.get('place') ?? '').trim().slice(0, 120);
    const caption = String(form.get('caption') ?? '').trim().slice(0, 240);
    const file = form.get('media') ?? form.get('image');
    const image = file instanceof File && ['image/webp', 'image/jpeg'].includes(file.type);
    const video = file instanceof File && ['video/mp4', 'video/webm'].includes(file.type);
    if (!isTripDate(date) || !(file instanceof File) || (!image && !video) || file.size < 1 || (image && file.size > 5_000_000) || (video && file.size > 50_000_000)) {
      return Response.json({ error: '사진은 5MB 이하, 영상은 압축된 MP4/WebM 50MB 이하로 올려 주세요.' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const extension = file.type === 'image/webp' ? 'webp' : file.type === 'image/jpeg' ? 'jpg' : file.type === 'video/mp4' ? 'mp4' : 'webm';
    objectKey = `private-trip/${id}.${extension}`;
    const uploadedAt = new Date().toISOString();
    await env.BUCKET.put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: 'private, no-store, max-age=0' },
      customMetadata: { date, uploader: travelerLabel(member.memberIndex), mediaKind: video ? 'video' : 'image' },
    });
    await env.DB!.prepare('INSERT INTO photos (id,trip_date,place,caption,uploader_id,uploader_label,uploaded_at,object_key,content_type,byte_size) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(id, date, place, caption, member.userId, travelerLabel(member.memberIndex), uploadedAt, objectKey, file.type, file.size).run();
    return Response.json({ ok: true, id, imageUrl: `/api/photos/${id}` });
  } catch {
    if (objectKey && env.BUCKET) await env.BUCKET.delete(objectKey).catch(() => undefined);
    return Response.json({ error: '사진 저장에 실패했습니다. 다시 시도해 주세요.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const member = await requireAllowedMember();
  if (isResponse(member)) return member;
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  let id: string | undefined;
  try { id = (await request.json() as { id?: string }).id; }
  catch { return Response.json({ error: '삭제 요청을 확인해 주세요.' }, { status: 400 }); }
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return Response.json({ error: '사진을 확인해 주세요.' }, { status: 400 });
  if (!env.BUCKET) return Response.json({ error: '비공개 사진 저장소를 사용할 수 없습니다.' }, { status: 503 });
  try {
    const photo = await env.DB!.prepare('SELECT object_key,uploader_id FROM photos WHERE id=?').bind(id).first<{ object_key: string; uploader_id: string }>();
    if (!photo) return Response.json({ error: '사진을 찾을 수 없습니다.' }, { status: 404 });
    if (photo.uploader_id !== member.userId) return Response.json({ error: '사진을 올린 사람만 삭제할 수 있습니다.' }, { status: 403 });
    await env.BUCKET.delete(photo.object_key);
    await env.DB!.prepare('DELETE FROM photos WHERE id=? AND uploader_id=?').bind(id, member.userId).run();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: '사진 삭제에 실패했습니다.' }, { status: 503 });
  }
}
