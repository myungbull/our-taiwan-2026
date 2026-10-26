# 개발 및 배포

## 로컬 개발

필요 환경: Node.js `>=22.13.0`, npm, Git.

```sh
npm run install:ci
```

PowerShell:

```powershell
Copy-Item .dev.vars.example .dev.vars
npm run dev
```

macOS/Linux:

```sh
cp .dev.vars.example .dev.vars
npm run dev
```

로컬 프리뷰는 예제의 가짜 사용자 `seedy@sites.test`로 동작합니다. 브라우저에서 `http://localhost:5173/signin-with-chatgpt?return_to=/`를 열어 로컬 로그인하세요. 로컬 mock 인증은 개발 전용이며 운영 접근 검증을 대체하지 않습니다. `.dev.vars`는 `.gitignore` 대상입니다.

```sh
npm run typecheck
npm run test:state
npm run build
npm run start
```

`npm run start`는 빌드된 Worker를 로컬로 프리뷰할 뿐 배포하지 않습니다. `npm run lint`는 현재 기준 20개 오류와 8개 경고로 실패합니다. 우선순위와 알려진 범위는 [OPEN_ITEMS.md](OPEN_ITEMS.md)에 기록되어 있습니다.

## 기존 Sites 운영 사이트에 배포

GitHub 저장소는 소스 전달용입니다. push만으로 배포되지 않습니다. 현재 사이트는 Sites가 Worker 실행, ChatGPT 로그인 식별, D1/R2 연결, 접근 제어를 제공하는 구성입니다.

1. 배포자는 기존 Sites 프로젝트에 접근할 수 있어야 합니다. `.openai/hosting.json`의 `project_id`를 다른 값으로 바꾸지 마세요.
2. 사이트의 현재 소유자와 접근 모드를 확인합니다. 현재 사용 중인 `custom` 2인 허용 목록을 유지하고 새 공개 모드로 변경하지 않습니다.
3. `DB`/`BUCKET` 바인딩과 실제 운영 `ALLOWED_EMAILS` 비밀을 보존합니다. 저장소 안의 예제 주소는 운영에 사용하지 않습니다.
4. 비밀 `ACCUWEATHER_API_KEY`가 필요해지는 날짜는 `2026-11-08`(Asia/Taipei)입니다. 키가 없으면 안전한 비밀 설정 경로로 소유자에게 요청하고, 코드·커밋·로그에 기록하지 않습니다.
5. 정확한 배포 커밋에서 `npm run typecheck`, `npm run test:state`, `npm run build`를 통과시킵니다.
6. Codex/ChatGPT에서 Sites 커넥터를 사용할 경우, 기존 사이트용 Sites source workflow로 해당 커밋을 사이트의 관리 소스 브랜치에 동기화하고 빌드 아카이브를 만든 다음, 저장한 버전을 배포합니다. Sites 도구와 사용 가능한 `sites` skill의 현재 절차를 따르세요. 일반 GitHub push를 사이트 배포로 간주하지 않습니다.
7. 배포 후 상태가 성공인지 확인하고 버전·커밋·URL을 기록합니다. 익명 접근은 거부되고 두 허용 계정은 공동 기능을 사용할 수 있는지 확인하되, 접근 정책이나 실제 여행 데이터를 테스트 목적으로 변경하지 않습니다.

운영 DB 마이그레이션은 `drizzle/` 순서대로 관리합니다. 이미 적용된 운영 마이그레이션을 Wrangler로 다시 실행하지 마세요. 새 마이그레이션은 검토하고, Sites의 운영 배포 흐름을 통해 적용하세요.

## 다른 플랫폼에 독립 배포

GitHub Pages 같은 정적 호스팅으로는 이 앱을 배포할 수 없습니다. 앱에는 서버 API, D1, 비공개 R2, Cloudflare Worker, Sites가 주입하는 신뢰 가능한 ChatGPT 사용자 식별 정보가 필요합니다. `.openai/hosting.json`과 로컬 mock sign-in만으로 운영 인증이 만들어지지 않습니다.

별도 Cloudflare 계정/Worker로 옮기려면 인증을 대체할 안전한 로그인·2인 허용 목록 체계, D1/R2 자원과 바인딩, 비밀 저장, 데이터 이전·마이그레이션·사진 접근 검증을 별도 설계해야 합니다. 이 작업은 현재 운영 사이트에 배포하는 것과 다른 마이그레이션입니다.
