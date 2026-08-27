import type { PaperSize, Workbook, Worksheet } from "exceljs";
import type { AuditPointCase, AuditPointGoal, OtherMeasure, UsoCase, UsoGoal } from "../../db/schema";
import {
  buildCombinedPointYearRows,
  buildOtherMeasureTypeBreakdown,
  buildOtherMeasureYearRows,
  buildUsoYearRows,
  calculateAuditPointBreakdown,
  pointsForAuditCase,
  pointsForOtherMeasure,
  pointsForUsoCase,
  usoTargetForYear
} from "./calculations";

export interface PointsYearExportInput {
  year: number;
  exportedAt: Date;
  auditPointCases: AuditPointCase[];
  auditPointGoals: AuditPointGoal[];
  usoCases: UsoCase[];
  usoGoals: UsoGoal[];
  otherMeasures: OtherMeasure[];
}

const COLORS = {
  navy: "243447",
  blue: "2F6F8F",
  paleBlue: "E8F1F5",
  paleGreen: "E7F4ED",
  paleOrange: "FFF1DD",
  white: "FFFFFF",
  border: "CDD7E0",
  text: "243447",
  muted: "5E6B78"
};

const thinBorder = {
  top: { style: "thin" as const, color: { argb: COLORS.border } },
  left: { style: "thin" as const, color: { argb: COLORS.border } },
  bottom: { style: "thin" as const, color: { argb: COLORS.border } },
  right: { style: "thin" as const, color: { argb: COLORS.border } }
};

function points(tenths: number): number {
  return tenths / 10;
}

function monthDate(month: string): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1, 12));
}

function completedDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function statusLabel(status: string): string {
  return status === "completed" ? "Erledigt" : "Offen";
}

function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function formula(formulaText: string, result: number) {
  return { formula: formulaText, result };
}

function styleSectionTitle(worksheet: Worksheet, row: number, title: string, lastColumn: number) {
  worksheet.mergeCells(row, 1, row, lastColumn);
  const cell = worksheet.getCell(row, 1);
  cell.value = title;
  cell.font = { bold: true, color: { argb: COLORS.white }, size: 12 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.blue } };
  cell.alignment = { vertical: "middle" };
  worksheet.getRow(row).height = 24;
}

function styleKpi(worksheet: Worksheet, labelCell: string, valueCell: string, label: string, value: number | null, numberFormat = "0.0") {
  const labelTarget = worksheet.getCell(labelCell);
  const valueTarget = worksheet.getCell(valueCell);
  labelTarget.value = label;
  valueTarget.value = value;
  labelTarget.font = { bold: true, color: { argb: COLORS.muted } };
  valueTarget.font = { bold: true, color: { argb: COLORS.text }, size: 12 };
  valueTarget.numFmt = numberFormat;
  for (const cell of [labelTarget, valueTarget]) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.paleBlue } };
    cell.border = thinBorder;
    cell.alignment = { vertical: "middle", wrapText: true };
  }
}

function styleStatusCells(worksheet: Worksheet, column: number, startRow: number, endRow: number) {
  for (let row = startRow; row <= endRow; row += 1) {
    const cell = worksheet.getCell(row, column);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: cell.value === "Erledigt" ? COLORS.paleGreen : COLORS.paleOrange }
    };
  }
}

function styleTableHeader(worksheet: Worksheet, row: number) {
  worksheet.getRow(row).height = 32;
  worksheet.getRow(row).alignment = { vertical: "middle", wrapText: true };
  worksheet.getRow(row).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.text }, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.paleBlue } };
    cell.border = thinBorder;
  });
}

function yearEntries<T extends { submissionMonth: string }>(entries: T[], year: number): T[] {
  return entries.filter((entry) => entry.submissionMonth.startsWith(`${year}-`));
}

function tableName(prefix: string, year: number): string {
  return `${prefix}${year}`;
}

