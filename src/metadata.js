export const PERIOD_GROUPS = {
  pre1990: {
    id: "1973_1989",
    start_year: 1973,
    end_year: 1989,
  },
  post1990: {
    id: "1990_latest",
    start_year: 1990,
    end_year: null,
  },
};

const STATION_CATALOG = {
  90: "속초",
  100: "대관령",
  101: "춘천",
  105: "강릉",
  108: "서울",
  112: "인천",
  114: "원주",
  119: "수원",
  127: "충주",
  129: "서산",
  130: "울진",
  131: "청주",
  133: "대전",
  135: "추풍령",
  136: "안동",
  138: "포항",
  140: "군산",
  143: "대구",
  146: "전주",
  152: "울산",
  155: "창원",
  156: "광주",
  159: "부산",
  162: "통영",
  165: "목포",
  168: "여수",
  170: "완도",
  184: "제주",
  185: "고산",
  188: "성산",
  189: "서귀포",
  192: "진주",
  201: "강화",
  202: "양평",
  203: "이천",
  211: "인제",
  212: "홍천",
  216: "태백",
  221: "제천",
  226: "보은",
  232: "천안",
  235: "보령",
  236: "부여",
  238: "금산",
  243: "부안",
  244: "임실",
  245: "정읍",
  247: "남원",
  248: "장수",
  260: "장흥",
  261: "해남",
  262: "고흥",
  271: "봉화",
  272: "영주",
  273: "문경",
  277: "영덕",
  278: "의성",
  279: "구미",
  281: "영천",
  284: "거창",
  285: "합천",
  288: "밀양",
  289: "산청",
  294: "거제",
  295: "남해",
  95: "철원",
};

const BASE_REGION_STATIONS = {
  [PERIOD_GROUPS.pre1990.id]: {
    "서울-인천-경기도": [108, 112, 119, 201, 202, 203],
    "강원도 영동": [90, 105, 100],
    "강원도 영서": [211, 101, 212, 114],
    "충청북도": [131, 127, 226, 135, 221],
    "대전-세종-충청남도": [133, 232, 129, 235, 236, 238],
    "대구-경상북도": [143, 281, 138, 279, 278, 273, 272, 277, 130],
    "부산-울산-경상남도": [159, 152, 284, 285, 289, 288, 295, 192, 162, 294],
    "전라북도": [146, 243, 245, 140, 247, 244],
    "광주-전라남도": [156, 165, 261, 260, 170, 262, 168],
    "제주": [184, 189],
  },
  [PERIOD_GROUPS.post1990.id]: {
    "서울-인천-경기도": [108, 112, 119, 201, 202, 203],
    "강원도 영동": [90, 105, 100, 216],
    "강원도 영서": [211, 95, 101, 212, 114],
    "충청북도": [131, 127, 226, 135, 221],
    "대전-세종-충청남도": [133, 232, 129, 235, 236, 238],
    "대구-경상북도": [143, 281, 138, 279, 278, 136, 273, 272, 277, 130, 271],
    "부산-울산-경상남도": [159, 152, 284, 285, 289, 288, 295, 192, 155, 162, 294],
    "전라북도": [146, 243, 245, 140, 247, 244, 248],
    "광주-전라남도": [156, 165, 261, 260, 170, 262, 168],
    "제주": [184, 185, 188, 189],
  },
};

export const COMPOSITE_REGION_COMPONENTS = {
  강원도: ["강원도 영동", "강원도 영서"],
  중부지역: [
    "서울-인천-경기도",
    "강원도 영동",
    "강원도 영서",
    "충청북도",
    "대전-세종-충청남도",
  ],
  남부지역: [
    "대구-경상북도",
    "부산-울산-경상남도",
    "전라북도",
    "광주-전라남도",
  ],
  남한: [
    "서울-인천-경기도",
    "강원도 영동",
    "강원도 영서",
    "충청북도",
    "대전-세종-충청남도",
    "대구-경상북도",
    "부산-울산-경상남도",
    "전라북도",
    "광주-전라남도",
  ],
};

export const STATION_RECORDS = Object.entries(BASE_REGION_STATIONS).flatMap(
  ([periodGroup, regions]) =>
    Object.entries(regions).flatMap(([regionName, stationIds]) =>
      stationIds.map((stationId) => ({
        period_group: periodGroup,
        region_name: regionName,
        station_id: stationId,
        station_name: STATION_CATALOG[stationId],
        is_composite_region_source: true,
      })),
    ),
);

export function getPeriodGroupForYear(year) {
  return year <= PERIOD_GROUPS.pre1990.end_year
    ? PERIOD_GROUPS.pre1990.id
    : PERIOD_GROUPS.post1990.id;
}

function buildRegionDefinitions(periodGroup) {
  const baseRegions = BASE_REGION_STATIONS[periodGroup];
  const definitions = new Map();

  for (const [regionName, stationIds] of Object.entries(baseRegions)) {
    definitions.set(regionName, {
      region_name: regionName,
      period_group: periodGroup,
      kind: "base",
      station_ids: [...stationIds],
      source_regions: [regionName],
    });
  }

  for (const [regionName, componentRegions] of Object.entries(
    COMPOSITE_REGION_COMPONENTS,
  )) {
    const stationIds = componentRegions.flatMap(
      (componentRegion) => baseRegions[componentRegion] ?? [],
    );
    definitions.set(regionName, {
      region_name: regionName,
      period_group: periodGroup,
      kind: "composite",
      station_ids: [...new Set(stationIds)],
      source_regions: [...componentRegions],
    });
  }

  return definitions;
}

const REGION_DEFINITIONS = {
  [PERIOD_GROUPS.pre1990.id]: buildRegionDefinitions(PERIOD_GROUPS.pre1990.id),
  [PERIOD_GROUPS.post1990.id]: buildRegionDefinitions(PERIOD_GROUPS.post1990.id),
};

export function getRegionDefinitionsForPeriodGroup(periodGroup) {
  return REGION_DEFINITIONS[periodGroup];
}

export function getAllStationIds() {
  return [...new Set(STATION_RECORDS.map((record) => record.station_id))].sort(
    (left, right) => left - right,
  );
}
