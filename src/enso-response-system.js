import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { readCsv } from "./csv.js";

const PHASES = ["El Nino", "Neutral", "La Nina"];
const COMBINED_DOCUMENT_ORDER = [
  "response_system_index.md",
  "evidence_registry.md",
  "question_answer_matrix.md",
  "enso_public_communication_guide.md",
  "2026_summer_enso_korea_objective_response.md",
  "monthly_effect_table.md",
  "seasonal_effect_table.md",
  "active_season_year_table.md",
  "lifecycle_effect_table.md",
  "climate_factor_modifier_table.md",
  "analog_year_cards.md",
  "changma_typhoon_reference.md",
];
const PHASE_LABELS = {
  "El Nino": "엘니뇨",
  Neutral: "중립",
  "La Nina": "라니냐",
};
const LIFECYCLE_LABELS = {
  Development: "발달기",
  Decay: "소멸기",
};

const MONTH_NAMES = {
  1: "1월",
  2: "2월",
  3: "3월",
  4: "4월",
  5: "5월",
  6: "6월",
  7: "7월",
  8: "8월",
  9: "9월",
  10: "10월",
  11: "11월",
  12: "12월",
};

const DEFAULT_STATION_POLICY =
  "기존 적용값 유지. 1973~1989년은 제주 제외 본토 56개 대표지점, 1990년 이후는 제주 제외 본토 62개 대표지점, 평년은 1991~2020 고정 평년.";

function numeric(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : null;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return "";
  }
  const factor = 10 ** digits;
  return Math.round((value + 1e-10) * factor) / factor;
}

function format(value, digits = 1, suffix = "") {
  if (!Number.isFinite(value)) {
    return "";
  }
  return `${round(value, digits).toFixed(digits)}${suffix}`;
}

