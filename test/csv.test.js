import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readCsv, writeCsv } from "../src/csv.js";

test("csv writer and reader preserve Korean text", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kod-csv-"));
  const filePath = join(directory, "sample.data");

  await writeCsv(filePath, [
    { region_name: "남한", variable: "tavg", value: 1.23 },
    { region_name: "제주", variable: "precip", value: 4.56 },
  ]);

  const rows = await readCsv(filePath);
  assert.deepEqual(rows, [
    { region_name: "남한", variable: "tavg", value: "1.23" },
    { region_name: "제주", variable: "precip", value: "4.56" },
  ]);
});
