import test from "node:test";
import assert from "node:assert/strict";

import { PERIOD_GROUPS } from "../src/metadata.js";
import {
  aggregateRegionMonthly,
  aggregateStationMonthly,
  buildNormalRanges,
  buildNormals,
  buildFixedNormalMonthlyComparison,
  buildRangeSign,
  classifyMonthlyValues,
  classifyValue,
  getNormalWindowForYear,
} from "../src/pipeline.js";

test("station monthly aggregation averages temperature and sums precipitation", () => {
  const dailyRows = [
    {
      station_id: 108,
      station_name: "서울",
      date: "2021-01-01",
      tavg: 1,
      tmin: -2,
      tmax: 5,
      precip: "",
    },
    {
      station_id: 108,
      station_name: "서울",
      date: "2021-01-02",
      tavg: 3,
      tmin: 0,
      tmax: 7,
      precip: 5,
    },
    {
      station_id: 108,
      station_name: "서울",
      date: "2021-02-01",
      tavg: 6,
      tmin: 1,
      tmax: 10,
      precip: 1,
    },
  ];

  const monthly = aggregateStationMonthly(dailyRows);
  assert.equal(monthly.length, 2);
  assert.deepEqual(monthly[0], {
    station_id: 108,
    station_name: "서울",
    year: 2021,
    month: 1,
    tavg: 2,
    tmin: -1,
    tmax: 6,
    precip: 5,
  });
});

test("region monthly aggregation uses equal-weight station means", () => {
  const stationMonthly = [
    {
      station_id: 108,
      station_name: "서울",
      year: 2021,
      month: 1,
      tavg: 2,
      tmin: -1,
      tmax: 6,
      precip: 5,
    },
    {
      station_id: 112,
      station_name: "인천",
      year: 2021,
      month: 1,
      tavg: 4,
      tmin: 0,
      tmax: 7,
      precip: 1,
    },
  ];

  const regional = aggregateRegionMonthly(
    stationMonthly,
    PERIOD_GROUPS.pre1990.id,
    ["서울-인천-경기도"],
  );

  assert.deepEqual(regional, [
    {
      period_group: PERIOD_GROUPS.pre1990.id,
      region_name: "서울-인천-경기도",
      year: 2021,
      month: 1,
      tavg: 3,
      tmin: -0.5,
      tmax: 6.5,
      precip: 3,
      station_count_used: 2,
    },
  ]);
});

test("normal windows update every ten years", () => {
  assert.deepEqual(getNormalWindowForYear(2010), {
    normal_window_start: 1971,
    normal_window_end: 2000,
  });
  assert.deepEqual(getNormalWindowForYear(2011), {
    normal_window_start: 1981,
    normal_window_end: 2010,
  });
  assert.deepEqual(getNormalWindowForYear(2021), {
    normal_window_start: 1991,
    normal_window_end: 2020,
  });
});

test("classification keeps percentile boundaries inside the similar band", () => {
  assert.equal(classifyValue(1, 1, 2, "tavg"), "비슷");
  assert.equal(classifyValue(2, 1, 2, "tavg"), "비슷");
  assert.equal(classifyValue(0.9, 1, 2, "tavg"), "낮음");
  assert.equal(classifyValue(2.1, 1, 2, "tavg"), "높음");
  assert.equal(classifyValue(0.9, 1, 2, "precip"), "적음");
  assert.equal(classifyValue(2.1, 1, 2, "precip"), "많음");
});

test("range sign uses -, 0, + from percentile thresholds", () => {
  assert.equal(buildRangeSign(1, 1, 2), "0");
  assert.equal(buildRangeSign(2, 1, 2), "0");
  assert.equal(buildRangeSign(0.9, 1, 2), "-");
  assert.equal(buildRangeSign(2.1, 1, 2), "+");
  assert.equal(buildRangeSign(null, 1, 2), null);
});

test("normals and classifications line up on shared keys", () => {
  const regionMonthly = [];
  for (let year = 1991; year <= 2021; year += 1) {
    regionMonthly.push({
      period_group: PERIOD_GROUPS.post1990.id,
      region_name: "서울-인천-경기도",
      year,
      month: 1,
      tavg: year - 1990,
      tmin: year - 1991,
      tmax: year - 1989,
      precip: year - 1980,
      station_count_used: 6,
    });
  }

  const normals = buildNormals(regionMonthly);
  const ranges = buildNormalRanges(regionMonthly);
  const classified = classifyMonthlyValues(regionMonthly, normals, ranges);
  const record2021 = classified.find(
    (record) =>
      record.year === 2021 &&
      record.month === 1 &&
      record.region_name === "서울-인천-경기도" &&
      record.variable === "tavg",
  );

  assert.equal(record2021.applied_normal_start, 1991);
  assert.equal(record2021.applied_normal_end, 2020);
  assert.equal(record2021.observed_value, 31);
  assert.equal(typeof record2021.normal_value, "number");
  assert.equal(typeof record2021.p33_33, "number");
  assert.equal(typeof record2021.p66_67, "number");
  assert.equal(record2021.departure_value, 15.5);
  assert.equal(record2021.departure_sign, "+");
  assert.equal(record2021.classification, "높음");
});

