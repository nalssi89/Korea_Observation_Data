import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildResponseDocuments, buildResponseSystem } from "../src/enso-response-system.js";
import { readCsv, writeCsv } from "../src/csv.js";

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

const seasonMonthSampleRows = [
  {
    season: "JJA",
    phase: "El Nino",
    n: "28",
    tavg_departure_mean: "-0.2736",
    precip_ratio_pct: "104.6074",
  },
];

const lifecycleRows = [
  {
    season: "JJA",
    phase: "El Nino",
    lifecycle_stage: "Development",
    n: "4",
    tavg_departure_mean: "-0.2",
    tavg_high_pct: "25",
    tavg_low_pct: "50",
    precip_departure_mean: "12.3",
    precip_ratio_pct: "108.1",
    precip_wet_pct: "50",
    precip_dry_pct: "25",
  },
  {
    season: "DJF",
    phase: "La Nina",
    lifecycle_stage: "Decay",
    n: "6",
    tavg_departure_mean: "-0.5",
    tavg_high_pct: "16.7",
    tavg_low_pct: "66.7",
    precip_departure_mean: "-10.2",
    precip_ratio_pct: "82.4",
    precip_wet_pct: "16.7",
    precip_dry_pct: "66.7",
  },
];

const analogRows = [
  {
    year: "2009",
    analysis_tier: "ONI development-year full; MJJ-ASO summer-transition subset",
    oni_development_full: "Y",
    oni_summer_transition: "Y",
    roni_auxiliary: "Y",
    roni_only_sensitivity: "",
    oni_episode_start: "JAS 2009",
    onset_proxy: "ONI JAS(+0.6); RONI ASO(+0.6)",
    transition_distance_to_2026: "1.3458",
    jja_tavg: "23.1311",
    jja_tavg_dep: "-0.5754",
    jja_tavg_month_signs: "0/-/-",
    jja_tmax: "27.8998",
    jja_tmax_dep: "-0.5602",
    jja_precip: "783.6919",
    jja_precip_ratio: "107.7687",
    jja_precip_month_signs: "0/+/-",
    ao_jfm: "0.0829",
    nao_jfm: "0.2071",
    arctic_jfm_z: "-0.1254",
    barents_jfm_z: "-0.3113",
    kara_jfm_z: "0.0679",
  },
  {
    year: "2023",
    analysis_tier: "ONI development-year full; RONI auxiliary noted",
    oni_development_full: "Y",
    oni_summer_transition: "",
    roni_auxiliary: "Y",
    roni_only_sensitivity: "",
    oni_episode_start: "AMJ 2023",
    onset_proxy: "ONI AMJ(+0.6); RONI JJA(+0.6)",
    transition_distance_to_2026: "1.6994",
    jja_tavg: "24.7259",
    jja_tavg_dep: "1.0194",
    jja_tavg_month_signs: "+/+/+",
    jja_tmax: "29.3118",
    jja_tmax_dep: "0.8518",
    jja_precip: "1015.6597",
    jja_precip_ratio: "139.6675",
    jja_precip_month_signs: "+/+/0",
    ao_jfm: "0.4021",
    nao_jfm: "0.3547",
    arctic_jfm_z: "-1.3648",
    barents_jfm_z: "-1.6175",
    kara_jfm_z: "-0.1547",
  },
];

