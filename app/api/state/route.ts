import { env } from 'cloudflare:workers';
import { requireAllowedMember, isResponse, sameOrigin } from '../_lib/auth';
export const dynamic = 'force-dynamic';
export async function GET() {
 const member=await requireAllowedMember(); if(isResponse(member))return member;
 try { const rows = await env.DB!.prepare('SELECT key, value, revision FROM records').all(); return Response.json(rows.results, {headers:{'Cache-Control':'private, no-store'}}); }
 catch { return Response.json({error:'공유 저장소에 연결하지 못했습니다.'},{status:503,headers:{'Cache-Control':'private, no-store'}}); }
}
export async function PUT(request: Request) {
 const member=await requireAllowedMember(); if(isResponse(member))return member;
 if(!sameOrigin(request)) return new Response(null,{status:403});
 try {
 const {key,value,revision}=await request.json() as {key:string;value:any;revision:number};
 if(typeof key!=='string'||!/^(budget|check|total):[a-z0-9_-]+$/.test(key)||JSON.stringify(value).length>1500||!Number.isInteger(revision)) return new Response(null,{status:400});
 if(key.startsWith('budget:') && (!Number.isFinite(value.planned)||value.planned<0||value.planned>100000000||(value.actual!==null&&(!Number.isFinite(value.actual)||value.actual<0||value.actual>100000000))||typeof value.paid!=='boolean'||typeof value.estimated!=='boolean')) return new Response(null,{status:400});
 if(key.startsWith('check:')&&typeof value!=='boolean')return new Response(null,{status:400});
 if(key.startsWith('total:')&&(!Number.isFinite(value)||value<=0||value>100000000))return new Response(null,{status:400});
 const result=revision===0?await env.DB!.prepare('INSERT OR IGNORE INTO records(key,value,revision) VALUES(?,?,1)').bind(key,JSON.stringify(value)).run():await env.DB!.prepare('UPDATE records SET value=?,revision=revision+1 WHERE key=? AND revision=?').bind(JSON.stringify(value),key,revision).run();
 if(!result.meta.changes)return Response.json({error:'다른 기기에서 수정했습니다. 최신 값을 확인하고 다시 저장해 주세요.'},{status:409});
 return Response.json({revision:revision+1});
 } catch {return Response.json({error:'저장 실패. 연결 상태를 확인하고 다시 시도해 주세요.'},{status:503});}
}

