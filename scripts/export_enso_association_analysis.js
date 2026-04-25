import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readCsv, writeCsv } from "../src/csv.js";

const inputPath =
  process.argv[2] ?? "data/output/final/south_korea_fixed_1991_2020_comparison.md";
const outputDir = process.argv[3] ?? "data/output/final/enso_analysis";

const ONI_SOURCE_URL =
  "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php";

const ONI_TEXT = `
1970 0.5 0.3 0.3 0.2 0.0 -0.3 -0.6 -0.8 -0.8 -0.7 -0.9 -1.1
1971 -1.4 -1.4 -1.1 -0.8 -0.7 -0.7 -0.8 -0.8 -0.8 -0.9 -1.0 -0.9
1972 -0.7 -0.4 0.1 0.4 0.7 0.9 1.1 1.4 1.6 1.8 2.1 2.1
1973 1.8 1.2 0.5 -0.1 -0.5 -0.9 -1.1 -1.3 -1.5 -1.7 -1.9 -2.0
1974 -1.8 -1.6 -1.2 -1.0 -0.9 -0.8 -0.5 -0.4 -0.4 -0.6 -0.8 -0.6
1975 -0.5 -0.6 -0.7 -0.7 -0.8 -1.0 -1.1 -1.2 -1.4 -1.4 -1.6 -1.7
1976 -1.6 -1.2 -0.7 -0.5 -0.3 0.0 0.2 0.4 0.6 0.8 0.9 0.8
1977 0.7 0.6 0.3 0.2 0.2 0.3 0.4 0.4 0.6 0.7 0.8 0.8
1978 0.7 0.4 0.1 -0.2 -0.3 -0.3 -0.4 -0.4 -0.4 -0.3 -0.1 0.0
1979 0.0 0.1 0.2 0.3 0.2 0.0 0.0 0.2 0.3 0.5 0.5 0.6
1980 0.6 0.5 0.3 0.4 0.5 0.5 0.3 0.0 -0.1 0.0 0.1 0.0
1981 -0.3 -0.5 -0.5 -0.4 -0.3 -0.3 -0.3 -0.2 -0.2 -0.1 -0.2 -0.1
1982 0.0 0.1 0.2 0.5 0.7 0.7 0.8 1.1 1.6 2.0 2.2 2.2
1983 2.2 1.9 1.5 1.3 1.1 0.7 0.3 -0.1 -0.5 -0.8 -1.0 -0.9
1984 -0.6 -0.4 -0.3 -0.4 -0.5 -0.4 -0.3 -0.2 -0.2 -0.6 -0.9 -1.1
1985 -1.0 -0.8 -0.8 -0.8 -0.8 -0.6 -0.5 -0.5 -0.4 -0.3 -0.3 -0.4
1986 -0.5 -0.5 -0.3 -0.2 -0.1 0.0 0.2 0.4 0.7 0.9 1.1 1.2
1987 1.2 1.2 1.1 0.9 1.0 1.2 1.5 1.7 1.6 1.5 1.3 1.1
1988 0.8 0.5 0.1 -0.3 -0.9 -1.3 -1.3 -1.1 -1.2 -1.5 -1.8 -1.8
1989 -1.7 -1.4 -1.1 -0.8 -0.6 -0.4 -0.3 -0.3 -0.2 -0.2 -0.2 -0.1
1990 0.1 0.2 0.3 0.3 0.3 0.3 0.3 0.4 0.4 0.3 0.4 0.4
1991 0.4 0.3 0.2 0.3 0.5 0.6 0.7 0.6 0.6 0.8 1.2 1.5
1992 1.7 1.6 1.5 1.3 1.1 0.7 0.4 0.1 -0.1 -0.2 -0.3 -0.1
1993 0.1 0.3 0.5 0.7 0.7 0.6 0.3 0.3 0.2 0.1 0.0 0.1
1994 0.1 0.1 0.2 0.3 0.4 0.4 0.4 0.4 0.6 0.7 1.0 1.1
1995 1.0 0.7 0.5 0.3 0.1 0.0 -0.2 -0.5 -0.8 -1.0 -1.0 -1.0
1996 -0.9 -0.8 -0.6 -0.4 -0.3 -0.3 -0.3 -0.3 -0.4 -0.4 -0.4 -0.5
1997 -0.5 -0.4 -0.1 0.3 0.8 1.2 1.6 1.9 2.1 2.3 2.4 2.4
1998 2.2 1.9 1.4 1.0 0.5 -0.1 -0.8 -1.1 -1.3 -1.4 -1.5 -1.6
1999 -1.5 -1.3 -1.1 -1.0 -1.0 -1.0 -1.1 -1.1 -1.2 -1.3 -1.5 -1.7
2000 -1.7 -1.4 -1.1 -0.8 -0.7 -0.6 -0.6 -0.5 -0.5 -0.6 -0.7 -0.7
2001 -0.7 -0.5 -0.4 -0.3 -0.3 -0.1 -0.1 -0.1 -0.2 -0.3 -0.3 -0.3
2002 -0.1 0.0 0.1 0.2 0.4 0.7 0.8 0.9 1.0 1.2 1.3 1.1
2003 0.9 0.6 0.4 0.0 -0.3 -0.2 0.1 0.2 0.3 0.3 0.4 0.4
2004 0.4 0.3 0.2 0.2 0.2 0.3 0.5 0.6 0.7 0.7 0.7 0.7
2005 0.6 0.6 0.4 0.4 0.3 0.1 -0.1 -0.1 -0.1 -0.3 -0.6 -0.8
2006 -0.9 -0.8 -0.6 -0.4 -0.1 0.0 0.1 0.3 0.5 0.8 0.9 0.9
2007 0.7 0.2 -0.1 -0.3 -0.4 -0.5 -0.6 -0.8 -1.1 -1.3 -1.5 -1.6
2008 -1.6 -1.5 -1.3 -1.0 -0.8 -0.6 -0.4 -0.2 -0.2 -0.4 -0.6 -0.7
2009 -0.8 -0.8 -0.6 -0.3 0.0 0.3 0.5 0.6 0.7 1.0 1.4 1.6
2010 1.5 1.2 0.8 0.4 -0.2 -0.7 -1.0 -1.3 -1.6 -1.6 -1.6 -1.5
2011 -1.3 -1.0 -0.8 -0.6 -0.5 -0.4 -0.4 -0.6 -0.8 -1.0 -1.0 -0.9
2012 -0.7 -0.6 -0.5 -0.4 -0.2 0.1 0.3 0.4 0.4 0.3 0.1 -0.1
2013 -0.3 -0.3 -0.2 -0.2 -0.3 -0.3 -0.4 -0.3 -0.2 -0.1 -0.1 -0.2
2014 -0.3 -0.3 -0.1 0.2 0.3 0.2 0.1 0.1 0.3 0.5 0.7 0.8
2015 0.7 0.6 0.7 0.8 1.0 1.3 1.6 1.9 2.2 2.5 2.6 2.8
2016 2.6 2.3 1.7 1.0 0.5 0.0 -0.3 -0.5 -0.6 -0.6 -0.6 -0.5
2017 -0.2 0.0 0.2 0.3 0.4 0.4 0.2 -0.1 -0.3 -0.6 -0.8 -0.9
2018 -0.8 -0.7 -0.6 -0.4 -0.1 0.1 0.1 0.3 0.5 0.8 1.0 0.9
2019 0.9 0.9 0.8 0.8 0.6 0.5 0.3 0.2 0.2 0.4 0.6 0.7
2020 0.6 0.6 0.5 0.3 0.0 -0.2 -0.4 -0.5 -0.8 -1.1 -1.2 -1.1
2021 -0.9 -0.8 -0.7 -0.5 -0.4 -0.3 -0.3 -0.4 -0.6 -0.8 -0.9 -0.9
2022 -0.8 -0.8 -0.9 -1.0 -0.9 -0.8 -0.8 -0.9 -1.0 -0.9 -0.8 -0.7
2023 -0.5 -0.3 0.0 0.3 0.6 0.8 1.1 1.4 1.6 1.8 2.0 2.1
2024 1.9 1.6 1.3 0.8 0.5 0.2 0.1 -0.1 -0.2 -0.2 -0.3 -0.4
2025 -0.4 -0.2 -0.1 0.0 0.0 0.0 -0.1 -0.3 -0.4 -0.5 -0.6 -0.5
2026 -0.4 -0.2
`;

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + 1e-9) * factor) / factor;
}

