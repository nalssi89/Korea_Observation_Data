import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildResponseDocuments, buildResponseSystem } from "../src/enso-response-system.js";
import { writeCsv } from "../src/csv.js";

const monthRows = [
  {
    month: "6",
    phase: "El Nino",
    n: "10",
    tavg_departure_mean: "-0.1034",
    tavg_high_pct: "30",
    tavg_low_pct: "40",
    precip_ratio_pct: "80.4881",
    precip_wet_pct: "20",
    precip_dry_pct: "40",
  },
  {
    month: "7",
    phase: "El Nino",
    n: "9",
    tavg_departure_mean: "-0.2921",
    tavg_high_pct: "11.1111",
    tavg_low_pct: "44.4444",
    precip_ratio_pct: "116.6843",
    precip_wet_pct: "55.5556",
    precip_dry_pct: "33.3333",
  },
  {
    month: "8",
    phase: "El Nino",
    n: "9",
    tavg_departure_mean: "-0.4441",
    tavg_high_pct: "11.1111",
    tavg_low_pct: "44.4444",
    precip_ratio_pct: "105.9925",
    precip_wet_pct: "22.2222",
    precip_dry_pct: "22.2222",
  },
];

const seasonRows = [
  {
    season: "DJF",
    phase: "El Nino",
    n: "54",
    tavg_departure_mean: "0.3004",
    tavg_high_pct: "42.5926",
    tavg_low_pct: "25.9259",
    precip_departure_mean: "5.3001",
    precip_ratio_pct: "117.7921",
    precip_wet_pct: "46.2963",
    precip_dry_pct: "24.0741",
  },
  {
    season: "JJA",
    phase: "El Nino",
    n: "28",
    tavg_departure_mean: "-0.2736",
    tavg_high_pct: "17.8571",
    tavg_low_pct: "42.8571",
    precip_departure_mean: "11.0133",
    precip_ratio_pct: "104.6074",
    precip_wet_pct: "32.1429",
    precip_dry_pct: "32.1429",
  },
  {
    season: "SON",
    phase: "El Nino",
    n: "50",
    tavg_departure_mean: "-0.1585",
    tavg_high_pct: "30",
    tavg_low_pct: "38",
    precip_departure_mean: "-15.5862",
    precip_ratio_pct: "81.7044",
    precip_wet_pct: "28",
    precip_dry_pct: "36",
  },
];

const analogRows = [
  {
    year: "2009",
    onset_proxy: "ONI JAS(+0.6); RONI ASO(+0.6)",
    distance_to_2026: "1.3458",
    jja_tavg: "23.1311",
    jja_tavg_dep: "-0.5754",
    jja_tmax: "27.8998",
    jja_tmax_dep: "-0.5602",
    jja_precip: "783.6919",
    jja_precip_ratio: "107.7687",
    ao_jfm: "0.0829",
    nao_jfm: "0.2071",
    arctic_jfm_z: "-0.1254",
    barents_jfm_z: "-0.3113",
    kara_jfm_z: "0.0679",
  },
  {
    year: "2023",
    onset_proxy: "RONI JJA(+0.6)",
    distance_to_2026: "1.6994",
    jja_tavg: "24.7259",
    jja_tavg_dep: "1.0194",
    jja_tmax: "29.3118",
    jja_tmax_dep: "0.8518",
    jja_precip: "1015.6597",
    jja_precip_ratio: "139.6675",
    ao_jfm: "0.4021",
    nao_jfm: "0.3547",
    arctic_jfm_z: "-1.3648",
    barents_jfm_z: "-1.6175",
    kara_jfm_z: "-0.1547",
  },
];

test("response documents use ONI as the default and keep RONI auxiliary", () => {
  const documents = buildResponseDocuments({ monthRows, seasonRows, analogRows });

  assert.match(documents["monthly_effect_table.md"], /기본 지표는 ONI입니다/u);
  assert.match(documents["monthly_effect_table.md"], /RONI는 이 표의 phase 판정에 쓰지 않습니다/u);
  assert.match(documents["analog_year_cards.md"], /ONI 기본 유사해/u);
  assert.match(documents["analog_year_cards.md"], /RONI 보조 참고/u);
  assert.match(documents["analog_year_cards.md"], /\| 2009 \| ONI 기본/u);
  assert.match(documents["analog_year_cards.md"], /\| 2023 \| RONI 보조/u);
});

