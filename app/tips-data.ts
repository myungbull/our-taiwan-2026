export type TipAccuracy = '정확' | '추정' | '자료 상충' | '미확인';

export type Tip = {
  title: string;
  body: string;
  accuracy: TipAccuracy;
  sources: { label: string; url: string }[];
};

export type TipGroup = { id: string; title: string; tips: Tip[] };

// Checked 2026-11-05. Accuracy describes how well the sources agree, not an
// official guarantee; rules and prices should be rechecked before departure.
export const tipGroups: TipGroup[] = [
  {
    id: 'entry',
    title: '입국 · 반입',
    tips: [
      {
        title: '고기는 위탁수하물로도 안 돼요',
        body: '대만은 육류와 고기가 든 가공식품, 고기가 든 기내식까지 반입을 금지해요. 첫 위반 벌금 NT$200,000, 재위반 NT$100만이에요. 먹을 걸 챙긴다면 위탁으로 옮기지 말고 고기 없는 것만 가져가세요. 고기 건더기가 든 라면과 소시지는 빼 두세요.',
        accuracy: '정확',
        sources: [{ label: '대만 이민서 안내', url: 'https://www.immigration.gov.tw/5475/5478/141457/141990/413532/' }],
      },
      {
        title: '돌아올 때도 육가공품과 망고는 금지',
        body: '한국 입국 시 육포·소시지 같은 육가공품과 망고 등 생과일은 주요 금지 품목이에요. 돼지기름 같은 축산 성분이 든 라면과 과자도 대상이라 성분표를 확인하세요. 미신고 시 최대 1,000만 원 과태료 자료가 있어요. 위탁수하물을 따로 다룬 자료는 찾지 못해서 안 가져오는 쪽을 권해요.',
        accuracy: '정확',
        sources: [{ label: '아시아경제 보도', url: 'https://www.asiae.co.kr/en/article/2026021616175591839' }, { label: '한국경제 보도', url: 'https://www.hankyung.com/article/2026021570547' }],
      },
      {
        title: '온라인 입국신고 TWAC',
        body: '종이 입국카드가 없어져 twac.immigration.gov.tw에서 무료로 제출해요. 입국 3일 전부터라는 자료가 많고 7일 전부터라는 자료도 있어요. 한 사람이 일행 것까지 함께 작성할 수 있어요.',
        accuracy: '자료 상충',
        sources: [{ label: '대만 이민서', url: 'https://www.immigration.gov.tw/5475/5478/141457/142068/393075' }, { label: '7일 전 안내', url: 'https://visasnews.com/en/taiwan-twac-arrival-card-can-now-be-completed-up-to-7-days-before-travel/' }],
      },
    ],
  },
  {
    id: 'money',
    title: '돈 · 통신 · 보험',
    tips: [
      {
        title: '환전은 소액 현금 + 카드',
        body: '야시장과 작은 식당은 현금만 받는 곳이 많아요. NT$100 이하 소액권을 챙기고 나머지는 트래블 카드로 쓰는 방식을 권해요. 결제 화면에서는 원화 말고 TWD를 고르세요. 현지 ATM 수수료는 기기마다 달라 카드 앱에서 확인하세요.',
        accuracy: '추정',
        sources: [{ label: '카드고릴라 2026 가이드', url: 'https://www.card-gorilla.com/contents/detail/4040' }],
      },
      {
        title: '택스리펀 NT$2,000부터',
        body: '같은 날 같은 매장에서 세금 포함 NT$2,000 이상이면 신청할 수 있어요. 환급액은 결제액의 약 5%에서 수수료 20%를 뺀 금액이라 체감 약 3.8%예요 (추정). NT$48,000 이하는 매장 현장 환급이 가능한 곳도 있어요. 공항에서는 짐 부치기 전에 처리하세요.',
        accuracy: '추정',
        sources: [{ label: '대만 택스리펀 서비스', url: 'https://www.taxrefund.net.tw/ttr/info/8a10a6ad4ae750d2014ae78a1d080004' }],
      },
      {
        title: '영수증은 복권이에요',
        body: '11~12월분 추첨은 2027년 1월 25일 전후, 수령은 2~5월로 추정해요 (지난해 일정 기준). 외국인도 여권으로 수령할 수 있다는 자료가 있어요. 영수증은 버리지 말고 모아 오세요.',
        accuracy: '추정',
        sources: [{ label: 'Focus Taiwan', url: 'https://focustaiwan.tw/business/202601250007' }, { label: 'Taiwan News', url: 'https://www.taiwannews.com.tw/en/news/6289298' }],
      },
      {
        title: '이심',
        body: '현지 3사 관광 상품과 이심 판매처가 많아요. 무제한이라고 적혀 있어도 공정 사용 약관과 핫스팟 허용 여부를 보세요. 비교할 만한 가격 자료는 찾지 못했어요.',
        accuracy: '미확인',
        sources: [{ label: '유심 vs 이심 비교', url: 'https://www.nomadesim.com/ko/blog/taiwan-esim-vs-chunghwa-tourist-sim' }],
      },
      {
        title: '여행자보험',
        body: '따로 조사하지 않은 항목이에요. 출발 전까지 2인 가입을 마치고 항공 지연과 휴대품 보장을 확인하세요.',
        accuracy: '미확인',
        sources: [],
      },
    ],
  },
  {
    id: 'transport',
    title: '교통 · 안내소',
    tips: [
      {
        title: '이지카드 1인 1장 권장',
        body: '타이베이 MRT는 2026년 7월 1일부터 신용카드와 모바일 결제 터치로 탈 수 있어요. 다만 상시 이용 우대가 없고, 버스와 소액 결제는 이지카드가 편해요. 우라이 849번 버스도 있어서 카드는 보조로 두는 걸 권해요. 보증금은 NT$100이에요 (추정).',
        accuracy: '추정',
        sources: [{ label: '중앙통신 보도', url: 'https://www.cna.com.tw/news/ahel/202606300226.aspx' }, { label: '이지카드 가이드', url: 'https://www.justaiwantour.com/easycard-taiwan/' }],
      },
      {
        title: '공항 T1 안내소',
        body: 'T1 입국장 서비스 센터는 매일 07:00~23:30으로 나와요. 무료 책자가 있는지는 자료로 확인하지 못해서 도착해서 물어보세요.',
        accuracy: '미확인',
        sources: [{ label: '대만 관광서 안내', url: 'https://www.taiwan.net.tw/m1.aspx?sNo=0030310' }],
      },
    ],
  },
  {
    id: 'food',
    title: '먹거리 · 건강',
    tips: [
      {
        title: '편의점 저녁 할인',
        body: '5시 할인은 패밀리마트 友善食光으로 보여요. 17시부터 임박 신선식품이 약 30% 할인이라는 자료가 있어요. 세븐일레븐 i珍食은 10~17시, 20~03시에 약 35%, 19시대에 약 20%예요. 전 상품이 아니고 매장별 재고가 달라 자료도 조금씩 달라요.',
        accuracy: '자료 상충',
        sources: [{ label: '시간대 정리', url: 'https://www.cashfeel.com.tw/article/友善時光-i珍食-時段' }, { label: '비즈니스투데이 정리', url: 'https://www.businesstoday.com.tw/article/category/183030/post/202509090020/' }],
      },
      {
        title: '편의점 푸딩',
        body: '믿을 만한 순위 자료는 찾지 못했어요. 세븐일레븐의 統一布丁 계열이 가장 많이 언급돼요. 매대에서 布丁을 찾아보세요.',
        accuracy: '추정',
        sources: [{ label: '식상완가 보도', url: 'https://supertaste.tvbs.com.tw/food/359217' }],
      },
      {
        title: '물갈이',
        body: '생수를 사서 마시고 수돗물은 끓여 드세요. 메모한 태산(泰山)은 대만 음료 브랜드가 맞고 편의점에서 찾아보면 돼요. 태산이 물갈이에 특히 좋다는 근거는 찾지 못했어요.',
        accuracy: '추정',
        sources: [{ label: '대만 음용수 안내', url: 'https://www.englishintaiwan.com/life-in-taiwan/tea-coffee-drinking-water-taiwan' }],
      },
      {
        title: '빈랑은 호기심으로도 안 돼요',
        body: '길가 가판에서 파는 씹는 열매예요. 국제암연구소 1군 발암물질이고, 타이베이에서는 붉은 침을 뱉으면 벌금이에요.',
        accuracy: '정확',
        sources: [{ label: 'Taipei Times', url: 'https://www.taipeitimes.com/News/taiwan/archives/2024/08/24/2003822700' }],
      },
    ],
  },
  {
    id: 'souvenir',
    title: '기념품 · 스탬프',
    tips: [
      {
        title: '누가크래커',
        body: '세인트피터가 많이 추천돼요. 시먼딩 등 시내 매장에서 살 수 있고 1상자 NT$150~200, 보관은 약 2주로 나와요. 11/19 시먼에서 사면 동선이 맞아요. 재료에 고기 성분이 없는지 보고 사세요.',
        accuracy: '추정',
        sources: [{ label: '기념품 가이드', url: 'https://www.tripstore.kr/blog/%EB%8C%80%EB%A7%8C-%EA%B8%B0%EB%85%90%ED%92%88-%EC%87%BC%ED%95%91%EB%A6%AC%EC%8A%A4%ED%8A%B8-%EC%B6%94%EC%B2%9C' }],
      },
      {
        title: '레몬원액',
        body: '메모의 특정 제품은 찾지 못했어요. 상품명을 알면 다시 확인할게요. 슈퍼에서는 檸檬原汁으로 찾으면 돼요. 액체라 위탁수하물에 넣고, 일행 위탁 한도는 귀국편 1인 20kg이에요.',
        accuracy: '미확인',
        sources: [],
      },
      {
        title: 'MRT 역 스탬프',
        body: '역 안내소 옆 작은 탁자에 두는 곳이 많고, 공항철도를 뺀 역마다 디자인이 달라요. 자료가 오래돼 일부 역은 다를 수 있어요. 2026 디지털 스탬프 행사는 9/30에 끝났어요. 작은 수첩을 챙겨 타이베이역, 베이먼, 솽롄, 룽산쓰, 시먼, 중정기념당, 101, 신뎬에서 찍어 보세요.',
        accuracy: '추정',
        sources: [{ label: '타이베이시 안내', url: 'https://english.gov.taipei/News_Content.aspx?n=A11F01CFC9F58C83&sms=DFFA119D1FD5602C&s=9177598FF181DA93' }, { label: 'Taiwanderers 가이드', url: 'https://taiwanderers.com/taiwan-souvenir-stamp-collecting/' }],
      },
    ],
  },
];
