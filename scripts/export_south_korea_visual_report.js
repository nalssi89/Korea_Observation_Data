import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { readCsv } from "../src/csv.js";
import { formatFixed } from "../src/pivot.js";

const inputPath =
  process.argv[2] ?? "data/output/final/south_korea_fixed_1991_2020_comparison.md";
const outputPath =
  process.argv[3] ?? "data/output/final/south_korea_visual_report.md";

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const RECENT_YEAR_COUNT = 10;

const VARIABLE_SPECS = [
  {
    variable: "tavg",
    heading: "\uD3C9\uADE0\uAE30\uC628",
    unit: "\u00B0C",
    valueLabel: "\uD3B8\uCC28",
    valueField: "departure_value",
    palette: {
      "-": "#2d6f9f",
      "0": "#efe4bf",
      "+": "#c94d3d",
    },
    annualMode: "meanDeparture",
  },
  {
    variable: "tmin",
    heading: "\uCD5C\uC800\uAE30\uC628",
    unit: "\u00B0C",
    valueLabel: "\uD3B8\uCC28",
    valueField: "departure_value",
    palette: {
      "-": "#315f9b",
      "0": "#efe4bf",
      "+": "#bc4b3d",
    },
    annualMode: "meanDeparture",
  },
  {
    variable: "tmax",
    heading: "\uCD5C\uACE0\uAE30\uC628",
    unit: "\u00B0C",
    valueLabel: "\uD3B8\uCC28",
    valueField: "departure_value",
    palette: {
      "-": "#34789b",
      "0": "#efe4bf",
      "+": "#d15a37",
    },
    annualMode: "meanDeparture",
  },
  {
    variable: "precip",
    heading: "\uAC15\uC218\uB7C9",
    unit: "mm",
    valueLabel: "\uC6D4\uB204\uC801",
    valueField: "observed_value",
    palette: {
      "-": "#c9812b",
      "0": "#d9d1a3",
      "+": "#2f73a8",
    },
    annualMode: "sumDeparture",
  },
];

const rows = (await readCsv(resolve(inputPath))).map((row) => ({
  ...row,
  year: Number(row.year),
  month: Number(row.month),
  observed_value: Number(row.observed_value),
  normal_value: Number(row.normal_value),
  departure_value: Number(row.departure_value),
  p33_33: Number(row.p33_33),
  p66_67: Number(row.p66_67),
  station_count_used: Number(row.station_count_used),
}));

const years = [...new Set(rows.map((row) => row.year))].sort((left, right) => left - right);
const rowMap = new Map(
  rows.map((row) => [`${row.variable}:${row.year}:${row.month}`, row]),
);

function xml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rowFor(spec, year, month) {
  return rowMap.get(`${spec.variable}:${year}:${month}`);
}

function colorFor(spec, sign) {
  return spec.palette[sign] ?? "#f2f2f2";
}

function signLabel(sign, variable) {
  if (sign === "-") {
    return variable === "precip" ? "\uC801\uC74C" : "\uB0AE\uC74C";
  }
  if (sign === "+") {
    return variable === "precip" ? "\uB9CE\uC74C" : "\uB192\uC74C";
  }
  return "\uBE44\uC2B7";
}

function renderLegend(spec, x, y) {
  const entries = ["-", "0", "+"];
  return entries
    .map((sign, index) => {
      const px = x + index * 100;
      return `
        <rect x="${px}" y="${y}" width="14" height="14" rx="3" fill="${colorFor(spec, sign)}" />
        <text x="${px + 20}" y="${y + 11}" font-size="12" fill="#334">${sign} ${xml(signLabel(sign, spec.variable))}</text>`;
    })
    .join("");
}

