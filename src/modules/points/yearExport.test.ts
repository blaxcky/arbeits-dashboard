import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { AuditPointCase, OtherMeasure, UsoCase } from "../../db/schema";
import { createPointsYearWorkbook, writePointsYearWorkbook, type PointsYearExportInput } from "./yearExport";

const timestamp = "2026-04-15T10:30:00.000Z";

const completedAudit: AuditPointCase = {
  id: "audit-completed",
  name: "Muster GmbH",
  taxNumber: "12-345/6789",
  firm: "Kanzlei Beispiel",
  category: "K3",
  periodStartYear: 2024,
  periodEndYear: 2024,
  additionalResultCents: 125_000_50,
  manualPointsTenths: 15,
  manualPointsNote: "COFAG",
  section99: true,
  submissionMonth: "2026-01",
  status: "completed",
  submittedPointsTenths: 60,
  submittedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
};

const openAudit: AuditPointCase = {
  ...completedAudit,
  id: "audit-open",
  name: "Offene KG",
  taxNumber: "01-002/0003",
  category: "K3",
  periodStartYear: 2025,
  periodEndYear: 2025,
  additionalResultCents: 0,
  manualPointsTenths: 0,
  section99: false,
  submissionMonth: "2026-02",
  status: "in_progress",
  submittedPointsTenths: null,
  submittedAt: null
};

const completedUso: UsoCase = {
  id: "uso-completed",
  title: "USO erledigt",
  manualPointsTenths: 12,
  manualPointsNote: "Amtshilfe",
  submissionMonth: "2026-01",
  status: "completed",
  createdAt: timestamp,
  updatedAt: timestamp
};

const completedOther: OtherMeasure = {
  id: "other-completed",
  title: "CLO erledigt",
  measureType: "CLO-Anfrage",
  manualPointsTenths: 7,
  manualPointsNote: "Sonderauftrag",
  submissionMonth: "2026-01",
  status: "completed",
  createdAt: timestamp,
  updatedAt: timestamp
};

function exportInput(): PointsYearExportInput {
  return {
    year: 2026,
    exportedAt: new Date("2026-08-27T12:34:00.000Z"),
    auditPointCases: [
      completedAudit,
      openAudit,
      { ...openAudit, id: "audit-other-year", name: "Falsches Jahr", submissionMonth: "2025-12" },
      { ...openAudit, id: "audit-no-month", name: "Ohne Monat", submissionMonth: "" }
    ],
    auditPointGoals: [{ id: "goal", year: 2026, targetPointsTenths: 200, updatedAt: timestamp }],
    usoCases: [
      completedUso,
      { ...completedUso, id: "uso-open", title: "USO offen", manualPointsTenths: 5, submissionMonth: "2026-02", status: "in_progress" },
      { ...completedUso, id: "uso-other-year", title: "USO Vorjahr", submissionMonth: "2025-01" },
      { ...completedUso, id: "uso-no-month", title: "USO ohne Monat", submissionMonth: "" }
    ],
    usoGoals: [{ id: "uso-goal", year: 2026, targetCount: 10, updatedAt: timestamp }],
    otherMeasures: [
      completedOther,
      { ...completedOther, id: "other-year", title: "Sonstige Vorjahr", submissionMonth: "2025-01" },
      { ...completedOther, id: "other-no-month", title: "Sonstige ohne Monat", submissionMonth: "" }
    ]
  };
}

function serializedTableRef(table: ExcelJS.Table): string {
  const model = (table as unknown as { table: { ref?: string; tableRef?: string } }).table;
  return (model.tableRef ?? model.ref ?? "").split(":")[0];
}

function tableNames(sheet: ExcelJS.Worksheet): string[] {
  return sheet.getTables().map((table) => (table as unknown as ExcelJS.Table).name);
}