function format(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }
  return round(value, digits).toFixed(digits);
}

function monthIndex(year, month) {
  return year * 12 + month - 1;
}

function parseOniRows() {
  return ONI_TEXT.trim()
    .split(/\n/u)
    .flatMap((line) => {
      const parts = line.trim().split(/\s+/u);
      const year = Number(parts[0]);
      return parts.slice(1).map((value, index) => ({
        year,
        month: index + 1,
        oni: Number(value),
        raw_phase:
          Number(value) >= 0.5
            ? "El Nino"
            : Number(value) <= -0.5
              ? "La Nina"
              : "Neutral",
      }));
    })
    .sort((left, right) => monthIndex(left.year, left.month) - monthIndex(right.year, right.month));
}

function assignEpisodePhases(oniRows) {
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

  for (const item of oniRows) {
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

function assignEpisodeLifecycleStages(oniRows) {
  const result = new Map();
  let run = [];

  const flush = () => {
    if (run.length >= 5) {
      const target =
        run[0].raw_phase === "El Nino"
          ? Math.max(...run.map((item) => item.oni))
          : Math.min(...run.map((item) => item.oni));
      const turningPointIndex = run.findIndex((item) => item.oni === target);
      for (const [index, item] of run.entries()) {
        result.set(
          `${item.year}:${item.month}`,
          index <= turningPointIndex ? "Development" : "Decay",
        );
      }
    }
    run = [];
  };

  for (const item of oniRows) {
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
  if (finite.length === 0) {
    return null;
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function median(values) {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) {
    return null;
  }
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 === 0 ? (finite[mid - 1] + finite[mid]) / 2 : finite[mid];
}

function correlation(pairs) {
  const valid = pairs.filter(
    ([left, right]) => Number.isFinite(left) && Number.isFinite(right),
  );
  if (valid.length < 3) {
    return null;
  }
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

function phaseOrder(phase) {
  return { "El Nino": 0, Neutral: 1, "La Nina": 2 }[phase] ?? 9;
}

function seasonForMonth(month) {
  if ([3, 4, 5].includes(month)) return "MAM";
  if ([6, 7, 8].includes(month)) return "JJA";
  if ([9, 10, 11].includes(month)) return "SON";
  return "DJF";
}

function seasonCenterMonth(season) {
  return { DJF: 1, MAM: 4, JJA: 7, SON: 10 }[season];
}

function seasonMonthSpecs(seasonYear, season) {
  if (season === "DJF") {
    return [
      { year: seasonYear - 1, month: 12 },
      { year: seasonYear, month: 1 },
      { year: seasonYear, month: 2 },
    ];
  }

  const startMonth = { MAM: 3, JJA: 6, SON: 9 }[season];
  return [0, 1, 2].map((offset) => ({ year: seasonYear, month: startMonth + offset }));
}

function signFromDeparture(value) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.05) return "0";
  return value > 0 ? "+" : "-";
}

function signFromRatio(value) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 110) return "+";
  if (value <= 90) return "-";
  return "0";
}

function summarizeGroup(rows, groupFields) {
  const groups = new Map();
  for (const row of rows) {
    const key = groupFields.map((field) => row[field]).join(":");
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
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
        oni_mean: round(mean(groupRows.map((row) => row.oni)), 4),
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

function aggregateSeasonYearRows(analysisRows) {
  const rowsByMonth = new Map(
    analysisRows.map((row) => [`${row.year}:${row.month}`, row]),
  );
  const years = [...new Set(analysisRows.map((row) => row.year))].sort((left, right) => left - right);
  const seasons = ["DJF", "MAM", "JJA", "SON"];
  const seasonRows = [];

  for (const seasonYear of years) {
    for (const season of seasons) {
      const monthSpecs = seasonMonthSpecs(seasonYear, season);
      const monthlyRows = monthSpecs.map(({ year, month }) => rowsByMonth.get(`${year}:${month}`));
      if (monthlyRows.some((row) => row === undefined)) {
        continue;
      }

      const centerRow = rowsByMonth.get(`${seasonYear}:${seasonCenterMonth(season)}`);
      if (!centerRow) {
        continue;
      }

      const tavgDeparture = mean(monthlyRows.map((row) => row.tavg_departure));
      const precipObserved = monthlyRows.reduce((sum, row) => sum + row.precip_observed, 0);
      const precipNormal = monthlyRows.reduce((sum, row) => sum + row.precip_normal, 0);
      const precipDeparture = precipObserved - precipNormal;
      const precipRatio = (precipObserved / precipNormal) * 100;

      seasonRows.push({
        year: seasonYear,
        season,
        oni: centerRow.oni,
        phase: centerRow.phase,
        lifecycle_stage: centerRow.lifecycle_stage,
        tavg_departure: tavgDeparture,
        tavg_sign: signFromDeparture(tavgDeparture),
        precip_observed: precipObserved,
        precip_normal: precipNormal,
        precip_departure: precipDeparture,
        precip_ratio_pct: precipRatio,
        precip_sign: signFromRatio(precipRatio),
      });
    }
  }

  return seasonRows;
}

const oniRows = parseOniRows();
const oniByMonthIndex = new Map(oniRows.map((row) => [monthIndex(row.year, row.month), row.oni]));
const phaseMap = assignEpisodePhases(oniRows);
const lifecycleStageMap = assignEpisodeLifecycleStages(oniRows);

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
  const oni = oniByMonthIndex.get(monthIndex(year, month));
  if (!tavg || !precip || oni === undefined) continue;
  analysisRows.push({
    year,
    month,
    season: seasonForMonth(month),
    oni,
    phase: phaseMap.get(`${year}:${month}`) ?? "Neutral",
    lifecycle_stage: lifecycleStageMap.get(`${year}:${month}`) ?? "Neutral",
    tavg_departure: Number(tavg.departure_value),
    tavg_sign: tavg.departure_sign,
    precip_observed: Number(precip.observed_value),
    precip_normal: Number(precip.normal_value),
    precip_departure: Number(precip.departure_value),
    precip_sign: precip.departure_sign,
  });
}

const phaseSummary = summarizeGroup(analysisRows, ["phase"]);
const monthPhaseSummary = summarizeGroup(analysisRows, ["month", "phase"]);
const seasonMonthSampleSummary = summarizeGroup(analysisRows, ["season", "phase"]);
const seasonYearRows = aggregateSeasonYearRows(analysisRows);
const seasonPhaseSummary = summarizeGroup(seasonYearRows, ["season", "phase"]);
const lifecycleRows = analysisRows.filter((row) => row.lifecycle_stage !== "Neutral");
const seasonLifecycleRows = seasonYearRows.filter((row) => row.lifecycle_stage !== "Neutral");
const lifecyclePhaseSummary = summarizeGroup(lifecycleRows, ["phase", "lifecycle_stage"]);
const monthLifecycleSummary = summarizeGroup(lifecycleRows, [
  "month",
  "phase",
  "lifecycle_stage",
]);
const seasonLifecycleSummary = summarizeGroup(seasonLifecycleRows, [
  "season",
  "phase",
  "lifecycle_stage",
]);
const activeSeasonYearRows = seasonYearRows
  .filter((row) => row.phase !== "Neutral")
  .map((row) => ({
    year: row.year,
    season: row.season,
    phase: row.phase,
    lifecycle_stage: row.lifecycle_stage,
    oni: round(row.oni, 1),
    tavg_departure: round(row.tavg_departure, 4),
    tavg_sign: row.tavg_sign,
    precip_observed: round(row.precip_observed, 4),
    precip_normal: round(row.precip_normal, 4),
    precip_departure: round(row.precip_departure, 4),
    precip_ratio_pct: round(row.precip_ratio_pct, 4),
    precip_sign: row.precip_sign,
  }))
  .sort((left, right) => {
    const yearDiff = right.year - left.year;
    if (yearDiff !== 0) return yearDiff;
    const seasonOrder = { DJF: 0, MAM: 1, JJA: 2, SON: 3 };
    return (seasonOrder[left.season] ?? 9) - (seasonOrder[right.season] ?? 9);
  });

const lagCorrelationRows = [];
for (let lag = 0; lag <= 6; lag += 1) {
  const pairsTavg = [];
  const pairsPrecip = [];
  for (const row of analysisRows) {
    const oni = oniByMonthIndex.get(monthIndex(row.year, row.month) - lag);
    if (oni === undefined) continue;
    pairsTavg.push([oni, row.tavg_departure]);
    pairsPrecip.push([oni, row.precip_departure]);
  }
  lagCorrelationRows.push({
    oni_leads_by_months: lag,
    n: pairsTavg.length,
    corr_oni_tavg_departure: round(correlation(pairsTavg), 4),
    corr_oni_precip_departure: round(correlation(pairsPrecip), 4),
  });
}

function getRow(rows, phase) {
  return rows.find((row) => row.phase === phase);
}

const elNino = getRow(phaseSummary, "El Nino");
const laNina = getRow(phaseSummary, "La Nina");
const neutral = getRow(phaseSummary, "Neutral");

const keyFindings = [
  `전체 월 기준 평균기온 편차 평균은 El Nino ${format(elNino.tavg_departure_mean)}°C, Neutral ${format(neutral.tavg_departure_mean)}°C, La Nina ${format(laNina.tavg_departure_mean)}°C입니다.`,
  `전체 월 기준 강수량 평년비는 El Nino ${format(elNino.precip_ratio_pct)}%, Neutral ${format(neutral.precip_ratio_pct)}%, La Nina ${format(laNina.precip_ratio_pct)}%입니다.`,
  `동월 ONI와 평균기온 편차의 상관은 ${format(lagCorrelationRows[0].corr_oni_tavg_departure, 2)}, ONI와 강수량 편차의 상관은 ${format(lagCorrelationRows[0].corr_oni_precip_departure, 2)}입니다.`,
  "ENSO 영향은 전체 평균보다 월별·계절별 차이가 더 중요하므로, 전망 활용 시 월별 phase summary를 우선 참고해야 합니다.",
];

const report = [
  "# ENSO와 남한 평균기온·강수량 연관성 분석",
  "",
  `- ONI 기준자료: ${ONI_SOURCE_URL}`,
  "- ONI phase: CPC ONI v5의 ±0.5°C 기준과 최소 5개 연속 overlapping season 조건을 적용했습니다.",
  "- 월 대응: DJF=1월, JFM=2월, ..., NDJ=12월처럼 3개월 계절의 가운데 월에 대응했습니다.",
  "- 기후자료: 남한 1991~2020 고정 평년 대비 평균기온 편차와 강수량 편차를 사용했습니다.",
  "",
  "## 핵심 해석",
  "",
  ...keyFindings.map((line) => `- ${line}`),
  "",
  "## ENSO Phase별 전체 월 합성",
  "",
  markdownTable(phaseSummary, [
    "phase",
    "n",
    "oni_mean",
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
  "## ONI 선행월별 상관",
  "",
  "- `oni_leads_by_months=0`은 같은 달, `1`은 ONI가 1개월 선행한 경우입니다.",
  "",
  markdownTable(lagCorrelationRows, [
    "oni_leads_by_months",
    "n",
    "corr_oni_tavg_departure",
    "corr_oni_precip_departure",
  ]),
  "",
  "## 계절별 ENSO 합성",
  "",
  "- 아래 표는 3개월이 모두 있는 완전한 계절연도 단위입니다. 예를 들어 JJA 표본은 6~8월을 한 해 여름으로 합산한 개수입니다.",
  "",
  markdownTable(seasonPhaseSummary, [
    "season",
    "phase",
    "n",
    "tavg_departure_mean",
    "tavg_high_pct",
    "precip_departure_mean",
    "precip_ratio_pct",
    "precip_wet_pct",
  ]),
  "",
  "## 계절별 ENSO 월표본 합성",
  "",
  "- 이 표는 월별 행을 계절명으로 묶은 진단용 표입니다. JJA n은 여름 개수가 아니라 6월, 7월, 8월 월별 표본 개수입니다.",
  "",
  markdownTable(seasonMonthSampleSummary, [
    "season",
    "phase",
    "n",
    "tavg_departure_mean",
    "tavg_high_pct",
    "precip_departure_mean",
    "precip_ratio_pct",
    "precip_wet_pct",
  ]),
  "",
  "## 월별 ENSO 합성",
  "",
  markdownTable(monthPhaseSummary, [
    "month",
    "phase",
    "n",
    "tavg_departure_mean",
    "tavg_high_pct",
    "precip_departure_mean",
    "precip_ratio_pct",
    "precip_wet_pct",
  ]),
  "",
  "## 발달기·소멸기 ENSO 합성",
  "",
  "- 발달기와 소멸기는 공식 ONI episode 안에서만 나눕니다.",
  "- El Nino는 episode 시작부터 첫 번째 ONI 최댓값까지를 발달기, 이후 종료까지를 소멸기로 둡니다.",
  "- La Nina는 episode 시작부터 첫 번째 ONI 최솟값까지를 발달기, 이후 종료까지를 소멸기로 둡니다.",
  "- 정점 또는 저점 계절은 발달기에 포함합니다.",
  "",
  markdownTable(lifecyclePhaseSummary, [
    "phase",
    "lifecycle_stage",
    "n",
    "oni_mean",
    "tavg_departure_mean",
    "tavg_high_pct",
    "precip_ratio_pct",
    "precip_wet_pct",
  ]),
  "",
  "## 계절별 발달기·소멸기 합성",
  "",
  markdownTable(seasonLifecycleSummary, [
    "season",
    "phase",
    "lifecycle_stage",
    "n",
    "tavg_departure_mean",
    "tavg_high_pct",
    "precip_departure_mean",
    "precip_ratio_pct",
    "precip_wet_pct",
  ]),
  "",
  "## ENSO 영향 계절연도 상세표",
  "",
  "- 이 표는 episode 시작연도가 아니라 해당 계절 자체가 ONI El Nino 또는 La Nina phase였는지를 기준으로 합니다.",
  "- 예를 들어 1987년은 episode 시작연도가 아니어도 JJA와 DJF 등 실제 계절이 엘니뇨 phase이므로 포함됩니다.",
  "- 2022년은 2021년에 시작한 라니냐가 지속된 해이므로 JJA와 DJF 등 실제 라니냐 계절연도에 포함됩니다.",
  "",
  markdownTable(
    activeSeasonYearRows.filter((row) => ["DJF", "JJA"].includes(row.season)),
    [
      "year",
      "season",
      "phase",
      "lifecycle_stage",
      "oni",
      "tavg_departure",
      "tavg_sign",
      "precip_ratio_pct",
      "precip_sign",
    ],
  ),
  "",
  "## 활용상 주의",
  "",
  "- ENSO는 한반도 기온·강수의 단독 설명변수가 아닙니다. 서태평양 대류, 북태평양고기압, 유라시아 눈덮임, 북극진동, 장마전선, 태풍 경로 등과 함께 해석해야 합니다.",
  "- 강수량은 표본 수와 극값 영향이 커서 평균보다 월별 부호 비율과 사례연도 확인이 더 중요합니다.",
  "- 최근 ONI 값은 NOAA 설명처럼 추정치 성격이 있으며, 이후 재분석으로 일부 바뀔 수 있습니다.",
].join("\n");

await mkdir(resolve(outputDir), { recursive: true });
await writeCsv(resolve(outputDir, "enso_phase_summary.md"), phaseSummary);
await writeCsv(resolve(outputDir, "enso_month_phase_summary.md"), monthPhaseSummary);
await writeCsv(resolve(outputDir, "enso_season_phase_summary.md"), seasonPhaseSummary);
await writeCsv(resolve(outputDir, "enso_lifecycle_phase_summary.md"), lifecyclePhaseSummary);
await writeCsv(resolve(outputDir, "enso_month_lifecycle_summary.md"), monthLifecycleSummary);
await writeCsv(resolve(outputDir, "enso_season_lifecycle_summary.md"), seasonLifecycleSummary);
await writeCsv(resolve(outputDir, "enso_active_season_years.md"), activeSeasonYearRows);
await writeCsv(
  resolve(outputDir, "enso_season_month_sample_summary.md"),
  seasonMonthSampleSummary,
);
await writeCsv(resolve(outputDir, "enso_lag_correlations.md"), lagCorrelationRows);
await writeFile(resolve(outputDir, "enso_association_report.md"), `${report}\n`, "utf8");