function renderCalendarHeatmap(spec) {
  const cellWidth = 34;
  const cellHeight = 10;
  const gap = 2;
  const left = 76;
  const top = 56;
  const width = left + MONTHS.length * (cellWidth + gap) + 24;
  const height = top + years.length * (cellHeight + gap) + 46;

  const monthLabels = MONTHS.map((month) => {
    const x = left + (month - 1) * (cellWidth + gap) + cellWidth / 2;
    return `<text x="${x}" y="42" text-anchor="middle" font-size="11" fill="#334">${month}\uC6D4</text>`;
  }).join("");

  const yearLabels = years
    .filter((year) => year === years[0] || year % 5 === 0 || year === years.at(-1))
    .map((year) => {
      const y = top + years.indexOf(year) * (cellHeight + gap) + 8;
      return `<text x="56" y="${y}" text-anchor="end" font-size="10" fill="#53606b">${year}</text>`;
    })
    .join("");

  const cells = years
    .flatMap((year, yearIndex) =>
      MONTHS.map((month) => {
        const row = rowFor(spec, year, month);
        const x = left + (month - 1) * (cellWidth + gap);
        const y = top + yearIndex * (cellHeight + gap);
        const title = row
          ? `${year}-${String(month).padStart(2, "0")} ${spec.heading}: ${formatFixed(row[spec.valueField], 1)}${spec.unit} (${row.departure_sign})`
          : `${year}-${month}`;
        return `<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" rx="2" fill="${colorFor(spec, row?.departure_sign)}"><title>${xml(title)}</title></rect>`;
      }),
    )
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${xml(spec.heading)} sign calendar heatmap">
    <rect width="${width}" height="${height}" rx="18" fill="#fbfaf5"/>
    <text x="24" y="26" font-size="18" font-weight="700" fill="#1f2a35">${xml(spec.heading)} \uBD80\uD638 \uB2EC\uB825</text>
    <text x="24" y="${height - 18}" font-size="12" fill="#66727f">1973~2026, 33.33~66.67% \uBE44\uC2B7\uBC94\uC704=0</text>
    ${monthLabels}
    ${yearLabels}
    ${cells}
    ${renderLegend(spec, left, height - 30)}
  </svg>`;
}

function annualValue(spec, year) {
  const yearRows = MONTHS.map((month) => rowFor(spec, year, month)).filter(Boolean);
  if (spec.annualMode === "sumDeparture") {
    return yearRows.reduce((sum, row) => sum + row.departure_value, 0);
  }

  return yearRows.reduce((sum, row) => sum + row.departure_value, 0) / yearRows.length;
}

function renderAnnualRibbon(spec) {
  const values = years.map((year) => ({ year, value: annualValue(spec, year) }));
  const maxAbs = Math.max(...values.map((entry) => Math.abs(entry.value)), 1);
  const width = 880;
  const height = 250;
  const left = 54;
  const right = 24;
  const top = 42;
  const bottom = 42;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const zeroY = top + chartHeight / 2;
  const barWidth = chartWidth / values.length;

  const bars = values
    .map((entry, index) => {
      const x = left + index * barWidth + 0.5;
      const barHeight = (Math.abs(entry.value) / maxAbs) * (chartHeight / 2);
      const y = entry.value >= 0 ? zeroY - barHeight : zeroY;
      const sign = entry.value > 0 ? "+" : entry.value < 0 ? "-" : "0";
      const title = `${entry.year}: ${formatFixed(entry.value, 1)}${spec.unit}`;
      return `<rect x="${x}" y="${y}" width="${Math.max(2, barWidth - 1)}" height="${barHeight}" rx="1.5" fill="${colorFor(spec, sign)}"><title>${xml(title)}</title></rect>`;
    })
    .join("");

  const yearTicks = years
    .filter((year) => year === years[0] || year % 10 === 0 || year === years.at(-1))
    .map((year) => {
      const x = left + years.indexOf(year) * barWidth + barWidth / 2;
      return `<text x="${x}" y="${height - 16}" text-anchor="middle" font-size="11" fill="#66727f">${year}</text>`;
    })
    .join("");

  const label =
    spec.annualMode === "sumDeparture"
      ? "\uC5F0 \uAC15\uC218\uB7C9 \uD3B8\uCC28\uD569"
      : "\uC5F0\uD3C9\uADE0 \uC6D4\uD3B8\uCC28";

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${xml(spec.heading)} annual departure ribbon">
    <rect width="${width}" height="${height}" rx="18" fill="#fbfaf5"/>
    <text x="24" y="26" font-size="18" font-weight="700" fill="#1f2a35">${xml(spec.heading)} ${label}</text>
    <line x1="${left}" y1="${zeroY}" x2="${width - right}" y2="${zeroY}" stroke="#88939e" stroke-width="1"/>
    <text x="${left - 10}" y="${zeroY - chartHeight / 2 + 4}" text-anchor="end" font-size="10" fill="#66727f">+${formatFixed(maxAbs, 1)}</text>
    <text x="${left - 10}" y="${zeroY + chartHeight / 2}" text-anchor="end" font-size="10" fill="#66727f">-${formatFixed(maxAbs, 1)}</text>
    ${bars}
    ${yearTicks}
  </svg>`;
}

