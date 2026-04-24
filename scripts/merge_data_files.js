import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { once } from "node:events";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

const [outputPath, ...inputPaths] = process.argv.slice(2);

if (!outputPath || inputPaths.length === 0) {
  throw new Error("Usage: node scripts/merge_data_files.js <output.data> <input.data>...");
}

await mkdir(dirname(outputPath), { recursive: true });
const writer = createWriteStream(outputPath, { encoding: "utf8" });
let wroteHeader = false;

for (const inputPath of inputPaths) {
  const reader = createInterface({
    input: createReadStream(inputPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let lineNumber = 0;

  for await (const line of reader) {
    const cleanedLine =
      lineNumber === 0 && line.charCodeAt(0) === 0xfeff
        ? line.slice(1)
        : line;

    if (lineNumber === 0) {
      if (!wroteHeader) {
        writer.write(`\uFEFF${cleanedLine}\n`);
        wroteHeader = true;
      }
    } else if (cleanedLine !== "") {
      writer.write(`${cleanedLine}\n`);
    }

    lineNumber += 1;
  }
}

writer.end();
await once(writer, "finish");
