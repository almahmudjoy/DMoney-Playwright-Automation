import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function localDateStamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function serializeStatementCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export async function saveStatementCsv(headers: string[], rows: string[][]): Promise<string> {
  const directory = path.resolve('output');
  const outputPath = path.join(directory, `self_statement_${localDateStamp()}.csv`);
  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, serializeStatementCsv(headers, rows), 'utf8');
  return outputPath;
}