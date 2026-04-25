import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { readCsv, writeCsv } from "../src/csv.js";

const southKoreaPath =
  process.argv[2] ?? "data/output/final/south_korea_fixed_1991_2020_comparison.md";
const onsetCandidatesPath =
  process.argv[3] ?? "data/output/final/elnino_summer_2026/enso_onset_candidates.csv";
const manifestPath = process.argv[4] ?? "data/input/enso_analog_manifest_2026.json";
const outputPath = process.argv[5] ?? "data/output/final/elnino_summer_2026/analog_year_metrics.csv";
const manifestOutputPath =
  process.argv[6] ?? "data/output/final/elnino_summer_2026/analog_year_metrics_manifest.md";

const DEVELOPMENT_SEASONS = new Set(["AMJ", "MJJ", "JJA", "JAS", "ASO", "SON"]);
const SUMMER_TRANSITION_SEASONS = new Set(["MJJ", "JJA", "JAS", "ASO"]);
const SUMMER_MONTHS = [6, 7, 8];
const FULL_DEVELOPMENT_START_YEAR = 1979;

function numeric(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : null;
}

function format(value, digits = 4) {
  const converted = numeric(value);
  return converted === null ? "" : converted.toFixed(digits);
}

function signed(value, digits = 1) {
  const converted = numeric(value);
  if (converted === null) {
    return "";
  }
  return `${converted > 0 ? "+" : ""}${converted.toFixed(digits)}`;
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return null;
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function sum(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return null;
  }
  return finite.reduce((total, value) => total + value, 0);
}

function groupOnsetCandidates(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const year = String(row.year);
    const current = grouped.get(year) ?? [];
    current.push(row);
    grouped.set(year, current);
  }
  return grouped;
}

function candidateLabel(row) {
  return `${row.index} ${row.season}(${signed(row.value, 1)})`;
}

function flag(value) {
  return value ? "Y" : "";
}

function buildSouthKoreaIndex(rows) {
  return new Map(rows.map((row) => [`${row.year}:${row.month}:${row.variable}`, row]));
}

function variableRowsForSummer(index, year, variable) {
  return SUMMER_MONTHS.map((month) => index.get(`${year}:${month}:${variable}`));
}

function monthlySigns(rows) {
  return rows.map((row) => row?.departure_sign ?? "").join("/");
}

function summerMetrics(index, year) {
  const tavgRows = variableRowsForSummer(index, year, "tavg");
  const tmaxRows = variableRowsForSummer(index, year, "tmax");
  const precipRows = variableRowsForSummer(index, year, "precip");
  if ([...tavgRows, ...tmaxRows, ...precipRows].some((row) => row === undefined)) {
    throw new Error(`Missing JJA South Korea rows for ${year}`);
  }

  const precipObserved = sum(precipRows.map((row) => numeric(row.observed_value)));
  const precipNormal = sum(precipRows.map((row) => numeric(row.normal_value)));
  const precipDeparture = precipObserved - precipNormal;

  return {
    jja_tavg: mean(tavgRows.map((row) => numeric(row.observed_value))),
    jja_tavg_dep: mean(tavgRows.map((row) => numeric(row.departure_value))),
    jja_tavg_month_signs: monthlySigns(tavgRows),
    jja_tmax: mean(tmaxRows.map((row) => numeric(row.observed_value))),
    jja_tmax_dep: mean(tmaxRows.map((row) => numeric(row.departure_value))),
    jja_tmax_month_signs: monthlySigns(tmaxRows),
    jja_precip: precipObserved,
    jja_precip_dep: precipDeparture,
    jja_precip_ratio: (precipObserved / precipNormal) * 100,
    jja_precip_month_signs: monthlySigns(precipRows),
  };
}

