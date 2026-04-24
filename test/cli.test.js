import test from "node:test";
import assert from "node:assert/strict";

import { isDirectExecution } from "../src/cli.js";

test("direct execution detection works with Windows paths", () => {
  assert.equal(
    isDirectExecution(
      "file:///D:/WORK/Projects/Codex/Korea_Observation_Data/src/cli.js",
      "D:\\WORK\\Projects\\Codex\\Korea_Observation_Data\\src\\cli.js",
    ),
    true,
  );
});
