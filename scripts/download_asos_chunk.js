import { fetchAllAsosDailyRows } from "../src/asos-client.js";
import { writeCsv } from "../src/csv.js";

const [startYear, endYear, outputPath] = process.argv.slice(2);
const serviceKey = process.env.KMA_SERVICE_KEY;

if (!serviceKey) {
  throw new Error("KMA_SERVICE_KEY is required.");
}

const rows = await fetchAllAsosDailyRows({
  serviceKey,
  startYear: Number(startYear),
  endYear: Number(endYear),
});

await writeCsv(outputPath, rows);
console.log(
  JSON.stringify({
    startYear: Number(startYear),
    endYear: Number(endYear),
    rows: rows.length,
    outputPath,
  }),
);