function renderMonthlyDistribution(spec) {
  const width = 880;
  const height = 230;
  const left = 68;
  const top = 46;
  const barWidth = 48;
  const barHeight = 118;
  const gap = 18;

  const bars = MONTHS.map((month, index) => {
    const monthRows = years.map((year) => rowFor(spec, year, month)).filter(Boolean);
    const counts = {
      "-": monthRows.filter((row) => row.departure_sign === "-").length,
      "0": monthRows.filter((row) => row.departure_sign === "0").length,
      "+": monthRows.filter((row) => row.departure_sign === "+").length,
    };
    const total = counts["-"] + counts["0"] + counts["+"];
    const x = left + index * (barWidth + gap);
    let y = top + barHeight;
    const segments = ["-", "0", "+"]
      .map((sign) => {
        const h = total > 0 ? (counts[sign] / total) * barHeight : 0;
        y -= h;
        return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${colorFor(spec, sign)}"><title>${month}\uC6D4 ${signLabel(sign, spec.variable)}: ${counts[sign]}\uD68C</title></rect>`;
      })
      .join("");
    return `
      <g>
        ${segments}
        <rect x="${x}" y="${top}" width="${barWidth}" height="${barHeight}" fill="none" stroke="#e1ded2"/>
        <text x="${x + barWidth / 2}" y="${top + barHeight + 18}" text-anchor="middle" font-size="12" fill="#334">${month}\uC6D4</text>
        <text x="${x + barWidth / 2}" y="${top - 8}" text-anchor="middle" font-size="10" fill="#66727f">${counts["+"]}/${counts["0"]}/${counts["-"]}</text>
      </g>`;
  }).join("");

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${xml(spec.heading)} monthly sign distribution">
    <rect width="${width}" height="${height}" rx="18" fill="#fbfaf5"/>
    <text x="24" y="26" font-size="18" font-weight="700" fill="#1f2a35">${xml(spec.heading)} \uC6D4\uBCC4 \uBD80\uD638 \uBD84\uD3EC</text>
    <text x="24" y="${height - 16}" font-size="12" fill="#66727f">\uB9C9\uB300 \uC704 \uC22B\uC790\uB294 +/0/- \uD69F\uC218</text>
    ${bars}
    ${renderLegend(spec, width - 330, height - 30)}
  </svg>`;
}

function renderRecentMatrix(spec) {
  const recentYears = years.slice(-RECENT_YEAR_COUNT);
  const cellWidth = 58;
  const cellHeight = 28;
  const left = 68;
  const top = 58;
  const width = left + MONTHS.length * cellWidth + 26;
  const height = top + recentYears.length * cellHeight + 46;

  const monthLabels = MONTHS.map((month) => {
    const x = left + (month - 1) * cellWidth + cellWidth / 2;
    return `<text x="${x}" y="43" text-anchor="middle" font-size="11" fill="#334">${month}\uC6D4</text>`;
  }).join("");

  const cells = recentYears
    .flatMap((year, yearIndex) => {
      const yearLabel = `<text x="54" y="${top + yearIndex * cellHeight + 18}" text-anchor="end" font-size="12" fill="#334">${year}</text>`;
      const monthCells = MONTHS.map((month) => {
        const row = rowFor(spec, year, month);
        const x = left + (month - 1) * cellWidth;
        const y = top + yearIndex * cellHeight;
        const value = row ? formatFixed(row[spec.valueField], 1) : "";
        const sign = row?.departure_sign ?? "";
        return `<g>
          <rect x="${x + 2}" y="${y + 2}" width="${cellWidth - 4}" height="${cellHeight - 4}" rx="7" fill="${colorFor(spec, sign)}"/>
          <text x="${x + cellWidth / 2}" y="${y + 18}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1f2a35">${xml(value)}${xml(sign)}</text>
        </g>`;
      }).join("");
      return yearLabel + monthCells;
    })
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${xml(spec.heading)} recent detail matrix">
    <rect width="${width}" height="${height}" rx="18" fill="#fbfaf5"/>
    <text x="24" y="26" font-size="18" font-weight="700" fill="#1f2a35">${xml(spec.heading)} \uCD5C\uADFC ${RECENT_YEAR_COUNT}\uB144 \uC0C1\uC138</text>
    ${monthLabels}
    ${cells}
    <text x="24" y="${height - 16}" font-size="12" fill="#66727f">\uAC12+\uBD80\uD638: ${xml(spec.valueLabel)} ${xml(spec.unit)}</text>
  </svg>`;
}

function renderVariableSection(spec) {
  return [
    `## ${spec.heading}`,
    "",
    renderCalendarHeatmap(spec),
    "",
    renderAnnualRibbon(spec),
    "",
    renderMonthlyDistribution(spec),
    "",
    renderRecentMatrix(spec),
    "",
  ].join("\n");
}

const markdown = [
  "# \uB0A8\uD55C \uD3C9\uB144 \uB300\uBE44 \uBCC0\uC218\uBCC4 \uAC00\uC2DC\uD654",
  "",
  "- \uAE30\uC900: \uB0A8\uD55C 1973~1989 56\uAC1C, 1990~ 62\uAC1C \uC9C0\uC810, \uC81C\uC8FC \uBCC4\uB3C4.",
  "- \uBD80\uD638: 1991~2020 \uAC01 \uC6D4 \uBD84\uD3EC\uC758 33.33~66.67% \uBC94\uC704\uB294 0, \uADF8 \uBBF8\uB9CC\uC740 -, \uADF8 \uCD08\uACFC\uB294 +.",
  "- \uD45C\uD604: \uAE30\uC628\uC740 \uD3C9\uB144\uAC12 \uB300\uBE44 \uD3B8\uCC28, \uAC15\uC218\uB7C9\uC740 \uC6D4\uB204\uC801\uAC15\uC218\uB7C9\uC744 \uBD80\uD638\uC640 \uD568\uAED8 \uD45C\uC2DC.",
  "",
  ...VARIABLE_SPECS.map(renderVariableSection),
].join("\n");

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(resolve(outputPath), `${markdown}\n`, "utf8");
