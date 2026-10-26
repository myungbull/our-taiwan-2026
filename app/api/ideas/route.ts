import { env } from 'cloudflare:workers';
import { requireAllowedMember, isResponse, sameOrigin, travelerLabel } from '../_lib/auth';
import { suggestIdeaSlots } from '../../idea-planner';
import { IDEA_VOTE_SLOT, SCHEDULE_SLOT_PREFIX, SCHEDULE_USER, ideaHasTwoApprovals, resolveIdeaApproval, selectedScheduleSlotId } from '../../idea-state';
import { days } from '../../travel-data';

export const dynamic = 'force-dynamic';

const cleanText = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const idPattern = /^[a-f0-9-]{36}$/i;

export async function GET() {
  const member = await requireAllowedMember();
  if (isResponse(member)) return member;
  try {
    const [ideasResult, votesResult] = await Promise.all([
      env.DB!.prepare('SELECT id, title, url, note, place, duration_minutes, preferred_date, suggestions, created_by, created_at, updated_at FROM ideas ORDER BY updated_at DESC LIMIT 80').all(),
      env.DB!.prepare('SELECT idea_id, slot_id, user_id, response FROM idea_votes').all(),
    ]);
    // Stable user IDs are compared to the signed identity at write time. The response exposes only anonymized labels.
    const votes = (votesResult.results ?? []).map((row: any) => ({
      ideaId: row.idea_id as string,
      slotId: row.slot_id as string,
      userId: row.user_id as string,
      response: row.response as 'yes' | 'no',
    }));
    const ideas = (ideasResult.results ?? []).map((row: any) => {
      const suggestions = JSON.parse(row.suggestions || '[]') as Array<Record<string, unknown> & { id: string }>;
      const ideaVotes = votes.filter((vote) => vote.ideaId === row.id);
      const ideaApproval = resolveIdeaApproval(ideaVotes, row.created_by, member.userId);
      const slotVotes = suggestions.map((slot) => {
        const matching = votes.filter((vote) => vote.ideaId === row.id && vote.slotId === slot.id);
        const viewerVote = matching.find((vote) => vote.userId === member.userId)?.response ?? null;
        const yesVotes = matching.filter((vote) => vote.response === 'yes');
        return {
          slotId: slot.id,
          votes: matching.map((vote) => ({ label: vote.userId === member.userId ? '나' : '동행인', response: vote.response })),
          myVote: viewerVote,
          approved: yesVotes.some((a) => yesVotes.some((b) => a.userId !== b.userId)),
        };
      });
      const selectedSlotId = selectedScheduleSlotId(ideaVotes, ideaApproval.approved);
      return {
        id: row.id,
        title: row.title,
        url: row.url,
        note: row.note,
        place: row.place,
        durationMinutes: row.duration_minutes,
        preferredDate: row.preferred_date,
        suggestions,
        slotVotes,
        ideaApproval,
        selectedSlotId,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
    return Response.json({ ideas, viewerLabel: travelerLabel(member.memberIndex) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: '공동 아이디어를 불러오지 못했습니다.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

export async function POST(request: Request) {
  const member = await requireAllowedMember();
  if (isResponse(member)) return member;
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    if (action === 'save') {
      const isUpdate = Boolean(body.id);
      const title = cleanText(body.title, 100);
      const place = cleanText(body.place, 120);
      const url = cleanText(body.url, 500);
      const note = cleanText(body.note, 500);
      const durationMinutes = Number(body.durationMinutes);
      const preferredDate = body.preferredDate === '' || body.preferredDate == null ? null : body.preferredDate;
      const id = body.id ? cleanText(body.id, 36) : crypto.randomUUID();
      if (!idPattern.test(id) || title.length < 1 || place.length < 1 || !Number.isInteger(durationMinutes) || durationMinutes < 10 || durationMinutes > 480) return Response.json({ error: '제목, 장소와 10~480분 체류시간을 확인해 주세요.' }, { status: 400 });
      if (url && (!/^https:\/\//i.test(url) || url.length > 500)) return Response.json({ error: '링크는 https 주소로 입력해 주세요.' }, { status: 400 });
      if (preferredDate != null && (typeof preferredDate !== 'string' || !/^2026-11-(1[89]|2[0-2])$/.test(preferredDate))) return Response.json({ error: '희망 날짜는 여행 기간 안에서 선택해 주세요.' }, { status: 400 });
      const suggestions = suggestIdeaSlots({ placeName: place, durationMinutes, preferredDate: preferredDate as string | undefined, itinerary: days });
      const now = new Date().toISOString();
      const statement = env.DB!.prepare(`INSERT INTO ideas (id,title,url,note,place,duration_minutes,preferred_date,suggestions,created_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,url=excluded.url,note=excluded.note,place=excluded.place,duration_minutes=excluded.duration_minutes,preferred_date=excluded.preferred_date,suggestions=excluded.suggestions,updated_at=excluded.updated_at`)
        .bind(id, title, url, note, place, durationMinutes, preferredDate, JSON.stringify(suggestions), member.userId, now, now);
      if (isUpdate) {
        await env.DB!.batch([
          env.DB!.prepare('DELETE FROM idea_votes WHERE idea_id=?').bind(id),
          statement,
        ]);
      } else {
        await statement.run();
      }
      return Response.json({ id, suggestions });
    }
    if (action === 'ideaVote') {
      const ideaId = cleanText(body.ideaId, 36);
      const response = body.response;
      if (!idPattern.test(ideaId) || (response !== 'yes' && response !== 'no')) return Response.json({ error: '아이디어 찬성 상태를 확인해 주세요.' }, { status: 400 });
      const exists = await env.DB!.prepare('SELECT id FROM ideas WHERE id=?').bind(ideaId).first<{ id: string }>();
      if (!exists) return Response.json({ error: '아이디어를 찾을 수 없습니다.' }, { status: 404 });
      const now = new Date().toISOString();
      const upsertVote = env.DB!.prepare(`INSERT INTO idea_votes (idea_id,slot_id,user_id,response,updated_at) VALUES (?,?,?,?,?)
        ON CONFLICT(idea_id,slot_id,user_id) DO UPDATE SET response=excluded.response,updated_at=excluded.updated_at`)
        .bind(ideaId, IDEA_VOTE_SLOT, member.userId, response, now);
      if (response === 'no') {
        await env.DB!.batch([
          upsertVote,
          env.DB!.prepare('DELETE FROM idea_votes WHERE idea_id=? AND user_id=?').bind(ideaId, SCHEDULE_USER),
        ]);
      } else {
        await upsertVote.run();
      }
      return Response.json({ ok: true });
    }
    if (action === 'schedule') {
      const ideaId = cleanText(body.ideaId, 36);
      const slotId = cleanText(body.slotId, 180);
      const selected = body.selected === true;
      if (!idPattern.test(ideaId) || !slotId) return Response.json({ error: '일정 후보를 확인해 주세요.' }, { status: 400 });
      const idea = await env.DB!.prepare('SELECT created_by, suggestions FROM ideas WHERE id=?').bind(ideaId).first<{ created_by: string; suggestions: string }>();
      if (!idea) return Response.json({ error: '아이디어를 찾을 수 없습니다.' }, { status: 404 });
      const slots = JSON.parse(idea.suggestions || '[]') as Array<{ id: string }>;
      if (!slots.some((slot) => slot.id === slotId)) return Response.json({ error: '현재 제안 목록에 없는 시간대입니다. 새로고침 후 다시 선택해 주세요.' }, { status: 409 });
      if (selected) {
        const approvalRows = await env.DB!.prepare('SELECT user_id, response FROM idea_votes WHERE idea_id=? AND slot_id=?').bind(ideaId, IDEA_VOTE_SLOT).all<{ user_id: string; response: 'yes' | 'no' }>();
        const approvals = (approvalRows.results ?? []).map((vote) => ({ slotId: IDEA_VOTE_SLOT, userId: vote.user_id, response: vote.response }));
        if (!ideaHasTwoApprovals(approvals, idea.created_by)) return Response.json({ error: '두 사람 모두 찬성한 아이디어만 최종 일정으로 선택할 수 있습니다.' }, { status: 409 });
        await env.DB!.batch([
          env.DB!.prepare('DELETE FROM idea_votes WHERE idea_id=? AND user_id=?').bind(ideaId, SCHEDULE_USER),
          env.DB!.prepare(`INSERT INTO idea_votes (idea_id,slot_id,user_id,response,updated_at) VALUES (?,?,?,?,?)
            ON CONFLICT(idea_id,slot_id,user_id) DO UPDATE SET response=excluded.response,updated_at=excluded.updated_at`)
            .bind(ideaId, `${SCHEDULE_SLOT_PREFIX}${slotId}`, SCHEDULE_USER, 'yes', new Date().toISOString()),
        ]);
      } else {
        await env.DB!.prepare('DELETE FROM idea_votes WHERE idea_id=? AND slot_id=? AND user_id=?')
          .bind(ideaId, `${SCHEDULE_SLOT_PREFIX}${slotId}`, SCHEDULE_USER).run();
      }
      return Response.json({ ok: true });
    }
    if (action === 'vote') {
      const ideaId = cleanText(body.ideaId, 36);
      const slotId = cleanText(body.slotId, 180);
      const response = body.response;
      if (!idPattern.test(ideaId) || !slotId || (response !== 'yes' && response !== 'no')) return Response.json({ error: '제안과 응답을 확인해 주세요.' }, { status: 400 });
      const row = await env.DB!.prepare('SELECT suggestions FROM ideas WHERE id=?').bind(ideaId).first<{ suggestions: string }>();
      const slots = row ? JSON.parse(row.suggestions) as Array<{ id: string }> : [];
      if (!slots.some((slot) => slot.id === slotId)) return Response.json({ error: '현재 제안 목록에 없는 시간대입니다. 새로고침 후 다시 선택해 주세요.' }, { status: 409 });
      await env.DB!.prepare(`INSERT INTO idea_votes (idea_id,slot_id,user_id,response,updated_at) VALUES (?,?,?,?,?)
        ON CONFLICT(idea_id,slot_id,user_id) DO UPDATE SET response=excluded.response,updated_at=excluded.updated_at`)
        .bind(ideaId, slotId, member.userId, response, new Date().toISOString()).run();
      return Response.json({ ok: true });
    }
    if (action === 'delete') {
      const ideaId = cleanText(body.ideaId, 36);
      if (!idPattern.test(ideaId)) return Response.json({ error: '항목을 확인해 주세요.' }, { status: 400 });
      await env.DB!.batch([
        env.DB!.prepare('DELETE FROM idea_votes WHERE idea_id=?').bind(ideaId),
        env.DB!.prepare('DELETE FROM ideas WHERE id=?').bind(ideaId),
      ]);
      return Response.json({ ok: true });
    }
    return Response.json({ error: '지원하지 않는 작업입니다.' }, { status: 400 });
  } catch {
    return Response.json({ error: '저장에 실패했습니다. 연결을 확인하고 다시 시도해 주세요.' }, { status: 503 });
  }
}
