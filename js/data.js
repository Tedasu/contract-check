/**
 * 계약 유형별 점검 항목 + 자동 판정 규칙
 *
 * polarity — 문서에서 무엇을 찾았을 때 어떤 의미인지
 *   required  : 있어야 하는 조항. 못 찾으면 경고.
 *   forbidden : 없어야 하는 조항(독소조항). 찾으면 경고.
 *   review    : 있으면 사람이 내용을 직접 봐야 하는 조항. 찾으면 주의.
 *
 * manualOnly — 계약서 본문으로는 판단할 수 없는 항목(등기부 확인, 서명 전 태도 등).
 *              자동 판정하지 않고 사용자가 직접 체크한다. 넘겨짚지 않는 것이 정확도다.
 *
 * rules.any — 조건군 배열. 하나라도 만족하면 "찾음".
 *   { all: [term, ...] } — 모든 term이 문서에 있어야 그 조건군이 성립.
 *   term 은 '가|나|다' 형태의 동의어 목록이며 정규식이 아니라 단순 문자열 후보다.
 *   비교는 공백을 모두 제거한 정규화 텍스트에서 이뤄진다.
 */
const CONTRACT_TYPES = [
  {
    id: 'employment',
    name: '근로계약서',
    icon: '💼',
    summary: '근로기준법 제17조는 임금·근로시간·휴일·연차휴가 등을 반드시 서면으로 명시하고 교부하도록 정하고 있습니다.',
    sections: [
      {
        name: '법정 필수 명시사항',
        items: [
          {
            id: 'emp-wage',
            title: '임금의 구성항목·계산방법·지급방법이 적혀 있다',
            desc: '기본급, 각종 수당, 상여금이 어떻게 계산되고 언제 어떤 방식으로 지급되는지 구체적으로 적혀 있어야 합니다. "회사 내규에 따름"만으로는 부족합니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['임금|급여|보수|월급', '지급|계산|산정'] },
              { all: ['기본급'] },
            ] },
          },
          {
            id: 'emp-hours',
            title: '소정근로시간과 시업·종업 시각, 휴게시간이 적혀 있다',
            desc: '하루 몇 시부터 몇 시까지 일하고 휴게시간이 언제 얼마나 주어지는지 명시되어야 합니다. 4시간마다 30분, 8시간마다 1시간 이상의 휴게시간이 법정 기준입니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['소정근로시간|근로시간|근무시간', '휴게'] },
              { all: ['시업|시작시각|출근시각', '종업|종료시각|퇴근시각'] },
            ] },
          },
          {
            id: 'emp-holiday',
            title: '휴일(주휴일)이 명시되어 있다',
            desc: '1주 소정근로일을 개근하면 유급 주휴일이 발생합니다. 어떤 요일이 휴일인지 적혀 있어야 합니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['주휴일|주휴'] },
              { all: ['휴일'] },
            ] },
          },
          {
            id: 'emp-annual',
            title: '연차유급휴가에 관한 사항이 적혀 있다',
            desc: '상시근로자 5인 이상 사업장이라면 연차휴가가 법정 의무입니다. 발생 기준과 사용 방법을 확인하세요.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['연차'] },
              { all: ['유급휴가'] },
            ] },
          },
          {
            id: 'emp-place',
            title: '근무 장소와 담당 업무가 특정되어 있다',
            desc: '업무 내용이 지나치게 포괄적이면("회사가 지시하는 업무 일체") 원치 않는 부서·직무로의 전환 근거가 될 수 있습니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['근무장소|근무지|취업의장소|근무부서', '업무|직무|담당'] },
            ] },
          },
          {
            id: 'emp-copy',
            title: '계약서를 2부 작성해 교부한다는 내용이 있다',
            desc: '사용자는 근로계약서를 서면으로 교부할 의무가 있습니다. 실제로 서명본 1부를 받았는지도 함께 확인하세요.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['교부'] },
              { all: ['각1부|1부씩|2부를작성|2통을작성'] },
            ] },
          },
        ],
      },
      {
        name: '조건 확인',
        items: [
          {
            id: 'emp-minwage',
            title: '시급 환산액이 최저임금 이상이다',
            desc: '월급을 월 소정근로시간(주 40시간 기준 약 209시간)으로 나눠 그해 최저임금과 비교하세요. 금액 판단은 자동으로 하지 않으니 직접 계산해 확인해야 합니다.',
            level: 'must',
            manualOnly: true,
          },
          {
            id: 'emp-period',
            title: '계약기간과 갱신 조건이 명확하다',
            desc: '기간제인지 정규직인지, 갱신 기준이 무엇인지 확인하세요. 기간제는 2년을 초과하면 무기계약직으로 전환되는 것이 원칙입니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['계약기간|근로계약기간'] },
              { all: ['기간의정함'] },
            ] },
          },
          {
            id: 'emp-probation',
            title: '수습기간의 길이와 임금 조건이 적혀 있다',
            desc: '수습기간, 그 기간의 임금 비율, 수습 종료 후 처우가 명확한지 확인하세요.',
            level: 'good',
            polarity: 'review',
            rules: { any: [
              { all: ['수습'] },
              { all: ['시용기간'] },
            ] },
          },
          {
            id: 'emp-overtime',
            title: '연장·야간·휴일근로 수당 지급 기준이 있다',
            desc: '5인 이상 사업장은 연장·야간·휴일근로에 50% 이상 가산수당을 지급해야 합니다. 포괄임금제라면 몇 시간분이 포함된 것인지 확인하세요.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['연장근로|시간외|야간근로|휴일근로', '수당|가산'] },
              { all: ['포괄임금'] },
            ] },
          },
          {
            id: 'emp-insurance',
            title: '4대보험 가입에 관한 내용이 있다',
            desc: '"프리랜서로 처리한다", "3.3%만 떼겠다"는 제안은 실질이 근로자라면 부당할 수 있습니다.',
            level: 'good',
            polarity: 'required',
            rules: { any: [
              { all: ['4대보험|사대보험'] },
              { all: ['국민연금'] },
              { all: ['고용보험'] },
              { all: ['건강보험'] },
            ] },
          },
          {
            id: 'emp-rules',
            title: '취업규칙에 위임된 내용이 있는지 확인했다',
            desc: '계약서가 "취업규칙에 따른다"고 위임한 부분이 많다면, 그 취업규칙 내용을 반드시 따로 확인해야 합니다.',
            level: 'good',
            polarity: 'review',
            rules: { any: [
              { all: ['취업규칙'] },
              { all: ['사내규정|회사내규|내규'] },
            ] },
          },
        ],
      },
      {
        name: '⚠️ 독소조항 확인',
        items: [
          {
            id: 'emp-penalty',
            title: '위약금·손해배상액 예정 조항이 없다',
            desc: '근로기준법 제20조는 근로계약 불이행에 대한 위약금이나 손해배상액을 미리 정하는 것을 금지합니다. "중도 퇴사 시 교육비 전액 배상" 같은 조항은 무효일 수 있습니다.',
            level: 'risk',
            polarity: 'forbidden',
            rules: { any: [
              { all: ['위약금'] },
              { all: ['손해배상액', '예정'] },
              { all: ['교육비', '반환|배상|상환'] },
            ] },
          },
          {
            id: 'emp-deposit',
            title: '강제 저축·예금 관리 조항이 없다',
            desc: '근로기준법 제22조는 사용자가 근로자의 저축을 강제하거나 예금을 관리하는 것을 금지합니다.',
            level: 'risk',
            polarity: 'forbidden',
            rules: { any: [
              { all: ['저축', '강제|의무'] },
              { all: ['예금', '관리|위탁'] },
            ] },
          },
          {
            id: 'emp-noncompete',
            title: '경업금지 조항이 없거나 범위가 과도하지 않다',
            desc: '퇴사 후 동종업계 취업을 무기한·전국적으로 금지하는 조항은 직업선택의 자유를 과도하게 제한해 효력이 부정될 수 있습니다. 보상 유무도 함께 확인하세요.',
            level: 'risk',
            polarity: 'forbidden',
            rules: { any: [
              { all: ['경업'] },
              { all: ['전직금지'] },
              { all: ['동종업계|동종업체|경쟁업체', '취업|근무|종사'] },
            ] },
          },
          {
            id: 'emp-blank',
            title: '빈칸이나 백지 상태로 서명하지 않았다',
            desc: '금액·기간·업무 등 핵심 항목이 비어 있는 상태로 서명하면 나중에 임의로 채워질 수 있습니다.',
            level: 'risk',
            manualOnly: true,
          },
        ],
      },
    ],
  },

  {
    id: 'lease',
    name: '주택임대차계약서',
    icon: '🏠',
    summary: '보증금을 지키는 핵심은 계약 전 권리관계 확인, 그리고 계약 후 전입신고·확정일자입니다. 이 항목들은 계약서 본문이 아니라 직접 확인해야 합니다.',
    sections: [
      {
        name: '계약 전 권리관계 확인 (직접 확인)',
        items: [
          {
            id: 'lease-register',
            title: '등기부등본을 직접 발급받아 확인했다',
            desc: '인터넷등기소에서 직접 발급받으세요. 중개인이 보여준 사본은 발급 시점이 오래되었을 수 있습니다. 계약 당일과 잔금일에 각각 확인하는 것이 안전합니다.',
            level: 'must',
            manualOnly: true,
          },
          {
            id: 'lease-owner',
            title: '등기부상 소유자와 계약 상대방이 같은 사람이다',
            desc: '신분증으로 대조하세요. 대리인과 계약한다면 인감증명서가 첨부된 위임장과 소유자 본인 확인이 필요합니다.',
            level: 'must',
            manualOnly: true,
          },
          {
            id: 'lease-mortgage',
            title: '근저당권·가압류·신탁 등 선순위 권리를 확인했다',
            desc: '등기부 을구의 근저당권 채권최고액을 확인하세요. 신탁등기가 되어 있다면 소유자가 아니라 신탁회사의 동의가 필요합니다.',
            level: 'must',
            manualOnly: true,
          },
          {
            id: 'lease-ratio',
            title: '보증금 + 선순위 채권이 주택 시세보다 충분히 낮다',
            desc: '경매로 넘어갔을 때 보증금을 돌려받을 수 있는지가 핵심입니다. 통상 (선순위 채권 + 내 보증금)이 시세의 70~80%를 넘으면 위험 신호로 봅니다.',
            level: 'must',
            manualOnly: true,
          },
          {
            id: 'lease-tax',
            title: '임대인의 국세·지방세 완납 여부를 확인했다',
            desc: '임차인은 임대인의 납세증명서 제시를 요구할 수 있습니다. 체납된 세금은 보증금보다 먼저 배당될 수 있습니다.',
            level: 'good',
            manualOnly: true,
          },
          {
            id: 'lease-building',
            title: '건축물대장상 용도와 실제 용도가 일치한다',
            desc: '근린생활시설을 주택으로 개조한 이른바 "근생빌라"는 주택임대차보호법 적용이나 전세대출에서 문제가 될 수 있습니다.',
            level: 'good',
            manualOnly: true,
          },
        ],
      },
      {
        name: '계약서 내용',
        items: [
          {
            id: 'lease-amount',
            title: '보증금·차임과 지급일이 적혀 있다',
            desc: '계약금, 중도금, 잔금의 금액과 날짜를 확인하세요. 금액은 숫자와 한글을 함께 적는 것이 안전합니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['보증금', '계약금|중도금|잔금|지급'] },
              { all: ['보증금', '차임|월세|월임대료'] },
            ] },
          },
          {
            id: 'lease-object',
            title: '임차할 부동산의 소재지와 면적이 특정되어 있다',
            desc: '동·호수까지 정확히 적혀 있어야 합니다. 등기부상 표시와 한 글자도 다르지 않은지 대조하세요.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['소재지'] },
              { all: ['면적'] },
              { all: ['부동산의표시'] },
            ] },
          },
          {
            id: 'lease-period',
            title: '임대차 기간이 적혀 있다',
            desc: '주택임대차보호법상 최소 2년이 보장되며, 계약갱신요구권을 1회 행사할 수 있습니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['임대차기간'] },
              { all: ['존속기간'] },
              { all: ['계약기간'] },
            ] },
          },
          {
            id: 'lease-repair',
            title: '수선 의무의 범위가 정해져 있다',
            desc: '보일러·누수 등 주요 설비의 수리 책임이 누구에게 있는지 특약으로 명확히 해두면 분쟁이 줄어듭니다.',
            level: 'good',
            polarity: 'required',
            rules: { any: [
              { all: ['수선'] },
              { all: ['수리', '부담|비용|책임'] },
            ] },
          },
          {
            id: 'lease-special-bad',
            title: '임차인에게 일방적으로 불리한 특약이 없다',
            desc: '"시설물 하자는 모두 임차인 부담", "중도 해지 시 보증금 반환 없음" 같은 특약은 임차인에게 매우 불리합니다.',
            level: 'risk',
            polarity: 'forbidden',
            rules: { any: [
              { all: ['원상복구|원상회복', '일체|전부|모두'] },
              { all: ['보증금', '반환하지아니한다|반환하지않는다|반환청구할수없다'] },
              { all: ['임차인', '전액부담|모두부담|일체부담'] },
            ] },
          },
          {
            id: 'lease-special',
            title: '특약사항 내용을 한 줄씩 직접 읽었다',
            desc: '특약은 표준계약서 본문보다 우선 적용되는 경우가 많습니다. 자동 판정에 의존하지 말고 반드시 직접 읽으세요.',
            level: 'must',
            polarity: 'review',
            rules: { any: [
              { all: ['특약'] },
            ] },
          },
          {
            id: 'lease-broker',
            title: '개업공인중개사 정보와 확인·설명서 관련 내용이 있다',
            desc: '공인중개사를 통했다면 중개대상물 확인·설명서 교부는 의무입니다. 공제증서는 중개사고 시 배상 근거가 됩니다.',
            level: 'good',
            polarity: 'required',
            rules: { any: [
              { all: ['중개대상물'] },
              { all: ['공제증서'] },
              { all: ['개업공인중개사|중개업자'] },
            ] },
          },
        ],
      },
      {
        name: '계약 후 필수 조치 (직접 확인)',
        items: [
          {
            id: 'lease-move',
            title: '전입신고를 했다 (대항력)',
            desc: '주택 인도 + 전입신고를 마치면 그 다음 날 0시부터 대항력이 생깁니다. 잔금일에 바로 처리하세요.',
            level: 'must',
            manualOnly: true,
          },
          {
            id: 'lease-date',
            title: '확정일자를 받았다 (우선변제권)',
            desc: '주민센터나 인터넷등기소에서 확정일자를 받아야 경매 시 후순위 권리자보다 먼저 보증금을 배당받을 수 있습니다.',
            level: 'must',
            manualOnly: true,
          },
          {
            id: 'lease-insurance',
            title: '전세보증금 반환보증 가입을 검토했다',
            desc: 'HUG, HF, SGI 등의 보증상품에 가입하면 임대인이 보증금을 돌려주지 않을 때 보증기관이 대신 지급합니다.',
            level: 'good',
            manualOnly: true,
          },
          {
            id: 'lease-photo',
            title: '입주 시 상태를 사진·영상으로 남겼다',
            desc: '퇴거할 때 원상복구 범위를 두고 다투는 일이 많습니다. 기존 하자를 날짜가 남도록 기록해두세요.',
            level: 'good',
            manualOnly: true,
          },
        ],
      },
    ],
  },

  {
    id: 'freelance',
    name: '프리랜서·용역계약서',
    icon: '🧑‍💻',
    summary: '분쟁의 대부분은 "어디까지가 계약 범위인가"와 "언제 돈을 받는가"에서 생깁니다.',
    sections: [
      {
        name: '업무 범위와 일정',
        items: [
          {
            id: 'free-scope',
            title: '산출물과 업무 범위가 특정되어 있다',
            desc: '"홈페이지 제작" 같은 표현 대신 페이지 수, 기능 목록, 파일 형식까지 적어두세요. 범위가 모호하면 무상 추가 작업으로 이어집니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['업무범위|용역범위|과업범위'] },
              { all: ['산출물|납품물|결과물'] },
              { all: ['용역의내용|업무의내용'] },
            ] },
          },
          {
            id: 'free-revision',
            title: '수정 요청의 횟수·범위 제한이 있다',
            desc: '무제한 수정 조항은 사실상 무기한 무보수 노동이 됩니다. 횟수를 정하고 초과분은 추가 비용으로 규정하세요.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['수정', '횟수|회이내|회까지|제한'] },
              { all: ['추가비용|추가대금', '수정'] },
            ] },
          },
          {
            id: 'free-schedule',
            title: '납기와 검수 절차가 명시되어 있다',
            desc: '납품일, 검수 기간, 기간 내 응답이 없을 때의 처리(예: 검수 완료로 간주)를 정해두면 대금 지급이 지연되지 않습니다.',
            level: 'good',
            polarity: 'required',
            rules: { any: [
              { all: ['검수'] },
              { all: ['납품일|납기|완료일'] },
            ] },
          },
          {
            id: 'free-client-duty',
            title: '발주자가 제공할 자료와 그 기한이 적혀 있다',
            desc: '자료 제공이 늦어져 일정이 밀리는 경우가 많습니다. 발주자 귀책으로 인한 지연은 납기에서 제외한다는 조항을 넣으세요.',
            level: 'good',
            polarity: 'required',
            rules: { any: [
              { all: ['자료', '제공'] },
              { all: ['협조', '의무'] },
            ] },
          },
        ],
      },
      {
        name: '대금',
        items: [
          {
            id: 'free-price',
            title: '총 대금과 부가세 포함 여부가 적혀 있다',
            desc: '"500만원"이 부가세 포함인지 별도인지에 따라 10% 차이가 납니다. 반드시 명시되어야 합니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['부가세|부가가치세'] },
              { all: ['용역대금|계약금액|총액'] },
            ] },
          },
          {
            id: 'free-pay-schedule',
            title: '지급 시기와 분할 지급 비율이 정해져 있다',
            desc: '착수금 없이 전액 후불은 위험합니다. 착수금 30~50%를 받고 시작하는 것이 일반적입니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['착수금'] },
              { all: ['선급금'] },
              { all: ['중도금'] },
              { all: ['잔금', '지급'] },
            ] },
          },
          {
            id: 'free-delay',
            title: '대금 지연 시의 이자나 제재가 규정되어 있다',
            desc: '지연이자율을 정해두면 지급을 미루는 것을 막는 실질적 장치가 됩니다.',
            level: 'good',
            polarity: 'required',
            rules: { any: [
              { all: ['지연이자'] },
              { all: ['지연', '이자|손해금'] },
            ] },
          },
          {
            id: 'free-tax',
            title: '원천징수 등 세금 처리 방식이 적혀 있다',
            desc: '사업소득으로 3.3%를 원천징수할지, 세금계산서를 발행할지 정하세요. 실질이 근로자에 가깝다면 근로계약이 맞을 수 있습니다.',
            level: 'good',
            polarity: 'required',
            rules: { any: [
              { all: ['원천징수'] },
              { all: ['세금계산서'] },
              { all: ['3.3'] },
            ] },
          },
        ],
      },
      {
        name: '권리와 책임',
        items: [
          {
            id: 'free-copyright',
            title: '저작권의 귀속 시점과 범위가 적혀 있다',
            desc: '대금 완납 시점에 이전되도록 하는 것이 안전합니다. 2차적저작물작성권까지 넘기는지도 확인하세요.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['저작권'] },
              { all: ['지식재산권|지적재산권'] },
            ] },
          },
          {
            id: 'free-copyright-all',
            title: '2차적저작물작성권까지 무상으로 넘기지 않는다',
            desc: '2차적저작물작성권까지 포함해 양도하면 결과물을 변형·재가공한 모든 저작물에 대한 권리를 잃습니다.',
            level: 'risk',
            polarity: 'forbidden',
            rules: { any: [
              { all: ['2차적저작물|이차적저작물'] },
              { all: ['저작인격권', '행사하지'] },
            ] },
          },
          {
            id: 'free-portfolio',
            title: '포트폴리오 공개 가능 여부가 정해져 있다',
            desc: '비밀유지 조항 때문에 결과물을 실적으로 쓰지 못하는 경우가 많습니다. 공개 가능 범위와 시점을 합의해두세요.',
            level: 'good',
            polarity: 'required',
            rules: { any: [
              { all: ['포트폴리오'] },
              { all: ['실적', '공개|사용|활용'] },
            ] },
          },
          {
            id: 'free-liability',
            title: '손해배상 책임에 상한이 정해져 있다',
            desc: '책임 한도를 "계약 대금 총액 이내"로 제한하지 않으면, 소액 프로젝트로 거액을 배상하게 될 수 있습니다.',
            level: 'risk',
            polarity: 'required',
            rules: { any: [
              { all: ['손해배상', '한도|상한|초과하지|이내로'] },
              { all: ['책임', '제한|한도'] },
            ] },
          },
          {
            id: 'free-termination',
            title: '해지 사유와 기성 대금 정산 방법이 있다',
            desc: '발주자가 일방적으로 중단했을 때 그때까지 진행한 작업분을 받을 수 있는지가 핵심입니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['해지|해제'] },
              { all: ['기성'] },
            ] },
          },
          {
            id: 'free-penalty',
            title: '지체상금 조항이 있다면 비율과 상한을 확인했다',
            desc: '하루당 요율과 총 상한을 확인하세요. 상한이 없으면 대금 전액을 넘는 배상이 발생할 수 있습니다.',
            level: 'risk',
            polarity: 'review',
            rules: { any: [
              { all: ['지체상금'] },
              { all: ['지체', '배상|위약'] },
            ] },
          },
        ],
      },
    ],
  },

  {
    id: 'general',
    name: '계약서 공통 기본',
    icon: '📄',
    summary: '어떤 계약이든 서명 전에 확인해야 하는 공통 항목입니다. 유형을 모르겠으면 이걸로 먼저 돌려보세요.',
    sections: [
      {
        name: '당사자와 형식',
        items: [
          {
            id: 'gen-party',
            title: '계약 당사자의 이름·주소가 적혀 있다',
            desc: '법인이라면 법인등기부상 상호, 대표자, 사업자등록번호를 확인하세요. 상대방이 실제로 계약을 체결할 권한이 있는지도 중요합니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['성명|상호|법인명', '주소|소재지'] },
              { all: ['사업자등록번호'] },
              { all: ['갑', '을'] },
            ] },
          },
          {
            id: 'gen-agent',
            title: '대리인이 등장한다면 위임 관계를 확인했다',
            desc: '인감증명서가 첨부된 위임장을 받고, 가능하면 본인에게 직접 확인 전화를 하세요.',
            level: 'must',
            polarity: 'review',
            rules: { any: [
              { all: ['대리인'] },
              { all: ['위임장|위임받'] },
            ] },
          },
          {
            id: 'gen-copy',
            title: '계약서를 2부 작성해 각자 보관한다는 내용이 있다',
            desc: '서명·날인이 완료된 원본을 각자 1부씩 보관하는 것이 원칙입니다.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['각1부|1부씩|2부를작성|2통을작성|각각1통'] },
              { all: ['날인', '보관'] },
            ] },
          },
          {
            id: 'gen-pages',
            title: '모든 장에 간인 또는 서명이 되어 있다',
            desc: '여러 장짜리 계약서는 간인이 없으면 중간 페이지가 바뀌어도 알기 어렵습니다.',
            level: 'good',
            manualOnly: true,
          },
        ],
      },
      {
        name: '핵심 조항',
        items: [
          {
            id: 'gen-term',
            title: '계약 기간이 적혀 있다',
            desc: '시작일과 종료일이 명확한지 확인하세요.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['계약기간'] },
              { all: ['존속기간'] },
              { all: ['유효기간'] },
            ] },
          },
          {
            id: 'gen-autorenew',
            title: '자동갱신 조항이 있다면 해지 통지 기한을 확인했다',
            desc: '자동갱신 조항이 있다면 해지 통지 기한(예: 만료 30일 전)을 반드시 기억해두세요. 놓치면 원치 않게 1년이 연장됩니다.',
            level: 'must',
            polarity: 'review',
            rules: { any: [
              { all: ['자동갱신|자동으로갱신|자동연장'] },
              { all: ['갱신', '이의|통지'] },
            ] },
          },
          {
            id: 'gen-terminate',
            title: '해지 사유와 절차가 규정되어 있다',
            desc: '어느 한쪽만 자유롭게 해지할 수 있는 구조인지 확인하세요.',
            level: 'must',
            polarity: 'required',
            rules: { any: [
              { all: ['해지'] },
              { all: ['해제'] },
            ] },
          },
          {
            id: 'gen-dispute',
            title: '관할 법원이나 분쟁 해결 방법이 적혀 있다',
            desc: '상대방 소재지 법원으로만 관할이 정해져 있으면 분쟁 시 비용 부담이 커집니다.',
            level: 'good',
            polarity: 'required',
            rules: { any: [
              { all: ['관할'] },
              { all: ['준거법'] },
              { all: ['중재'] },
            ] },
          },
          {
            id: 'gen-attachment',
            title: '별첨·부속 문서가 실제로 첨부되어 있다',
            desc: '"별지 1에 따른다"고 하면서 별지가 없는 계약서가 의외로 많습니다.',
            level: 'good',
            polarity: 'review',
            rules: { any: [
              { all: ['별지|별첨|부속합의|첨부문서'] },
            ] },
          },
          {
            id: 'gen-confidential',
            title: '비밀유지 의무의 범위와 기간을 확인했다',
            desc: '기간 제한 없이 무기한 비밀유지를 요구하거나, 위반 시 과도한 배상을 정한 조항인지 살펴보세요.',
            level: 'good',
            polarity: 'review',
            rules: { any: [
              { all: ['비밀유지'] },
              { all: ['기밀', '유지|누설'] },
            ] },
          },
        ],
      },
      {
        name: '⚠️ 서명 전 마지막 확인 (직접 확인)',
        items: [
          {
            id: 'gen-blank',
            title: '빈칸이 남아 있지 않다',
            desc: '금액·날짜·기간 칸이 비어 있는 상태로 서명하지 마세요.',
            level: 'risk',
            manualOnly: true,
          },
          {
            id: 'gen-verbal',
            title: '구두로 약속받은 내용이 계약서에 반영되어 있다',
            desc: '"그건 나중에 알아서 해드릴게요"라는 말은 계약서에 없으면 없는 것입니다.',
            level: 'risk',
            manualOnly: true,
          },
          {
            id: 'gen-rush',
            title: '충분히 검토할 시간을 가졌다',
            desc: '오늘 안에 서명하라고 재촉하는 것은 그 자체로 위험 신호입니다. 검토 시간을 요구하는 것은 정당한 권리입니다.',
            level: 'risk',
            manualOnly: true,
          },
          {
            id: 'gen-expert',
            title: '금액이 크거나 복잡하면 전문가에게 검토받았다',
            desc: '변호사, 공인중개사, 노무사 등 해당 분야 전문가의 검토 비용은 분쟁 비용보다 훨씬 저렴합니다.',
            level: 'good',
            manualOnly: true,
          },
        ],
      },
    ],
  },
];

const LEVEL_META = {
  must: { label: '필수', className: 'level-must' },
  good: { label: '권장', className: 'level-good' },
  risk: { label: '위험', className: 'level-risk' },
};

/** 자동 판정 결과 상태 표시 */
const STATUS_META = {
  ok:      { label: '확인됨',    className: 'st-ok' },
  missing: { label: '못 찾음',   className: 'st-missing' },
  danger:  { label: '위험 발견', className: 'st-danger' },
  review:  { label: '직접 확인', className: 'st-review' },
  manual:  { label: '수동 확인', className: 'st-manual' },
};
