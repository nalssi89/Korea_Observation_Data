import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readCsv, writeCsv } from "../src/csv.js";

const inputPath = process.argv[2] ?? "data/output/final/region_monthly.md";
const outputDir = process.argv[3] ?? "data/output/final/outlook_reference";

const VARIABLES = ["tavg", "tmin", "tmax", "precip"];
const TEMPERATURE_VARIABLES = ["tavg", "tmin", "tmax"];
const LATEST_YEAR = 2026;
const BASELINE_START = 1991;
const BASELINE_END = 2020;
const LATEST_MONTHS = [1, 2, 3];
const OUTLOOK_MONTHS = [4, 5, 6];

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + 1e-9) * factor) / factor;
}

function format(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }
  return round(value, digits).toFixed(digits);
}

function quantile(values, probability) {
  const sorted = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (sorted.length === 0) {
    return null;
  }
  if (sorted.length === 1) {
    return sorted[0];
  }

  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];
  if (lowerIndex === upperIndex) {
    return lower;
  }

  return lower + (upper - lower) * (position - lowerIndex);
}

function signFromRange(value, p33, p66) {
  if (value === null || p33 === null || p66 === null) {
    return "";
  }
  if (value < p33) {
    return "-";
  }
  if (value > p66) {
    return "+";
  }
  return "0";
}

function signText(variable, sign) {
  if (sign === "-") {
    return variable === "precip" ? "적음" : "낮음";
  }
  if (sign === "+") {
    return variable === "precip" ? "많음" : "높음";
  }
  if (sign === "0") {
    return "비슷";
  }
  return "미싱";
}

function variableName(variable) {
  return {
    tavg: "평균기온",
    tmin: "최저기온",
    tmax: "최고기온",
    precip: "강수량",
  }[variable];
}

function buildNormalStats(rows) {
  const stats = new Map();
  const regions = [...new Set(rows.map((row) => row.region_name))];

  for (const region of regions) {
    for (const month of Array.from({ length: 12 }, (_, index) => index + 1)) {
      const normalRows = rows.filter(
        (row) =>
          row.region_name === region &&
          row.year >= BASELINE_START &&
          row.year <= BASELINE_END &&
          row.month === month,
      );

      for (const variable of VARIABLES) {
        const values = normalRows
          .map((row) => row[variable])
          .filter((value) => value !== null && value !== undefined);
        if (values.length < 30) {
          continue;
        }
        const normal = values.reduce((sum, value) => sum + value, 0) / values.length;
        stats.set(`${region}:${month}:${variable}`, {
          normal,
          p33: quantile(values, 0.3333),
          p66: quantile(values, 0.6667),
        });
      }
    }
  }

  return stats;
}

function enrichRows(rows, stats) {
  return rows.map((row) => {
    const enriched = { ...row, variables: {} };
    for (const variable of VARIABLES) {
      const normal = stats.get(`${row.region_name}:${row.month}:${variable}`);
      const observed = row[variable];
      const departure =
        observed === null || normal === undefined ? null : observed - normal.normal;
      enriched.variables[variable] = {
        observed,
        normal: normal?.normal ?? null,
        departure,
        p33: normal?.p33 ?? null,
        p66: normal?.p66 ?? null,
        sign: normal ? signFromRange(observed, normal.p33, normal.p66) : "",
      };
    }
    return enriched;
  });
}

