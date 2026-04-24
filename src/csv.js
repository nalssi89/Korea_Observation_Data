import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }

  return text;
}

export async function writeCsv(filePath, rows) {
  await mkdir(dirname(filePath), { recursive: true });

  if (rows.length === 0) {
    await writeFile(filePath, "\uFEFF", "utf8");
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvValue(row[header])).join(","));
  }

  await writeFile(filePath, `\uFEFF${lines.join("\n")}\n`, "utf8");
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

export async function readCsv(filePath) {
  const content = await readFile(filePath, "utf8");
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }

  const [headerLine, ...lines] = trimmed.split(/\r?\n/u);
  const normalizedHeaderLine =
    headerLine.charCodeAt(0) === 0xfeff ? headerLine.slice(1) : headerLine;
  const headers = parseCsvLine(normalizedHeaderLine);

  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}