function signedFormat(value, digits = 1, suffix = "") {
  if (!Number.isFinite(value)) {
    return "";
  }
  const rounded = round(value, digits);
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(digits)}${suffix}`;
}

function markdownTable(rows, fields) {
  const lines = [
    `| ${fields.map((field) => field.label).join(" | ")} |`,
    `| ${fields.map(() => "---").join(" | ")} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${fields.map((field) => row[field.key] ?? "").join(" | ")} |`);
  }
  return lines.join("\n");
}

function demoteMarkdownHeadings(content) {
  return content.trim().replace(/^(#{1,5})\s/gmu, "$1# ");
}

function confidenceFromCount(count) {
  if (count >= 30) return "높음";
  if (count >= 15) return "중간";
  if (count >= 8) return "낮음";
  return "매우 낮음";
}

function precipitationSignal(row) {
  const ratio = numeric(row.precip_ratio_pct);
  const wet = numeric(row.precip_wet_pct);
  const dry = numeric(row.precip_dry_pct);
  if (ratio === null) return "자료 부족";
  if (ratio >= 110 || wet - dry >= 15) return "다우 쪽";
  if (ratio <= 90 || dry - wet >= 15) return "소우 쪽";
  return "뚜렷하지 않음";
}

function temperatureSignal(row) {
  const departure = numeric(row.tavg_departure_mean);
  const high = numeric(row.tavg_high_pct);
  const low = numeric(row.tavg_low_pct);
  if (departure === null) return "자료 부족";
  if (departure >= 0.3 || high - low >= 15) return "고온 쪽";
  if (departure <= -0.3 || low - high >= 15) return "저온 쪽";
  return "뚜렷하지 않음";
}

function hasPrimaryOniSignal(row) {
  if ("oni_development_full" in row || "oni_summer_transition" in row) {
    return isOniDevelopmentFull(row) || isOniSummerTransition(row);
  }
  return /(^|;\s*)ONI\s/u.test(row.onset_proxy ?? "");
}

function flagEnabled(row, key) {
  return String(row[key] ?? "").toUpperCase() === "Y";
}

function isOniDevelopmentFull(row) {
  if ("oni_development_full" in row) {
    return flagEnabled(row, "oni_development_full");
  }
  return /(^|;\s*)ONI\s/u.test(row.onset_proxy ?? "");
}

function isOniSummerTransition(row) {
  if ("oni_summer_transition" in row) {
    return flagEnabled(row, "oni_summer_transition");
  }
  return /(^|;\s*)ONI\s/u.test(row.onset_proxy ?? "");
}

function isRoniAuxiliary(row) {
  if ("roni_auxiliary" in row) {
    return flagEnabled(row, "roni_auxiliary");
  }
  return /(^|;\s*)RONI\s/u.test(row.onset_proxy ?? "");
}

function analogDistance(row) {
  return (
    numeric(row.transition_distance_to_2026) ??
    numeric(row.distance_to_2026) ??
    numeric(row.high_latitude_distance)
  );
}

function sortAnalogRowsRecent(rows) {
  return [...rows].sort((left, right) => (numeric(right.year) ?? 0) - (numeric(left.year) ?? 0));
}

function analogFactorSummary(row) {
  const parts = [];
  if (numeric(row.ao_jfm) !== null) parts.push(`AO ${format(numeric(row.ao_jfm), 2)}`);
  if (numeric(row.nao_jfm) !== null) parts.push(`NAO ${format(numeric(row.nao_jfm), 2)}`);
  if (numeric(row.arctic_jfm_z) !== null) {
    parts.push(`해빙 z ${format(numeric(row.arctic_jfm_z), 2)}`);
  }
  return parts.join(", ");
}

function sortMonthRows(rows) {
  return [...rows].sort((left, right) => {
    const leftMonth = numeric(left.month) ?? 0;
    const rightMonth = numeric(right.month) ?? 0;
    if (leftMonth !== rightMonth) return leftMonth - rightMonth;
    return PHASES.indexOf(left.phase) - PHASES.indexOf(right.phase);
  });
}

function sortSeasonRows(rows) {
  const order = { DJF: 0, MAM: 1, JJA: 2, SON: 3 };
  return [...rows].sort((left, right) => {
    const seasonDiff = (order[left.season] ?? 9) - (order[right.season] ?? 9);
    if (seasonDiff !== 0) return seasonDiff;
    return PHASES.indexOf(left.phase) - PHASES.indexOf(right.phase);
  });
}

function sortLifecycleRows(rows) {
  const seasonOrder = { DJF: 0, MAM: 1, JJA: 2, SON: 3 };
  const lifecycleOrder = { Development: 0, Decay: 1 };
  return [...rows].sort((left, right) => {
    const phaseDiff = PHASES.indexOf(left.phase) - PHASES.indexOf(right.phase);
    if (phaseDiff !== 0) return phaseDiff;
    const stageDiff =
      (lifecycleOrder[left.lifecycle_stage] ?? 9) -
      (lifecycleOrder[right.lifecycle_stage] ?? 9);
    if (stageDiff !== 0) return stageDiff;
    return (seasonOrder[left.season] ?? 9) - (seasonOrder[right.season] ?? 9);
  });
}

function sortActiveSeasonRows(rows) {
  const seasonOrder = { DJF: 0, MAM: 1, JJA: 2, SON: 3 };
  return [...rows].sort((left, right) => {
    const yearDiff = (numeric(right.year) ?? 0) - (numeric(left.year) ?? 0);
    if (yearDiff !== 0) return yearDiff;
    return (seasonOrder[left.season] ?? 9) - (seasonOrder[right.season] ?? 9);
  });
}

function buildMonthlyEffectTable(monthRows) {
  const rows = sortMonthRows(monthRows).map((row) => {
    const count = numeric(row.n) ?? 0;
    return {
      month: MONTH_NAMES[row.month] ?? `${row.month}월`,
      phase: PHASE_LABELS[row.phase] ?? row.phase,
      n: count,
      tavg_departure: signedFormat(numeric(row.tavg_departure_mean), 1, "°C"),
      tavg_high_pct: format(numeric(row.tavg_high_pct), 0, "%"),
      precip_ratio: format(numeric(row.precip_ratio_pct), 0, "%"),
      precip_wet_pct: format(numeric(row.precip_wet_pct), 0, "%"),
      temp_signal: temperatureSignal(row),
      precip_signal: precipitationSignal(row),
      confidence: confidenceFromCount(count),
    };
  });

  return [
    "# ONI 기준 월별 기온·강수 영향표",
    "",
    "- 기본 지표는 ONI입니다.",
    "- RONI는 이 표의 phase 판정에 쓰지 않습니다.",
    "- 기온은 남한 평균기온 평년편차, 강수는 남한 월강수량 평년비와 다우 비율을 함께 봅니다.",
    "",
    markdownTable(rows, [
      { key: "month", label: "월" },
      { key: "phase", label: "ONI 위상" },
      { key: "n", label: "표본" },
      { key: "tavg_departure", label: "평균기온 편차" },
      { key: "tavg_high_pct", label: "고온 비율" },
      { key: "precip_ratio", label: "강수 평년비" },
      { key: "precip_wet_pct", label: "다우 비율" },
      { key: "temp_signal", label: "기온 신호" },
      { key: "precip_signal", label: "강수 신호" },
      { key: "confidence", label: "신뢰도" },
    ]),
    "",
    "## 해석 규칙",
    "",
    "- 표본이 작거나 강수 부호가 엇갈리면 평균값만으로 단정하지 않습니다.",
    "- 월별 영향이 전체 평균보다 중요합니다.",
  ].join("\n");
}

function buildSeasonalEffectTable(seasonRows, seasonMonthSampleRows = []) {
  const rows = sortSeasonRows(seasonRows).map((row) => {
    const count = numeric(row.n) ?? 0;
    return {
      season: row.season,
      phase: PHASE_LABELS[row.phase] ?? row.phase,
      n: count,
      tavg_departure: signedFormat(numeric(row.tavg_departure_mean), 1, "°C"),
      tavg_high_pct: format(numeric(row.tavg_high_pct), 0, "%"),
      precip_departure: signedFormat(numeric(row.precip_departure_mean), 1, "mm"),
      precip_ratio: format(numeric(row.precip_ratio_pct), 0, "%"),
      precip_wet_pct: format(numeric(row.precip_wet_pct), 0, "%"),
      temp_signal: temperatureSignal(row),
      precip_signal: precipitationSignal(row),
      confidence: confidenceFromCount(count),
    };
  });

  return [
    "# ONI 기준 계절연도별 기온·강수 영향표",
    "",
    "- 기본 지표는 ONI입니다.",
    "- 남한 평균자료와 1991~2020 고정 평년을 그대로 사용합니다.",
    "- 이 표의 표본은 3개월이 모두 있는 완전한 계절연도입니다. JJA는 한 해의 6~8월을 합산·평균한 1개 여름입니다.",
    "",
    markdownTable(rows, [
      { key: "season", label: "계절" },
      { key: "phase", label: "ONI 위상" },
      { key: "n", label: "표본(계절연도)" },
      { key: "tavg_departure", label: "평균기온 편차" },
      { key: "tavg_high_pct", label: "고온 비율" },
      { key: "precip_departure", label: "강수 편차" },
      { key: "precip_ratio", label: "강수 평년비" },
      { key: "precip_wet_pct", label: "다우 비율" },
      { key: "temp_signal", label: "기온 신호" },
      { key: "precip_signal", label: "강수 신호" },
      { key: "confidence", label: "신뢰도" },
    ]),
    "",
    "## 여름 해석",
    "",
    "- JJA 평균만 보지 않고 6월, 7월, 8월을 따로 확인합니다.",
    "- 강수량은 장마전선, 저기압, 태풍 수증기 유입에 민감하므로 계절 평균과 집중호우 위험을 분리합니다.",
    "",
    "## 진단용 계절 월표본",
    "",
    "- 아래 표는 월별 행을 계절명으로 묶은 보조 진단표입니다. JJA n은 여름 수가 아니라 6월·7월·8월 월별 표본 수입니다.",
    seasonMonthSampleRows.length > 0
      ? markdownTable(
          sortSeasonRows(seasonMonthSampleRows).map((row) => ({
            season: row.season,
            phase: PHASE_LABELS[row.phase] ?? row.phase,
            n: row.n,
            tavg_departure: signedFormat(numeric(row.tavg_departure_mean), 1, "°C"),
            precip_ratio: format(numeric(row.precip_ratio_pct), 0, "%"),
          })),
          [
            { key: "season", label: "계절" },
            { key: "phase", label: "ONI 위상" },
            { key: "n", label: "표본(월)" },
            { key: "tavg_departure", label: "평균기온 편차" },
            { key: "precip_ratio", label: "강수 평년비" },
          ],
        )
      : "진단용 월표본 파일이 없습니다.",
  ].join("\n");
}

function buildLifecycleEffectTable(lifecycleRows = []) {
  const rows = sortLifecycleRows(lifecycleRows).map((row) => {
    const count = numeric(row.n) ?? 0;
    return {
      phase: PHASE_LABELS[row.phase] ?? row.phase,
      lifecycle_stage: LIFECYCLE_LABELS[row.lifecycle_stage] ?? row.lifecycle_stage,
      season: row.season,
      n: count,
      tavg_departure: signedFormat(numeric(row.tavg_departure_mean), 1, "°C"),
      tavg_high_pct: format(numeric(row.tavg_high_pct), 0, "%"),
      precip_departure: signedFormat(numeric(row.precip_departure_mean), 1, "mm"),
      precip_ratio: format(numeric(row.precip_ratio_pct), 0, "%"),
      temp_signal: temperatureSignal(row),
      precip_signal: precipitationSignal(row),
      confidence: confidenceFromCount(count),
    };
  });

  const interpretationRows = [
    {
      item: "엘니뇨 발달기",
      use: "해수온이 엘니뇨 정점으로 강화되는 구간. 여름 발달 질문과 초기 대외 설명에 우선 확인.",
      caution: "발달기라는 이유만으로 한반도 여름 고온·다우·태풍 증가를 단정하지 않음.",
    },
    {
      item: "엘니뇨 소멸기",
      use: "정점 이후 약화되는 구간. 다음 봄·여름 영향 질문에서 잔류 대기반응과 월별 통계를 분리.",
      caution: "소멸기에도 AO, 북태평양고기압, 장마전선, 태풍 경로가 결과를 바꿀 수 있음.",
    },
    {
      item: "라니냐 발달기",
      use: "해수온이 라니냐 저점으로 강화되는 구간. 가을·겨울 한파/건조 질문에서 보조 확인.",
      caution: "라니냐 발달만으로 겨울 한파·건조·폭설을 확정하지 않음.",
    },
    {
      item: "라니냐 소멸기",
      use: "저점 이후 약화되는 구간. 봄철 저온·강수, 여름 장마·태풍 질문에서 별도 확인.",
      caution: "소멸기 효과는 표본이 작아 월별·계절별 반대사례를 반드시 같이 제시.",
    },
  ];

  return [
    "# ONI 발달기·소멸기별 기온·강수 영향표",
    "",
    "- 기본 지표는 ONI입니다.",
    "- 발달기·소멸기는 공식 ONI episode 안에서만 나눕니다.",
    "- El Nino는 episode 시작부터 첫 번째 ONI 최댓값까지를 발달기, 이후 종료까지를 소멸기로 둡니다.",
    "- La Nina는 episode 시작부터 첫 번째 ONI 최솟값까지를 발달기, 이후 종료까지를 소멸기로 둡니다.",
    "- 정점 또는 저점 계절은 발달기에 포함합니다.",
    "- 표본이 작으므로 이 표는 위상별 월별·계절별 표를 대체하지 않고, 발달/소멸 질문에 대한 보조 판단표로 사용합니다.",
    "- 표에 없는 위상·단계·계절 조합은 완전한 계절연도 표본이 없어 제시하지 않습니다.",
    "",
    rows.length > 0
      ? markdownTable(rows, [
          { key: "phase", label: "ONI 위상" },
          { key: "lifecycle_stage", label: "단계" },
          { key: "season", label: "계절" },
          { key: "n", label: "표본(계절연도)" },
          { key: "tavg_departure", label: "평균기온 편차" },
          { key: "tavg_high_pct", label: "고온 비율" },
          { key: "precip_departure", label: "강수 편차" },
          { key: "precip_ratio", label: "강수 평년비" },
          { key: "temp_signal", label: "기온 신호" },
          { key: "precip_signal", label: "강수 신호" },
          { key: "confidence", label: "신뢰도" },
        ])
      : "발달기·소멸기 산출 파일이 없습니다.",
    "",
    "## 해석 순서",
    "",
    markdownTable(interpretationRows, [
      { key: "item", label: "단계" },
      { key: "use", label: "사용법" },
      { key: "caution", label: "주의" },
    ]),
  ].join("\n");
}

function buildActiveSeasonYearTable(activeSeasonRows = []) {
  const targetRows = sortActiveSeasonRows(activeSeasonRows)
    .filter((row) => ["DJF", "JJA"].includes(row.season))
    .map((row) => ({
      year: row.year,
      season: row.season,
      phase: PHASE_LABELS[row.phase] ?? row.phase,
      lifecycle_stage: LIFECYCLE_LABELS[row.lifecycle_stage] ?? row.lifecycle_stage,
      oni: signedFormat(numeric(row.oni), 1, "°C"),
      tavg_departure: signedFormat(numeric(row.tavg_departure), 1, "°C"),
      tavg_sign: row.tavg_sign,
      precip_ratio: format(numeric(row.precip_ratio_pct), 0, "%"),
      precip_sign: row.precip_sign,
    }));

  const summerRows = targetRows.filter((row) => row.season === "JJA");
  const winterRows = targetRows.filter((row) => row.season === "DJF");
  const fields = [
    { key: "year", label: "연도" },
    { key: "phase", label: "ONI 위상" },
    { key: "lifecycle_stage", label: "단계" },
    { key: "oni", label: "중심 ONI" },
    { key: "tavg_departure", label: "기온편차" },
    { key: "tavg_sign", label: "기온 부호" },
    { key: "precip_ratio", label: "강수 평년비" },
    { key: "precip_sign", label: "강수 부호" },
  ];

  return [
    "# ONI 영향 계절연도 상세표",
    "",
    "- 이 표는 episode 시작연도가 아니라 해당 계절 자체가 ONI El Nino 또는 La Nina phase였는지를 기준으로 합니다.",
    "- 여름·겨울 영향 질문에는 이 표를 우선 확인합니다.",
    "- ONI 발달해 표는 ENSO가 새로 시작되는 해를 보는 표이고, 이 표는 실제 JJA/DJF가 ENSO 위상 안에 있었는지를 보는 표입니다.",
    "- 따라서 1987년처럼 전년부터 이어진 엘니뇨 해와 2022년처럼 전년부터 이어진 라니냐 해도 포함합니다.",
    "",
    "## 여름 JJA 영향연도",
    "",
    summerRows.length > 0 ? markdownTable(summerRows, fields) : "JJA 영향연도 표본이 없습니다.",
    "",
    "## 겨울 DJF 영향연도",
    "",
    winterRows.length > 0 ? markdownTable(winterRows, fields) : "DJF 영향연도 표본이 없습니다.",
    "",
    "## 사용 원칙",
    "",
    "- '올여름/이번 겨울 ENSO 영향은?' 질문에는 활성 계절연도 표를 우선 사용합니다.",
    "- '올해 ENSO가 발달한다면?' 질문에는 ONI 발달해 표를 함께 사용합니다.",
    "- '발달기인가 소멸기인가?' 질문에는 lifecycle_effect_table.md를 함께 사용합니다.",
  ].join("\n");
}

function extractContextValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = text.match(new RegExp(`\\| ${escaped} \\| ([^|]+) \\|`, "u"));
  return match?.[1]?.trim() ?? "기존 요약자료에서 자동 추출 실패";
}

function buildClimateFactorModifierTable(contextText, analogRows) {
  const currentRows = [
    {
      factor: "AO",
      current: extractContextValue(contextText, "AO 월평균"),
      role: "겨울~봄 고위도 순환 배경. 음/양 전환이 큰 해는 여름 유사해 판단에서 별도 표시.",
      effect: "ONI 결론을 직접 대체하지 않고 유사해 우선순위를 보정",
    },
    {
      factor: "NAO",
      current: extractContextValue(contextText, "AO/NAO"),
      role: "북대서양-유라시아 파동 배경. AO와 함께 고위도 순환의 보조 신호로 사용.",
      effect: "AO와 같은 방향이면 보정 신뢰도 상승, 다르면 보수적으로 해석",
    },
    {
      factor: "북극·바렌츠·카라 해빙",
      current:
        extractContextValue(contextText, "북극·카라바렌츠 해빙") ||
        extractContextValue(contextText, "북극 해빙"),
      role: "봄철 고위도 열적 배경. 북극 전체와 바렌츠/카라를 분리해서 본다.",
      effect: "저해빙 유사해가 고온·소우/다우로 갈라지면 단정 금지",
    },
    {
      factor: "유라시아 눈덮임",
      current: extractContextValue(contextText, "유라시아 눈덮임"),
      role: "봄철 대륙 가열과 제트/순환장의 간접 보조 인자.",
      effect: "원시 시계열이 없는 경우 기존 요약값만 쓰고 낮은 가중치 적용",
    },
  ];

  const analogFactorRows = analogRows
    .filter(isOniDevelopmentFull)
    .slice(0, 8)
    .map((row) => ({
      year: row.year,
      onset: row.oni_episode_start || row.onset_proxy,
      distance: format(analogDistance(row), 2),
      ao_jfm: format(numeric(row.ao_jfm), 2),
      nao_jfm: format(numeric(row.nao_jfm), 2),
      arctic_z: format(numeric(row.arctic_jfm_z), 2),
      barents_z: format(numeric(row.barents_jfm_z), 2),
      kara_z: format(numeric(row.kara_jfm_z), 2),
      summer: `${signedFormat(numeric(row.jja_tavg_dep), 1, "°C")} / ${format(
        numeric(row.jja_precip_ratio),
        0,
        "%",
      )}`,
    }));

  return [
    "# ONI 해석 보정용 기후인자 표",
    "",
    "- ONI를 먼저 적용하고, 아래 인자는 결론의 강도와 유사해 우선순위를 보정합니다.",
    "- RONI는 이 보정표의 가중치에 넣지 않습니다.",
    "",
    "## 현재 감시 인자",
    "",
    markdownTable(currentRows, [
      { key: "factor", label: "인자" },
      { key: "current", label: "현재 요약" },
      { key: "role", label: "사용 목적" },
      { key: "effect", label: "ONI 해석에서의 역할" },
    ]),
    "",
    "## ONI 유사해의 고위도 보조지표",
    "",
    markdownTable(analogFactorRows, [
      { key: "year", label: "연도" },
      { key: "onset", label: "ONI 전환 근거" },
      { key: "distance", label: "2026 유사도" },
      { key: "ao_jfm", label: "AO JFM" },
      { key: "nao_jfm", label: "NAO JFM" },
      { key: "arctic_z", label: "북극 해빙 z" },
      { key: "barents_z", label: "바렌츠 z" },
      { key: "kara_z", label: "카라 z" },
      { key: "summer", label: "JJA 기온/강수" },
    ]),
  ].join("\n");
}

function buildEvidenceRegistry(stationPolicy) {
  const rows = [
    {
      item: "ONI",
      role: "기본 ENSO 판정",
      source: "NOAA/CPC ONI v5",
      rule: "+0.5°C 이상 또는 -0.5°C 이하가 5개 이상 연속된 episode를 phase로 사용",
    },
    {
      item: "ONI 발달해 전체",
      role: "유사해 기본 표본",
      source: "data/output/final/elnino_summer_2026/analog_year_metrics.csv",
      rule: "1979년 이후 ONI warm episode 시작이 AMJ~SON인 해. 판단표는 최근 연도순으로 제시.",
    },
    {
      item: "MJJ-ASO 여름 전환형",
      role: "여름 중 전환 질문의 부분집합",
      source: "data/output/final/elnino_summer_2026/analog_year_metrics.csv",
      rule: "ONI warm episode 시작이 MJJ~ASO인 해. ONI 발달해 전체를 대체하지 않고 하위 표본으로만 사용.",
    },
    {
      item: "ONI 발달기·소멸기",
      role: "episode 생애주기별 영향 보조 판단",
      source: "data/output/final/enso_analysis/enso_season_lifecycle_summary.md",
      rule: "El Nino는 첫 ONI 최댓값까지, La Nina는 첫 ONI 최솟값까지를 발달기로 두고 이후를 소멸기로 구분. 정점/저점은 발달기에 포함.",
    },
    {
      item: "ONI 영향 계절연도",
      role: "여름·겨울 계절 영향 기본 표본",
      source: "data/output/final/enso_analysis/enso_active_season_years.md",
      rule: "episode 시작연도가 아니라 해당 DJF/JJA 계절 자체가 ONI El Nino 또는 La Nina phase였는지를 기준으로 포함.",
    },
    {
      item: "RONI",
      role: "보조 확인",
      source: "NOAA/CPC RONI",
      rule: "ONI 결론의 온난화 배경 민감도 확인용. 기본 phase나 유사도 점수에는 넣지 않음",
    },
    {
      item: "남한 기온·강수",
      role: "국내 영향 산출",
      source: "data/output/final/south_korea_fixed_1991_2020_comparison.md",
      rule: stationPolicy,
    },
    {
      item: "기관 공식 기온·강수 전망",
      role: "제외",
      source: "KMA 등 국내외 기관 전망",
      rule: "기온·강수 영향 판단에는 사용하지 않음. 관측자료 기반 사후 비교가 필요할 때만 별도 참고.",
    },
    {
      item: "AO",
      role: "고위도 순환 보정",
      source: "NOAA/CPC AO monthly index",
      rule: "1~3월 평균, 월별 값, 겨울-봄 전환폭을 보조지표로 사용",
    },
    {
      item: "NAO",
      role: "고위도 순환 보정",
      source: "NOAA/CPC NAO monthly index",
      rule: "AO와 함께 대서양-유라시아 순환 배경을 판단",
    },
    {
      item: "해빙",
      role: "고위도 열적 배경 보정",
      source: "NSIDC Sea Ice Index",
      rule: "북극 전체, 바렌츠해, 카라해를 분리해서 사용",
    },
    {
      item: "유라시아 눈덮임",
      role: "대륙 가열·제트 보조인자",
      source: "Rutgers Global Snow Lab Eurasia SCE",
      rule: "1~3월 월별값과 봄철 주별값을 보조로 사용",
    },
    {
      item: "티벳 눈덮임",
      role: "제외",
      source: "없음",
      rule: "이번 프로젝트 범위에서는 제외",
    },
    {
      item: "장마·태풍",
      role: "별도 보정 레이어",
      source: "KMA 장마 통계, IBTrACS/KMA 태풍자료",
      rule: "ONI 직접효과로 단정하지 않고 정체전선, 북태평양고기압, 저기압, 경로를 함께 해석",
    },
  ];

  return [
    "# ENSO 대응 체계 근거 등록부",
    "",
    markdownTable(rows, [
      { key: "item", label: "항목" },
      { key: "role", label: "역할" },
      { key: "source", label: "출처" },
      { key: "rule", label: "적용 규칙" },
    ]),
  ].join("\n");
}

function buildAnalogYearCards(analogRows) {
  const fields = [
    { key: "year", label: "연도" },
    { key: "tier", label: "기준" },
    { key: "onset", label: "ONI/RONI 근거" },
    { key: "distance", label: "2026 유사도" },
    { key: "tavg", label: "JJA 평균기온" },
    { key: "tavg_signs", label: "6~8월 기온 부호" },
    { key: "precip", label: "JJA 강수량" },
    { key: "precip_signs", label: "6~8월 강수 부호" },
    { key: "factors", label: "보조 인자" },
    { key: "typhoon", label: "태풍 참고" },
  ];

  const mapAnalogRow = (row, tier) => ({
      year: row.year,
      tier,
      onset: row.onset_proxy,
      distance: format(analogDistance(row), 2),
      tavg: `${format(numeric(row.jja_tavg), 2, "°C")} (${signedFormat(
        numeric(row.jja_tavg_dep),
        1,
        "°C",
      )})`,
      tavg_signs: row.jja_tavg_month_signs ?? "",
      tmax: `${format(numeric(row.jja_tmax), 2, "°C")} (${signedFormat(
        numeric(row.jja_tmax_dep),
        1,
        "°C",
      )})`,
      precip: `${format(numeric(row.jja_precip), 1, "mm")} (${format(
        numeric(row.jja_precip_ratio),
        0,
        "%",
      )})`,
      precip_signs: row.jja_precip_month_signs ?? "",
      factors: analogFactorSummary(row),
      typhoon: row.typhoon_near_korea_count
        ? `${row.typhoon_near_korea_count}개 ${row.typhoon_reference ?? ""}`.trim()
        : "",
  });

  const developmentRows = sortAnalogRowsRecent(analogRows)
    .filter(isOniDevelopmentFull)
    .map((row) => mapAnalogRow(row, "ONI 발달해 전체"));
  const transitionRows = sortAnalogRowsRecent(analogRows)
    .filter(isOniSummerTransition)
    .map((row) => mapAnalogRow(row, "MJJ-ASO 여름 전환형"));
  const roniRows = sortAnalogRowsRecent(analogRows)
    .filter(isRoniAuxiliary)
    .map((row) =>
      mapAnalogRow(
        row,
        flagEnabled(row, "roni_only_sensitivity") ? "RONI-only 민감도" : "RONI 보조 표기",
      ),
    );

  return [
    "# ONI 중심 유사해 카드",
    "",
    "- 판단 기본 표본은 ONI 발달해 전체입니다.",
    "- MJJ-ASO 여름 전환형은 여름 중 전환 질문에만 쓰는 부분집합입니다.",
    "- RONI는 보조 민감도 확인이며 ONI 기본 표본을 대체하지 않습니다.",
    "- 표는 최근 연도순으로 정렬합니다.",
    "",
    "## ONI 발달해 전체",
    "",
    markdownTable(developmentRows, fields),
    "",
    "## MJJ-ASO 여름 전환형 부분집합",
    "",
    markdownTable(transitionRows, fields),
    "",
    "## RONI 보조 민감도",
    "",
    roniRows.length > 0 ? markdownTable(roniRows, fields) : "RONI 보조 표기 사례가 없습니다.",
  ].join("\n");
}

function rowLookup(rows, keyField, keyValue, phase) {
  return rows.find((row) => String(row[keyField]) === String(keyValue) && row.phase === phase);
}

function meanValue(rows, key) {
  const values = rows.map((row) => numeric(row[key])).filter((value) => value !== null);
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function developmentYearTemperatureRows(analogRows) {
  return sortAnalogRowsRecent(analogRows)
    .filter(isOniDevelopmentFull)
    .map((row) => ({
      year: row.year,
      onset: row.oni_episode_start || row.onset_proxy,
      tavg_departure: signedFormat(numeric(row.jja_tavg_dep), 1, "°C"),
      signs: row.jja_tavg_month_signs ?? "",
    }));
}

function developmentYearPrecipitationRows(analogRows) {
  return sortAnalogRowsRecent(analogRows)
    .filter(isOniDevelopmentFull)
    .map((row) => ({
      year: row.year,
      onset: row.oni_episode_start || row.onset_proxy,
      precip_ratio: format(numeric(row.jja_precip_ratio), 0, "%"),
      signs: row.jja_precip_month_signs ?? "",
    }));
}

function buildExampleScenarioResponse(monthRows, seasonRows, analogRows = []) {
  const jjaElNino = rowLookup(seasonRows, "season", "JJA", "El Nino");
  const sonElNino = rowLookup(seasonRows, "season", "SON", "El Nino");
  const djfElNino = rowLookup(seasonRows, "season", "DJF", "El Nino");
  const juneElNino = rowLookup(monthRows, "month", 6, "El Nino");
  const julyElNino = rowLookup(monthRows, "month", 7, "El Nino");
  const augustElNino = rowLookup(monthRows, "month", 8, "El Nino");
  const septemberElNino = rowLookup(monthRows, "month", 9, "El Nino");
  const octoberElNino = rowLookup(monthRows, "month", 10, "El Nino");
  const novemberElNino = rowLookup(monthRows, "month", 11, "El Nino");
  const decemberElNino = rowLookup(monthRows, "month", 12, "El Nino");
  const januaryElNino = rowLookup(monthRows, "month", 1, "El Nino");
  const februaryElNino = rowLookup(monthRows, "month", 2, "El Nino");
  const primaryAnalogRows = sortAnalogRowsRecent(analogRows).filter(isOniDevelopmentFull);
  const summerTransitionRows = sortAnalogRowsRecent(analogRows).filter(isOniSummerTransition);
  const analogCount = primaryAnalogRows.length;
  const transitionCount = summerTransitionRows.length;
  const analogTempMean = meanValue(primaryAnalogRows, "jja_tavg_dep");
  const analogPrecipMean = meanValue(primaryAnalogRows, "jja_precip_ratio");
  const analogHotCount = primaryAnalogRows.filter(
    (row) => (numeric(row.jja_tavg_dep) ?? 0) > 0,
  ).length;
  const analogWetCount = primaryAnalogRows.filter(
    (row) => (numeric(row.jja_precip_ratio) ?? 0) >= 110,
  ).length;
  const analogDryCount = primaryAnalogRows.filter(
    (row) => (numeric(row.jja_precip_ratio) ?? 999) <= 90,
  ).length;

  const premiseRows = [
    {
      item: "질문 시나리오",
      content:
        "2026년 4월 현재 여름철 엘니뇨 발달 가능성이 제기된 상황을 가정한다. 이 전제는 질문 조건이며, 영향 판단 점수에는 넣지 않는다.",
    },
    {
      item: "판단 자료",
      content:
        "관측된 ONI 위상별 남한 평균 기온·강수 통계, ONI 발달해 전체와 MJJ-ASO 여름 전환형 부분집합의 실제 여름 결과, AO·NAO·해빙·유라시아 눈덮임 관측값만 사용한다.",
    },
    {
      item: "제외 자료",
      content:
        "KMA 등 국내외 기관의 기온·강수 공식 전망, 3개월전망, 계절전망 확률은 기온·강수 판단 근거에서 제외한다.",
    },
  ];

  const answerRows = [
    {
      topic: "여름 기온",
      answer: "ONI 관측 통계만으로는 여름 고온이나 폭염을 단정하기 어렵다.",
      evidence: `과거 ONI 엘니뇨 JJA 계절연도는 평균기온 편차 ${signedFormat(
        numeric(jjaElNino?.tavg_departure_mean),
        1,
        "°C",
      )}, 고온 비율 ${format(numeric(jjaElNino?.tavg_high_pct), 0, "%")}. ONI 발달해 전체 ${analogCount}개 평균 JJA 기온편차는 ${signedFormat(
        analogTempMean,
        1,
        "°C",
      )}, 양의 편차 사례는 ${analogHotCount}/${analogCount}개.`,
      caution:
        "폭염은 7~8월 북태평양고기압, 고온다습 남서류, 해양열용량, 중위도 파동이 결합할 때 강화됨.",
      confidence: "중간",
    },
    {
      topic: "여름 강수",
      answer: "계절 누적 강수는 뚜렷한 다우·소우 한 방향으로 단정하지 않는다.",
      evidence: `ONI 엘니뇨 JJA 계절연도 강수 평년비는 ${format(
        numeric(jjaElNino?.precip_ratio_pct),
        0,
        "%",
      )}. 월별로는 6월 ${format(numeric(juneElNino?.precip_ratio_pct), 0, "%")}, 7월 ${format(
        numeric(julyElNino?.precip_ratio_pct),
        0,
        "%",
      )}, 8월 ${format(numeric(augustElNino?.precip_ratio_pct), 0, "%")}로 방향이 일정하지 않음. ONI 발달해 전체 평균 강수 평년비는 ${format(
        analogPrecipMean,
        0,
        "%",
      )}, 다우 사례는 ${analogWetCount}/${analogCount}개, 소우 사례는 ${analogDryCount}/${analogCount}개.`,
      caution:
        "장마전선 체류, 저기압 발달, 하층 수증기 유입, 태풍 원격 수증기 때문에 계절 강수와 단기 호우는 분리해서 설명.",
      confidence: "중간",
    },
    {
      topic: "여름 태풍",
      answer: "엘니뇨 발달이 한반도 영향태풍 증가를 바로 뜻하지 않는다.",
      evidence:
        "관측 유사사례의 한반도 500km 접근 참고값은 넓게 퍼짐. 이는 거리 기반 참고값이며 공식 영향태풍 판정을 대체하지 않음.",
      caution:
        "태풍은 개수보다 북태평양고기압 가장자리, 중위도 기압골, 전선 위치, 접근 시점의 수증기 공급이 핵심.",
      confidence: "낮음~중간",
    },
    {
      topic: "가을 영향",
      answer: "엘니뇨가 지속되면 평균적으로 가을 강수는 소우 쪽 신호가 있으나 태풍·전선 예외가 크다.",
      evidence: `ONI 엘니뇨 SON은 평균기온 편차 ${signedFormat(
        numeric(sonElNino?.tavg_departure_mean),
        1,
        "°C",
      )}, 강수 평년비 ${format(numeric(sonElNino?.precip_ratio_pct), 0, "%")}. 월별 강수는 9월 ${format(
        numeric(septemberElNino?.precip_ratio_pct),
        0,
        "%",
      )}, 10월 ${format(numeric(octoberElNino?.precip_ratio_pct), 0, "%")}, 11월 ${format(
        numeric(novemberElNino?.precip_ratio_pct),
        0,
        "%",
      )}.`,
      caution:
        "9월 소우 신호가 강하지만, 가을 태풍이나 전선성 강수가 있으면 계절 평균이 쉽게 바뀔 수 있음.",
      confidence: "중간",
    },
    {
      topic: "겨울 영향",
      answer: "엘니뇨가 겨울까지 지속되면 고온·다우 쪽 신호가 여름보다 비교적 선명하다.",
      evidence: `ONI 엘니뇨 DJF는 평균기온 편차 ${signedFormat(
        numeric(djfElNino?.tavg_departure_mean),
        1,
        "°C",
      )}, 강수 평년비 ${format(numeric(djfElNino?.precip_ratio_pct), 0, "%")}. 월별로는 12월 ${signedFormat(
        numeric(decemberElNino?.tavg_departure_mean),
        1,
        "°C",
      )}/${format(numeric(decemberElNino?.precip_ratio_pct), 0, "%")}, 1월 ${signedFormat(
        numeric(januaryElNino?.tavg_departure_mean),
        1,
        "°C",
      )}/${format(numeric(januaryElNino?.precip_ratio_pct), 0, "%")}, 2월 ${signedFormat(
        numeric(februaryElNino?.tavg_departure_mean),
        1,
        "°C",
      )}/${format(numeric(februaryElNino?.precip_ratio_pct), 0, "%")}.`,
      caution:
        "AO, 시베리아고기압, 동아시아 겨울몬순이 반대로 작동하면 월별 한파와 건조한 시기는 남을 수 있음.",
      confidence: "중간~높음",
    },
  ];
  const criteriaRows = [
    {
      criterion: "ONI 발달해 전체",
      definition: "1979년 이후 ONI warm episode 시작이 AMJ~SON인 해",
      use: "기본 유사해 판단",
      n: analogCount,
    },
    {
      criterion: "MJJ-ASO 여름 전환형",
      definition: "ONI warm episode 시작이 MJJ~ASO인 해",
      use: "여름 중 전환 질문의 부분집합",
      n: transitionCount,
    },
    {
      criterion: "RONI 보조",
      definition: "RONI onset은 민감도 표기로만 사용",
      use: "ONI 판단의 보조 확인",
      n: analogRows.filter(isRoniAuxiliary).length,
    },
  ];
  const temperatureRows = developmentYearTemperatureRows(analogRows);
  const precipitationRows = developmentYearPrecipitationRows(analogRows);

  return [
    "## 예시 답변: 2026년 4월 현재 엘니뇨 발달 가능성과 한반도 영향",
    "",
    "### 예시 질문",
    "",
    "> 2026년 4월 현재 여름철 엘니뇨가 발달한다고 하는데, 한반도 여름철 기온과 강수량, 태풍의 영향은 어떤가? 가을철과 겨울철 영향도 함께 알려달라.",
    "",
    "### 답변 요지",
    "",
    "관측자료만으로 보면, 엘니뇨 발달 가능성이 있다는 이유만으로 한반도 여름이 반드시 고온·다우·태풍 증가로 간다고 답하기 어렵습니다. 과거 ONI 기준 엘니뇨 여름 통계는 기온 고온 신호가 약하고, 강수는 6~8월 월별 방향이 엇갈립니다. 따라서 여름 기온은 폭염 단정이 아니라 북태평양고기압, 고온다습한 남서류, 해양열용량, 중위도 파동의 결합 여부를 조건부로 설명합니다. 강수량은 계절 누적 다우를 단정하지 않고, 장마전선·저기압·태풍 수증기 유입에 따른 단기 집중호우 가능성을 별도로 둡니다. 태풍도 엘니뇨 여부보다 경로와 수증기 유입 시점이 핵심입니다. 가을은 엘니뇨 지속 시 소우 쪽 신호가 있으나 태풍 예외가 크고, 겨울은 고온·다우 쪽 신호가 여름보다 비교적 선명합니다.",
    "",
    "### 예시 전제",
    "",
    markdownTable(premiseRows, [
      { key: "item", label: "항목" },
      { key: "content", label: "적용 내용" },
    ]),
    "",
    "### 기준 분리",
    "",
    markdownTable(criteriaRows, [
      { key: "criterion", label: "기준" },
      { key: "definition", label: "정의" },
      { key: "use", label: "사용" },
      { key: "n", label: "표본" },
    ]),
    "",
    "### 항목별 답변",
    "",
    markdownTable(answerRows, [
      { key: "topic", label: "항목" },
      { key: "answer", label: "판단" },
      { key: "evidence", label: "근거" },
      { key: "caution", label: "주의" },
      { key: "confidence", label: "신뢰도" },
    ]),
    "",
    "### ONI 발달해 전체: JJA 기온",
    "",
    markdownTable(temperatureRows, [
      { key: "year", label: "연도" },
      { key: "onset", label: "ONI episode 시작" },
      { key: "tavg_departure", label: "JJA 기온편차" },
      { key: "signs", label: "6~8월 기온 부호" },
    ]),
    "",
    "### ONI 발달해 전체: JJA 강수",
    "",
    markdownTable(precipitationRows, [
      { key: "year", label: "연도" },
      { key: "onset", label: "ONI episode 시작" },
      { key: "precip_ratio", label: "JJA 강수 평년비" },
      { key: "signs", label: "6~8월 강수 부호" },
    ]),
    "",
    "### 대외 설명 문구",
    "",
    "> 관측된 과거자료 기준으로는 엘니뇨 발달 가능성만으로 한반도 여름의 폭염, 다우, 태풍 증가를 단정하기 어렵습니다. ONI 기준 엘니뇨 여름은 평균기온 고온 신호가 강하지 않고, 강수량도 6월·7월·8월 방향이 같지 않았습니다. 따라서 여름 기온은 북태평양고기압과 고온다습한 남서류가 실제로 강화되는지를 함께 봐야 하며, 강수량은 계절 누적보다 장마전선 정체나 태풍 수증기 유입에 따른 단기 집중호우를 별도로 감시해야 합니다. 태풍은 개수보다 경로와 접근 시점이 중요합니다.",
    "",
    "### 예시 출처",
    "",
    "- `data/output/final/enso_analysis/enso_month_phase_summary.md`",
    "- `data/output/final/enso_analysis/enso_season_phase_summary.md`",
    "- `data/output/final/elnino_summer_2026/analog_year_metrics.csv`",
    "- `data/output/final/south_korea_fixed_1991_2020_comparison.md`",
  ].join("\n");
}

function buildQuestionAnswerMatrix(monthRows, seasonRows) {
  const jjaElNino = rowLookup(seasonRows, "season", "JJA", "El Nino");
  const juneElNino = rowLookup(monthRows, "month", 6, "El Nino");
  const julyElNino = rowLookup(monthRows, "month", 7, "El Nino");
  const augustElNino = rowLookup(monthRows, "month", 8, "El Nino");
  const djfElNino = rowLookup(seasonRows, "season", "DJF", "El Nino");
  const sonElNino = rowLookup(seasonRows, "season", "SON", "El Nino");

  const rows = [
    {
      question: "엘니뇨가 발달하면 여름에 비가 많이 오나?",
      answer: "ONI만으로는 단정하지 않는다.",
      evidence: `JJA 엘니뇨 강수 평년비 ${format(
        numeric(jjaElNino?.precip_ratio_pct),
        0,
        "%",
      )}, 6월 ${format(numeric(juneElNino?.precip_ratio_pct), 0, "%")}, 7월 ${format(
        numeric(julyElNino?.precip_ratio_pct),
        0,
        "%",
      )}, 8월 ${format(numeric(augustElNino?.precip_ratio_pct), 0, "%")}.`,
      counter: "월별 방향이 같지 않고 장마전선, 저기압, 태풍 수증기 유입의 영향이 큼.",
      confidence: "중간",
      wording:
        "엘니뇨 발달 가능성은 강수 판단의 한 근거일 뿐입니다. 여름 강수는 월별 차이가 커서 장마전선과 태풍 경로를 함께 봐야 합니다.",
    },
    {
      question: "엘니뇨가 발달하면 폭염이 오나?",
      answer: "ONI 단독으로 폭염을 설명하지 않는다.",
      evidence: `JJA 엘니뇨 평균기온 편차 ${signedFormat(
        numeric(jjaElNino?.tavg_departure_mean),
        1,
        "°C",
      )}, 고온 비율 ${format(numeric(jjaElNino?.tavg_high_pct), 0, "%")}.`,
      counter: "폭염은 북태평양고기압, 습윤 남서류, 해양열용량, 중위도 파동의 결합이 더 직접적.",
      confidence: "중간",
      wording:
        "엘니뇨라서 바로 폭염이라고 말하기는 어렵습니다. 고온 가능성은 ONI보다 북태평양고기압과 고온다습한 남서류 조건까지 결합해 설명하는 것이 안전합니다.",
    },
    {
      question: "겨울 엘니뇨는 한반도에 어떤 영향이 있나?",
      answer: "상대적으로 고온·다우 신호가 여름보다 더 선명하다.",
      evidence: `DJF 엘니뇨 평균기온 편차 ${signedFormat(
        numeric(djfElNino?.tavg_departure_mean),
        1,
        "°C",
      )}, 강수 평년비 ${format(numeric(djfElNino?.precip_ratio_pct), 0, "%")}.`,
      counter: "AO, 시베리아고기압, EAWM이 반대 방향이면 월별 한파 가능성은 남음.",
      confidence: "중간",
      wording:
        "겨울 엘니뇨는 남한 평균으로는 평년보다 온화하고 강수가 많은 쪽 신호가 비교적 뚜렷하지만, AO와 동아시아 겨울몬순 상태를 같이 봐야 합니다.",
    },
    {
      question: "가을 엘니뇨와 태풍·강수는 어떤가?",
      answer: "가을 강수는 소우 쪽 신호가 있지만 태풍 경로 예외가 크다.",
      evidence: `SON 엘니뇨 강수 평년비 ${format(
        numeric(sonElNino?.precip_ratio_pct),
        0,
        "%",
      )}, 다우 비율 ${format(numeric(sonElNino?.precip_wet_pct), 0, "%")}.`,
      counter: "태풍 접근 또는 전선성 강수가 있으면 계절 평균과 다른 사례가 생김.",
      confidence: "낮음",
      wording:
        "가을 엘니뇨는 평균적으로 소우 쪽을 시사하지만, 태풍 경로 하나로 결과가 뒤집힐 수 있어 개수보다 경로와 수증기 유입 시점을 봐야 합니다.",
    },
    {
      question: "장마는 ONI로 설명할 수 있나?",
      answer: "장마는 별도 보정 레이어로 다룬다.",
      evidence: "ONI 월별 강수 표는 참고하되, 장마 시작·종료와 정체전선 위치 자료가 직접 근거.",
      counter: "같은 ONI 위상에서도 6월과 7월 강수 신호가 달라질 수 있음.",
      confidence: "낮음",
      wording:
        "장마는 ONI 하나로 설명하지 않습니다. 정체전선 위치, 북태평양고기압 가장자리, 저기압 통과, 수증기 유입을 함께 보겠습니다.",
    },
    {
      question: "태풍은 엘니뇨 때 늘어나나?",
      answer: "한반도 영향태풍은 개수보다 경로가 핵심이다.",
      evidence: "기존 IBTrACS 유사해 표에서 한반도 500km 접근 수는 해마다 크게 달랐음.",
      counter: "IBTrACS 거리 접근은 KMA 공식 영향태풍 판정을 대체하지 않음.",
      confidence: "낮음",
      wording:
        "엘니뇨 여부보다 북서태평양 발생 위치, 북태평양고기압 가장자리, 중위도 기압골과의 상호작용이 한반도 영향 여부를 좌우합니다.",
    },
  ];

  return [
    "# ENSO 질문 대응 매트릭스",
    "",
    "- 기본 답변은 ONI 기준입니다.",
    "- RONI는 보조 확인이며, 기본 답변의 주 근거로 쓰지 않습니다.",
    "- 모든 문항은 근거와 반대근거를 함께 둡니다.",
    "",
    markdownTable(rows, [
      { key: "question", label: "질문" },
      { key: "answer", label: "짧은 답" },
      { key: "evidence", label: "근거" },
      { key: "counter", label: "반대근거/주의" },
      { key: "confidence", label: "신뢰도" },
      { key: "wording", label: "실무 답변문구" },
    ]),
  ].join("\n");
}

function buildChangmaTyphoonReference() {
  const rows = [
    {
      topic: "장마 시작·종료",
      oni_use: "ONI 월별 강수 신호는 참고자료",
      primary_factors: "정체전선 위치, 북태평양고기압 가장자리, 상층 제트, 저기압 통과",
      evidence:
        "6월과 7월 엘니뇨 강수 신호가 서로 다를 수 있으므로 장마 시작·종료일 자체는 별도 자료가 필요",
      caution: "ONI로 장마 시작일이나 종료일을 직접 판정하지 않음",
      next_data: "KMA 장마 시작·종료 통계, 장마기간 강수량",
    },
    {
      topic: "장마기간 강수량",
      oni_use: "ONI 위상별 6~7월 강수 평년비를 보조로 사용",
      primary_factors: "정체전선 체류, 하층 수증기 유입, 저기압 발달, 북태평양고기압 확장",
      evidence:
        "여름철 전체 강수 평년비와 특정 장마기간 강수는 다를 수 있음",
      caution: "계절 누적 강수량과 집중호우 위험을 분리해서 설명",
      next_data: "장마기간 일강수량, 극한강수일수, 지역별 장마 통계",
    },
    {
      topic: "태풍 발생 수",
      oni_use: "ONI는 서태평양 대류·발생 위치 배경을 보는 보조 인자",
      primary_factors: "해수면온도, MJO/BSISO, 몬순골, 연직시어",
      evidence:
        "기존 유사해 표에서 서태평양 발생 수와 한반도 영향은 같은 방향으로 모이지 않음",
      caution: "태풍 발생 수를 한반도 영향 위험으로 바로 바꾸지 않음",
      next_data: "IBTrACS 발생수, KMA 태풍 발생·영향 통계",
    },
    {
      topic: "한반도 영향태풍",
      oni_use: "ONI 유사해의 태풍 접근 사례는 참고자료",
      primary_factors: "북태평양고기압 가장자리, 중위도 기압골, 전선 위치, 태풍 구조와 진로",
      evidence:
        "현재 IBTrACS 500km 접근값은 거리 기반 참고값이며 KMA 공식 영향태풍 판정이 아님",
      caution: "개수보다 경로와 수증기 유입 시점을 중심으로 설명",
      next_data: "KMA 공식 영향태풍 목록, 진로별 강수·바람 피해 기록",
    },
    {
      topic: "집중호우",
      oni_use: "ONI 강수 신호가 약해도 위험은 유지",
      primary_factors: "대기불안정, 하층 제트, 수증기 수송, 전선 정체, 태풍 원격 수증기",
      evidence:
        "계절 전체 강수량이 평년과 비슷하거나 적어도 짧은 기간의 큰비는 가능",
      caution: "소우 전망을 집중호우 위험 낮음으로 해석하지 않음",
      next_data: "일강수 극값, 3일 누적강수, 호우특보·피해 사례",
    },
  ];

  return [
    "# 장마·태풍 별도 해석 참고표",
    "",
    "- 장마와 태풍은 ONI 직접효과가 아니라 별도 보정 레이어입니다.",
    "- 현재 체계에서는 ONI 월별·계절별 강수 표를 참고하되, 최종 설명은 정체전선, 북태평양고기압, 저기압, 태풍 경로를 함께 봅니다.",
    "- IBTrACS 거리 접근값은 KMA 공식 영향태풍 판정을 대체하지 않습니다.",
    "",
    markdownTable(rows, [
      { key: "topic", label: "항목" },
      { key: "oni_use", label: "ONI 사용법" },
      { key: "primary_factors", label: "주요 직접 인자" },
      { key: "evidence", label: "현재 근거" },
      { key: "caution", label: "주의" },
      { key: "next_data", label: "보강 자료" },
    ]),
  ].join("\n");
}

function buildPublicCommunicationGuide() {
  const statusRows = [
    {
      situation: "한 달 또는 주별 SST가 +0.5°C 부근",
      wording: "엘니뇨 쪽으로 기울고 있다",
      avoid: "엘니뇨 발생",
    },
    {
      situation: "3개월 평균이 +0.5°C 이상이나 지속성 미확인",
      wording: "엘니뇨 발달 가능성이 커졌다",
      avoid: "엘니뇨 확정",
    },
    {
      situation: "3개월 평균 +0.5°C 이상이 이어지는 중",
      wording: "엘니뇨 감시 또는 발달 단계",
      avoid: "이미 강한 엘니뇨",
    },
    {
      situation: "ONI 기준 episode 충족",
      wording: "공식 기준상 엘니뇨 상태",
      avoid: "단순 고수온",
    },
    {
      situation: "해수온은 높지만 대기 반응 약함",
      wording: "해양 신호는 있으나 대기 결합은 약하다",
      avoid: "엘니뇨 영향이 확실하다",
    },
  ];

  const responseRows = [
    {
      question: "지금 엘니뇨인가요?",
      answer:
        "공식 ONI 기준으로는 아직 확정 전인지, 이미 기준을 충족했는지 먼저 구분합니다. 확정 전이면 '엘니뇨 발달 가능성을 감시 중'이라고 답합니다.",
    },
    {
      question: "왜 바로 엘니뇨라고 말하지 않나요?",
      answer:
        "엘니뇨는 한 달 해수온만으로 선언하지 않고, 3개월 이동평균과 지속성을 확인하기 때문입니다. 공식 판정은 원래 사후 확인 성격이 있습니다.",
    },
    {
      question: "그럼 대응이 늦어지는 것 아닌가요?",
      answer:
        "공식 선언은 늦게 확정되지만 감시는 늦게 시작하지 않습니다. 해수온 상승, 대기 반응, 무역풍, 대류, 계절모델, 과거 유사해를 함께 보며 발달 가능성은 미리 설명합니다.",
    },
    {
      question: "한반도 영향은 어떻게 말하나요?",
      answer:
        "엘니뇨 선언 여부 하나로 기온, 강수, 태풍을 단정하지 않습니다. ONI 발달 신호와 별도로 북태평양고기압, 장마전선, 저기압, 태풍 경로를 함께 설명합니다.",
    },
  ];

  return [
    "# 엘니뇨 공식 판정 지연과 대국민 소통 가이드",
    "",
    "## 핵심 메시지",
    "",
    "> 공식 선언은 늦고, 감시는 빠르게 한다.",
    "",
    "엘니뇨는 한 달 해수온이 높다고 바로 선언하지 않습니다. Niño3.4 해역의 3개월 이동평균이 +0.5°C 이상이고, 이 상태가 여러 계절 동안 지속되는지를 확인해야 합니다. 따라서 공식 ONI 판정은 원래 사후 확인 성격이 있습니다.",
    "",
    "다만 공식 판정이 늦다고 해서 감시를 늦게 시작하는 것은 아닙니다. 해수온 상승, 대기 반응, 무역풍, 대류, 계절모델, 과거 유사해를 함께 보면서 발달 가능성과 영향 가능성은 미리 설명합니다.",
    "",
    "## 답변 원칙",
    "",
    "1. 공식 판정과 조기 감시를 분리한다.",
    "2. 엘니뇨 상태와 한반도 영향을 분리한다.",
    "3. 예/아니오 단답보다 현재 단계와 불확실성을 함께 말한다.",
    "4. 공식 전망 확률이 아니라 관측 신호와 관측 기반 유사해를 근거로 설명한다.",
    "",
    "## 상태별 표현",
    "",
    markdownTable(statusRows, [
      { key: "situation", label: "상황" },
      { key: "wording", label: "권장 표현" },
      { key: "avoid", label: "피해야 할 표현" },
    ]),
    "",
    "## 질문별 답변법",
    "",
    markdownTable(responseRows, [
      { key: "question", label: "질문" },
      { key: "answer", label: "답변 방향" },
    ]),
    "",
    "## 언론 대응 문구",
    "",
    "### 짧은 답변",
    "",
    "> 공식 기준으로는 아직 엘니뇨 확정 여부를 지속성까지 확인해야 합니다. 다만 해수온이 엘니뇨 방향으로 움직이고 있어 발달 가능성은 감시 단계입니다. 한반도 영향은 엘니뇨 여부 하나로 단정하지 않고, 북태평양고기압, 장마전선, 태풍 경로 등과 함께 판단해야 합니다.",
    "",
    "### 엄밀한 답변",
    "",
    "> 엘니뇨는 한 달 해수온이 높다고 바로 선언하지 않고, Niño3.4 해역의 3개월 이동평균이 +0.5°C 이상으로 여러 계절 지속되는지를 봅니다. 그래서 공식 판정은 다소 늦게 나올 수 있습니다. 현재 설명은 '엘니뇨 확정'보다 '엘니뇨 발달 가능성이 높아지는 단계'가 더 정확합니다.",
    "",
    "## 실무 답변 틀",
    "",
    "질문자가 '엘니뇨냐 아니냐'라고 물으면 다음 순서로 답합니다.",
    "",
    "1. 공식 ONI 기준 충족 여부를 먼저 말한다.",
    "2. 아직 확정 전이면 발달 가능성 감시 단계라고 말한다.",
    "3. 한반도 영향은 별도 판단이라고 분리한다.",
    "4. 기온·강수·태풍은 지역 순환과 관측 유사해를 함께 보겠다고 설명한다.",
    "",
    "## 표준 답변",
    "",
    "> 공식 기준으로는 아직 확정 전입니다. 하지만 엘니뇨 쪽으로 발달하는 신호는 감시 중입니다. 따라서 현재 단계의 정확한 표현은 '엘니뇨 발생'이 아니라 '엘니뇨 발달 가능성'입니다. 한반도 영향은 공식 엘니뇨 선언 여부보다 실제 해수온 변화, 대기 반응, 장마전선, 북태평양고기압, 태풍 경로를 함께 보겠습니다.",
  ].join("\n");
}

function buildResponseSystemIndex() {
  const rows = [
    {
      file: "evidence_registry.md",
      purpose: "ONI, RONI, 남한 자료, AO/NAO, 해빙, 유라시아 눈덮임의 적용 규칙",
      use: "자료 기준을 설명할 때 먼저 확인",
    },
    {
      file: "monthly_effect_table.md",
      purpose: "ONI 위상별 1~12월 기온·강수 영향표",
      use: "월별 질문 대응",
    },
    {
      file: "seasonal_effect_table.md",
      purpose: "ONI 위상별 DJF/MAM/JJA/SON 기온·강수 영향표",
      use: "계절 전망 질문 대응",
    },
    {
      file: "active_season_year_table.md",
      purpose: "ONI phase가 실제로 걸린 JJA/DJF 계절연도별 영향표",
      use: "1987년 엘니뇨, 2022년 라니냐처럼 지속 episode의 계절 영향 확인",
    },
    {
      file: "lifecycle_effect_table.md",
      purpose: "엘니뇨·라니냐 발달기와 소멸기별 계절 기온·강수 영향표",
      use: "발달기인지 소멸기인지 묻는 질문 대응",
    },
    {
      file: "climate_factor_modifier_table.md",
      purpose: "AO, NAO, 해빙, 유라시아 눈덮임으로 ONI 결론을 보정",
      use: "유사해 우선순위와 반대근거 확인",
    },
    {
      file: "analog_year_cards.md",
      purpose: "ONI 중심 유사해와 RONI 보조 사례",
      use: "과거 유사해 질문 대응",
    },
    {
      file: "changma_typhoon_reference.md",
      purpose: "장마·태풍을 ONI 직접효과와 분리하는 해석표",
      use: "장마, 집중호우, 태풍 질문 대응",
    },
    {
      file: "question_answer_matrix.md",
      purpose: "실제 질문별 짧은 답, 근거, 반대근거, 실무 문구",
      use: "대외·내부 Q&A 초안",
    },
    {
      file: "enso_public_communication_guide.md",
      purpose: "공식 엘니뇨 판정 지연 상황에서 언론·대국민 질문에 답하는 문구와 단계 기준",
      use: "엘니뇨냐 아니냐 질문 대응",
    },
    {
      file: "2026_summer_enso_korea_objective_response.md",
      purpose: "2026년 4월 엘니뇨 발달 시나리오에 대한 관측자료 기반 예시 답변",
      use: "실제 문의 대응 예시",
    },
  ];

  return [
    "# ENSO 대응 체계 산출물 안내",
    "",
    "- 기본 지표는 ONI입니다.",
    "- RONI는 보조 확인으로만 사용합니다.",
    "- 남한 기온·강수는 기존 1991~2020 평년 및 기존 대표지점 적용값을 그대로 사용합니다.",
    "- 기온·강수 판단에는 기관 공식 전망이나 확률전망을 사용하지 않습니다.",
    "- 티벳 눈덮임은 현재 범위에서 제외했습니다.",
    "",
    markdownTable(rows, [
      { key: "file", label: "파일" },
      { key: "purpose", label: "내용" },
      { key: "use", label: "사용 시점" },
    ]),
    "",
    "## 재생성",
    "",
    "```bash",
    "npm run build:enso-response",
    "```",
  ].join("\n");
}