function buildAnnualCharacteristics(enrichedRows) {
  const groups = new Map();
  for (const row of enrichedRows) {
    if (row.year === LATEST_YEAR) {
      continue;
    }
    const key = `${row.region_name}:${row.year}`;
    const current = groups.get(key) ?? {
      region_name: row.region_name,
      year: row.year,
      months: [],
    };
    current.months.push(row);
    groups.set(key, current);
  }

  const annualRows = [];
  for (const group of groups.values()) {
    if (group.months.length < 12) {
      continue;
    }

    const annual = {
      region_name: group.region_name,
      year: group.year,
    };

    for (const variable of TEMPERATURE_VARIABLES) {
      const departures = group.months.map((row) => row.variables[variable].departure);
      annual[`${variable}_mean_departure`] = round(
        departures.reduce((sum, value) => sum + value, 0) / departures.length,
        4,
      );
      annual[`${variable}_plus_months`] = group.months.filter(
        (row) => row.variables[variable].sign === "+",
      ).length;
      annual[`${variable}_zero_months`] = group.months.filter(
        (row) => row.variables[variable].sign === "0",
      ).length;
      annual[`${variable}_minus_months`] = group.months.filter(
        (row) => row.variables[variable].sign === "-",
      ).length;
    }

    const precipObserved = group.months.reduce(
      (sum, row) => sum + row.variables.precip.observed,
      0,
    );
    const precipNormal = group.months.reduce(
      (sum, row) => sum + row.variables.precip.normal,
      0,
    );
    annual.precip_total = round(precipObserved, 4);
    annual.precip_normal_total = round(precipNormal, 4);
    annual.precip_departure = round(precipObserved - precipNormal, 4);
    annual.precip_ratio_percent = round((precipObserved / precipNormal) * 100, 4);
    annual.precip_plus_months = group.months.filter(
      (row) => row.variables.precip.sign === "+",
    ).length;
    annual.precip_zero_months = group.months.filter(
      (row) => row.variables.precip.sign === "0",
    ).length;
    annual.precip_minus_months = group.months.filter(
      (row) => row.variables.precip.sign === "-",
    ).length;

    annualRows.push(annual);
  }

  return annualRows.sort(
    (left, right) =>
      left.region_name.localeCompare(right.region_name, "ko") ||
      left.year - right.year,
  );
}

function topYears(annualRows, region, field, direction, count = 5) {
  return annualRows
    .filter((row) => row.region_name === region)
    .sort((left, right) =>
      direction === "desc" ? right[field] - left[field] : left[field] - right[field],
    )
    .slice(0, count)
    .map((row) => `${row.year}(${format(row[field])})`)
    .join(", ");
}

function latestPattern(enrichedRows, region) {
  return LATEST_MONTHS.flatMap((month) => {
    const row = enrichedRows.find(
      (entry) => entry.region_name === region && entry.year === LATEST_YEAR && entry.month === month,
    );
    return VARIABLES.map((variable) => row?.variables[variable].sign ?? "");
  });
}

function candidatePattern(enrichedRows, region, year) {
  return LATEST_MONTHS.flatMap((month) => {
    const row = enrichedRows.find(
      (entry) => entry.region_name === region && entry.year === year && entry.month === month,
    );
    return VARIABLES.map((variable) => row?.variables[variable].sign ?? "");
  });
}

function findAnalogYears(enrichedRows, region) {
  const target = latestPattern(enrichedRows, region);
  const candidateYears = [
    ...new Set(
      enrichedRows
        .filter(
          (row) =>
            row.region_name === region &&
            row.year >= BASELINE_START &&
            row.year < LATEST_YEAR,
        )
        .map((row) => row.year),
    ),
  ].sort((left, right) => left - right);

  return candidateYears
    .map((year) => {
      const pattern = candidatePattern(enrichedRows, region, year);
      const matches = target.reduce(
        (count, sign, index) => count + (sign !== "" && sign === pattern[index] ? 1 : 0),
        0,
      );
      return { year, matches };
    })
    .sort((left, right) => right.matches - left.matches || right.year - left.year)
    .slice(0, 5);
}

