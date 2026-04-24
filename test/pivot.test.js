import test from "node:test";
import assert from "node:assert/strict";

import {
  buildYearMonthPivotRows,
  formatFixed,
  formatValueWithSignRows,
} from "../src/pivot.js";

test("buildYearMonthPivotRows pivots month values across columns", () => {
  const rows = [
    {
      year: "2025",
      month: "1",
      region_name: "south",
      variable: "tavg",
      observed_value: "1.2",
      departure_value: "-0.3",
      departure_sign: "-",
    },
    {
      year: "2025",
      month: "2",
      region_name: "south",
      variable: "tavg",
      observed_value: "2.3",
      departure_value: "0.1",
      departure_sign: "+",
    },
    {
      year: "2026",
      month: "1",
      region_name: "south",
      variable: "tavg",
      observed_value: "3.4",
      departure_value: "0",
      departure_sign: "0",
    },
  ];

  const pivot = buildYearMonthPivotRows(rows, {
    regionName: "south",
    variable: "tavg",
    valueField: "departure_sign",
  });

  assert.deepEqual(pivot, [
    {
      연도: "2025",
      "1월": "-",
      "2월": "+",
      "3월": "",
      "4월": "",
      "5월": "",
      "6월": "",
      "7월": "",
      "8월": "",
      "9월": "",
      "10월": "",
      "11월": "",
      "12월": "",
    },
    {
      연도: "2026",
      "1월": "0",
      "2월": "",
      "3월": "",
      "4월": "",
      "5월": "",
      "6월": "",
      "7월": "",
      "8월": "",
      "9월": "",
      "10월": "",
      "11월": "",
      "12월": "",
    },
  ]);
});

test("formatValueWithSignRows formats values as value(sign)", () => {
  const rows = [
    {
      year: "1973",
      month: "1",
      region_name: "south",
      variable: "tavg",
      departure_value: "-2.34",
      departure_sign: "-",
    },
    {
      year: "1973",
      month: "2",
      region_name: "south",
      variable: "tavg",
      departure_value: "0",
      departure_sign: "0",
    },
  ];

  const formatted = formatValueWithSignRows(rows, {
    regionName: "south",
    variable: "tavg",
    valueField: "departure_value",
  });

  assert.equal(formatted[0]["1월"], "-2.3(-)");
  assert.equal(formatted[0]["2월"], "0.0(0)");
});

test("formatFixed rounds decimal half boundaries stably", () => {
  assert.equal(formatFixed(148.04999999999998, 1), "148.1");
  assert.equal(formatFixed(199.24999999999997, 1), "199.3");
  assert.equal(formatFixed(464.2499999999999, 1), "464.3");
});
