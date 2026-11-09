import type { WeatherRegionId } from './weather-data';

// `hour` (Taipei local, 0-23) and `region` pick the forecast shown next to each stop.
// lat/lng place the map pin; `approx` marks positions estimated from nearby landmarks (±a few hundred metres).
export type TripStop = { time: string; name: string; description: string; transport: string; duration: string; query: string; lat: number; lng: number; approx?: boolean; region: WeatherRegionId; hour: number };
export type TripDay = { date: string; title: string; subtitle: string; stops: TripStop[] };

const HOTEL = '華麗大飯店 台北市萬華區康定路41號';
const HOMESTAY = '龍門精緻溫泉民宿 新北市烏來區溫泉街116號';
const TRIO = '馥森阪治 Trio 新北市烏來區環山路151號';

export const days: TripDay[] = [
  {
    date: '2026-11-18', title: '타이베이와 첫인사', subtitle: '공항 · 시먼 호텔 · 디화제 · 야시장',
    stops: [
      { time: '08:00 → 09:45', name: '인천 → 타오위안', description: '이스타항공 ZE881 · 인천 T1 출발, 타오위안 T1 도착. 각 공항 현지시간. 위탁수하물 15kg/인 · 2인 예약 완료.', transport: '항공', duration: '2시간 45분', query: 'Taiwan Taoyuan International Airport Terminal 1', lat: 25.081, lng: 121.237, approx: true, region: 'taoyuan', hour: 9 },
      { time: '입국 후', name: '공항에서 첫 준비', description: 'T1 입국장 안내소에서 지도·책자 챙기기, 이지카드 2장 구매·충전, 이심 개통 확인. 무료 책자 비치 여부는 현장 확인.', transport: '공항 내', duration: '약 30분 추정', query: 'Taiwan Taoyuan International Airport Terminal 1', lat: 25.081, lng: 121.237, approx: true, region: 'taoyuan', hour: 10 },
      { time: '12:00 예상', name: 'Ferrary Hotel에 짐 맡기기', description: '華麗大飯店 · 康定路41號 · 3박 예약 완료(체크인 15:00). 공항 MRT로 메인역 → 반난선(파란선) 시먼역 → 걸어서 약 8분 추정. 체크인 전 짐 보관은 호텔에 확인.', transport: '공항 MRT + MRT + 도보', duration: '공항 출발 후 약 70~90분 추정', query: HOTEL, lat: 25.04154, lng: 121.50247, region: 'taipei', hour: 12 },
      { time: '12:20 예상', name: '시먼에서 점심', description: '호텔 옆 시먼 상권에서 가볍게. 오후 디화제 간식이 많으니 적당히.', transport: '도보', duration: '약 1시간 추정', query: 'Ximending Taipei', lat: 25.04347, lng: 121.50719, region: 'taipei', hour: 12 },
      { time: '14:00 예상', name: '디화제 스티커사진 · SNAPPP', description: 'SNAPPP Lucky Star 포토부스. 회당 NT$200, 10:00~20:00 (후기 기준, 추정). 1층 카레집을 지나 2층이라는 메모가 있어 현장 확인. 시먼역 → 베이먼역 1정거장(초록선) 후 도보.', transport: 'MRT + 도보', duration: '이동 약 20분 · 체류 30분 추정', query: 'SNAPPP 迪化街一段14巷20號', lat: 25.05409, lng: 121.50942, approx: true, region: 'taipei', hour: 14 },
      { time: '14:40 예상', name: '터치망고아이스', description: '悠哉呷冰으로 추정되는 망고빙수 전문점. 10:30~18:00 (추정). 11월은 망고 비시즌이라 전화 확인 필요, 없으면 우유 눈꽃빙수.', transport: '도보', duration: '약 40분 추정', query: '悠哉呷冰 迪化街一段6號', lat: 25.0546, lng: 121.5101, approx: true, region: 'taipei', hour: 15 },
      { time: '15:30 예상', name: '디화제 찻집 · 남가득의', description: '民藝埕 2층의 옛 찻집. 1인 1포트, NT$280부터 (추정). 영업시간은 자료마다 달라 전화 확인 02-2552-1367. 비 오면 다다오청을 빼고 더 머물기.', transport: '도보', duration: '약 1시간 추정', query: '南街得意 迪化街一段67號', lat: 25.0568, lng: 121.51, approx: true, region: 'taipei', hour: 15 },
      { time: '16:40 예상', name: '다다오청', description: '강변을 걷고 일몰 보기. 일몰은 약 17:05 추정. 비 오면 생략.', transport: '도보', duration: '디화제에서 약 10~20분 추정', query: 'Dadaocheng Wharf Taipei', lat: 25.05687, lng: 121.51125, approx: true, region: 'taipei', hour: 17 },
      { time: '18:00 예상', name: '닝샤 야시장', description: '작은 접시를 나눠 먹으며 첫날 저녁. 개별 점포 영업은 현장 확인. 현금 준비.', transport: '도보', duration: '강변에서 약 20~30분 추정', query: 'Ningxia Night Market Taipei', lat: 25.05619, lng: 121.51522, region: 'taipei', hour: 18 },
      { time: '20:00 예상', name: '호텔 체크인 · 편의점 푸딩', description: '닝샤에서 택시로 약 10분(추정) 호텔 복귀 후 체크인. 가는 길 편의점에서 세븐일레븐 統一布丁 계열 푸딩. 패밀리마트는 17시부터 임박 상품 약 30% 할인 자료가 있고 매장별 차이 있음.', transport: '택시', duration: '약 10분 추정', query: HOTEL, lat: 25.04154, lng: 121.50247, region: 'taipei', hour: 20 },
    ],
  },
  {
    date: '2026-11-19', title: '도시의 표정을 걷다', subtitle: '호텔에서 걸어서 용산사 · 101의 노을까지',
    stops: [
      { time: '09:00 예상', name: '용산사', description: '호텔에서 걸어서 약 12분(추정). 오래된 사원에서 시작하는 아침. 참배객을 배려해 관람.', transport: '도보', duration: '관람 약 45분 추정', query: 'Lungshan Temple Taipei', lat: 25.03725, lng: 121.49988, region: 'taipei', hour: 9 },
      { time: '10:00 예상', name: '보피랴오', description: '붉은 벽돌과 옛 골목 풍경. 전시 공간 운영 여부는 별도 확인.', transport: '도보', duration: '용산사에서 약 5~10분 추정', query: 'Bopiliao Historical Block', lat: 25.03685, lng: 121.50227, region: 'taipei', hour: 10 },
      { time: '10:50 예상', name: '시먼 행복당', description: '현장에서 볶는 흑당 버블티. 시먼역 6번 출구 부근, 8:30~00:30 (2026 플랫폼 자료, 옛 자료와 다름). 근처에서 누가크래커도 구매.', transport: '도보', duration: '보피랴오에서 약 15분 · 체류 25분 추정', query: '幸福堂 西門町全球旗艦店', lat: 25.04335, lng: 121.50734, region: 'taipei', hour: 11 },
      { time: '11:40 예상', name: '중정기념당', description: '시먼역 → 중정기념당역 1정거장(초록선). 12:00 위병 교대식 보기. 교대식은 매시 정각 약 10분, 본당 앞 광장, 궂은 날은 취소 (가이드 자료).', transport: 'MRT + 도보', duration: '이동 약 15분 추정', query: 'Chiang Kai-shek Memorial Hall', lat: 25.03458, lng: 121.52178, region: 'taipei', hour: 12 },
      { time: '14:00 예상', name: '사사남촌', description: '낮은 옛 주택과 타이베이 101이 함께 보이는 풍경. 점심 후 빨간선으로 이동.', transport: 'MRT + 도보', duration: '이동 약 30~40분 추정', query: 'Four Four South Village Taipei', lat: 25.03147, lng: 121.56196, region: 'taipei', hour: 14 },
      { time: '16:00 입장', name: '타이베이 101 전망대', description: '예약 완료. 89층 + 101층 전망대 2인, 11/19 16:00. 입장할 때 예약 바우처 QR을 보여 주세요(1인 1장씩 따로 사용 가능). 일몰 약 17:04라 낮에서 노을, 야경까지 볼 수 있어요.', transport: '도보', duration: '관람 약 2시간 추정', query: 'Taipei 101 Observatory', lat: 25.03384, lng: 121.5645, region: 'taipei', hour: 16 },
      { time: '18:20 예상', name: '101 근처 저녁', description: '딘타이펑 101점이 후보. 대기가 길 수 있어 전망대 입장 전에 대기 상황 확인. 목요일 영업시간은 지점에 재확인.', transport: '도보', duration: '약 1시간 15분 추정', query: '鼎泰豐 台北101店', lat: 25.0336, lng: 121.5651, approx: true, region: 'taipei', hour: 18 },
      { time: '20:00 예상', name: '혜안공원 101 야경', description: '惠安公園. 吳興街 320巷 또는 336巷에서 계단으로 5~10분. 조명 상태는 미확인이라 휴대폰 불빛 준비, 주택가이니 조용히. 비 오면 생략.', transport: '택시 권장', duration: '이동 약 10~15분 · 체류 약 40분 추정', query: '惠安公園 台北市信義區', lat: 25.02463, lng: 121.56477, region: 'taipei', hour: 20 },
      { time: '21:00 예상', name: '호텔로 복귀', description: '혜안공원에서 택시로 약 20~25분(추정). MRT는 샹산역 빨간선 → 중정기념당역 환승 → 시먼역.', transport: '택시 / MRT', duration: '약 20~35분 추정', query: HOTEL, lat: 25.04154, lng: 121.50247, region: 'taipei', hour: 21 },
    ],
  },
  {
    date: '2026-11-20', title: '바다에서 야경까지', subtitle: '오전 자유 · 예스지 투어 · 해열루 19:00 · 예약 완료',
    stops: [
      { time: '오전', name: '호텔 근처 자유시간', description: '늦잠이나 시먼·완화 산책. 투어가 21시 넘어 끝나니 체력 아끼기. 점심은 집결 전에 해결.', transport: '도보', duration: '12:40까지', query: 'Ximending Taipei', lat: 25.04347, lng: 121.50719, region: 'taipei', hour: 10 },
      { time: '12:50 집결', name: '예스지 투어 · 시먼역 5번 출구', description: '예약 완료. 호텔에서 걸어서 약 8분이라 시먼역 집결(12:50, 13:00 출발)을 권장. 메인역 M3 지하 1층(13:20, 13:30 출발)도 가능하니 예약 내역의 집결지를 따르기. 가이드에게 한글 이름 말하기. 11/17부터 취소·변경 불가.', transport: '투어 버스', duration: '복귀 21:10~ · 교통 상황에 따라 변동', query: 'Ximen Station Exit 5 Taipei', lat: 25.0416, lng: 121.50842, approx: true, region: 'taipei', hour: 13 },
      { time: '14:30–15:40', name: '예류', description: '바다와 기암이 만드는 해안 풍경. 입장료 NT$120 별도.', transport: '투어 버스', duration: '체류 1시간 10분', query: 'Yehliu Geopark', lat: 25.21135, lng: 121.69638, region: 'yehliu', hour: 15 },
      { time: '16:30', name: '스펀 리우거 닭날개볶음밥', description: '스펀 도착하면 먼저 들르기. 溜哥 닭날개 NT$65~75, 10:00~18:00, 현금만 받는다는 자료 있음 (추정).', transport: '투어 버스 + 도보', duration: '약 15분 추정', query: '溜哥燒烤雞翅包飯 十分', lat: 25.0428, lng: 121.7762, approx: true, region: 'shifen', hour: 16 },
      { time: '16:45–17:20', name: '스펀 천등', description: '일몰(약 17:05) 무렵 철길 마을에서 두 사람의 소원을 적는 시간. 천등 NT$200부터.', transport: '도보', duration: '스펀 전체 체류 50분', query: 'Shifen Old Street', lat: 25.04261, lng: 121.77662, region: 'shifen', hour: 17 },
      { time: '18:10 도착 후', name: '지우펀 옛거리 산책', description: '홍등 야경 위주. 아간이 토란경단 등 간식. 평일은 상점이 19~20시쯤 닫기 시작한다는 자료가 있어 먹고 살 것부터. 18:50쯤 찻집으로. 계단이 많고 산이라 겉옷 챙기기.', transport: '투어 버스 + 도보', duration: '약 40분 추정', query: '阿柑姨芋圓 九份', lat: 25.10778, lng: 121.84362, region: 'jiufen', hour: 18 },
      { time: '19:00 예약', name: '해열루 찻집', description: '海悅樓 · 豎崎路31號. KKday 예약 완료(2명, 26KK228714347). 5~10분 전 도착, 20분 이상 일찍 오지 말 것, 10분 넘게 늦으면 취소·환불 불가. 바우처 제시. 합석 가능. 차와 면선으로 저녁 해결 가능. 약 19:50에 나와 20:10 버스로.', transport: '도보', duration: '약 50분 추정', query: '海悅樓景觀茶坊 九份', lat: 25.10842, lng: 121.84337, region: 'jiufen', hour: 19 },
      { time: '21:10~ 하차', name: '시먼에서 내려 호텔로', description: '라오허 야시장 → 메인역 → 시먼역 순서로 하차. 마지막 시먼에서 내려 걸어서 호텔. 복귀 집합 장소는 가이드에게 미리 확인.', transport: '투어 버스 + 도보', duration: '하차 후 약 8분 추정', query: HOTEL, lat: 25.04154, lng: 121.50247, region: 'taipei', hour: 21 },
    ],
  },
  {
    date: '2026-11-21', title: '도시를 떠나 온천으로', subtitle: '오전 예비 · 12시 체크아웃 · Trio 온천 16:30 · 우라이 1박',
    stops: [
      { time: '오전', name: '타이베이 예비 시간', description: '비 오면 실내 위주로. 짐은 미리 싸 두기.', transport: 'MRT / 도보', duration: '11:30까지', query: 'Ximending Taipei', lat: 25.04347, lng: 121.50719, region: 'taipei', hour: 10 },
      { time: '12:00', name: 'Ferrary Hotel 체크아웃', description: '체크아웃 12:00 (Agoda 1794494816). 바로 출발하거나, 짐을 맡기고 시먼에서 점심 후 13:30 출발.', transport: '도보', duration: '약 30분', query: HOTEL, lat: 25.04154, lng: 121.50247, region: 'taipei', hour: 12 },
      { time: '13:30 출발', name: '우라이로 이동', description: '시먼역에서 신뎬역까지 초록선 직행(환승 없음, 약 25분) → 신뎬역 앞 849번 버스(이지카드, 약 40분). 캐리어가 있으면 택시 약 40~50분이 편함(요금 미확인). 15:00 도착 목표.', transport: 'MRT + 849번 버스 / 택시', duration: '약 1시간 15분~1시간 30분 추정', query: 'Wulai Bus Station', lat: 24.86652, lng: 121.55139, region: 'wulai', hour: 14 },
      { time: '15:00 예상', name: '룽먼 홈스테이에 짐 맡기기', description: '龍門精緻溫泉民宿 · 溫泉街116號(예약 확정서 기준). 옛 거리에서 약 400m. 체크인 18:00 전 짐 보관 가능 여부는 숙소에 확인(+886 937 061 354).', transport: '도보', duration: '약 10분 추정', query: HOMESTAY, lat: 24.86017, lng: 121.55151, approx: true, region: 'wulai', hour: 15 },
      { time: '15:30 식사', name: 'Trio 온천 세트 식사', description: '馥森阪治 Trio · 環山路151號 · 02-2661-6688. 예약 200862804 확정. 식사 15:30 요청(식사 10:00~17:00, 라스트오더 16:00). 옛 거리에서 걸어서 약 20분(블로그 기준)이라 택시 권장.', transport: '택시 / 도보', duration: '약 1시간 추정', query: TRIO, lat: 24.8556, lng: 121.5492, approx: true, region: 'wulai', hour: 15 },
      { time: '16:30–18:00', name: 'Trio 온천 · YingLin 90분', description: '주말 YingLin + 세트 메뉴(2인) 90분. 예약 확정 16:30. 온천 후 숙소로.', transport: '시설 내', duration: '90분', query: TRIO, lat: 24.8556, lng: 121.5492, approx: true, region: 'wulai', hour: 17 },
      { time: '18:00', name: '룽먼 홈스테이 체크인', description: 'Cozy Deluxe Room · 조식 포함 · 커피·차 · 일본식 가운 무료 대여(예약 1794507059). 체크인 18:00.', transport: '택시 / 도보', duration: '약 10~20분 추정', query: HOMESTAY, lat: 24.86017, lng: 121.55151, approx: true, region: 'wulai', hour: 18 },
      { time: '19:00 예상', name: '우라이 옛 거리 저녁 산책', description: '세트 식사를 했으니 가볍게. 타이야포포(토요일 ~22:00) 대나무통밥이나 간식. 산이라 밤에는 쌀쌀함.', transport: '도보', duration: '약 1시간 추정', query: 'Wulai Old Street', lat: 24.86493, lng: 121.55168, region: 'wulai', hour: 19 },
    ],
  },
  {
    date: '2026-11-22', title: '따뜻한 아침, 폭포, 그리고 집으로', subtitle: '조식 · 우라이 폭포 · 11시 체크아웃 · 인천 귀국',
    stops: [
      { time: '08:00 예상', name: '홈스테이 조식', description: '조식 포함. 객실로 가져다준다는 후기 있음(시간은 숙소 확인). 폭포에 가려면 일찍.', transport: '숙소 내', duration: '약 40분 추정', query: HOMESTAY, lat: 24.86017, lng: 121.55151, approx: true, region: 'wulai', hour: 8 },
      { time: '08:50 예상', name: '우라이 폭포', description: '숙소에서 약 1.4km. 관광 열차 승강장이 숙소 근처(약 100m, 지도 기준). 운행 여부는 현장 확인, 걸어서 약 25분 추정. 비가 많이 오면 생략.', transport: '관광 열차 / 도보', duration: '10:20까지 복귀 목표', query: 'Wulai Falls', lat: 24.84752, lng: 121.55236, region: 'wulai', hour: 9 },
      { time: '11:00', name: '홈스테이 체크아웃', description: '체크아웃 11:00(예약 기준). 짐 정리는 전날 밤에.', transport: '도보', duration: '약 15분', query: HOMESTAY, lat: 24.86017, lng: 121.55151, approx: true, region: 'wulai', hour: 11 },
      { time: '11:15 예상', name: '우라이 옛 거리 점심', description: '공항 가기 전 마지막 식사. 짐을 숙소에 잠깐 맡길 수 있는지 확인.', transport: '도보', duration: '약 1시간 추정', query: 'Wulai Old Street', lat: 24.86493, lng: 121.55168, region: 'wulai', hour: 11 },
      { time: '12:30 출발', name: '공항으로 이동', description: '예약 차량 권장, 약 1시간 15분~2시간(주말 정체 포함 추정). 대중교통은 849번 버스 → 신뎬 → 메인역 → 공항 MRT로 2.5~3시간. 차량·요금 확정 필요.', transport: '차량 / 대중교통', duration: '약 1시간 15분~3시간 추정', query: 'Taiwan Taoyuan International Airport Terminal 1', lat: 25.081, lng: 121.237, approx: true, region: 'taoyuan', hour: 13 },
      { time: '15:10 목표', name: '타오위안공항 T1 도착', description: '18:10 출발 3시간 전 도착 목표. 택스리펀은 짐 부치기 전에 먼저, 레몬원액 같은 액체는 위탁으로.', transport: '공항 내', duration: '출발 전 여유 3시간', query: 'Taiwan Taoyuan International Airport Terminal 1', lat: 25.081, lng: 121.237, approx: true, region: 'taoyuan', hour: 15 },
      { time: '18:10 → 21:40', name: '타오위안 → 인천', description: '스쿠트 TR872 · 타오위안 T1 출발, 인천 T1 도착. 각 공항 현지시간. 기내 10kg · 위탁 20kg/인 · 2인 예약 완료.', transport: '항공', duration: '2시간 30분', query: 'Incheon International Airport Terminal 1', lat: 37.4491, lng: 126.4505, region: 'taoyuan', hour: 18 },
    ],
  },
];

