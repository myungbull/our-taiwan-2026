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
    id: 'cityinn-candidate', type: 'hotel', title: 'CityInn 타이베이역 2관',
    status: 'candidate', statusLabel: '숙소 후보 · 예약 전',
    destination: '新驛旅店\n台北車站二館', address: '台北市大同區長安西路81號',
    date: '검토 중 · 2026.11.18~11.21 · 3박',
    details: ['타이베이 숙소 비교 후보', '체크인·체크아웃 시각은 예약 전 확인 필요'],
    note: '이 카드는 주소 확인용 후보 카드입니다. 실제 예약 숙소로 확정되지 않았습니다.',
    speechText: '您好，請送我們到新驛旅店，台北車站二館，地址是台北市大同區長安西路八十一號，謝謝。', speechLang: 'zh-TW',
    mapQuery: '新驛旅店 台北車站二館 台北市大同區長安西路81號',
    sources: [{ label: 'CityInn 2관 공식 연락처', url: 'https://c2.cityinn.com.tw/tw/contact-t/' }],
  },
  {
    id: 'roaders-candidate', type: 'hotel', title: 'Roaders 타이베이 중화관',
    status: 'candidate', statusLabel: '숙소 후보 · 예약 전',
    destination: '路徒行旅\n台北中華館', address: '台北市中正區延平南路68號',
    date: '검토 중 · 2026.11.18~11.21 · 3박',
    details: ['타이베이 숙소 비교 후보', '체크인·체크아웃 시각은 예약 전 확인 필요'],
    note: '이 카드는 주소 확인용 후보 카드입니다. 실제 예약 숙소로 확정되지 않았습니다.',
    speechText: '您好，請送我們到路徒行旅，台北中華館，地址是台北市中正區延平南路六十八號，謝謝。', speechLang: 'zh-TW',
    mapQuery: '路徒行旅 台北中華館 台北市中正區延平南路68號',
    sources: [{ label: 'Roaders 중화관 공식 안내', url: 'https://zhonghua.roadershotel.com/en' }],
  },
  {
    id: 'spring-candidate', type: 'hotel', title: 'Spring Spa 우라이',
    status: 'candidate', statusLabel: '숙소 후보 · 예약 전',
    destination: '烏來 Spring Spa\n溫泉山莊', address: '新北市烏來區新烏路五段66號',
    date: '검토 중 · 2026.11.21~11.22 · 1박',
    details: ['디럭스 온천 더블룸 우선 검토', '체크인 17:00 · 체크아웃 12:00 (현재 여행 계획)', '객실 온천 사용·귀국일 공항 이동 확인 필요'],
    note: '이 카드는 주소 확인용 후보 카드입니다. 객실·체크인 조건은 예약 시 다시 확인해 주세요.',
    speechText: '您好，請送我們到烏來 Spring Spa 溫泉山莊，地址是新北市烏來區新烏路五段六十六號，謝謝。', speechLang: 'zh-TW',
    mapQuery: '烏來 Spring Spa 溫泉山莊 新北市烏來區新烏路五段66號',
    sources: [{ label: 'Spring Spa 공식 안내', url: 'https://www.springspa.com.tw/' }],
  },
  {
    id: 'tour-meeting-pending', type: 'tour', title: '예스지 투어 집결지',
    status: 'pending', statusLabel: '집결지 확인 필요',
    destination: '집결지를 먼저 확인해 주세요', address: '',
    date: '2026.11.19 목요일 · 대만 현지 시각',
    details: ['계획: 예류 15:00 · 스펀 17:00~18:00 · 지우펀 18:50~20:30', '집결 장소·출발 시각·상품 예약 상태 확인 필요'],
    note: '클룩 예약 내역에서 정확한 상품명과 집결 장소를 확인한 뒤 이용해 주세요. 관광지 도착 시각은 집결 시각이 아닙니다.',
    speechText: '', speechLang: 'zh-TW',
    sources: [{ label: '클룩 예약 내역에서 확인', url: 'https://www.klook.com/ko/' }],
  },
];

export const fieldCardTabs: { type: FieldCardType; label: string }[] = [
  { type: 'airport', label: '공항' }, { type: 'hotel', label: '숙소' }, { type: 'tour', label: '투어' },
];

export function fieldCardText(card: FieldCard) {
  return [card.statusLabel, card.destination, card.address, card.date, ...card.details, card.note].filter(Boolean).join('\n');
}

