# 독립 Cloudflare 배포 (스테이징)

Last updated: 2026-10-27 (Asia/Seoul)

OpenAI Sites 운영 사이트와 **별개로**, 본인 Cloudflare 계정에 같은 앱을 띄우는 방법입니다. 새 D1/R2를 쓰므로 **빈 상태로 시작**하며 Sites의 투표·예산·사진은 옮겨지지 않습니다. Sites 운영 배포 절차는 [DEPLOYMENT.md](DEPLOYMENT.md)를 보세요.

## 인증 구조

- Cloudflare Access(Zero Trust)가 Worker 앞에서 허용 이메일 두 개만 일회용 코드(One-time PIN)로 로그인시킵니다.
- Worker(`worker/cloudflare-access.ts`)는 `AUTH_PROVIDER=cloudflare-access`일 때 모든 요청의 `Cf-Access-Jwt-Assertion` JWT를 팀 공개키로 직접 검증합니다. 서명·`aud`·`iss`·만료가 맞지 않으면 401, 설정이 없으면 503으로 **닫힌 상태로 실패**합니다. Access 정책이 빠지거나 우회돼도 앱이 열리지 않습니다.
- 클라이언트가 보낸 `oai-authenticated-user-*` 헤더는 삭제하고, 검증된 JWT의 `sub`/`email`로 다시 채웁니다. 그 뒤에는 기존 `ALLOWED_EMAILS` 검사(`app/api/_lib/auth.ts`)가 그대로 적용됩니다.
- Sites 빌드는 `AUTH_PROVIDER`를 설정하지 않으므로 동작이 바뀌지 않습니다.
- 정적 클라이언트 자산(JS/CSS/이미지)은 Worker보다 먼저 제공됩니다. 이 자산은 공개 저장소의 내용과 같으며, workers.dev 전체에 Access를 적용하면 Access가 함께 가립니다.

## 1회 준비 (계정 소유자가 직접)

1. Cloudflare 계정을 만들고 Workers의 `workers.dev` 서브도메인을 정합니다.
2. 로컬에서 `npx wrangler login`을 실행하고 브라우저에서 승인합니다.
3. D1 생성: `npx wrangler d1 create our-taiwan-2026` → 출력된 `database_id`를 기록합니다.
4. R2 활성화(대시보드 R2 화면, 결제수단 등록이 요구될 수 있음. 무료 한도 내 사용) 후 `npx wrangler r2 bucket create our-taiwan-2026-media`.
5. Zero Trust 대시보드에서 팀 이름을 정합니다(Free 플랜). Access → Applications → **Self-hosted** 앱을 만들고 도메인에 `our-taiwan-2026-standalone.<서브도메인>.workers.dev`를 넣습니다. 정책은 Allow, Include → Emails에 두 사람의 이메일만 넣고 로그인 방법은 One-time PIN을 씁니다. 앱의 **Application Audience (AUD) Tag**를 복사합니다.
6. `.standalone.example.json`을 `.standalone.json`으로 복사해 채웁니다(Git 제외 파일). `accessTeamDomain`은 `<팀>.cloudflareaccess.com`입니다.

## 배포

```sh
npm run typecheck
npm run test:access
npm run build
npm run standalone:deploy
```

`standalone:deploy`는 `dist/server/wrangler.json`을 독립 설정(Worker 이름, D1/R2, Access 변수, `preview_urls: false`)으로 바꾼 `dist/server/wrangler.standalone.json`을 만든 뒤, `drizzle/` 마이그레이션을 원격 D1에 적용하고 배포합니다. 계정 없이 설정만 확인하려면 `node scripts/standalone-deploy.mjs --dry-run`을 씁니다.

첫 배포 뒤 비밀을 등록합니다. 값은 프롬프트에 직접 입력하고 파일·커밋·로그에 남기지 않습니다.

```sh
npx wrangler secret put ALLOWED_EMAILS --config dist/server/wrangler.standalone.json
```

선택: AccuWeather를 쓰려면 같은 방식으로 `ACCUWEATHER_API_KEY`를 등록합니다.

## 배포 후 확인

- 브라우저 시크릿 창에서 workers.dev 주소 → Access 로그인 화면이 나와야 합니다.
- `curl -i https://<주소>/api/state` → 302(Access 로그인) 또는 401이어야 합니다. `oai-authenticated-user-email` 헤더를 위조해도 401이어야 합니다.
- 허용된 두 이메일로 각각 로그인해 아이디어·예산·체크리스트가 서로 보이는지 확인합니다.

## 로컬 확인 기록 (2026-10-27)

- `--dry-run` 패키징 성공: 바인딩 `DB`, `BUCKET`, `AUTH_PROVIDER`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`.
- 독립 설정으로 `wrangler dev --local`을 띄워 확인: 익명 `/` 401, 익명 `/api/state` 401, 위조한 `oai-*` 헤더 401, 가짜 JWT 401.
- 기본(Sites) 설정은 그대로: `/` 200, 익명 `/api/state`는 앱의 401 응답.
- 실제 Cloudflare 계정·Access 로그인·두 계정 동기화는 아직 확인하지 않았습니다.
