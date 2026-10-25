import { env } from 'cloudflare:workers';
import { getChatGPTUser, type ChatGPTUser } from '../../chatgpt-auth';

export type AllowedMember = ChatGPTUser & { memberIndex: number };

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function requireAllowedMember(): Promise<AllowedMember | Response> {
  const user = await getChatGPTUser();
  if (!user) return errorResponse('사이트 계정으로 로그인해 주세요.', 401);

  const emails = (env.ALLOWED_EMAILS ?? '')
    .split(/[\n,;]+/)
    .map((email) => email.trim().toLocaleLowerCase())
    .filter(Boolean);
  if (emails.length < 2) return errorResponse('공동 공간 허용 목록이 아직 설정되지 않았습니다.', 503);

  const memberIndex = emails.indexOf(user.email.trim().toLocaleLowerCase());
  if (memberIndex < 0) return errorResponse('이 공동 공간에 허용된 계정이 아닙니다.', 403);
  return { ...user, memberIndex };
}

export function isResponse(value: AllowedMember | Response): value is Response {
  return value instanceof Response;
}

export function travelerLabel(memberIndex: number): string {
  return memberIndex === 0 ? '여행자 A' : '여행자 B';
}

export function sameOrigin(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin;
}

export function isTripDate(value: unknown): value is string {
  return typeof value === 'string' && /^2026-11-(1[89]|2[0-2])$/.test(value);
}

