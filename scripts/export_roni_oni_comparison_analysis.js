import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readCsv, writeCsv } from "../src/csv.js";

const inputPath =
  process.argv[2] ?? "data/output/final/south_korea_fixed_1991_2020_comparison.md";
const oniLagPath =
  process.argv[3] ?? "data/output/final/enso_analysis/enso_lag_correlations.md";
const outputDir = process.argv[4] ?? "data/output/final/enso_roni_comparison";

const RONI_SOURCE_URL =
  "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/#latest-data";

const RONI_TEXT = `
1970 0.5 0.3 0.3 0.1 0.0 -0.3 -0.6 -0.7 -0.7 -0.6 -0.7 -0.9
1971 -1.0 -1.0 -0.8 -0.6 -0.5 -0.4 -0.4 -0.4 -0.5 -0.5 -0.5 -0.5
1972 -0.3 0.0 0.4 0.8 0.9 1.1 1.3 1.5 1.7 2.0 2.2 2.3
1973 2.0 1.4 0.6 -0.2 -0.8 -1.1 -1.2 -1.4 -1.5 -1.8 -1.9 -1.9
1974 -1.5 -1.2 -0.9 -0.9 -0.8 -0.6 -0.4 -0.2 -0.2 -0.4 -0.4 -0.2
1975 -0.1 -0.1 -0.3 -0.5 -0.6 -0.8 -0.9 -0.9 -1.0 -1.0 -1.1 -1.1
1976 -1.0 -0.6 -0.3 -0.1 0.0 0.2 0.5 0.7 0.9 1.1 1.1 1.1
1977 1.0 0.9 0.5 0.3 0.2 0.4 0.4 0.6 0.8 1.0 1.1 1.1
1978 0.9 0.6 0.1 -0.2 -0.4 -0.3 -0.3 -0.3 -0.2 0.0 0.2 0.2
1979 0.2 0.2 0.2 0.2 0.1 -0.1 0.0 0.2 0.4 0.5 0.5 0.7
1980 0.6 0.5 0.3 0.2 0.3 0.3 0.2 0.0 0.0 0.1 0.2 0.2
1981 0.0 -0.3 -0.3 -0.3 -0.3 -0.3 -0.3 -0.2 -0.1 -0.2 -0.2 0.0
1982 0.1 0.3 0.4 0.6 0.8 0.8 0.9 1.3 1.8 2.2 2.4 2.5
1983 2.5 2.2 1.7 1.4 1.0 0.6 0.1 -0.2 -0.6 -0.9 -1.1 -1.0
1984 -0.5 -0.3 -0.3 -0.5 -0.6 -0.4 -0.2 -0.1 -0.1 -0.5 -0.8 -1.0
1985 -0.8 -0.6 -0.6 -0.7 -0.7 -0.5 -0.4 -0.3 -0.2 -0.2 -0.1 -0.2
1986 -0.3 -0.3 -0.2 -0.1 -0.1 -0.1 0.3 0.6 0.9 1.2 1.4 1.5
1987 1.6 1.5 1.3 1.0 0.9 1.1 1.3 1.6 1.5 1.3 1.0 0.9
1988 0.7 0.3 -0.2 -0.7 -1.4 -1.7 -1.6 -1.3 -1.4 -1.6 -1.9 -1.9
1989 -1.7 -1.4 -1.1 -0.8 -0.6 -0.4 -0.3 -0.3 -0.2 -0.2 -0.1 0.0
1990 0.2 0.3 0.3 0.3 0.2 0.2 0.3 0.4 0.4 0.4 0.4 0.5
1991 0.6 0.5 0.4 0.4 0.5 0.7 0.8 0.8 0.9 1.2 1.7 2.1
1992 2.3 2.2 2.0 1.7 1.4 0.9 0.5 0.3 0.2 0.1 0.1 0.3
1993 0.5 0.7 0.9 1.0 0.9 0.7 0.5 0.5 0.5 0.4 0.3 0.3
1994 0.3 0.3 0.4 0.5 0.6 0.6 0.7 0.8 1.0 1.1 1.3 1.4
1995 1.3 1.0 0.7 0.4 0.1 -0.1 -0.3 -0.5 -0.7 -0.9 -0.9 -0.9
1996 -0.9 -0.8 -0.6 -0.4 -0.3 -0.3 -0.2 -0.2 -0.2 -0.3 -0.3 -0.3
1997 -0.2 -0.1 0.2 0.5 1.0 1.3 1.7 2.0 2.3 2.4 2.4 2.3
1998 2.2 1.8 1.3 0.8 0.1 -0.5 -1.2 -1.4 -1.5 -1.5 -1.6 -1.6
1999 -1.5 -1.3 -1.1 -1.0 -1.0 -1.0 -1.0 -1.0 -1.0 -1.1 -1.4 -1.6
2000 -1.7 -1.4 -1.1 -0.8 -0.6 -0.5 -0.4 -0.4 -0.4 -0.6 -0.7 -0.7
2001 -0.6 -0.5 -0.5 -0.5 -0.3 -0.1 0.0 0.0 0.0 -0.2 -0.2 -0.3
2002 -0.1 0.0 0.0 0.1 0.4 0.7 0.9 1.1 1.3 1.4 1.5 1.2
2003 0.9 0.5 0.2 -0.2 -0.4 -0.3 0.0 0.2 0.2 0.2 0.3 0.3
2004 0.3 0.1 0.1 0.2 0.3 0.5 0.7 0.8 0.9 0.8 0.7 0.7
2005 0.6 0.4 0.3 0.3 0.2 0.0 -0.1 -0.1 0.0 -0.2 -0.5 -0.8
2006 -0.9 -0.9 -0.6 -0.4 -0.1 0.0 0.1 0.3 0.5 0.8 0.9 0.9
2007 0.6 0.2 -0.2 -0.4 -0.4 -0.5 -0.6 -0.8 -1.0 -1.3 -1.4 -1.5
2008 -1.6 -1.5 -1.3 -0.9 -0.8 -0.5 -0.3 -0.2 -0.3 -0.4 -0.6 -0.8
2009 -0.9 -0.8 -0.7 -0.4 -0.1 0.1 0.3 0.4 0.6 0.9 1.3 1.6
2010 1.5 1.1 0.6 0.1 -0.5 -1.0 -1.3 -1.5 -1.7 -1.7 -1.7 -1.6
2011 -1.4 -1.2 -0.9 -0.7 -0.5 -0.3 -0.4 -0.5 -0.7 -0.9 -1.0 -1.0
2012 -0.8 -0.6 -0.6 -0.5 -0.3 0.0 0.3 0.4 0.4 0.2 -0.1 -0.4
2013 -0.6 -0.6 -0.5 -0.4 -0.4 -0.4 -0.4 -0.3 -0.3 -0.2 -0.2 -0.3
2014 -0.5 -0.5 -0.3 0.0 0.1 0.0 -0.1 -0.1 0.1 0.4 0.5 0.6
2015 0.5 0.4 0.5 0.6 0.8 1.0 1.3 1.6 1.9 2.2 2.3 2.4
2016 2.2 1.8 1.3 0.5 -0.1 -0.6 -0.9 -1.0 -1.1 -1.1 -1.1 -1.0
2017 -0.7 -0.5 -0.3 -0.1 0.1 0.1 -0.2 -0.5 -0.7 -1.0 -1.1 -1.3
2018 -1.1 -1.0 -0.9 -0.7 -0.3 0.0 0.1 0.2 0.4 0.7 0.8 0.7
2019 0.6 0.6 0.6 0.5 0.3 0.2 0.0 -0.1 0.0 0.1 0.2 0.2
2020 0.1 0.1 0.0 -0.3 -0.6 -0.8 -0.8 -0.9 -1.2 -1.5 -1.5 -1.4
2021 -1.2 -1.0 -1.0 -0.8 -0.6 -0.5 -0.6 -0.7 -0.9 -1.1 -1.2 -1.2
2022 -1.2 -1.2 -1.3 -1.3 -1.2 -1.0 -0.9 -1.0 -1.1 -1.1 -1.0 -1.0
2023 -0.8 -0.6 -0.4 -0.2 0.1 0.4 0.6 0.9 1.1 1.4 1.5 1.5
2024 1.2 0.9 0.5 0.1 -0.3 -0.5 -0.5 -0.6 -0.8 -0.8 -0.9 -1.1
2025 -1.1 -0.9 -0.7 -0.5 -0.5 -0.4 -0.5 -0.6 -0.8 -0.9 -0.9 -1.0
2026 -0.9 -0.7
`;

