import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readCsv, writeCsv } from "../src/csv.js";

const normalStartYear = Number(process.argv[2] ?? 1991);
const normalEndYear = Number(process.argv[3] ?? 2020);
const outputDir = resolve(
  process.argv[4] ?? "data/output/derived/monthly_terciles",
);

const variables = new Set(["tavg", "precip"]);
const variableLabels = {
  tavg: "평균기온",
  precip: "강수량",
};
const units = {
  tavg: "degC",
  precip: "mm",
};
const lowLabels = {
  tavg: "낮음",
  precip: "적음",
};
const highLabels = {
  tavg: "높음",
  precip: "많음",
};

const normalRows = await readCsv(resolve("data/output/final/region_normals.md"));
const rangeRows = await readCsv(resolve("data/output/final/region_normal_ranges.md"));

function key(row) {
  return [
    row.normal_window_start,
    row.normal_window_end,
    row.period_group,
    row.region_name,
    row.month,
    row.variable,
  ].join(":");
}

const normalMap = new Map(normalRows.map((row) => [key(row), row.normal_value]));

const tercileRows = rangeRows
  .filter(
    (row) =>
      Number(row.normal_window_start) === normalStartYear &&
      Number(row.normal_window_end) === normalEndYear &&
      row.period_group === "1990_latest" &&
      variables.has(row.variable),
  )
  .map((row) => ({
    normal_period: `${normalStartYear}-${normalEndYear}`,
    region_name: row.region_name,
    month: Number(row.month),
    variable: row.variable,
    variable_label: variableLabels[row.variable],
    unit: units[row.variable],
    normal_value: Number(normalMap.get(key(row))),
    p33_33: Number(row.p33_33),
    p66_67: Number(row.p66_67),
    lower_tercile: `< ${row.p33_33} (${lowLabels[row.variable]})`,
    middle_tercile: `${row.p33_33} - ${row.p66_67} (비슷)`,
    upper_tercile: `> ${row.p66_67} (${highLabels[row.variable]})`,
  }))
  .sort(
    (left, right) =>
      left.region_name.localeCompare(right.region_name, "ko") ||
      left.month - right.month ||
      left.variable.localeCompare(right.variable),
  );

if (tercileRows.length === 0) {
  throw new Error("No tercile rows were found for the requested normal period.");
}

await mkdir(outputDir, { recursive: true });

const allRegionsCsv = resolve(
  outputDir,
  `region_monthly_tavg_precip_terciles_${normalStartYear}_${normalEndYear}.csv`,
);
const southKoreaCsv = resolve(
  outputDir,
  `south_korea_monthly_tavg_precip_terciles_${normalStartYear}_${normalEndYear}.csv`,
);
const southKoreaMarkdown = resolve(
  outputDir,
  `south_korea_monthly_tavg_precip_terciles_${normalStartYear}_${normalEndYear}.md`,
);

await writeCsv(allRegionsCsv, tercileRows);

const southKoreaRows = tercileRows.filter((row) => row.region_name === "남한");
await writeCsv(southKoreaCsv, southKoreaRows);

function toMarkdownTable(rows) {
  const headers = [
    "월",
    "변수",
    "평년값",
    "하위 삼분위 기준",
    "중간 삼분위",
    "상위 삼분위 기준",
    "단위",
  ];
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];

  for (const row of rows) {
    lines.push(
      [
        `| ${row.month}`,
        row.variable_label,
        row.normal_value,
        row.lower_tercile,
        row.middle_tercile,
        row.upper_tercile,
        `${row.unit} |`,
      ].join(" | "),
    );
  }

  return lines.join("\n");
}

await writeFile(
  southKoreaMarkdown,
  [
    `# 남한 월별 평균기온/강수량 삼분위 (${normalStartYear}-${normalEndYear})`,
    "",
    "- 기준: 권역 월별 집계(`region_monthly.md`)의 `1990_latest` 남한 시계열",
    "- 하위/중간/상위 구분: 각 월 1991-2020 값의 33.33/66.67 퍼센타일",
    "- 평균기온은 `tavg`, 강수량은 월 누적강수량 `precip`",
    "",
    toMarkdownTable(southKoreaRows),
    "",
  ].join("\n"),
  "utf8",
);

console.log(`Wrote ${tercileRows.length} all-region rows to ${allRegionsCsv}`);
console.log(`Wrote ${southKoreaRows.length} South Korea rows to ${southKoreaCsv}`);
console.log(`Wrote South Korea Markdown table to ${southKoreaMarkdown}`);