export async function createPointsYearWorkbook(input: PointsYearExportInput): Promise<Workbook> {
  const excelJsModule = await import("exceljs");
  const ExcelJs = excelJsModule.default;
  const workbook = new ExcelJs.Workbook();
  const sheetName = `Punkte ${input.year}`;
  const worksheet = workbook.addWorksheet(sheetName, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 8 as PaperSize },
    properties: { defaultRowHeight: 18 }
  });

  workbook.creator = "arbeits-dashboard";
  workbook.created = input.exportedAt;
  workbook.modified = input.exportedAt;
  workbook.lastPrinted = input.exportedAt;
  workbook.calcProperties.fullCalcOnLoad = true;

  const auditCases = yearEntries(input.auditPointCases, input.year);
  const usoCases = yearEntries(input.usoCases, input.year);
  const otherMeasures = yearEntries(input.otherMeasures, input.year);
  const pointRows = buildCombinedPointYearRows(auditCases, usoCases, otherMeasures, input.year, input.auditPointGoals);
  const usoRows = buildUsoYearRows(usoCases, input.year, input.usoGoals);
  const otherRows = buildOtherMeasureYearRows(otherMeasures, input.year);
  const otherTypeRows = buildOtherMeasureTypeBreakdown(otherMeasures, input.year);
  const auditGoal = input.auditPointGoals.find((goal) => goal.year === input.year)?.targetPointsTenths ?? null;
  const completedPoints = pointRows[pointRows.length - 1]?.cumulativeValue ?? 0;
  const openPoints = pointRows.reduce((sum, row) => sum + row.openValue, 0);
  const usoCompleted = usoRows[usoRows.length - 1]?.cumulativeValue ?? 0;
  const usoOpen = usoRows.reduce((sum, row) => sum + row.openValue, 0);
  const otherCompleted = otherRows[otherRows.length - 1]?.cumulativeValue ?? 0;
  const otherOpen = otherRows.reduce((sum, row) => sum + row.openValue, 0);

  worksheet.mergeCells("A1:T1");
  worksheet.getCell("A1").value = "Punkte-Jahresstatistik";
  worksheet.getCell("A1").font = { bold: true, color: { argb: COLORS.white }, size: 20 };
  worksheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
  worksheet.getCell("A1").alignment = { vertical: "middle" };
  worksheet.getRow(1).height = 36;
  worksheet.getCell("A2").value = "Jahr";
  worksheet.getCell("B2").value = input.year;
  worksheet.getCell("A3").value = "Exportiert am";
  worksheet.getCell("B3").value = input.exportedAt;
  worksheet.getCell("B3").numFmt = "dd.mm.yyyy hh:mm";
  worksheet.getCell("A2").font = worksheet.getCell("A3").font = { bold: true, color: { argb: COLORS.muted } };

  styleSectionTitle(worksheet, 5, "Jahreskennzahlen", 19);
  styleKpi(worksheet, "A6", "B6", "Punkte erledigt", points(completedPoints));
  styleKpi(worksheet, "C6", "D6", "Punkte offen", points(openPoints));
  styleKpi(worksheet, "E6", "F6", "Punkte gesamt", points(completedPoints + openPoints));
  styleKpi(worksheet, "G6", "H6", "BP-Jahresziel", auditGoal === null ? null : points(auditGoal));
  styleKpi(worksheet, "I6", "J6", "USO erledigt", usoCompleted, "0");
  styleKpi(worksheet, "K6", "L6", "USO offen", usoOpen, "0");
  styleKpi(worksheet, "M6", "N6", "USO-Ziel", usoTargetForYear(input.usoGoals, input.year), "0");
  styleKpi(worksheet, "O6", "P6", "Sonstige erledigt", otherCompleted, "0");
  styleKpi(worksheet, "Q6", "R6", "Sonstige offen", otherOpen, "0");

  styleSectionTitle(worksheet, 8, "Monatsstatistik", 18);
  const monthlyHeaders = [
    "Monat", "Punkte erledigt", "Punkte offen", "Punkte Soll", "Punkte Stand", "Punkte Rest",
    "USO erledigt", "USO offen", "USO Soll", "USO Stand", "USO Rest",
    "Sonstige erledigt", "Sonstige offen", "Sonstige Stand"
  ];
  worksheet.getRow(9).values = monthlyHeaders;
  worksheet.getRow(9).font = { bold: true, color: { argb: COLORS.white } };
  worksheet.getRow(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
  worksheet.getRow(9).alignment = { vertical: "middle", wrapText: true };
  worksheet.getRow(9).height = 32;
  const quotedSheet = quoteSheetName(sheetName);
  pointRows.forEach((row, index) => {
    const excelRow = 10 + index;
    const usoRow = usoRows[index];
    const otherRow = otherRows[index];
    worksheet.getRow(excelRow).values = [
      monthDate(row.month),
      points(row.submissionValue),
      points(row.openValue),
      row.targetValue === null ? null : points(row.targetValue),
      formula(`SUM(${quotedSheet}!$B$10:B${excelRow})`, points(row.cumulativeValue)),
      row.remainingValue === null ? null : points(row.remainingValue),
      usoRow.submissionValue,
      usoRow.openValue,
      usoRow.targetValue,
      formula(`SUM(${quotedSheet}!$G$10:G${excelRow})`, usoRow.cumulativeValue),
      usoRow.remainingValue,
      otherRow.completedValue,
      otherRow.openValue,
      formula(`SUM(${quotedSheet}!$L$10:L${excelRow})`, otherRow.cumulativeValue)
    ];
    worksheet.getCell(excelRow, 1).numFmt = "mmmm yyyy";
    for (let column = 2; column <= 6; column += 1) worksheet.getCell(excelRow, column).numFmt = "0.0";
  });
  for (let row = 9; row <= 21; row += 1) {
    for (let column = 1; column <= monthlyHeaders.length; column += 1) worksheet.getCell(row, column).border = thinBorder;
  }

  styleSectionTitle(worksheet, 23, "Sonstige Maßnahmen nach Art", 6);
  worksheet.getRow(24).values = ["Art", "Erledigt", "Offen", "Gesamt"];
  worksheet.getRow(24).font = { bold: true, color: { argb: COLORS.white } };
  worksheet.getRow(24).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
  const otherTypeData = otherTypeRows.length > 0 ? otherTypeRows : [{ measureType: "Keine Einträge", completedCount: 0, openCount: 0, totalCount: 0 }];
  otherTypeData.forEach((item, index) => {
    worksheet.getRow(25 + index).values = [item.measureType, item.completedCount, item.openCount, item.totalCount];
  });
  const otherTypeEndRow = 24 + otherTypeData.length;
  for (let row = 24; row <= otherTypeEndRow; row += 1) {
    for (let column = 1; column <= 4; column += 1) worksheet.getCell(row, column).border = thinBorder;
  }

  let nextRow = otherTypeEndRow + 2;
  styleSectionTitle(worksheet, nextRow, "Betriebsprüfungen", 20);
  const auditTitleRow = nextRow;
  nextRow += 1;
  const auditHeaders = [
    "Name", "Steuernummer", "Kanzlei", "Kategorie", "Zeitraum von", "Zeitraum bis", "Mehrergebnis", "§99",
    "Kategoriepunkte", "Zeitraumpunkte", "§99-Punkte", "Mehrergebnis-Punkte", "Automatik aktuell", "Abgabepunkte eingefroren",
    "Manuelle Punkte", "Hinweis zu Zusatzpunkten", "Verwendete Gesamtpunkte", "Status", "Abgabemonat", "Erledigungsdatum"
  ];
  const auditRows = auditCases.map((pointCase) => {
    const breakdown = calculateAuditPointBreakdown(pointCase);
    return [
      pointCase.name,
      pointCase.taxNumber,
      pointCase.firm,
      pointCase.category,
      pointCase.periodStartYear,
      pointCase.periodEndYear,
      pointCase.additionalResultCents / 100,
      pointCase.section99 ? "Ja" : "Nein",
      points(breakdown.categoryTenths),
      points(breakdown.periodTenths),
      points(breakdown.section99Tenths),
      points(breakdown.additionalResultTenths),
      points(breakdown.automaticTotalTenths),
      pointCase.submittedPointsTenths === null ? null : points(pointCase.submittedPointsTenths),
      points(pointCase.manualPointsTenths ?? 0),
      pointCase.manualPointsNote ?? "",
      points(pointsForAuditCase(pointCase)),
      statusLabel(pointCase.status),
      monthDate(pointCase.submissionMonth),
      completedDate(pointCase.submittedAt)
    ];
  });
  worksheet.addTable({
    name: tableName("Betriebspruefungen", input.year),
    ref: `A${nextRow}`,
    headerRow: true,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: auditHeaders.map((name) => ({ name, filterButton: true })),
    rows: auditRows
  });
  styleTableHeader(worksheet, nextRow);
  const auditDataStart = nextRow + 1;
  const auditDataEnd = auditDataStart + Math.max(auditRows.length - 1, 0);
  for (let row = auditDataStart; row <= auditDataEnd; row += 1) {
    worksheet.getCell(row, 2).numFmt = "@";
    worksheet.getCell(row, 7).numFmt = "#,##0.00 [$€-407]";
    for (let column = 9; column <= 15; column += 1) worksheet.getCell(row, column).numFmt = "0.0";
    worksheet.getCell(row, 17).numFmt = "0.0";
    worksheet.getCell(row, 19).numFmt = "mmmm yyyy";
    worksheet.getCell(row, 20).numFmt = "dd.mm.yyyy";
  }
  if (auditRows.length > 0) styleStatusCells(worksheet, 18, auditDataStart, auditDataEnd);
  nextRow = auditTitleRow + auditRows.length + 4;

  styleSectionTitle(worksheet, nextRow, "USO-Fälle", 8);
  const usoTitleRow = nextRow;
  nextRow += 1;
  const usoDetailRows = usoCases.map((usoCase) => [
    usoCase.title,
    points(pointsForUsoCase(usoCase)),
    usoCase.manualPointsNote ?? "",
    statusLabel(usoCase.status),
    monthDate(usoCase.submissionMonth)
  ]);
  worksheet.addTable({
    name: tableName("UsoFaelle", input.year),
    ref: `A${nextRow}`,
    headerRow: true,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: ["Titel", "Punkte", "Hinweis zu Zusatzpunkten", "Status", "Abgabemonat"].map((name) => ({ name, filterButton: true })),
    rows: usoDetailRows
  });
  styleTableHeader(worksheet, nextRow);
  const usoDataStart = nextRow + 1;
  const usoDataEnd = usoDataStart + Math.max(usoDetailRows.length - 1, 0);
  for (let row = usoDataStart; row <= usoDataEnd; row += 1) {
    worksheet.getCell(row, 2).numFmt = "0.0";
    worksheet.getCell(row, 5).numFmt = "mmmm yyyy";
  }
  if (usoDetailRows.length > 0) styleStatusCells(worksheet, 4, usoDataStart, usoDataEnd);
  nextRow = usoTitleRow + usoDetailRows.length + 4;

  styleSectionTitle(worksheet, nextRow, "Sonstige Maßnahmen", 8);
  const otherTitleRow = nextRow;
  nextRow += 1;
  const otherDetailRows = otherMeasures.map((measure) => [
    measure.title,
    measure.measureType,
    points(pointsForOtherMeasure(measure)),
    measure.manualPointsNote ?? "",
    statusLabel(measure.status),
    monthDate(measure.submissionMonth)
  ]);
  worksheet.addTable({
    name: tableName("SonstigeMassnahmen", input.year),
    ref: `A${nextRow}`,
    headerRow: true,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: ["Titel", "Art", "Punkte", "Hinweis zu Zusatzpunkten", "Status", "Abgabemonat"].map((name) => ({ name, filterButton: true })),
    rows: otherDetailRows
  });
  styleTableHeader(worksheet, nextRow);
  const otherDataStart = nextRow + 1;
  const otherDataEnd = otherDataStart + Math.max(otherDetailRows.length - 1, 0);
  for (let row = otherDataStart; row <= otherDataEnd; row += 1) {
    worksheet.getCell(row, 3).numFmt = "0.0";
    worksheet.getCell(row, 6).numFmt = "mmmm yyyy";
  }
  if (otherDetailRows.length > 0) styleStatusCells(worksheet, 5, otherDataStart, otherDataEnd);
  worksheet.getRow(otherTitleRow).height = 24;

  const widths = [28, 18, 24, 14, 14, 14, 18, 12, 17, 17, 15, 20, 18, 23, 18, 28, 23, 14, 18, 18];
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  worksheet.views = [{ state: "frozen", xSplit: 1, ySplit: 9, topLeftCell: "B10", activeCell: "B10" }];
  worksheet.autoFilter = undefined;
  worksheet.pageSetup.printTitlesRow = "1:9";
  worksheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
  worksheet.headerFooter.oddFooter = `&Larbeits-dashboard&C${sheetName}&RSeite &P von &N`;

  return workbook;
}

export async function writePointsYearWorkbook(input: PointsYearExportInput): Promise<Uint8Array> {
  const workbook = await createPointsYearWorkbook(input);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function downloadPointsYearWorkbook(input: PointsYearExportInput): Promise<void> {
  const bytes = await writePointsYearWorkbook(input);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `punkte-jahresstatistik-${input.year}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