function round(value, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }
  const factor = 10 ** digits;
  return Math.round((Number(value) + 1e-12) * factor) / factor;
}

function format(value, digits = 3) {
  const rounded = round(value, digits);
  return rounded === "" ? "" : rounded.toFixed(digits);
}

function monthIndex(year, month) {
  return year * 12 + month - 1;
}

function parseIndexRows(text, valueName) {
  return text
    .trim()
    .split(/\n/u)
    .flatMap((line) => {
      const parts = line.trim().split(/\s+/u);
      const year = Number(parts[0]);
      return parts.slice(1).map((value, index) => {
        const numericValue = Number(value);
        return {
          year,
          month: index + 1,
          [valueName]: numericValue,
          raw_phase:
            numericValue >= 0.5 ? "El Nino" : numericValue <= -0.5 ? "La Nina" : "Neutral",
        };
      });
    })
    .sort((left, right) => monthIndex(left.year, left.month) - monthIndex(right.year, right.month));
}

function assignEpisodePhases(rows) {
  const result = new Map();
  let run = [];
  const flush = () => {
    if (run.length >= 5) {
      for (const item of run) {
        result.set(`${item.year}:${item.month}`, item.raw_phase);
      }
    }
    run = [];
  };

  for (const item of rows) {
    if (item.raw_phase === "Neutral") {
      flush();
      continue;
    }
    if (run.length > 0 && run.at(-1).raw_phase !== item.raw_phase) {
      flush();
    }
    run.push(item);
  }
  flush();
  return result;
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function median(values) {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 === 0 ? (finite[mid - 1] + finite[mid]) / 2 : finite[mid];
}

function correlation(pairs) {
  const valid = pairs.filter(([left, right]) => Number.isFinite(left) && Number.isFinite(right));
  if (valid.length < 3) return null;
  const leftMean = mean(valid.map(([left]) => left));
  const rightMean = mean(valid.map(([, right]) => right));
  const covariance = valid.reduce(
    (sum, [left, right]) => sum + (left - leftMean) * (right - rightMean),
    0,
  );
  const leftVar = valid.reduce((sum, [left]) => sum + (left - leftMean) ** 2, 0);
  const rightVar = valid.reduce((sum, [, right]) => sum + (right - rightMean) ** 2, 0);
  const denominator = Math.sqrt(leftVar * rightVar);
  return denominator === 0 ? null : covariance / denominator;
}

function erf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x));
  return sign * y;
}

