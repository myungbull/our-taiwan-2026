export const days = [
  {
    date: '2026-11-18', title: '타이베이와 첫인사', subtitle: '공항 · 오래된 거리 · 야시장',
    stops: [
      { time: '08:00 → 09:45', name: '인천 → 타오위안', description: '이스타항공 ZE881 · 인천 T1 출발, 타오위안 T1 도착. 각 공항 현지시간. 위탁수하물 15kg/인 · 2인 예약 완료.', transport: '항공', duration: '2시간 45분', query: 'Taiwan Taoyuan International Airport Terminal 1' },
      { time: '11:30 예상', name: '타이베이 호텔에 짐 맡기기', description: '입국·공항철도 이동을 고려한 예상 시각. 호텔은 예약 전이며 짐 보관 가능 여부 확인 필요.', transport: '공항 MRT + 도보', duration: '공항 출발 후 약 60~90분 추정', query: 'Taipei Main Station' },
      { time: '14:00 예상', name: '디화제', description: '차와 건어물 상점, 오래된 건축이 이어지는 거리 산책. 방문 시각과 체류시간은 제안 일정.', transport: '도보 / 버스', duration: '약 1시간 30분 추정', query: 'Dihua Street Taipei' },
      { time: '16:00 예상', name: '다다오청', description: '강변을 따라 여유롭게 걷기. 날씨와 컨디션에 맞춰 조정하는 예상 일정.', transport: '도보', duration: '디화제에서 약 10~20분 추정', query: 'Dadaocheng Wharf Taipei' },
      { time: '18:00 예상', name: '닝샤 야시장', description: '작은 접시를 나눠 먹으며 첫날 저녁. 방문 시각은 예상이며 개별 점포 영업은 현장 확인.', transport: '도보', duration: '강변에서 약 20~30분 추정', query: 'Ningxia Night Market Taipei' },
    ],
  },
  {
    date: '2026-11-19', title: '바다에서 야경까지', subtitle: '클룩 예스지 투어 · 예약 전',
    stops: [
      { time: '집결시간 확인', name: '예스지 투어 집결', description: '클룩 상품의 실제 집결 장소·시각, 포함 사항과 귀환 시간을 예약 전 확인. 아래 시각은 사용자 확정 계획이며 운영사 확약 여부는 별도 확인.', transport: '투어 버스', duration: '상품별 상이', query: 'Taipei Main Station' },
      { time: '15:00', name: '예류', description: '바다와 기암이 만드는 해안 풍경. 투어 운영사 일정과 입장권 포함 여부 확인 필요.', transport: '투어 버스', duration: '체류시간 운영사 확인', query: 'Yehliu Geopark' },
      { time: '17:00–18:00', name: '스펀 천등', description: '철길 마을에서 두 사람의 소원을 적는 시간. 천등 비용과 체험 포함 여부 확인.', transport: '투어 버스', duration: '계획 체류 1시간', query: 'Shifen Old Street' },
      { time: '18:50–20:30', name: '지우펀 야경', description: '홍등이 켜지는 골목과 찻집 풍경. 계단이 많아 편한 신발 준비, 투어 복귀 장소 확인.', transport: '투어 버스 + 도보', duration: '계획 체류 1시간 40분', query: 'Jiufen Old Street' },
    ],
  },
  {
    date: '2026-11-20', title: '도시의 표정을 걷다', subtitle: '오래된 사원에서 101의 노을까지',
    stops: [
      { time: '09:00 예상', name: '용산사', description: '타이베이의 오래된 사원에서 시작하는 아침. 방문 시각은 예상이며 참배객을 배려해 관람.', transport: 'MRT + 도보', duration: '관람 약 45분 추정', query: 'Lungshan Temple Taipei' },
      { time: '10:00 예상', name: '보피랴오', description: '붉은 벽돌과 옛 골목 풍경을 천천히 걷기. 예상 일정이며 전시 공간 운영 여부는 별도 확인.', transport: '도보', duration: '용산사에서 약 5~10분 추정', query: 'Bopiliao Historical Block' },
      { time: '11:30 예상', name: '중정기념당', description: '넓은 광장과 기념당을 둘러보기. 방문 시각과 관람시간은 예상.', transport: 'MRT + 도보', duration: '이동 약 25~40분 추정', query: 'Chiang Kai-shek Memorial Hall' },
      { time: '14:00 예상', name: '사사남촌', description: '낮은 옛 주택과 타이베이 101이 함께 보이는 풍경. 점심 이후 방문하는 예상 일정.', transport: 'MRT + 도보', duration: '이동 약 30~45분 추정', query: 'Four Four South Village Taipei' },
      { time: '15:30–18:00', name: '타이베이 101 전망대', description: '낮에서 노을, 야경으로 바뀌는 도시 감상. 티켓 예약 전 · 날씨에 따라 조망이 달라질 수 있음.', transport: '도보', duration: '계획 관람 2시간 30분', query: 'Taipei 101 Observatory' },
    ],
  },
  {
    date: '2026-11-21', title: '도시를 떠나 온천으로', subtitle: '타이베이 체크아웃 · 우라이 1박',
    stops: [
      { time: '10:00 예상', name: '타이베이 호텔 체크아웃', description: '3박 후 우라이로 이동. 체크아웃 시각은 예상이며 최종 호텔 규정 확인 필요.', transport: 'MRT + 버스 / 택시', duration: '우라이까지 약 1시간 30분~2시간 30분 추정', query: 'Wulai Old Street' },
      { time: '13:00 예상', name: '우라이 옛 거리', description: '산과 강 사이 온천 마을에서 점심과 산책. 시각은 교통 상황에 따라 조정하는 예상 일정.', transport: '도보', duration: '약 1시간~1시간 30분 추정', query: 'Wulai Old Street' },
      { time: '15:00 예상', name: '우라이 폭포', description: '폭포와 산 풍경 감상. 방문 시각은 예상이며 산책로·교통수단 운영 상태 확인 필요.', transport: '도보 / 현지 교통', duration: '옛 거리에서 약 30~50분 추정', query: 'Wulai Falls' },
      { time: '17:00', name: 'Spring Spa Hotel 체크인 계획', description: '디럭스 온천 더블룸 우선 검토 · 예약 전. 체크인 17시 기준은 사용자 제공이며 예약 조건 재확인. 객실 내 온천 사용 가능 여부 필수 확인.', transport: '택시 / 현지 교통', duration: '출발지에 따라 약 15~30분 추정', query: 'Spring Spa Hotel Wulai' },
    ],
  },
  {
    date: '2026-11-22', title: '따뜻한 아침, 집으로', subtitle: '온천 조식 · 공항 이동 · 인천 귀국',
    stops: [
      { time: '09:00 예상', name: '온천과 조식', description: '여행의 마지막 아침을 여유롭게. 이용 시각은 예상이며 조식 포함 여부·운영시간·온천 이용 규정 확인 필요.', transport: '호텔 내', duration: '여유롭게', query: 'Spring Spa Hotel Wulai' },
      { time: '12:00', name: '우라이 호텔 체크아웃', description: '체크아웃 12시 기준은 사용자 제공이며 예약 조건 재확인. 공항 이동 예약과 짐 준비를 전날 마무리.', transport: '예약 차량 권장 / 대중교통', duration: '공항까지 약 2~3시간 추정', query: 'Taiwan Taoyuan International Airport Terminal 1' },
      { time: '15:10 목표', name: '타오위안공항 T1 도착', description: '18:10 출발 3시간 전 도착 목표. 주말 교통과 환승 대기를 고려해 출발 시간을 앞당길 수 있음. 차량·경로 확정 필요.', transport: '차량 / MRT 환승', duration: '출발 전 여유 3시간', query: 'Taiwan Taoyuan International Airport Terminal 1' },
      { time: '18:10 → 21:40', name: '타오위안 → 인천', description: '스쿠트 TR872 · 타오위안 T1 출발, 인천 T1 도착. 각 공항 현지시간. 기내 10kg · 위탁 20kg/인 · 2인 예약 완료.', transport: '항공', duration: '2시간 30분', query: 'Incheon International Airport Terminal 1' },
    ],
  },
];

