import {
  getPeriodGroupForYear,
  getRegionDefinitionsForPeriodGroup,
} from "./metadata.js";

const VARIABLES = ["tavg", "tmin", "tmax", "precip"];
const SOUTH_KOREA = "\uB0A8\uD55C";

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toPrecipNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundValue(value) {
  return Number(value.toFixed(4));
}

export function buildDepartureSign(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value < 0) {
    return "-";
  }

  if (value > 0) {
    return "+";
  }

  return "0";
}

export function buildRangeSign(value, p33_33, p66_67) {
  if (
    value === null ||
    value === undefined ||
    p33_33 === null ||
    p33_33 === undefined ||
    p66_67 === null ||
    p66_67 === undefined
  ) {
    return null;
  }

  if (value < p33_33) {
    return "-";
  }

  if (value > p66_67) {
    return "+";
  }

  return "0";
}

function buildYearMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function sortMonthlyRows(left, right) {
  return (
    left.year - right.year ||
    left.month - right.month ||
    String(left.region_name ?? left.station_name).localeCompare(
      String(right.region_name ?? right.station_name),
      "ko",
    )
  );
}

export function aggregateStationMonthly(dailyRows) {
  const groups = new Map();

  for (const row of dailyRows) {
    const [yearText, monthText] = String(row.date).split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const key = `${row.station_id}:${buildYearMonthKey(year, month)}`;
    const current = groups.get(key) ?? {
      station_id: Number(row.station_id),
      station_name: row.station_name,
      year,
      month,
      tavg_sum: 0,
      tavg_count: 0,
      tmin_sum: 0,
      tmin_count: 0,
      tmax_sum: 0,
      tmax_count: 0,
      precip_sum: 0,
    };

    const tavg = toNumberOrNull(row.tavg);
    const tmin = toNumberOrNull(row.tmin);
    const tmax = toNumberOrNull(row.tmax);
    const precip = toPrecipNumber(row.precip);

    if (tavg !== null) {
      current.tavg_sum += tavg;
      current.tavg_count += 1;
    }
    if (tmin !== null) {
      current.tmin_sum += tmin;
      current.tmin_count += 1;
    }
    if (tmax !== null) {
      current.tmax_sum += tmax;
      current.tmax_count += 1;
    }
    current.precip_sum += precip;

    groups.set(key, current);
  }

  return [...groups.values()]
    .map((row) => ({
      station_id: row.station_id,
      station_name: row.station_name,
      year: row.year,
      month: row.month,
      tavg: row.tavg_count > 0 ? roundValue(row.tavg_sum / row.tavg_count) : null,
      tmin: row.tmin_count > 0 ? roundValue(row.tmin_sum / row.tmin_count) : null,
      tmax: row.tmax_count > 0 ? roundValue(row.tmax_sum / row.tmax_count) : null,
      precip: roundValue(row.precip_sum),
    }))
    .sort(sortMonthlyRows);
}

