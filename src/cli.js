import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { fetchAllAsosDailyRows } from "./asos-client.js";
import { readCsv, writeCsv } from "./csv.js";
import { processDailyRows } from "./pipeline.js";

function parseArgs(argv) {
  const result = {
    command: "run",
    startYear: 1973,
    endYear: new Date().getFullYear(),
    rawInput: null,
    rawOutput: "data/raw/asos_daily.md",
    outputDir: "data/output",
    serviceKeyEnv: "KMA_SERVICE_KEY",
  };

  const [maybeCommand, ...rest] = argv;
  const args = maybeCommand && !maybeCommand.startsWith("--") ? rest : argv;
  if (maybeCommand && !maybeCommand.startsWith("--")) {
    result.command = maybeCommand;
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const next = args[index + 1];

    if (argument === "--start-year") {
      result.startYear = Number(next);
      index += 1;
    } else if (argument === "--end-year") {
      result.endYear = Number(next);
      index += 1;
    } else if (argument === "--raw-input") {
      result.rawInput = next;
      index += 1;
    } else if (argument === "--raw-output") {
      result.rawOutput = next;
      index += 1;
    } else if (argument === "--output-dir") {
      result.outputDir = next;
      index += 1;
    } else if (argument === "--service-key-env") {
      result.serviceKeyEnv = next;
      index += 1;
    }
  }

  return result;
}

function normalizeDailyRows(rows) {
  return rows.map((row) => ({
    station_id: Number(row.station_id),
    station_name: row.station_name,
    date: row.date,
    tavg: row.tavg,
    tmin: row.tmin,
    tmax: row.tmax,
    precip: row.precip,
  }));
}

async function fetchOrLoadDailyRows(options) {
  if (options.rawInput) {
    const rows = await readCsv(resolve(options.rawInput));
    return normalizeDailyRows(rows);
  }

  const serviceKey = process.env[options.serviceKeyEnv];
  if (!serviceKey) {
    throw new Error(
      `Environment variable ${options.serviceKeyEnv} is required when --raw-input is not provided.`,
    );
  }

  const rows = await fetchAllAsosDailyRows({
    serviceKey,
    startYear: options.startYear,
    endYear: options.endYear,
  });
  await writeCsv(resolve(options.rawOutput), rows);
  return rows;
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.command !== "run") {
    throw new Error(`Unsupported command: ${options.command}`);
  }

  const dailyRows = await fetchOrLoadDailyRows(options);
  const {
    stationMonthly,
    regionMonthly,
    regionNormals,
    regionNormalRanges,
    regionMonthlyClassification,
    southKoreaFixedNormalComparison,
  } = processDailyRows(dailyRows);
  const outputDir = resolve(options.outputDir);

  await mkdir(outputDir, { recursive: true });
  await writeCsv(resolve(outputDir, "station_monthly.md"), stationMonthly);
  await writeCsv(resolve(outputDir, "region_monthly.md"), regionMonthly);
  await writeCsv(resolve(outputDir, "region_normals.md"), regionNormals);
  await writeCsv(resolve(outputDir, "region_normal_ranges.md"), regionNormalRanges);
  await writeCsv(
    resolve(outputDir, "region_monthly_classification.md"),
    regionMonthlyClassification,
  );
  await writeCsv(
    resolve(outputDir, "south_korea_fixed_1991_2020_comparison.md"),
    southKoreaFixedNormalComparison,
  );
}

export function isDirectExecution(importMetaUrl, scriptPath) {
  if (!scriptPath) {
    return false;
  }

  if (importMetaUrl === pathToFileURL(scriptPath).href) {
    return true;
  }

  const scriptPathForComparison = scriptPath.replaceAll("\\", "/");
  const normalizedScriptPath = /^[A-Za-z]:\//u.test(scriptPathForComparison)
    ? scriptPathForComparison
    : resolve(scriptPathForComparison);
  const normalizedImportPath = decodeURIComponent(
    new URL(importMetaUrl).pathname,
  ).replace(/^\/([A-Za-z]:\/)/u, "$1");

  return normalizedImportPath === normalizedScriptPath;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
