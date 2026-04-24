const YEAR_COLUMN = "\uC5F0\uB3C4";
const MONTH_COLUMNS = Array.from(
  { length: 12 },
  (_, index) => `${index + 1}\uC6D4`,
);

function emptyPivotRow(year) {
  return {
    [YEAR_COLUMN]: String(year),
    ...Object.fromEntries(MONTH_COLUMNS.map((month) => [month, ""])),
  };
}

export function buildYearMonthPivotRows(
  rows,
  { regionName, variable, valueField },
) {
  const yearMap = new Map();

  for (const row of rows) {
    if (regionName && row.region_name !== regionName) {
      continue;
    }
    if (row.variable !== variable) {
      continue;
    }

    const year = String(row.year);
    const month = `${Number(row.month)}\uC6D4`;
    const pivotRow = yearMap.get(year) ?? emptyPivotRow(year);
    pivotRow[month] = row[valueField] ?? "";
    yearMap.set(year, pivotRow);
  }

  return [...yearMap.values()].sort(
    (left, right) => Number(left[YEAR_COLUMN]) - Number(right[YEAR_COLUMN]),
  );
}

export function formatValueWithSignRows(
  rows,
  {
    variable,
    valueField,
    signField = "departure_sign",
    regionName = "\uB0A8\uD55C",
    digits = 1,
  },
) {
  const yearMap = new Map();

  for (const row of rows) {
    if (regionName && row.region_name !== regionName) {
      continue;
    }
    if (row.variable !== variable) {
      continue;
    }

    const value = row[valueField];
    const sign = row[signField];
    const formattedValue =
      value === "" || value === null || value === undefined
        ? ""
        : formatFixed(Number(value), digits);
    const cell = formattedValue === "" || !sign ? "" : `${formattedValue}(${sign})`;
    const year = String(row.year);
    const month = `${Number(row.month)}\uC6D4`;
    const pivotRow = yearMap.get(year) ?? emptyPivotRow(year);
    pivotRow[month] = cell;
    yearMap.set(year, pivotRow);
  }

  return [...yearMap.values()].sort(
    (left, right) => Number(left[YEAR_COLUMN]) - Number(right[YEAR_COLUMN]),
  );
}

export function formatFixed(value, digits) {
  const factor = 10 ** digits;
  return (Math.round((value + 1e-9) * factor) / factor).toFixed(digits);
}

export const SOUTH_KOREA_PIVOT_SPECS = [
  { variable: "tavg", valueField: "observed_value", fileName: "south_korea_tavg_observed_by_year.data" },
  { variable: "tavg", valueField: "departure_value", fileName: "south_korea_tavg_departure_by_year.data" },
  { variable: "tavg", valueField: "departure_sign", fileName: "south_korea_tavg_departure_sign_by_year.data" },
  { variable: "tmin", valueField: "observed_value", fileName: "south_korea_tmin_observed_by_year.data" },
  { variable: "tmin", valueField: "departure_value", fileName: "south_korea_tmin_departure_by_year.data" },
  { variable: "tmin", valueField: "departure_sign", fileName: "south_korea_tmin_departure_sign_by_year.data" },
  { variable: "tmax", valueField: "observed_value", fileName: "south_korea_tmax_observed_by_year.data" },
  { variable: "tmax", valueField: "departure_value", fileName: "south_korea_tmax_departure_by_year.data" },
  { variable: "tmax", valueField: "departure_sign", fileName: "south_korea_tmax_departure_sign_by_year.data" },
  { variable: "precip", valueField: "observed_value", fileName: "south_korea_precip_observed_by_year.data" },
  { variable: "precip", valueField: "departure_value", fileName: "south_korea_precip_departure_by_year.data" },
  { variable: "precip", valueField: "departure_sign", fileName: "south_korea_precip_departure_sign_by_year.data" },
];