export function aggregateRegionMonthly(
  stationMonthlyRows,
  periodGroup,
  regionNames = null,
) {
  const regionDefinitions = getRegionDefinitionsForPeriodGroup(periodGroup);
  const targetDefinitions = [...regionDefinitions.values()].filter((definition) =>
    regionNames ? regionNames.includes(definition.region_name) : true,
  );
  const results = [];

  for (const definition of targetDefinitions) {
    const stationIdSet = new Set(definition.station_ids);
    const monthGroups = new Map();

    for (const row of stationMonthlyRows) {
      if (!stationIdSet.has(Number(row.station_id))) {
        continue;
      }

      const key = buildYearMonthKey(row.year, row.month);
      const current = monthGroups.get(key) ?? {
        period_group: periodGroup,
        region_name: definition.region_name,
        year: row.year,
        month: row.month,
        station_ids: new Set(),
        sums: {
          tavg: 0,
          tmin: 0,
          tmax: 0,
          precip: 0,
        },
        counts: {
          tavg: 0,
          tmin: 0,
          tmax: 0,
          precip: 0,
        },
      };

      current.station_ids.add(Number(row.station_id));

      for (const variable of VARIABLES) {
        const value = toNumberOrNull(row[variable]);
        if (value === null) {
          continue;
        }

        current.sums[variable] += value;
        current.counts[variable] += 1;
      }

      monthGroups.set(key, current);
    }

    for (const current of monthGroups.values()) {
      results.push({
        period_group: current.period_group,
        region_name: current.region_name,
        year: current.year,
        month: current.month,
        tavg:
          current.counts.tavg > 0
            ? roundValue(current.sums.tavg / current.counts.tavg)
            : null,
        tmin:
          current.counts.tmin > 0
            ? roundValue(current.sums.tmin / current.counts.tmin)
            : null,
        tmax:
          current.counts.tmax > 0
            ? roundValue(current.sums.tmax / current.counts.tmax)
            : null,
        precip:
          current.counts.precip > 0
            ? roundValue(current.sums.precip / current.counts.precip)
            : null,
        station_count_used: current.station_ids.size,
      });
    }
  }

  return results.sort(sortMonthlyRows);
}

export function buildAllRegionMonthly(stationMonthlyRows) {
  return [
    ...aggregateRegionMonthly(stationMonthlyRows, "1973_1989"),
    ...aggregateRegionMonthly(stationMonthlyRows, "1990_latest"),
  ].sort(sortMonthlyRows);
}

export function getNormalWindowForYear(year) {
  const normalWindowEnd = Math.floor((year - 1) / 10) * 10;
  return {
    normal_window_start: normalWindowEnd - 29,
    normal_window_end: normalWindowEnd,
  };
}

function quantile(values, probability) {
  if (values.length === 0) {
    return null;
  }

  if (values.length === 1) {
    return values[0];
  }

  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];

  if (lowerIndex === upperIndex) {
    return roundValue(lower);
  }

  const weight = position - lowerIndex;
  return roundValue(lower + (upper - lower) * weight);
}

function buildWindowGroups(regionMonthlyRows) {
  const windows = new Map();

  for (const row of regionMonthlyRows) {
    const { normal_window_start: start, normal_window_end: end } =
      getNormalWindowForYear(row.year);

    if (!windows.has(`${start}:${end}`)) {
      windows.set(`${start}:${end}`, {
        normal_window_start: start,
        normal_window_end: end,
      });
    }
  }

  return [...windows.values()].sort(
    (left, right) => left.normal_window_start - right.normal_window_start,
  );
}

function buildValueSeries(regionMonthlyRows, periodGroup, regionName, month, variable, window) {
  return regionMonthlyRows
    .filter(
      (row) =>
        row.period_group === periodGroup &&
        row.region_name === regionName &&
        row.month === month &&
        row.year >= window.normal_window_start &&
        row.year <= window.normal_window_end &&
        row[variable] !== null &&
        row[variable] !== undefined,
    )
    .map((row) => ({
      year: row.year,
      value: Number(row[variable]),
    }));
}

function hasCompleteThirtyYearWindow(series) {
  return new Set(series.map((entry) => entry.year)).size === 30;
}

export function buildNormals(regionMonthlyRows) {
  const windows = buildWindowGroups(regionMonthlyRows);
  const keys = new Map();

  for (const row of regionMonthlyRows) {
    for (const variable of VARIABLES) {
      const key = `${row.period_group}:${row.region_name}:${row.month}:${variable}`;
      keys.set(key, {
        period_group: row.period_group,
        region_name: row.region_name,
        month: row.month,
        variable,
      });
    }
  }

  const normals = [];

  for (const definition of keys.values()) {
    for (const window of windows) {
      const values = buildValueSeries(
        regionMonthlyRows,
        definition.period_group,
        definition.region_name,
        definition.month,
        definition.variable,
        window,
      );
      if (values.length === 0 || !hasCompleteThirtyYearWindow(values)) {
        continue;
      }

      normals.push({
        ...window,
        period_group: definition.period_group,
        region_name: definition.region_name,
        month: definition.month,
        variable: definition.variable,
        normal_value: roundValue(
          values.reduce((sum, entry) => sum + entry.value, 0) / values.length,
        ),
      });
    }
  }

  return normals.sort(
    (left, right) =>
      left.normal_window_start - right.normal_window_start ||
      left.month - right.month ||
      left.region_name.localeCompare(right.region_name, "ko") ||
      left.variable.localeCompare(right.variable),
  );
}

