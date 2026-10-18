import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

const CSV_PATH = path.join(process.cwd(), "..", "data", "Siemens.csv");

function parseCsvLine(line: string) {
  return line.split(",").map((value) => value.trim());
}

export async function GET() {
  const csv = await readFile(CSV_PATH, "utf8");
  const lines = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });

  return NextResponse.json(rows);
}