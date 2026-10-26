# Our Taiwan 2026

한국어 모바일 우선 커플 여행 플래너·공유 기록 앱입니다. 2026년 11월 대만 여행을 위한 일정, 아이디어 투표, 날짜별 사진·영상, 예산·준비 체크리스트, 날씨 정보를 제공합니다.

> **공개 저장소 안내:** 코드에는 실제 여행 날짜와 일정, 항공편 번호·시간, 운임이 포함되어 있습니다. 공개 링크를 공유하기 전에 이 정보가 공개된다는 점을 확인하세요. 허용 이메일, 예약번호, 카드번호, 업로드된 개인 사진, 운영 API 키는 저장소에 두지 않습니다.

## 빠른 시작

필요 환경: Node.js `>=22.13.0`, npm, Git.

```sh
npm run install:ci
cp .dev.vars.example .dev.vars
npm run dev
```

PowerShell에서는 `cp` 대신 `Copy-Item .dev.vars.example .dev.vars`를 사용하세요. 개발 서버가 뜨면 로컬에서 `http://localhost:5173/signin-with-chatgpt?return_to=/`를 열어 mock 계정 `seedy@sites.test`로 로그인합니다. 이 계정은 개발용이며 운영 접근 권한과 무관합니다.

`.dev.vars`의 이메일은 가짜 로컬 테스트 주소입니다. 실제 허용 계정이나 API 키를 `.dev.vars.example`이나 Git에 기록하지 마세요.

## 확인 명령

```sh
npm run typecheck
npm run test:state
npm run test:weather
npm run build
npm run start
```

`npm run start`는 빌드된 Worker를 로컬에서 프리뷰합니다. **배포하지 않습니다.** `npm run lint`는 현재 기존 오류 20개와 경고 8개로 실패하며, 상세 내용은 [미해결 항목](docs/OPEN_ITEMS.md)에 있습니다. GitHub Actions는 타입 검사, 아이디어 상태 테스트, 날씨 서비스 테스트, 빌드를 확인하고 운영 비밀 없이 실행됩니다.

## 구조와 데이터

- `app/`: 화면과 API. 주요 경로는 `/`, `/itinerary`, `/ideas`, `/memories`, `/prepare`, `/weather`입니다.
- `app/api/`: 공유 상태, 아이디어 투표, 사진·영상, 날씨 API.
- `worker/index.ts`: Vinext 요청을 Cloudflare Worker로 전달합니다.
- `db/`, `drizzle/`: D1 스키마와 순서 있는 데이터베이스 마이그레이션.
- `public/`: 사이트 장식·관광지 이미지.
- `docs/`: 개발 인수인계, 미해결 항목, 배포 방법, 다음 개발자용 시작 프롬프트.

공동 기능은 OpenAI Sites가 전달하는 로그인 사용자 정보와 서버 비밀 `ALLOWED_EMAILS`를 사용합니다. 두 계정만 허용하는 검사는 서버 API에 적용됩니다. D1에는 여행 상태와 사진 메타데이터가 저장되고, 사진·영상 바이트는 비공개 R2에 저장됩니다. 운영 바인딩은 `.openai/hosting.json`의 `DB`와 `BUCKET`입니다.

## 운영 배포

이 GitHub 저장소는 공개 소스 저장소이며 push만으로 사이트가 배포되지는 않습니다. 기존 사이트는 ChatGPT 로그인 식별, D1, 비공개 R2, 접근 제어를 제공하는 Sites 플랫폼에서 운영됩니다. GitHub Pages 같은 정적 호스팅은 이 앱의 공동 기능을 제공하지 않습니다.

기존 비공개 사이트에 배포하려면 Sites 프로젝트 권한과 Sites 커넥터가 필요합니다. 기존 `custom` 2인 접근 정책과 데이터 바인딩을 보존한 뒤 Sites 전용 source/build/deploy 흐름을 사용하세요. 별도 호스팅으로 옮기려면 인증과 저장소를 이전하는 별도 작업이 필요합니다.

자세한 안내: [개발 인수인계](docs/DEVELOPER_HANDOFF.md) · [배포 방법](docs/DEPLOYMENT.md) · [미해결 항목](docs/OPEN_ITEMS.md) · [다음 개발자 시작 프롬프트](docs/NEXT_DEVELOPER_PROMPT.md)