export function buildNormalRanges(regionMonthlyRows) {
  const windows = buildWindowGroups(regionMonthlyRows);
  const keys = new Map();

  for (const row of regionMonthlyRows) {
    for (const variable of VARIABLES) {
      const key = `${row.period_group}:${row.region_name}:${row.month}:${variable}`;
      keys.set(key, {
        period_group: row.period_group,
        region_name: row.region_name,
        month: row.month,
        variable,
      });
    }
  }

  const ranges = [];

  for (const definition of keys.values()) {
    for (const window of windows) {
      const values = buildValueSeries(
        regionMonthlyRows,
        definition.period_group,
        definition.region_name,
        definition.month,
        definition.variable,
        window,
      );
      if (values.length === 0 || !hasCompleteThirtyYearWindow(values)) {
        continue;
      }

      ranges.push({
        ...window,
        period_group: definition.period_group,
        region_name: definition.region_name,
        month: definition.month,
        variable: definition.variable,
        p33_33: quantile(values.map((entry) => entry.value), 0.3333),
        p66_67: quantile(values.map((entry) => entry.value), 0.6667),
      });
    }
  }

  return ranges.sort(
    (left, right) =>
      left.normal_window_start - right.normal_window_start ||
      left.month - right.month ||
      left.region_name.localeCompare(right.region_name, "ko") ||
      left.variable.localeCompare(right.variable),
  );
}

export function classifyValue(value, p33_33, p66_67, variable) {
  if (value === null || p33_33 === null || p66_67 === null) {
    return null;
  }

  if (value < p33_33) {
    return variable === "precip" ? "\uC801\uC74C" : "\uB0AE\uC74C";
  }

  if (value > p66_67) {
    return variable === "precip" ? "\uB9CE\uC74C" : "\uB192\uC74C";
  }

  return "\uBE44\uC2B7";
}

export function classifyMonthlyValues(regionMonthlyRows, normals, ranges) {
  const normalMap = new Map(
    normals.map((row) => [
      `${row.period_group}:${row.normal_window_start}:${row.normal_window_end}:${row.region_name}:${row.month}:${row.variable}`,
      row,
    ]),
  );
  const rangeMap = new Map(
    ranges.map((row) => [
      `${row.period_group}:${row.normal_window_start}:${row.normal_window_end}:${row.region_name}:${row.month}:${row.variable}`,
      row,
    ]),
  );
  const classified = [];

  for (const row of regionMonthlyRows) {
    const { normal_window_start: start, normal_window_end: end } =
      getNormalWindowForYear(row.year);

    for (const variable of VARIABLES) {
      const key = `${row.period_group}:${start}:${end}:${row.region_name}:${row.month}:${variable}`;
      const normal = normalMap.get(key) ?? null;
      const range = rangeMap.get(key) ?? null;
      const observedValue =
        row[variable] === null || row[variable] === undefined
          ? null
          : Number(row[variable]);
      const departureValue =
        observedValue === null || normal?.normal_value === null || normal?.normal_value === undefined
          ? null
          : roundValue(observedValue - normal.normal_value);

      classified.push({
        year: row.year,
        month: row.month,
        region_name: row.region_name,
        variable,
        observed_value: observedValue,
        applied_normal_start: start,
        applied_normal_end: end,
        normal_value: normal?.normal_value ?? null,
        departure_value: departureValue,
        departure_sign: range
          ? buildRangeSign(observedValue, range.p33_33, range.p66_67)
          : null,
        p33_33: range?.p33_33 ?? null,
        p66_67: range?.p66_67 ?? null,
        classification: range
          ? classifyValue(observedValue, range.p33_33, range.p66_67, variable)
          : null,
        station_count_used: row.station_count_used,
      });
    }
  }

  return classified.sort(
    (left, right) =>
      left.year - right.year ||
      left.month - right.month ||
      left.region_name.localeCompare(right.region_name, "ko") ||
      left.variable.localeCompare(right.variable),
  );
}