describe("points year Excel export", () => {
  it("exports mixed yearly data with formulas, types, formatting and complete detail tables", async () => {
    const bytes = await writePointsYearWorkbook(exportInput());
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes);

    expect(loaded.worksheets).toHaveLength(1);
    const sheet = loaded.getWorksheet("Punkte 2026");
    expect(sheet).toBeDefined();
    if (!sheet) return;

    expect(sheet.getCell("B2").value).toBe(2026);
    expect(sheet.getCell("B3").value).toBeInstanceOf(Date);
    expect(sheet.getCell("B6").value).toBe(9.4);
    expect(sheet.getCell("D6").value).toBe(4);
    expect(sheet.getCell("F6").value).toBe(13.4);
    expect(sheet.getCell("H6").value).toBe(20);
    expect(sheet.getCell("N6").value).toBe(10);

    expect(sheet.getCell("A10").value).toBeInstanceOf(Date);
    expect((sheet.getCell("A10").value as Date).getUTCFullYear()).toBe(2026);
    expect((sheet.getCell("A10").value as Date).getUTCMonth()).toBe(0);
    expect(sheet.getCell("E10").value).toMatchObject({ formula: "SUM('Punkte 2026'!$B$10:B10)", result: 9.4 });
    expect(sheet.getCell("J10").value).toMatchObject({ formula: "SUM('Punkte 2026'!$G$10:G10)", result: 1 });
    expect(sheet.getCell("N10").value).toMatchObject({ formula: "SUM('Punkte 2026'!$L$10:L10)", result: 1 });
    expect(sheet.getCell("B10").numFmt).toBe("0.0");

    const auditTable = sheet.getTable("Betriebspruefungen2026");
    const usoTable = sheet.getTable("UsoFaelle2026");
    const otherTable = sheet.getTable("SonstigeMassnahmen2026");
    expect(tableNames(sheet)).toEqual([
      "Betriebspruefungen2026",
      "UsoFaelle2026",
      "SonstigeMassnahmen2026"
    ]);
    expect(serializedTableRef(usoTable)).toMatch(/^A\d+$/);
    expect(serializedTableRef(otherTable)).toMatch(/^A\d+$/);

    const auditHeaderRow = Number(serializedTableRef(auditTable).match(/\d+$/)?.[0]);
    const auditFirstRow = auditHeaderRow + 1;
    expect(sheet.getCell(auditFirstRow, 1).value).toBe("Muster GmbH");
    expect(sheet.getCell(auditFirstRow, 2).value).toBe("12-345/6789");
    expect(sheet.getCell(auditFirstRow, 2).numFmt).toBe("@");
    expect(sheet.getCell(auditFirstRow, 7).value).toBe(125000.5);
    expect(sheet.getCell(auditFirstRow, 14).value).toBe(6);
    expect(sheet.getCell(auditFirstRow, 15).value).toBe(1.5);
    expect(sheet.getCell(auditFirstRow, 16).value).toBe("COFAG");
    expect(sheet.getCell(auditFirstRow, 17).value).toBe(7.5);
    expect(sheet.getCell(auditFirstRow, 18).value).toBe("Erledigt");
    expect(sheet.getCell(auditFirstRow, 19).value).toBeInstanceOf(Date);
    expect(sheet.getCell(auditFirstRow, 20).value).toBeInstanceOf(Date);

    const usoFirstRow = Number(serializedTableRef(usoTable).match(/\d+$/)?.[0]) + 1;
    const otherFirstRow = Number(serializedTableRef(otherTable).match(/\d+$/)?.[0]) + 1;
    expect(sheet.getCell(usoFirstRow, 3).value).toBe("Amtshilfe");
    expect(sheet.getCell(otherFirstRow, 4).value).toBe("Sonderauftrag");

    const allText = Array.from({ length: sheet.rowCount }, (_, index) => sheet.getRow(index + 1).values).flat().join("|");
    expect(allText).not.toContain("Falsches Jahr");
    expect(allText).not.toContain("Ohne Monat");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", xSplit: 1, ySplit: 9 });
    expect(sheet.pageSetup.paperSize).toBe(8);
  });

  it("creates a valid header-only workbook with zero values for an empty year", async () => {
    const workbook = await createPointsYearWorkbook({
      ...exportInput(),
      auditPointCases: [],
      auditPointGoals: [],
      usoCases: [],
      usoGoals: [],
      otherMeasures: []
    });
    const sheet = workbook.getWorksheet("Punkte 2026");

    expect(sheet).toBeDefined();
    expect(sheet?.getCell("B6").value).toBe(0);
    expect(sheet?.getCell("D6").value).toBe(0);
    expect(sheet?.getCell("F6").value).toBe(0);
    expect(sheet?.getCell("H6").value).toBeNull();
    expect(sheet ? tableNames(sheet) : []).toEqual([
      "Betriebspruefungen2026",
      "UsoFaelle2026",
      "SonstigeMassnahmen2026"
    ]);
    if (!sheet) return;
    expect(sheet.getCell(serializedTableRef(sheet.getTable("Betriebspruefungen2026"))).value).toBe("Name");
    expect(sheet.getCell(serializedTableRef(sheet.getTable("UsoFaelle2026"))).value).toBe("Titel");
    expect(sheet.getCell(serializedTableRef(sheet.getTable("SonstigeMassnahmen2026"))).value).toBe("Titel");
    await expect(workbook.xlsx.writeBuffer()).resolves.toBeDefined();
  });
});