function buildTierLabels({ oniDevelopmentFull, oniSummerTransition, roniOnlySensitivity, roniAuxiliary }) {
  const labels = [];
  if (oniDevelopmentFull) labels.push("ONI development-year full");
  if (oniSummerTransition) labels.push("MJJ-ASO summer-transition subset");
  if (roniOnlySensitivity) labels.push("RONI-only sensitivity");
  if (roniAuxiliary && !roniOnlySensitivity) labels.push("RONI auxiliary noted");
  return labels.join("; ");
}

function buildRows({ onsetRows, southKoreaRows, manifest }) {
  const candidatesByYear = groupOnsetCandidates(onsetRows);
  const southKoreaIndex = buildSouthKoreaIndex(southKoreaRows);
  const selectedYears = new Set();

  for (const [year, rows] of candidatesByYear.entries()) {
    const numericYear = Number(year);
    const oniRows = rows.filter((row) => row.index === "ONI");
    const roniRows = rows.filter((row) => row.index === "RONI");
    const hasOniDevelopment =
      numericYear >= FULL_DEVELOPMENT_START_YEAR &&
      oniRows.some((row) => DEVELOPMENT_SEASONS.has(row.season));
    const hasOniSummerTransition = oniRows.some((row) =>
      SUMMER_TRANSITION_SEASONS.has(row.season),
    );
    const hasRoniSummerAuxiliary = roniRows.some((row) =>
      SUMMER_TRANSITION_SEASONS.has(row.season),
    );

    if (hasOniDevelopment || hasOniSummerTransition || hasRoniSummerAuxiliary) {
      selectedYears.add(year);
    }
  }

  return [...selectedYears]
    .sort((left, right) => Number(right) - Number(left))
    .map((year) => {
      const numericYear = Number(year);
      const candidates = candidatesByYear.get(year) ?? [];
      const oniRows = candidates.filter((row) => row.index === "ONI");
      const roniRows = candidates.filter((row) => row.index === "RONI");
      const oniDevelopmentRows = oniRows.filter((row) => DEVELOPMENT_SEASONS.has(row.season));
      const oniSummerTransitionRows = oniRows.filter((row) =>
        SUMMER_TRANSITION_SEASONS.has(row.season),
      );
      const roniSummerRows = roniRows.filter((row) =>
        SUMMER_TRANSITION_SEASONS.has(row.season),
      );
      const oniDevelopmentFull =
        numericYear >= FULL_DEVELOPMENT_START_YEAR && oniDevelopmentRows.length > 0;
      const oniSummerTransition = oniSummerTransitionRows.length > 0;
      const roniAuxiliary = roniRows.length > 0;
      const roniOnlySensitivity =
        roniSummerRows.length > 0 && !oniDevelopmentFull && !oniSummerTransition;
      const metrics = summerMetrics(southKoreaIndex, numericYear);
      const auxiliary = manifest.auxiliary_metrics_by_year?.[year] ?? {};

      return {
        year,
        analysis_tier: buildTierLabels({
          oniDevelopmentFull,
          oniSummerTransition,
          roniOnlySensitivity,
          roniAuxiliary,
        }),
        oni_development_full: flag(oniDevelopmentFull),
        oni_summer_transition: flag(oniSummerTransition),
        roni_auxiliary: flag(roniAuxiliary),
        roni_only_sensitivity: flag(roniOnlySensitivity),
        oni_episode_start: oniDevelopmentRows[0]?.season
          ? `${oniDevelopmentRows[0].season} ${year}`
          : "",
        onset_proxy: [...oniRows, ...roniRows].map(candidateLabel).join("; "),
        transition_distance_to_2026: auxiliary.transition_distance_to_2026 ?? "",
        high_latitude_distance: auxiliary.high_latitude_distance ?? "",
        sst_distance: auxiliary.sst_distance ?? "",
        jja_tavg: format(metrics.jja_tavg),
        jja_tavg_dep: format(metrics.jja_tavg_dep),
        jja_tavg_month_signs: metrics.jja_tavg_month_signs,
        jja_tmax: format(metrics.jja_tmax),
        jja_tmax_dep: format(metrics.jja_tmax_dep),
        jja_tmax_month_signs: metrics.jja_tmax_month_signs,
        jja_precip: format(metrics.jja_precip),
        jja_precip_dep: format(metrics.jja_precip_dep),
        jja_precip_ratio: format(metrics.jja_precip_ratio),
        jja_precip_month_signs: metrics.jja_precip_month_signs,
        ao_jfm: auxiliary.ao_jfm ?? "",
        nao_jfm: auxiliary.nao_jfm ?? "",
        ao_mar: auxiliary.ao_mar ?? "",
        nao_mar: auxiliary.nao_mar ?? "",
        arctic_jfm: auxiliary.arctic_jfm ?? "",
        barents_jfm: auxiliary.barents_jfm ?? "",
        kara_jfm: auxiliary.kara_jfm ?? "",
        arctic_jfm_z: auxiliary.arctic_jfm_z ?? "",
        barents_jfm_z: auxiliary.barents_jfm_z ?? "",
        kara_jfm_z: auxiliary.kara_jfm_z ?? "",
        typhoon_near_korea_count: auxiliary.typhoon_near_korea_count ?? "",
        typhoon_reference: auxiliary.typhoon_reference ?? "",
      };
    });
}