function summarizeOutlookMonths(enrichedRows, region, analogYears) {
  const rows = enrichedRows.filter(
    (row) =>
      row.region_name === region &&
      analogYears.some((analog) => analog.year === row.year) &&
      OUTLOOK_MONTHS.includes(row.month),
  );

  const summaries = {};
  for (const variable of VARIABLES) {
    const variableRows = rows.filter((row) => row.variables[variable].sign !== "");
    const signCounts = {
      "-": variableRows.filter((row) => row.variables[variable].sign === "-").length,
      "0": variableRows.filter((row) => row.variables[variable].sign === "0").length,
      "+": variableRows.filter((row) => row.variables[variable].sign === "+").length,
    };
    const total = Math.max(1, variableRows.length);
    if (variable === "precip") {
      const observedTotalByYear = analogYears.map((analog) => {
        const yearRows = rows.filter((row) => row.year === analog.year);
        const observed = yearRows.reduce(
          (sum, row) => sum + row.variables.precip.observed,
          0,
        );
        const normal = yearRows.reduce((sum, row) => sum + row.variables.precip.normal, 0);
        return { observed, normal };
      });
      const meanObserved =
        observedTotalByYear.reduce((sum, row) => sum + row.observed, 0) /
        observedTotalByYear.length;
      const meanNormal =
        observedTotalByYear.reduce((sum, row) => sum + row.normal, 0) /
        observedTotalByYear.length;
      summaries[variable] = {
        signCounts,
        signShare: {
          "-": round((signCounts["-"] / total) * 100),
          "0": round((signCounts["0"] / total) * 100),
          "+": round((signCounts["+"] / total) * 100),
        },
        metric: `${format(meanObserved)}mm (${format((meanObserved / meanNormal) * 100)}%)`,
      };
    } else {
      const meanDeparture =
        variableRows.reduce((sum, row) => sum + row.variables[variable].departure, 0) /
        total;
      summaries[variable] = {
        signCounts,
        signShare: {
          "-": round((signCounts["-"] / total) * 100),
          "0": round((signCounts["0"] / total) * 100),
          "+": round((signCounts["+"] / total) * 100),
        },
        metric: `${format(meanDeparture)}°C`,
      };
    }
  }

  return summaries;
}

function latestStatusText(enrichedRows, region) {
  return LATEST_MONTHS.map((month) => {
    const row = enrichedRows.find(
      (entry) => entry.region_name === region && entry.year === LATEST_YEAR && entry.month === month,
    );
    const parts = VARIABLES.map((variable) => {
      const item = row?.variables[variable];
      const value =
        variable === "precip"
          ? `${format(item?.observed)}mm`
          : `${format(item?.departure)}°C`;
      return `${variableName(variable)} ${value}(${item?.sign ?? ""})`;
    });
    return `${month}월: ${parts.join(", ")}`;
  }).join("; ");
}

function outlookSummaryText(summary) {
  return VARIABLES.map((variable) => {
    const item = summary[variable];
    return `${variableName(variable)} ${item.metric}, +/0/-=${item.signShare["+"]}/${item.signShare["0"]}/${item.signShare["-"]}%`;
  }).join("; ");
}