export function buildResponseDocuments({
  monthRows,
  seasonRows,
  seasonMonthSampleRows = [],
  lifecycleRows = [],
  activeSeasonRows = [],
  analogRows = [],
  currentContextText = "",
  stationPolicy = DEFAULT_STATION_POLICY,
}) {
  return {
    "evidence_registry.md": `${buildEvidenceRegistry(stationPolicy)}\n`,
    "monthly_effect_table.md": `${buildMonthlyEffectTable(monthRows)}\n`,
    "seasonal_effect_table.md": `${buildSeasonalEffectTable(
      seasonRows,
      seasonMonthSampleRows,
    )}\n`,
    "active_season_year_table.md": `${buildActiveSeasonYearTable(activeSeasonRows)}\n`,
    "lifecycle_effect_table.md": `${buildLifecycleEffectTable(lifecycleRows)}\n`,
    "climate_factor_modifier_table.md": `${buildClimateFactorModifierTable(
      currentContextText,
      analogRows,
    )}\n`,
    "analog_year_cards.md": `${buildAnalogYearCards(analogRows)}\n`,
    "changma_typhoon_reference.md": `${buildChangmaTyphoonReference()}\n`,
    "question_answer_matrix.md": `${buildQuestionAnswerMatrix(monthRows, seasonRows)}\n`,
    "enso_public_communication_guide.md": `${buildPublicCommunicationGuide()}\n`,
    "2026_summer_enso_korea_objective_response.md": `${buildExampleScenarioResponse(
      monthRows,
      seasonRows,
      analogRows,
    )}\n`,
    "response_system_index.md": `${buildResponseSystemIndex()}\n`,
  };
}