function markdownManifest(manifest, rows) {
  const counts = {
    oniDevelopmentFull: rows.filter((row) => row.oni_development_full === "Y").length,
    oniSummerTransition: rows.filter((row) => row.oni_summer_transition === "Y").length,
    roniAuxiliary: rows.filter((row) => row.roni_auxiliary === "Y").length,
    roniOnlySensitivity: rows.filter((row) => row.roni_only_sensitivity === "Y").length,
  };

  return [
    "# ENSO analog metrics manifest",
    "",
    `- version: ${manifest.version}`,
    `- purpose: ${manifest.purpose}`,
    "",
    "## Local Inputs",
    "",
    `- South Korea monthly observations: \`${manifest.local_inputs.south_korea_monthly}\``,
    `- ENSO onset candidates: \`${manifest.local_inputs.enso_onset_candidates}\``,
    `- Auxiliary manifest: \`${manifestPath}\``,
    "",
    "## Criteria",
    "",
    `- ONI development-year full: ${manifest.criteria.oni_development_full}`,
    `- MJJ-ASO summer-transition subset: ${manifest.criteria.oni_summer_transition}`,
    `- RONI auxiliary: ${manifest.criteria.roni_auxiliary}`,
    `- RONI-only sensitivity: ${manifest.criteria.roni_only_sensitivity}`,
    "",
    "## Generated Counts",
    "",
    `- ONI development-year full: ${counts.oniDevelopmentFull}`,
    `- MJJ-ASO summer-transition subset: ${counts.oniSummerTransition}`,
    `- RONI auxiliary noted: ${counts.roniAuxiliary}`,
    `- RONI-only sensitivity: ${counts.roniOnlySensitivity}`,
    "",
    "## External References",
    "",
    ...Object.entries(manifest.external_references).map(
      ([key, value]) => `- ${key}: ${value}`,
    ),
    "",
    "## Notes",
    "",
    "- JJA temperature metrics are arithmetic means of June, July, and August South Korea monthly values.",
    "- JJA precipitation metrics use June-August accumulated observed and normal precipitation before computing the percentage ratio.",
    "- RONI labels are retained for sensitivity checks but do not promote a year into the ONI-primary set.",
    "",
  ].join("\n");
}

const [southKoreaRows, onsetRows, manifestText] = await Promise.all([
  readCsv(resolve(southKoreaPath)),
  readCsv(resolve(onsetCandidatesPath)),
  readFile(resolve(manifestPath), "utf8"),
]);
const manifest = JSON.parse(manifestText);
const rows = buildRows({ onsetRows, southKoreaRows, manifest });

await writeCsv(resolve(outputPath), rows);
await mkdir(dirname(resolve(manifestOutputPath)), { recursive: true });
await writeFile(resolve(manifestOutputPath), `${markdownManifest(manifest, rows)}\n`, "utf8");