function buildMarkdownReport(regions, annualRows, enrichedRows) {
  const lines = [
    "# 권역별 연도 특성 및 향후 3개월 전망 참고자료",
    "",
    "- 목적: 실제 예측값을 제시하는 것이 아니라, 권역별 과거 연도 특성과 최근 패턴의 유사 사례를 정리해 향후 3개월 전망 검토에 참고한다.",
    "- 기준: 1991~2020 고정 평년, 33.33~66.67%는 비슷(0), 미만은 -, 초과는 +.",
    "- 최신 상태: 2026년 1~3월을 최근 완전 3개월로 사용한다.",
    "- 전망 참고 구간: 4~6월.",
    "- 유사년도: 1991~2025년 중 1~3월의 평균기온, 최저기온, 최고기온, 강수량 부호 패턴이 2026년과 가장 유사한 5개년.",
    "",
  ];

  for (const region of regions) {
    const analogs = findAnalogYears(enrichedRows, region);
    const outlookSummary = summarizeOutlookMonths(enrichedRows, region, analogs);
    lines.push(`## ${region}`);
    lines.push("");
    lines.push("| 항목 | 요약 |");
    lines.push("| --- | --- |");
    lines.push(`| 2026년 1~3월 최근 상태 | ${latestStatusText(enrichedRows, region)} |`);
    lines.push(
      `| 유사년도 상위 5개년 | ${analogs
        .map((analog) => `${analog.year}(${analog.matches}/12)`)
        .join(", ")} |`,
    );
    lines.push(`| 유사년도 4~6월 결과 요약 | ${outlookSummaryText(outlookSummary)} |`);
    lines.push(
      `| 평균기온 연도 특성 | 고온: ${topYears(
        annualRows,
        region,
        "tavg_mean_departure",
        "desc",
      )}; 저온: ${topYears(annualRows, region, "tavg_mean_departure", "asc")} |`,
    );
    lines.push(
      `| 최저기온 연도 특성 | 높음: ${topYears(
        annualRows,
        region,
        "tmin_mean_departure",
        "desc",
      )}; 낮음: ${topYears(annualRows, region, "tmin_mean_departure", "asc")} |`,
    );
    lines.push(
      `| 최고기온 연도 특성 | 높음: ${topYears(
        annualRows,
        region,
        "tmax_mean_departure",
        "desc",
      )}; 낮음: ${topYears(annualRows, region, "tmax_mean_departure", "asc")} |`,
    );
    lines.push(
      `| 강수량 연도 특성 | 다우: ${topYears(
        annualRows,
        region,
        "precip_ratio_percent",
        "desc",
      )}; 소우: ${topYears(annualRows, region, "precip_ratio_percent", "asc")} |`,
    );
    lines.push("");
  }

  lines.push("## 활용 방법");
  lines.push("");
  lines.push("- 유사년도는 예측 결론이 아니라 토의 시작점으로 사용한다.");
  lines.push("- 4~6월 요약에서 + 비율이 높으면 해당 변수의 높은 쪽 위험을, - 비율이 높으면 낮거나 적은 쪽 위험을 우선 점검한다.");
  lines.push("- 강수량은 소수 사례와 국지성 영향이 커서, 유사년도 결과를 단독 판단 기준으로 쓰지 않는다.");
  lines.push("- 최신 계절예보, 해수면온도, 대기순환장, 장마 시작 시점, 태풍 및 저기압 경로 전망과 함께 해석한다.");

  return lines.join("\n");
}

const rawRows = await readCsv(resolve(inputPath));
const monthlyRows = rawRows
  .map((row) => ({
    ...row,
    year: Number(row.year),
    month: Number(row.month),
    tavg: row.tavg === "" ? null : Number(row.tavg),
    tmin: row.tmin === "" ? null : Number(row.tmin),
    tmax: row.tmax === "" ? null : Number(row.tmax),
    precip: row.precip === "" ? null : Number(row.precip),
    station_count_used: Number(row.station_count_used),
  }))
  .filter((row) => {
    const expectedPeriodGroup = row.year <= 1989 ? "1973_1989" : "1990_latest";
    return row.period_group === expectedPeriodGroup;
  })
  .filter(
    (row) =>
      row.year < LATEST_YEAR ||
      (row.year === LATEST_YEAR && LATEST_MONTHS.includes(row.month)),
  );

const regions = [...new Set(monthlyRows.map((row) => row.region_name))].sort((left, right) =>
  left.localeCompare(right, "ko"),
);
const normalStats = buildNormalStats(monthlyRows);
const enrichedRows = enrichRows(monthlyRows, normalStats);
const annualRows = buildAnnualCharacteristics(enrichedRows);

await mkdir(resolve(outputDir), { recursive: true });
await writeCsv(resolve(outputDir, "region_annual_characteristics.md"), annualRows);
await writeFile(
  resolve(outputDir, "region_outlook_reference.md"),
  `${buildMarkdownReport(regions, annualRows, enrichedRows)}\n`,
  "utf8",
);
