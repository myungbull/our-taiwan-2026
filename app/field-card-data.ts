export type FieldCardType = 'airport' | 'hotel' | 'tour';

export type FieldCard = {
  id: string;
  type: FieldCardType;
  title: string;
  status: 'confirmed' | 'candidate' | 'pending';
  statusLabel: string;
  destination: string;
  address: string;
  date: string;
  details: string[];
  note: string;
  speechText: string;
  speechLang: 'zh-TW' | 'ko-KR';
  mapQuery?: string;
  sources: { label: string; url: string }[];
};

// Flight details were supplied by the travelers. A paid regional budget item is
// intentionally not evidence that a particular hotel or tour meeting point is booked.
export const fieldCards: FieldCard[] = [
  {
    id: 'taoyuan-return', type: 'airport', title: '타오위안 공항으로',
    status: 'confirmed', statusLabel: '항공 예약 완료',
    destination: '臺灣桃園國際機場\n第一航廈', address: '桃園市大園區航站南路9號',
    date: '2026.11.22 일요일 · 대만 현지 시각',
    details: ['스쿠트 TR872 · 타오위안 T1 → 인천 T1', '18:10 출발 → 21:40 도착 (각 공항 현지 시각)', '공항 도착 목표 15:10 · 여행 계획상 목표 시각'],
    note: '출발 전 항공사에서 터미널·운항 변경을 다시 확인해 주세요.',
    speechText: '您好，請送我們到臺灣桃園國際機場，第一航廈，謝謝。', speechLang: 'zh-TW',
    mapQuery: '臺灣桃園國際機場 第一航廈',
    sources: [{ label: '타오위안 공항 공식 안내', url: 'https://www.taoyuan-airport.com/en/transportation' }],
  },
  {
    id: 'incheon-outbound', type: 'airport', title: '인천 공항으로',
    status: 'confirmed', statusLabel: '항공 예약 완료',
    destination: '인천국제공항\n제1여객터미널', address: '인천광역시 영종구 공항로272',
    date: '2026.11.18 수요일 · 한국 현지 시각',
    details: ['이스타항공 ZE881 · 인천 T1 → 타오위안 T1', '08:00 출발 → 09:45 도착 (각 공항 현지 시각)', '위탁수하물 1인 15kg · 2인 예약 완료'],
    note: '출발 전 항공사에서 터미널·운항 변경을 다시 확인해 주세요.',
    speechText: '안녕하세요. 인천국제공항 제1여객터미널로 가 주세요. 감사합니다.', speechLang: 'ko-KR',
    mapQuery: '인천국제공항 제1여객터미널',
    sources: [{ label: '인천공항 공식 안내', url: 'https://www.airport.kr/ap_ko/index.do' }],
  },
  {
    id: 'ferrary-hotel', type: 'hotel', title: 'Ferrary Hotel · 타이베이',
    status: 'confirmed', statusLabel: '숙소 예약 완료',
    destination: '華麗大飯店', address: '台北市萬華區康定路41號',
    date: '2026.11.18~11.21 · 3박',
    details: ['체크인 15:00 · 체크아웃 12:00', 'Business Double Room · Agoda 1794494816', '시먼역에서 걸어서 약 8분 (추정)'],
    note: '택시 기사님께 이 화면을 보여 주세요.',
    speechText: '您好，請送我們到華麗大飯店，地址是台北市萬華區康定路四十一號，謝謝。', speechLang: 'zh-TW',
    mapQuery: '華麗大飯店 台北市萬華區康定路41號',
    sources: [{ label: 'Agoda 예약 확인', url: 'https://www.agoda.com/' }],
  },
  {
    id: 'trio-spa', type: 'hotel', title: 'Trio 온천 · 우라이',
    status: 'confirmed', statusLabel: '온천 예약 완료 · 16:30',
    destination: '馥森阪治 Trio', address: '新北市烏來區環山路151號',
    date: '2026.11.21 토요일 · 식사 15:30 · 온천 16:30',
    details: ['주말 YingLin + 세트 메뉴(2인) 90분', '예약번호 200862804', '전화 02-2661-6688'],
    note: '우라이 옛 거리에서 걸어서 약 20분(블로그 기준). 택시를 권장해요.',
    speechText: '您好，請送我們到烏來的馥森阪治 Trio，地址是新北市烏來區環山路一百五十一號，謝謝。', speechLang: 'zh-TW',
    mapQuery: '馥森阪治 Trio 新北市烏來區環山路151號',
    sources: [{ label: 'Trio 공식 사이트', url: 'https://fusenbanzhi.com.tw/' }],
  },
  {
    id: 'longmun-homestay', type: 'hotel', title: '룽먼 온천 홈스테이 · 우라이',
    status: 'confirmed', statusLabel: '숙소 예약 완료 · 주소 확인 필요',
    destination: '龍門精緻溫泉民宿', address: '新北市烏來區溫泉街116號',
    date: '2026.11.21~11.22 · 1박',
    details: ['체크인 18:00 · 체크아웃 11:00', 'Cozy Deluxe Room · 조식 포함 · 예약 1794507059', '숙소 연락처 +886 937 061 354'],
    note: '주소는 블로그 1곳 기준(추정)이에요. 도착 전에 숙소에 주소를 확인해 주세요.',
    speechText: '您好，請送我們到烏來的龍門精緻溫泉民宿，地址是新北市烏來區溫泉街一百一十六號，謝謝。', speechLang: 'zh-TW',
    mapQuery: '龍門精緻溫泉民宿 新北市烏來區溫泉街116號',
    sources: [{ label: '숙소 소개(블로그)', url: 'https://bunnyann.tw/longmen/' }],
  },
  {
    id: 'tour-meeting-pending', type: 'tour', title: '예스지 투어 집결지',
    status: 'confirmed', statusLabel: '예약 완료 · 집결지 택 1',
    destination: '타이베이 메인역 M3 지하 1층\n또는 시먼역 5번 출구 지상 1층', address: '',
    date: '2026.11.20 금요일 · 대만 현지 시각',
    details: ['12:50 시먼역 미팅 · 13:00 출발 (호텔에서 걸어서 약 8분)', '13:20 메인역 미팅 · 13:30 출발', '예류 14:30~15:40 · 스펀 16:30~17:20 · 지우펀 18:10~20:10 · 21:10부터 하차'],
    note: '가이드에게 한글 이름을 말하면 됩니다. 구매처 안내와 다르면 예약 내역을 따라 주세요.',
    speechText: '', speechLang: 'zh-TW',
    sources: [{ label: '착한투어 상품 안내', url: 'https://experiences.myrealtrip.com/products/3481408' }],
  },
];

export const fieldCardTabs: { type: FieldCardType; label: string }[] = [
  { type: 'airport', label: '공항' }, { type: 'hotel', label: '숙소' }, { type: 'tour', label: '투어' },
];

export function fieldCardText(card: FieldCard) {
  return [card.statusLabel, card.destination, card.address, card.date, ...card.details, card.note].filter(Boolean).join('\n');
}