test("classification includes zero-sign departures when observed equals normal", () => {
  const regionMonthly = [];
  for (let year = 1991; year <= 2021; year += 1) {
    regionMonthly.push({
      period_group: PERIOD_GROUPS.post1990.id,
      region_name: "제주",
      year,
      month: 2,
      tavg: 10,
      tmin: 5,
      tmax: 15,
      precip: 20,
      station_count_used: 4,
    });
  }

  const normals = buildNormals(regionMonthly);
  const ranges = buildNormalRanges(regionMonthly);
  const classified = classifyMonthlyValues(regionMonthly, normals, ranges);
  const precip2021 = classified.find(
    (record) =>
      record.year === 2021 &&
      record.month === 2 &&
      record.region_name === "제주" &&
      record.variable === "precip",
  );

  assert.equal(precip2021.observed_value, 20);
  assert.equal(precip2021.normal_value, 20);
  assert.equal(precip2021.departure_value, 0);
  assert.equal(precip2021.departure_sign, "0");
  assert.equal(precip2021.classification, "비슷");
});

test("fixed normal comparison signs use the similar percentile range", () => {
  const regionMonthly = [];
  for (let year = 1991; year <= 2020; year += 1) {
    regionMonthly.push({
      period_group: PERIOD_GROUPS.post1990.id,
      region_name: "남한",
      year,
      month: 1,
      tavg: year - 1990,
      tmin: year - 1990,
      tmax: year - 1990,
      precip: year - 1990,
      station_count_used: 62,
    });
  }
  regionMonthly.push({
    period_group: PERIOD_GROUPS.post1990.id,
    region_name: "남한",
    year: 2021,
    month: 1,
    tavg: 16,
    tmin: 0,
    tmax: 31,
    precip: 16,
    station_count_used: 62,
  });

  const comparison = buildFixedNormalMonthlyComparison(regionMonthly);
  const tavg2021 = comparison.find(
    (record) => record.year === 2021 && record.variable === "tavg",
  );
  const tmin2021 = comparison.find(
    (record) => record.year === 2021 && record.variable === "tmin",
  );
  const tmax2021 = comparison.find(
    (record) => record.year === 2021 && record.variable === "tmax",
  );

  assert.equal(tavg2021.departure_value, 0.5);
  assert.equal(tavg2021.departure_sign, "0");
  assert.equal(tmin2021.departure_sign, "-");
  assert.equal(tmax2021.departure_sign, "+");
  assert.equal(typeof tavg2021.p33_33, "number");
  assert.equal(typeof tavg2021.p66_67, "number");
});

test("normals are not produced from incomplete 30-year windows", () => {
  const regionMonthly = [];
  for (let year = 1973; year <= 2000; year += 1) {
    regionMonthly.push({
      period_group: PERIOD_GROUPS.pre1990.id,
      region_name: "서울-인천-경기도",
      year,
      month: 1,
      tavg: 1,
      tmin: 0,
      tmax: 2,
      precip: 3,
      station_count_used: 6,
    });
  }
  regionMonthly.push({
    period_group: PERIOD_GROUPS.post1990.id,
    region_name: "서울-인천-경기도",
    year: 2010,
    month: 1,
    tavg: 1,
    tmin: 0,
    tmax: 2,
    precip: 3,
    station_count_used: 6,
  });

  const normals = buildNormals(regionMonthly);
  const ranges = buildNormalRanges(regionMonthly);
  const classified = classifyMonthlyValues(regionMonthly, normals, ranges);
  const record2010 = classified.find(
    (record) =>
      record.year === 2010 &&
      record.month === 1 &&
      record.region_name === "서울-인천-경기도" &&
      record.variable === "tavg",
  );

  assert.equal(record2010.applied_normal_start, 1971);
  assert.equal(record2010.applied_normal_end, 2000);
  assert.equal(record2010.normal_value, null);
  assert.equal(record2010.departure_value, null);
  assert.equal(record2010.departure_sign, null);
  assert.equal(record2010.classification, null);
});