export function buildCombinedResponseSystem(documents) {
  const quickUseRows = [
    {
      situation: "엘니뇨가 발달하면 여름에 비가 많은가?",
      section: "ENSO 질문 대응 매트릭스, ONI 기준 월별 기온·강수 영향표",
    },
    {
      situation: "폭염 가능성을 ONI로 설명할 수 있는가?",
      section: "ENSO 질문 대응 매트릭스, ONI 기준 계절별 기온·강수 영향표",
    },
    {
      situation: "1987년 엘니뇨, 2022년 라니냐처럼 지속된 해도 봐야 하는가?",
      section: "ONI 영향 계절연도 상세표",
    },
    {
      situation: "과거 유사해에는 어떤 일이 있었는가?",
      section: "ONI 중심 유사해 카드, ONI 해석 보정용 기후인자 표",
    },
    {
      situation: "발달기와 소멸기에 한반도 영향이 다른가?",
      section: "ONI 발달기·소멸기별 기온·강수 영향표",
    },
    {
      situation: "장마·태풍 질문에 어떻게 답할 것인가?",
      section: "장마·태풍 별도 해석 참고표",
    },
    {
      situation: "지금 엘니뇨냐는 질문에 어떻게 답할 것인가?",
      section: "엘니뇨 공식 판정 지연과 대국민 소통 가이드",
    },
  ];

  const sections = COMBINED_DOCUMENT_ORDER.map((fileName) => {
    const content = documents[fileName];
    if (!content) {
      return "";
    }
    return [`<!-- source: ${fileName} -->`, demoteMarkdownHeadings(content)].join("\n\n");
  }).filter(Boolean);

  return [
    "# ENSO 한반도 영향 대응체계 종합본",
    "",
    "- 이 파일 하나만 보면 됩니다.",
    "- 기본 ENSO 지표는 ONI입니다. RONI는 보조 민감도 확인으로만 사용합니다.",
    "- 남한 기온·강수는 기존 62개 지점 남한 평균자료 체계를 사용하며, 1973~1989년은 제주 제외 본토 56개 대표지점, 1990년 이후는 제주 제외 본토 62개 대표지점, 평년은 1991~2020 고정 평년입니다.",
    "- 기온·강수량 판단에는 KMA 등 기관의 공식 전망, 3개월전망, 계절전망 확률을 사용하지 않고 실제 관측자료와 관측 기반 유사해만 사용합니다.",
    "- AO, NAO, 북극·바렌츠·카라 해빙, 유라시아 눈덮임은 ONI 결론의 강도와 유사해 우선순위를 보정하는 보조 인자입니다.",
    "- 티벳 눈덮임은 현재 대응체계에서 제외했습니다.",
    "- 세부 원본 파일은 `Korea_Observation_Data/data/output/final/enso_response_system/`에 보관됩니다.",
    "",
    "## 빠른 사용법",
    "",
    markdownTable(quickUseRows, [
      { key: "situation", label: "질문 상황" },
      { key: "section", label: "우선 확인할 절" },
    ]),
    "",
    "## 재생성",
    "",
    "```bash",
    "cd Korea_Observation_Data",
    "npm run build:enso-response",
    "```",
    "",
    "---",
    "",
    ...sections.map((section, index) =>
      index === sections.length - 1 ? section : `${section}\n\n---`,
    ),
    "",
  ].join("\n");
}

