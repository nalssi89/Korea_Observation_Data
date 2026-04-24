import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPOSITE_REGION_COMPONENTS,
  PERIOD_GROUPS,
  STATION_RECORDS,
  getPeriodGroupForYear,
  getRegionDefinitionsForPeriodGroup,
} from "../src/metadata.js";

test("period group switches in 1990", () => {
  assert.equal(getPeriodGroupForYear(1989), PERIOD_GROUPS.pre1990.id);
  assert.equal(getPeriodGroupForYear(1990), PERIOD_GROUPS.post1990.id);
});

test("station metadata matches expected base-region counts", () => {
  const pre1990 = STATION_RECORDS.filter(
    (record) => record.period_group === PERIOD_GROUPS.pre1990.id,
  );
  const post1990 = STATION_RECORDS.filter(
    (record) => record.period_group === PERIOD_GROUPS.post1990.id,
  );

  const pre1990NonJeju = new Set(
    pre1990
      .filter((record) => record.region_name !== "제주")
      .map((record) => record.station_id),
  );
  const post1990NonJeju = new Set(
    post1990
      .filter((record) => record.region_name !== "제주")
      .map((record) => record.station_id),
  );

  assert.equal(pre1990NonJeju.size, 56);
  assert.equal(post1990NonJeju.size, 62);
  assert.equal(
    pre1990.filter((record) => record.region_name === "제주").length,
    2,
  );
  assert.equal(
    post1990.filter((record) => record.region_name === "제주").length,
    4,
  );
});

test("known station assignments are present in both periods", () => {
  const pre1990SeoulMetro = getRegionDefinitionsForPeriodGroup(
    PERIOD_GROUPS.pre1990.id,
  ).get("서울-인천-경기도");
  const post1990SouthGyeongsang = getRegionDefinitionsForPeriodGroup(
    PERIOD_GROUPS.post1990.id,
  ).get("부산-울산-경상남도");

  assert.deepEqual(
    pre1990SeoulMetro.station_ids,
    [108, 112, 119, 201, 202, 203],
  );
  assert.equal(post1990SouthGyeongsang.station_ids.includes(155), true);
  assert.equal(post1990SouthGyeongsang.station_ids.includes(295), true);
});

test("composite regions follow the agreed composition", () => {
  assert.deepEqual(COMPOSITE_REGION_COMPONENTS["강원도"], [
    "강원도 영동",
    "강원도 영서",
  ]);
  assert.deepEqual(COMPOSITE_REGION_COMPONENTS["남부지역"], [
    "대구-경상북도",
    "부산-울산-경상남도",
    "전라북도",
    "광주-전라남도",
  ]);
  assert.equal(COMPOSITE_REGION_COMPONENTS["남한"].includes("제주"), false);
  assert.equal(
    getRegionDefinitionsForPeriodGroup(PERIOD_GROUPS.pre1990.id).get("남한")
      .station_ids.length,
    56,
  );
  assert.equal(
    getRegionDefinitionsForPeriodGroup(PERIOD_GROUPS.post1990.id).get("남한")
      .station_ids.length,
    62,
  );
});
