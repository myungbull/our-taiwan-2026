# 개발 인수인계

Last updated: 2026-10-27 (Asia/Seoul)

## 현재 상태

- 공개 소스 저장소: <https://github.com/myungbull/our-taiwan-2026>
- 앱 기능 기준 커밋: `98e48cdb429710b871628047d80a1ec24f0717e4` (이후 `main`에 인수인계 문서와 CI가 추가됐습니다. 개발은 항상 최신 `main`에서 시작하세요.)
- 기존 운영 사이트: Our Taiwan 2026, **비공개 2인 접근 정책 유지**
- 현재 운영 버전: v18, 기준 커밋 `c95e50858be0e5fb231872b57aea038968ec1a0b`
- 소스와 운영 상태는 일치하지 않습니다. 시작 기준 커밋의 ChatGPT 공유 대체 안내는 아직 운영 사이트에 배포되지 않았습니다.
- GitHub에 push해도 사이트는 자동 배포되지 않습니다.
- 2026-10-27 Claude Code 세션: 날씨 서비스 자동 테스트(`npm run test:weather`)와 CI 단계를 추가했습니다. Sites 커넥터·프로젝트 권한이 없어 운영 상태 확인과 배포는 하지 못했습니다. 위 운영 버전·접근 정책은 재확인되지 않은 이전 기록입니다. 상세는 [OPEN_ITEMS.md](OPEN_ITEMS.md)를 보세요.

## 앱 구조

- `app/`: 모바일 여행 대시보드, 일정, 아이디어 투표/대기목록, 사진 기록, 준비·예산, 날씨 화면과 API 라우트
- `worker/index.ts`: Vinext 요청을 Cloudflare Worker로 전달
- `db/`, `drizzle/`: D1 스키마와 순서가 있는 SQL 마이그레이션
- `app/api/photos/`: 사진·영상 메타데이터는 D1, 바이트는 비공개 R2에 저장
- `app/api/_lib/auth.ts`: Sites가 전달하는 로그인 사용자를 검사하고 `ALLOWED_EMAILS`에 있는 두 계정만 공동 API에 허용
- `app/api/weather/`: Open-Meteo 캐시와 AccuWeather 전환/캐시 처리
- `.openai/hosting.json`: 기존 Sites 프로젝트 ID와 `DB`, `BUCKET` 바인딩 이름
- `scripts/`, `vite.config.ts`: Sites/Vinext 개발, Worker 프리뷰, 빌드 도구. 플랫폼 통합을 제거하지 마세요.

## 안전 경계

- 공개 저장소에는 실제 여행 날짜·일정, 항공편 번호/시간, 운임이 들어 있습니다. 예약번호, 카드번호, 허용 이메일, 업로드된 개인 사진은 소스에 넣지 않습니다.
- `ALLOWED_EMAILS`와 `ACCUWEATHER_API_KEY`는 런타임 비밀로만 설정합니다. 실제 값을 `.dev.vars`, GitHub Actions, 문서, 로그에 커밋하지 마세요.
- 기존 사이트의 D1/R2 데이터와 비공개 사진을 초기화하거나 공개 링크로 바꾸지 마세요.
- `ALLOWED_EMAILS`는 실제 사용자 두 명으로 구성돼야 합니다. 로컬 예제 이메일을 운영 설정으로 복사하지 마세요.
- 일정과 이동시간은 여행 데이터입니다. 실제 도로 안내나 예약 확정 정보로 표현하지 마세요.

## 배포 권한과 사전조건

기존 운영 사이트에 배포하려면 개발자 계정에 현재 Sites 프로젝트 편집 권한과 Sites 배포 기능이 필요합니다. `.openai/hosting.json`의 `project_id`를 그대로 사용하고, 현재 접근 정책이 두 사용자만 허용하는 `custom` 상태인지 먼저 확인합니다. `DB`와 `BUCKET` 바인딩, 비밀 `ALLOWED_EMAILS`를 유지해야 합니다.

`ACCUWEATHER_API_KEY`는 현재 운영 환경에서 미설정으로 기록돼 있습니다. 소유자가 안전한 비밀 설정 경로로 제공하기 전에는 키를 만들거나 추측하지 말고, AccuWeather 실시간 연동이 확인됐다고 보고하지 마세요.

세부 단계와 독립 호스팅 제약은 [DEPLOYMENT.md](DEPLOYMENT.md)를, 미해결 항목과 완료 기준은 [OPEN_ITEMS.md](OPEN_ITEMS.md)를 참고하세요. 다음 개발자에게 전달할 프롬프트는 [NEXT_DEVELOPER_PROMPT.md](NEXT_DEVELOPER_PROMPT.md)에 있습니다.