test("response documents exclude Tibetan snow from climate modifiers", () => {
  const documents = buildResponseDocuments({ monthRows, seasonRows, analogRows });

  assert.doesNotMatch(documents["climate_factor_modifier_table.md"], /티벳/u);
  assert.doesNotMatch(documents["climate_factor_modifier_table.md"], /티베트/u);
  assert.match(documents["evidence_registry.md"], /티벳 눈덮임/u);
  assert.match(documents["evidence_registry.md"], /이번 프로젝트 범위에서는 제외/u);
});

test("evidence registry preserves the existing South Korea station and normal policy", () => {
  const documents = buildResponseDocuments({ monthRows, seasonRows, analogRows });

  assert.match(documents["evidence_registry.md"], /1973~1989년은 제주 제외 본토 56개/u);
  assert.match(documents["evidence_registry.md"], /1990년 이후는 제주 제외 본토 62개/u);
  assert.match(documents["evidence_registry.md"], /1991~2020 고정 평년/u);
});

test("question matrix keeps evidence and counter-evidence together", () => {
  const documents = buildResponseDocuments({ monthRows, seasonRows, analogRows });

  assert.match(documents["question_answer_matrix.md"], /근거/u);
  assert.match(documents["question_answer_matrix.md"], /반대근거\/주의/u);
  assert.match(documents["question_answer_matrix.md"], /ONI만으로는 단정하지 않는다/u);
});

test("response system includes Changma and typhoon as separate modifier layer", () => {
  const documents = buildResponseDocuments({ monthRows, seasonRows, analogRows });

  assert.match(documents["changma_typhoon_reference.md"], /ONI 직접효과가 아니라 별도 보정 레이어/u);
  assert.match(documents["changma_typhoon_reference.md"], /KMA 공식 영향태풍 판정/u);
  assert.match(documents["response_system_index.md"], /changma_typhoon_reference\.md/u);
});

test("buildResponseSystem writes the expected markdown artifacts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kod-enso-response-"));
  await writeCsv(join(directory, "data/output/final/enso_analysis/enso_month_phase_summary.md"), monthRows);
  await writeCsv(join(directory, "data/output/final/enso_analysis/enso_season_phase_summary.md"), seasonRows);
  await writeCsv(join(directory, "data/output/final/elnino_summer_2026/analog_year_metrics.csv"), analogRows);

  const result = await buildResponseSystem({ baseDir: directory });
  assert.equal(result.files.length, 8);

  const registry = await readFile(
    join(directory, "data/output/final/enso_response_system/evidence_registry.md"),
    "utf8",
  );
  assert.match(registry, /ENSO 대응 체계 근거 등록부/u);

  const combined = await readFile(result.combinedFile, "utf8");
  assert.match(combined, /ENSO 한반도 영향 대응체계 종합본/u);
  assert.match(combined, /이 파일 하나만 보면 됩니다/u);
  assert.match(combined, /ONI 기준 월별 기온·강수 영향표/u);
  assert.match(combined, /RONI는 보조 민감도 확인/u);
  assert.match(combined, /장마·태풍 별도 해석 참고표/u);
  assert.match(combined, /예시 답변: 2026년 4월 현재 엘니뇨 발달 가능성과 한반도 영향/u);
  assert.match(combined, /가을은 엘니뇨 지속 시 소우 쪽 신호/u);
  assert.match(combined, /겨울은 고온·다우 쪽 신호/u);
  assert.match(combined, /기관 공식 기온·강수 전망/u);
  assert.match(combined, /실제 관측자료와 관측 기반 유사해만 사용/u);
  assert.doesNotMatch(combined, /KMA 여름 전망/u);
  assert.doesNotMatch(combined, /고온 확률 60/u);
  assert.doesNotMatch(combined, /KMA 2026년 여름 기후전망/u);
});
