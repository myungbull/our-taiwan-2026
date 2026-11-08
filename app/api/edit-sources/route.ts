import { env } from 'cloudflare:workers';
import { requireAllowedMember, isResponse, sameOrigin, travelerLabel } from '../_lib/auth';
import { r2Limits, reserveR2Operation, storedBytes } from '../_lib/r2-budget';

export const dynamic = 'force-dynamic';

// Stages a photo that is not in the diary yet, so a claude.ai cloud session can fetch it
// for a Higgsfield edit (scripts/fetch-trip-photo.mjs --source). It never appears in the
// diary; the cloud session deletes it after the import (docs/CLOUD_PHOTO_EDIT.md).
export async function POST(request: Request) {
  const member = await requireAllowedMember();
  if (isResponse(member)) return member;
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (!env.BUCKET) return Response.json({ error: '비공개 사진 저장소를 사용할 수 없습니다.' }, { status: 503 });
  let objectKey: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get('media');
    if (!(file instanceof File) || file.type !== 'image/jpeg' || file.size < 1 || file.size > 5_000_000) {
      return Response.json({ error: '편집할 사진은 5MB 이하 JPEG로 보내 주세요.' }, { status: 400 });
    }
    const limits = r2Limits(env);
    if (limits) {
      if (await storedBytes(env.DB!) + file.size > limits.maxBytes) return Response.json({ error: '무료 저장 한도에 도달했어요. 기존 사진을 지운 뒤 다시 시도해 주세요.' }, { status: 507 });
      if (!await reserveR2Operation(env.DB!, 'r2-write', limits.maxWritesPerMonth)) return Response.json({ error: '이번 달 무료 업로드 한도에 도달했어요.' }, { status: 429 });
    }
    const id = crypto.randomUUID();
    objectKey = `edit-source/${id}.jpg`;
    await env.BUCKET.put(objectKey, file.stream(), {
      httpMetadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store, max-age=0' },
      customMetadata: { uploader: travelerLabel(member.memberIndex), stagedAt: new Date().toISOString() },
    });
    return Response.json({ ok: true, id });
  } catch {
    if (objectKey) await env.BUCKET.delete(objectKey).catch(() => undefined);
    return Response.json({ error: '편집할 사진을 올리지 못했어요. 다시 시도해 주세요.' }, { status: 503 });
  }
}