export const initialBudget = [
  { id: 'flight-out', label: '출국 항공 · 2인', planned: 540000, actual: 540000, estimated: false, paid: true },
  { id: 'flight-back', label: '귀국 항공 · USD 495.95 임시 환산', planned: 656517, actual: 656517, estimated: true, paid: true },
  { id: 'taipei-hotel', label: '타이베이 호텔 · 3박', planned: 330000, actual: null, estimated: true, paid: false },
  { id: 'wulai-hotel', label: '우라이 온천 호텔 · 1박', planned: 230000, actual: null, estimated: true, paid: false },
  { id: 'tour', label: '예스지 투어 · 2인', planned: 100000, actual: null, estimated: true, paid: false },
  { id: 'food', label: '식비 · 2인', planned: 260000, actual: null, estimated: true, paid: false },
  { id: 'observatory', label: '101 전망대 · 2인', planned: 70000, actual: null, estimated: true, paid: false },
  { id: 'transport', label: '현지 교통 · 공항 이동', planned: 180000, actual: null, estimated: true, paid: false },
  { id: 'insurance', label: '여행자보험 · 2인', planned: 40000, actual: null, estimated: true, paid: false },
  { id: 'buffer', label: '예비비', planned: 93483, actual: null, estimated: true, paid: false },
];

export const checklist = [
  { id: 'flight-out', label: '출국 항공권 · ZE881 예약 및 결제', done: true },
  { id: 'flight-back', label: '귀국 항공권 · TR872 예약 및 결제', done: true },
  { id: 'flight-bill', label: '귀국 항공권 원화 최종 청구액 반영', done: false },
  { id: 'taipei-hotel', label: '타이베이 같은 호텔 3박 예약', done: false },
  { id: 'wulai-hotel', label: '우라이 온천 호텔 1박 예약', done: false },
  { id: 'room-spa', label: '디럭스 더블룸 객실 온천 이용 조건 확인', done: false },
  { id: 'tour', label: '클룩 예스지 투어 예약 · 집결 장소 확인', done: false },
  { id: 'observatory', label: '101 전망대 11/20 15:30 입장 예약', done: false },
  { id: 'airport-transfer', label: '11/22 우라이 → 공항 이동 확정', done: false },
  { id: 'insurance', label: '여행자보험 2인 가입', done: false },
  { id: 'mobile', label: 'eSIM / 로밍 준비', done: false },
  { id: 'passport', label: '여권 · 입국 준비사항 확인', done: false },
];