async function readOptionalText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function readOptionalCsv(filePath) {
  try {
    return await readCsv(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function buildResponseSystem({
  baseDir = ".",
  outputDir = "data/output/final/enso_response_system",
  combinedOutputPath = "data/output/final/enso_response_system/ENSO_RESPONSE_SYSTEM.md",
  stationPolicy = DEFAULT_STATION_POLICY,
} = {}) {
  const absoluteBase = resolve(baseDir);
  const monthRows = await readCsv(
    resolve(absoluteBase, "data/output/final/enso_analysis/enso_month_phase_summary.md"),
  );
  const seasonRows = await readCsv(
    resolve(absoluteBase, "data/output/final/enso_analysis/enso_season_phase_summary.md"),
  );
  const seasonMonthSampleRows = await readOptionalCsv(
    resolve(absoluteBase, "data/output/final/enso_analysis/enso_season_month_sample_summary.md"),
  );
  const lifecycleRows = await readOptionalCsv(
    resolve(absoluteBase, "data/output/final/enso_analysis/enso_season_lifecycle_summary.md"),
  );
  const activeSeasonRows = await readOptionalCsv(
    resolve(absoluteBase, "data/output/final/enso_analysis/enso_active_season_years.md"),
  );
  const analogRows = await readCsv(
    resolve(absoluteBase, "data/output/final/elnino_summer_2026/analog_year_metrics.csv"),
  );
  const currentContextText = await readOptionalText(
    resolve(absoluteBase, "data/output/final/summer_outlook/oni_elnino_development_cryosphere_ao_analog_2026.md"),
  );
  const extraContextText = await readOptionalText(
    resolve(absoluteBase, "data/output/final/summer_outlook/current_sst_cryosphere_ao_analog_reference_2026.md"),
  );

  const documents = buildResponseDocuments({
    monthRows,
    seasonRows,
    seasonMonthSampleRows,
    lifecycleRows,
    activeSeasonRows,
    analogRows,
    currentContextText: `${currentContextText}\n${extraContextText}`,
    stationPolicy,
  });

  const absoluteOutput = resolve(absoluteBase, outputDir);
  await mkdir(absoluteOutput, { recursive: true });
  for (const [fileName, content] of Object.entries(documents)) {
    await writeFile(resolve(absoluteOutput, fileName), content, "utf8");
  }

  const combinedFile = resolve(absoluteBase, combinedOutputPath);
  await mkdir(dirname(combinedFile), { recursive: true });
  await writeFile(combinedFile, buildCombinedResponseSystem(documents), "utf8");

  return {
    outputDir: absoluteOutput,
    files: Object.keys(documents).map((fileName) => resolve(absoluteOutput, fileName)),
    combinedFile,
  };
}