export const initialBudget = [
  { id: 'flight-out', label: '출국 항공 · 2인', planned: 540000, actual: 540000, estimated: false, paid: true },
  { id: 'flight-back', label: '귀국 항공 · USD 495.95 임시 환산', planned: 656517, actual: 656517, estimated: true, paid: true },
  { id: 'taipei-hotel', label: 'Ferrary Hotel · 3박 · USD 243.26', planned: 326324, actual: 326324, estimated: false, paid: true },
  { id: 'wulai-hotel', label: '룽먼 온천 홈스테이 · 1박', planned: 150311, actual: 150311, estimated: false, paid: true },
  { id: 'trio-spa', label: 'Trio 온천 · YingLin 90분 + 세트 메뉴', planned: 155000, actual: 155000, estimated: false, paid: true },
  { id: 'tour', label: '예스지 투어 · 2인', planned: 100000, actual: null, estimated: true, paid: false },
  { id: 'food', label: '식비 · 2인', planned: 260000, actual: null, estimated: true, paid: false },
  { id: 'observatory', label: '101 전망대 · 89층+101층 2인', planned: 70000, actual: 69000, estimated: false, paid: true },
  { id: 'transport', label: '현지 교통 · 공항 이동', planned: 180000, actual: null, estimated: true, paid: false },
  { id: 'insurance', label: '여행자보험 · 2인 · 현대해상 다이렉트', planned: 40000, actual: 11400, estimated: false, paid: true },
  { id: 'buffer', label: '예비비', planned: 93483, actual: null, estimated: true, paid: false },
];