test("response documents use ONI as the default and keep RONI auxiliary", () => {
  const documents = buildResponseDocuments({ monthRows, seasonRows, lifecycleRows, analogRows });

  assert.match(documents["monthly_effect_table.md"], /기본 지표는 ONI입니다/u);
  assert.match(documents["monthly_effect_table.md"], /RONI는 이 표의 phase 판정에 쓰지 않습니다/u);
  assert.match(documents["lifecycle_effect_table.md"], /ONI 발달기·소멸기별/u);
  assert.match(documents["lifecycle_effect_table.md"], /엘니뇨 \| 발달기/u);
  assert.match(documents["lifecycle_effect_table.md"], /라니냐 \| 소멸기/u);
  assert.match(documents["analog_year_cards.md"], /ONI 발달해 전체/u);
  assert.match(documents["analog_year_cards.md"], /MJJ-ASO 여름 전환형 부분집합/u);
  assert.match(documents["analog_year_cards.md"], /RONI 보조 민감도/u);
  assert.match(documents["analog_year_cards.md"], /\| 2023 \| ONI 발달해 전체/u);
  assert.match(documents["analog_year_cards.md"], /\| 2009 \| MJJ-ASO 여름 전환형/u);
  assert.match(
    documents["2026_summer_enso_korea_objective_response.md"],
    /\| 2023 \| AMJ 2023 \| \+1\.0°C \| \+\/\+\/\+ \|/u,
  );
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

test("response system includes public communication guidance for delayed ENSO confirmation", () => {
  const documents = buildResponseDocuments({ monthRows, seasonRows, analogRows });

  assert.match(documents["enso_public_communication_guide.md"], /공식 선언은 늦고, 감시는 빠르게 한다/u);
  assert.match(documents["enso_public_communication_guide.md"], /엘니뇨 발달 가능성/u);
  assert.match(documents["enso_public_communication_guide.md"], /피해야 할 표현/u);
  assert.match(documents["response_system_index.md"], /enso_public_communication_guide\.md/u);
});

test("buildResponseSystem writes the expected markdown artifacts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kod-enso-response-"));
  await writeCsv(join(directory, "data/output/final/enso_analysis/enso_month_phase_summary.md"), monthRows);
  await writeCsv(join(directory, "data/output/final/enso_analysis/enso_season_phase_summary.md"), seasonRows);
  await writeCsv(
    join(directory, "data/output/final/enso_analysis/enso_season_month_sample_summary.md"),
    seasonMonthSampleRows,
  );
  await writeCsv(
    join(directory, "data/output/final/enso_analysis/enso_season_lifecycle_summary.md"),
    lifecycleRows,
  );
  await writeCsv(join(directory, "data/output/final/elnino_summer_2026/analog_year_metrics.csv"), analogRows);

  const result = await buildResponseSystem({ baseDir: directory });
  assert.equal(result.files.length, 11);

  const registry = await readFile(
    join(directory, "data/output/final/enso_response_system/evidence_registry.md"),
    "utf8",
  );
  assert.match(registry, /ENSO 대응 체계 근거 등록부/u);

  const combined = await readFile(result.combinedFile, "utf8");
  assert.match(combined, /ENSO 한반도 영향 대응체계 종합본/u);
  assert.match(combined, /이 파일 하나만 보면 됩니다/u);
  assert.match(combined, /ONI 기준 월별 기온·강수 영향표/u);
  assert.match(combined, /ONI 발달기·소멸기별 기온·강수 영향표/u);
  assert.match(combined, /RONI는 보조 민감도 확인/u);
  assert.match(combined, /장마·태풍 별도 해석 참고표/u);
  assert.match(combined, /엘니뇨 공식 판정 지연과 대국민 소통 가이드/u);
  assert.match(combined, /예시 답변: 2026년 4월 현재 엘니뇨 발달 가능성과 한반도 영향/u);
  assert.match(combined, /ONI 발달해 전체: JJA 기온/u);
  assert.match(combined, /가을은 엘니뇨 지속 시 소우 쪽 신호/u);
  assert.match(combined, /겨울은 고온·다우 쪽 신호/u);
  assert.match(combined, /기관 공식 기온·강수 전망/u);
  assert.match(combined, /실제 관측자료와 관측 기반 유사해만 사용/u);
  assert.doesNotMatch(combined, /KMA 여름 전망/u);
  assert.doesNotMatch(combined, /고온 확률 60/u);
  assert.doesNotMatch(combined, /KMA 2026년 여름 기후전망/u);
});

test("real analog metrics keep 2023 in the ONI development-year set", async () => {
  const rows = await readCsv("data/output/final/elnino_summer_2026/analog_year_metrics.csv");
  const row2023 = rows.find((row) => row.year === "2023");

  assert.ok(row2023);
  assert.equal(row2023.oni_development_full, "Y");
  assert.equal(row2023.oni_summer_transition, "");
  assert.match(row2023.onset_proxy, /ONI AMJ\(\+0\.6\)/u);
  assert.equal(row2023.jja_tavg_month_signs, "+/+/+");
  assert.equal(row2023.jja_precip_month_signs, "+/+/0");
});

test("real ENSO season summaries separate complete seasons from month samples", async () => {
  const seasonRowsReal = await readCsv("data/output/final/enso_analysis/enso_season_phase_summary.md");
  const monthSampleRowsReal = await readCsv(
    "data/output/final/enso_analysis/enso_season_month_sample_summary.md",
  );
  const jjaSeason = seasonRowsReal.find(
    (row) => row.season === "JJA" && row.phase === "El Nino",
  );
  const jjaMonthSample = monthSampleRowsReal.find(
    (row) => row.season === "JJA" && row.phase === "El Nino",
  );

  assert.ok(jjaSeason);
  assert.ok(jjaMonthSample);
  assert.notEqual(jjaSeason.n, jjaMonthSample.n);
});

test("real ENSO lifecycle summaries preserve development and decay effects", async () => {
  const lifecycleRowsReal = await readCsv(
    "data/output/final/enso_analysis/enso_season_lifecycle_summary.md",
  );
  const jjaElNinoDevelopment = lifecycleRowsReal.find(
    (row) =>
      row.season === "JJA" &&
      row.phase === "El Nino" &&
      row.lifecycle_stage === "Development",
  );
  const djfLaNinaDecay = lifecycleRowsReal.find(
    (row) =>
      row.season === "DJF" &&
      row.phase === "La Nina" &&
      row.lifecycle_stage === "Decay",
  );

  assert.ok(jjaElNinoDevelopment);
  assert.ok(djfLaNinaDecay);
  assert.equal(jjaElNinoDevelopment.n, "9");
  assert.equal(djfLaNinaDecay.n, "14");
});
