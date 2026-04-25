import { buildResponseSystem } from "../src/enso-response-system.js";

const outputDir = process.argv[2] ?? "data/output/final/enso_response_system";
const combinedOutputPath = process.argv[3] ?? "ENSO_RESPONSE_SYSTEM.md";

const result = await buildResponseSystem({ outputDir, combinedOutputPath });

console.log(`ENSO response system written to ${result.outputDir}`);
console.log(`Single-file response system written to ${result.combinedFile}`);
for (const file of result.files) {
  console.log(`- ${file}`);
}