export const checklist = [
  { id: 'flight-out', label: '출국 항공권 · ZE881 예약 및 결제', done: true },
  { id: 'flight-back', label: '귀국 항공권 · TR872 예약 및 결제', done: true },
  { id: 'flight-bill', label: '귀국 항공권 원화 최종 청구액 반영', done: false },
  { id: 'taipei-hotel', label: 'Ferrary Hotel 3박 예약 · 11/18~21', done: true },
  { id: 'wulai-hotel', label: '룽먼 온천 홈스테이 1박 예약 · 11/21~22', done: true },
  { id: 'trio-spa', label: 'Trio 온천 11/21 16:30 · 식사 15:30 예약', done: true },
  { id: 'tour', label: '예스지 투어 11/20 예약 · 집결지(시먼 12:50 / 메인역 13:20) 확인', done: true },
  { id: 'jiufen-tea', label: '해열루 11/20 금 19:00 예약', done: true },
  { id: 'mango-call', label: '터치망고 11월 메뉴 전화 확인 · 02-2550-9939', done: false },
  { id: 'observatory', label: '101 전망대 표 · 11/19 16:00 · 89층+101층 2인', done: true },
  { id: 'forecast-decision', label: '11/19 타이베이 예보 확인 · 101 표 구매일 결정', done: true },
  { id: 'wulai-bag', label: '룽먼 홈스테이 18시 전 짐 보관 가능한지 확인', done: false },
  { id: 'airport-transfer', label: '11/22 우라이 → 공항 차량 확정 (12:30 출발)', done: false },
  { id: 'insurance', label: '여행자보험 2인 가입 · 11/18 08시~11/22 22시', done: true },
  { id: 'starbucks-coupon', label: '클룩 스타벅스 1+1 쿠폰 · 매장 가기 전 클룩에서 교환권 받기 (12/31까지)', done: false },
  { id: 'mobile', label: 'eSIM / 로밍 준비', done: false },
  { id: 'passport', label: '여권 · 입국 준비사항 확인', done: false },
  { id: 'twac', label: '대만 온라인 입국신고 TWAC 제출 · 입국 3일 전부터', done: false },
  { id: 'cash', label: '환전 · 야시장용 소액 현금 준비', done: false },
  { id: 'easycard', label: '이지카드 2장 · 공항에서 구매 및 충전', done: false },
];