export function buildFixedNormalMonthlyComparison(
  regionMonthlyRows,
  {
    regionName = SOUTH_KOREA,
    normalStartYear = 1991,
    normalEndYear = 2020,
  } = {},
) {
  const normalRows = regionMonthlyRows.filter(
    (row) =>
      row.region_name === regionName &&
      row.period_group === "1990_latest" &&
      row.year >= normalStartYear &&
      row.year <= normalEndYear,
  );
  const normalMap = new Map();

  for (const month of Array.from({ length: 12 }, (_, index) => index + 1)) {
    const monthNormalRows = normalRows.filter((row) => row.month === month);
    if (new Set(monthNormalRows.map((row) => row.year)).size < 30) {
      continue;
    }

    for (const variable of VARIABLES) {
      const values = monthNormalRows
        .filter((row) => row[variable] !== null && row[variable] !== undefined)
        .map((row) => Number(row[variable]));

      normalMap.set(`${month}:${variable}`, {
        normal_value: roundValue(
          values.reduce((sum, value) => sum + value, 0) / values.length,
        ),
        p33_33: quantile(values, 0.3333),
        p66_67: quantile(values, 0.6667),
      });
    }
  }

  return regionMonthlyRows
    .filter(
      (row) =>
        row.region_name === regionName &&
        row.period_group === getPeriodGroupForYear(row.year),
    )
    .flatMap((row) =>
      VARIABLES.map((variable) => {
        const observedValue =
          row[variable] === null || row[variable] === undefined
            ? null
            : Number(row[variable]);
        const normal = normalMap.get(`${row.month}:${variable}`) ?? null;
        const departureValue =
          observedValue === null || normal === null
            ? null
            : roundValue(observedValue - normal.normal_value);

        return {
          year: row.year,
          month: row.month,
          region_name: row.region_name,
          variable,
          observed_value: observedValue,
          normal_start_year: normalStartYear,
          normal_end_year: normalEndYear,
          normal_value: normal?.normal_value ?? null,
          departure_value: departureValue,
          departure_sign: normal
            ? buildRangeSign(observedValue, normal.p33_33, normal.p66_67)
            : null,
          p33_33: normal?.p33_33 ?? null,
          p66_67: normal?.p66_67 ?? null,
          classification: normal
            ? classifyValue(observedValue, normal.p33_33, normal.p66_67, variable)
            : null,
          station_count_used: row.station_count_used,
        };
      }),
    )
    .sort(
      (left, right) =>
        left.year - right.year ||
        left.month - right.month ||
        left.variable.localeCompare(right.variable),
    );
}

export function processDailyRows(dailyRows) {
  const stationMonthly = aggregateStationMonthly(dailyRows);
  const regionMonthly = buildAllRegionMonthly(stationMonthly);
  const regionNormals = buildNormals(regionMonthly);
  const regionNormalRanges = buildNormalRanges(regionMonthly);
  const regionMonthlyClassification = classifyMonthlyValues(
    regionMonthly.filter(
      (row) => row.period_group === getPeriodGroupForYear(row.year),
    ),
    regionNormals,
    regionNormalRanges,
  );
  const southKoreaFixedNormalComparison =
    buildFixedNormalMonthlyComparison(regionMonthly);

  return {
    stationMonthly,
    regionMonthly,
    regionNormals,
    regionNormalRanges,
    regionMonthlyClassification,
    southKoreaFixedNormalComparison,
  };
}