function normalCdf(value) {
  return 0.5 * (1 + erf(value / Math.SQRT2));
}

function approximatePearsonPValue(corr, n) {
  if (!Number.isFinite(corr) || n < 4 || Math.abs(corr) >= 1) return "";
  const fisherZ = 0.5 * Math.log((1 + corr) / (1 - corr)) * Math.sqrt(n - 3);
  return 2 * (1 - normalCdf(Math.abs(fisherZ)));
}

function seasonForMonth(month) {
  if ([3, 4, 5].includes(month)) return "MAM";
  if ([6, 7, 8].includes(month)) return "JJA";
  if ([9, 10, 11].includes(month)) return "SON";
  return "DJF";
}

function phaseOrder(phase) {
  return { "El Nino": 0, Neutral: 1, "La Nina": 2 }[phase] ?? 9;
}

function summarizeGroup(rows, groupFields, indexName) {
  const groups = new Map();
  for (const row of rows) {
    const key = groupFields.map((field) => row[field]).join(":");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.entries()]
    .map(([key, groupRows]) => {
      const keys = key.split(":");
      const output = Object.fromEntries(groupFields.map((field, index) => [field, keys[index]]));
      const precipNormal = mean(groupRows.map((row) => row.precip_normal));
      const precipObserved = mean(groupRows.map((row) => row.precip_observed));
      return {
        ...output,
        n: groupRows.length,
        [`${indexName}_mean`]: round(mean(groupRows.map((row) => row[indexName])), 4),
        tavg_departure_mean: round(mean(groupRows.map((row) => row.tavg_departure)), 4),
        tavg_departure_median: round(median(groupRows.map((row) => row.tavg_departure)), 4),
        tavg_high_pct: round(
          (groupRows.filter((row) => row.tavg_sign === "+").length / groupRows.length) * 100,
          4,
        ),
        tavg_low_pct: round(
          (groupRows.filter((row) => row.tavg_sign === "-").length / groupRows.length) * 100,
          4,
        ),
        precip_departure_mean: round(mean(groupRows.map((row) => row.precip_departure)), 4),
        precip_ratio_pct: round((precipObserved / precipNormal) * 100, 4),
        precip_wet_pct: round(
          (groupRows.filter((row) => row.precip_sign === "+").length / groupRows.length) * 100,
          4,
        ),
        precip_dry_pct: round(
          (groupRows.filter((row) => row.precip_sign === "-").length / groupRows.length) * 100,
          4,
        ),
      };
    })
    .sort((left, right) => {
      for (const field of groupFields) {
        const cmp =
          field === "phase"
            ? phaseOrder(left[field]) - phaseOrder(right[field])
            : String(left[field]).localeCompare(String(right[field]), "ko", { numeric: true });
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
}

function markdownTable(rows, fields) {
  const lines = [
    `| ${fields.join(" | ")} |`,
    `| ${fields.map(() => "---").join(" | ")} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${fields.map((field) => row[field] ?? "").join(" | ")} |`);
  }
  return lines.join("\n");
}

const roniRows = parseIndexRows(RONI_TEXT, "roni");
const roniByMonthIndex = new Map(roniRows.map((row) => [monthIndex(row.year, row.month), row.roni]));
const roniPhaseMap = assignEpisodePhases(roniRows);

const sourceRows = await readCsv(resolve(inputPath));
const byKey = new Map(sourceRows.map((row) => [`${row.year}:${row.month}:${row.variable}`, row]));
const analysisRows = [];

for (const key of byKey.keys()) {
  const [yearText, monthText, variable] = key.split(":");
  if (variable !== "tavg") continue;
  const year = Number(yearText);
  const month = Number(monthText);
  const tavg = byKey.get(`${year}:${month}:tavg`);
  const precip = byKey.get(`${year}:${month}:precip`);
  const roni = roniByMonthIndex.get(monthIndex(year, month));
  if (!tavg || !precip || roni === undefined) continue;
  analysisRows.push({
    year,
    month,
    season: seasonForMonth(month),
    roni,
    phase: roniPhaseMap.get(`${year}:${month}`) ?? "Neutral",
    tavg_departure: Number(tavg.departure_value),
    tavg_sign: tavg.departure_sign,
    precip_observed: Number(precip.observed_value),
    precip_normal: Number(precip.normal_value),
    precip_departure: Number(precip.departure_value),
    precip_sign: precip.departure_sign,
  });
}

const roniLagRows = [];
for (let lag = 0; lag <= 6; lag += 1) {
  const pairsTavg = [];
  const pairsPrecip = [];
  for (const row of analysisRows) {
    const roni = roniByMonthIndex.get(monthIndex(row.year, row.month) - lag);
    if (roni === undefined) continue;
    pairsTavg.push([roni, row.tavg_departure]);
    pairsPrecip.push([roni, row.precip_departure]);
  }
  const corrTavg = correlation(pairsTavg);
  const corrPrecip = correlation(pairsPrecip);
  roniLagRows.push({
    roni_leads_by_months: lag,
    n: pairsTavg.length,
    corr_roni_tavg_departure: round(corrTavg, 4),
    p_approx_roni_tavg: round(approximatePearsonPValue(corrTavg, pairsTavg.length), 4),
    corr_roni_precip_departure: round(corrPrecip, 4),
    p_approx_roni_precip: round(approximatePearsonPValue(corrPrecip, pairsPrecip.length), 4),
  });
}

let comparisonRows = [];
try {
  const oniLagRows = await readCsv(resolve(oniLagPath));
  comparisonRows = roniLagRows.map((roniRow) => {
    const lag = Number(roniRow.roni_leads_by_months);
    const oniRow = oniLagRows.find((row) => Number(row.oni_leads_by_months) === lag);
    const oniTavg = Number(oniRow?.corr_oni_tavg_departure);
    const oniPrecip = Number(oniRow?.corr_oni_precip_departure);
    const roniTavg = Number(roniRow.corr_roni_tavg_departure);
    const roniPrecip = Number(roniRow.corr_roni_precip_departure);
    return {
      leads_by_months: lag,
      n: roniRow.n,
      corr_oni_tavg_departure: round(oniTavg, 4),
      corr_roni_tavg_departure: round(roniTavg, 4),
      delta_roni_minus_oni_tavg: round(roniTavg - oniTavg, 4),
      corr_oni_precip_departure: round(oniPrecip, 4),
      corr_roni_precip_departure: round(roniPrecip, 4),
      delta_roni_minus_oni_precip: round(roniPrecip - oniPrecip, 4),
    };
  });
} catch {
  comparisonRows = [];
}

const phaseSummary = summarizeGroup(analysisRows, ["phase"], "roni");
const seasonPhaseSummary = summarizeGroup(analysisRows, ["season", "phase"], "roni");
const monthPhaseSummary = summarizeGroup(analysisRows, ["month", "phase"], "roni");
const zeroLag = roniLagRows[0];
const bestTavg = roniLagRows.reduce((best, row) =>
  Math.abs(Number(row.corr_roni_tavg_departure)) >
  Math.abs(Number(best.corr_roni_tavg_departure))
    ? row
    : best,
);
const bestPrecip = roniLagRows.reduce((best, row) =>
  Math.abs(Number(row.corr_roni_precip_departure)) >
  Math.abs(Number(best.corr_roni_precip_departure))
    ? row
    : best,
);
const djfRows = seasonPhaseSummary.filter((row) => row.season === "DJF");

const report = [
  "# RONI와 남한 평균기온·강수량 상관성 비교",
  "",
  `- RONI 원자료: ${RONI_SOURCE_URL}`,
  "- RONI 기준: CPC Relative Oceanic Nino Index, 1991~2020 기준의 상대 Niño 3.4 3개월 이동평균입니다.",
  "- 월 매칭: DJF=1월, JFM=2월, ..., NDJ=12월처럼 3개월 계절값을 가운데 월에 대응했습니다.",
  "- 국내 기후자료: 남한 1991~2020 고정 평년 대비 평균기온 편차와 강수량 편차를 사용했습니다.",
  "- 주의: 아래 p값은 독립 표본을 가정한 근사값입니다. 월별 기후 시계열은 자기상관이 있으므로 실무 판단은 상관계수 크기를 우선 보세요.",
  "",
  "## 핵심 결론",
  "",
  `- 같은 달 RONI와 평균기온 편차의 상관은 ${format(zeroLag.corr_roni_tavg_departure, 3)}입니다. 통계적으로는 작게 유의할 수 있어도, 예측 설명력으로는 매우 약합니다.`,
  `- 같은 달 RONI와 강수량 편차의 상관은 ${format(zeroLag.corr_roni_precip_departure, 3)}입니다. 강수량은 RONI 단독 선형 상관이 거의 없습니다.`,
  `- 0~6개월 선행 중 평균기온 상관 최대 절댓값은 lag ${bestTavg.roni_leads_by_months}개월의 ${format(bestTavg.corr_roni_tavg_departure, 3)}입니다.`,
  `- 0~6개월 선행 중 강수량 상관 최대 절댓값은 lag ${bestPrecip.roni_leads_by_months}개월의 ${format(bestPrecip.corr_roni_precip_departure, 3)}입니다.`,
  "- ONI와 비교하면 RONI는 기온 상관을 키우지 않고 거의 0에 가깝게 낮춥니다. 즉 ONI의 약한 기온 상관에는 열대 해수온 상승 배경장이 일부 섞였을 가능성이 있습니다.",
  "",
  "## RONI 선행상관",
  "",
  markdownTable(roniLagRows, [
    "roni_leads_by_months",
    "n",
    "corr_roni_tavg_departure",
    "p_approx_roni_tavg",
    "corr_roni_precip_departure",
    "p_approx_roni_precip",
  ]),
  "",
  "## ONI 대비 RONI 상관 차이",
  "",
  comparisonRows.length > 0
    ? markdownTable(comparisonRows, [
        "leads_by_months",
        "n",
        "corr_oni_tavg_departure",
        "corr_roni_tavg_departure",
        "delta_roni_minus_oni_tavg",
        "corr_oni_precip_departure",
        "corr_roni_precip_departure",
        "delta_roni_minus_oni_precip",
      ])
    : "- ONI lag 상관 파일을 찾지 못해 비교표를 만들지 못했습니다.",
  "",
  "## RONI phase별 전체 특성",
  "",
  markdownTable(phaseSummary, [
    "phase",
    "n",
    "roni_mean",
    "tavg_departure_mean",
    "tavg_departure_median",
    "tavg_high_pct",
    "tavg_low_pct",
    "precip_departure_mean",
    "precip_ratio_pct",
    "precip_wet_pct",
    "precip_dry_pct",
  ]),
  "",
  "## 겨울철(DJF) RONI phase 특성",
  "",
  markdownTable(djfRows, [
    "season",
    "phase",
    "n",
    "roni_mean",
    "tavg_departure_mean",
    "tavg_high_pct",
    "precip_departure_mean",
    "precip_ratio_pct",
    "precip_wet_pct",
  ]),
  "",
  "## 활용 판단",
  "",
  "- RONI는 열대 평균 해수면온도 상승분을 제거하므로 최근 기후에서는 ONI보다 순수 ENSO 신호를 보수적으로 볼 때 유용합니다.",
  "- 이번 계산에서는 남한 월별 평균기온·강수량 편차에 대한 RONI 선형 상관이 사실상 없습니다. 향후 3개월 전망에서는 RONI를 주 인자가 아니라 ENSO 상태 확인용 보조 변수로 쓰는 것이 안전합니다.",
  "- 특히 강수량은 RONI보다 계절, 장마전선, 북태평양고기압, 태풍 경로, 중위도 파동 등과 함께 해석해야 합니다.",
].join("\n");

await mkdir(resolve(outputDir), { recursive: true });
await writeCsv(resolve(outputDir, "roni_monthly_index.md"), roniRows);
await writeCsv(resolve(outputDir, "roni_lag_correlations.md"), roniLagRows);
await writeCsv(resolve(outputDir, "oni_vs_roni_lag_correlation_comparison.md"), comparisonRows);
await writeCsv(resolve(outputDir, "roni_phase_summary.md"), phaseSummary);
await writeCsv(resolve(outputDir, "roni_season_phase_summary.md"), seasonPhaseSummary);
await writeCsv(resolve(outputDir, "roni_month_phase_summary.md"), monthPhaseSummary);
await writeFile(resolve(outputDir, "roni_oni_comparison_report.md"), `\uFEFF${report}\n`, "utf8");
