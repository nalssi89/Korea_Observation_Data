import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readCsv, writeCsv } from "../src/csv.js";
import {
  buildYearMonthPivotRows,
  formatValueWithSignRows,
  SOUTH_KOREA_PIVOT_SPECS,
} from "../src/pivot.js";

const inputPath =
  process.argv[2] ?? "data/output/final/south_korea_fixed_1991_2020_comparison.md";
const outputDir =
  process.argv[3] ?? "data/output/final/south_korea_tables";

const rows = await readCsv(resolve(inputPath));
await mkdir(resolve(outputDir), { recursive: true });

for (const spec of SOUTH_KOREA_PIVOT_SPECS) {
  const pivotRows = buildYearMonthPivotRows(rows, {
    regionName: "\uB0A8\uD55C",
    variable: spec.variable,
    valueField: spec.valueField,
  });
  await writeCsv(resolve(outputDir, spec.fileName.replace(/\.data$/u, ".md")), pivotRows);
}

const reportSpecs = [
  {
    variable: "tavg",
    title: "mean_temperature_departure",
    heading: "\uD3C9\uADE0\uAE30\uC628 \uD3B8\uCC28",
    valueField: "departure_value",
  },
  {
    variable: "tmin",
    title: "minimum_temperature_departure",
    heading: "\uCD5C\uC800\uAE30\uC628 \uD3B8\uCC28",
    valueField: "departure_value",
  },
  {
    variable: "tmax",
    title: "maximum_temperature_departure",
    heading: "\uCD5C\uACE0\uAE30\uC628 \uD3B8\uCC28",
    valueField: "departure_value",
  },
  {
    variable: "precip",
    title: "monthly_precipitation",
    heading: "\uAC15\uC218\uB7C9",
    valueField: "observed_value",
  },
];

function toMarkdownTable(rowsForTable) {
  const headers = [
    "\uC5F0\uB3C4",
    "1\uC6D4",
    "2\uC6D4",
    "3\uC6D4",
    "4\uC6D4",
    "5\uC6D4",
    "6\uC6D4",
    "7\uC6D4",
    "8\uC6D4",
    "9\uC6D4",
    "10\uC6D4",
    "11\uC6D4",
    "12\uC6D4",
  ];
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];

  for (const row of rowsForTable) {
    lines.push(`| ${headers.map((header) => row[header] ?? "").join(" | ")} |`);
  }

  return lines.join("\n");
}

const finalReportParts = [
  "# \uB0A8\uD55C \uC5F0\uB3C4-\uC6D4\uBCC4 \uCD5C\uC885\uD45C",
  "",
  "- \uAE30\uC628: 1991-2020 \uACE0\uC815 \uD3C9\uB144\uAC12 \uB300\uBE44 \uD3B8\uCC28\uAC12(\uBD80\uD638)",
  "- \uAC15\uC218\uB7C9: \uC6D4 \uB204\uC801\uAC15\uC218\uB7C9(\uD3C9\uB144 \uB300\uBE44 \uBD80\uD638)",
  "- \uBD80\uD638: 1991-2020 \uAC01 \uC6D4\uAC12 \uBD84\uD3EC\uC758 33.33~66.67% \uBC94\uC704\uB294 0, \uADF8 \uBBF8\uB9CC\uC740 -, \uADF8 \uCD08\uACFC\uB294 +",
  "",
];

for (const spec of reportSpecs) {
  const rowsForReport = formatValueWithSignRows(rows, {
    variable: spec.variable,
    valueField: spec.valueField,
  });
  const markdownTable = toMarkdownTable(rowsForReport);

  await writeCsv(
    resolve(outputDir, `${spec.title}_value_sign_by_year.md`),
    rowsForReport,
  );
  await writeFile(
    resolve(outputDir, `${spec.title}_value_sign_table.md`),
    `# ${spec.heading}\n\n${markdownTable}\n`,
    "utf8",
  );
  finalReportParts.push(`## ${spec.heading}`, "", markdownTable, "");
}

await writeFile(
  resolve(outputDir, "south_korea_final_value_sign_tables.md"),
  `${finalReportParts.join("\n")}\n`,
  "utf8",
);
