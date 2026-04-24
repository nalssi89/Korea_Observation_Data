import test from "node:test";
import assert from "node:assert/strict";

import { fetchAllAsosDailyRows } from "../src/asos-client.js";

test("asos client can use requestJsonImpl when fetch is unavailable", async () => {
  const responses = [
    {
      response: {
        body: {
          items: {
            item: [
              {
                stnId: "108",
                stnNm: "서울",
                tm: "2021-01-01",
                avgTa: "-4.2",
                minTa: "-9.8",
                maxTa: "1.6",
                sumRn: "",
              },
            ],
          },
        },
      },
    },
    {
      response: {
        body: {
          items: {
            item: [],
          },
        },
      },
    },
  ];

  const rows = await fetchAllAsosDailyRows({
    serviceKey: "dummy",
    startYear: 2021,
    endYear: 2021,
    stationIds: [108],
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
    requestJsonImpl: async () => responses.shift(),
  });

  assert.deepEqual(rows, [
    {
      station_id: 108,
      station_name: "서울",
      date: "2021-01-01",
      tavg: "-4.2",
      tmin: "-9.8",
      tmax: "1.6",
      precip: "",
    },
  ]);
});

test("asos client accepts encoded service keys from the data portal", async () => {
  const encodedKey = "abc%2Fdef%3D%3D";
  const seenServiceKeys = [];
  const responses = [
    {
      response: {
        body: {
          items: {
            item: [],
          },
        },
      },
    },
  ];

  await fetchAllAsosDailyRows({
    serviceKey: encodedKey,
    startYear: 2021,
    endYear: 2021,
    stationIds: [108],
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
    requestJsonImpl: async (url) => {
      seenServiceKeys.push(url.searchParams.get("serviceKey"));
      return responses.shift();
    },
  });

  assert.deepEqual(seenServiceKeys, ["abc/def=="]);
});

test("asos client clamps the final request end date to the latest available day", async () => {
  const seenRanges = [];
  const responses = [
    {
      response: {
        body: {
          items: {
            item: [],
          },
        },
      },
    },
  ];

  await fetchAllAsosDailyRows({
    serviceKey: "dummy",
    startYear: 2020,
    endYear: 2026,
    stationIds: [108],
    latestAvailableDate: "20260422",
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
    requestJsonImpl: async (url) => {
      seenRanges.push({
        startDt: url.searchParams.get("startDt"),
        endDt: url.searchParams.get("endDt"),
      });
      return responses.shift();
    },
  });

  assert.deepEqual(seenRanges, [
    {
      startDt: "20200101",
      endDt: "20260422",
    },
  ]);
});
