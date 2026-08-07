import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OtherMeasure, Trip, UsoCase } from "../db/schema";
import { auditPointMonthOptions, AuditPointsView, automaticDestinationDraft, CollapsiblePointLists, destinationImportDraft, duplicatedTripDraft, formatAuditTaxNumber, formatDateOnly, formatTripCopyDateTime, normalizeTimeInput, openTripFields, parseEuroCentsInput, parsePointTenthsInput, pointYearOptions, preferredTimeEntryDate, publicTransportDestinationPlace, publicTransportTaxFreeYearLimitForYear, publicTransportYearLimitToForm, settingsToForm, sortedOpenTrips, stripTripMeta, tripToForm, tripYearOptions, validateAuditPointCaseForm, validateSettingsForm, WorkTimeField, yearFromUrlParam } from "./App";
import { summarizeAuditPoints } from "../modules/points/calculations";
import type { AuditPointCase, Settings } from "../db/schema";

describe("normalizeTimeInput", () => {
  it("treats one and two digit values as full hours", () => {
    expect(normalizeTimeInput("7")).toBe("07:00");
    expect(normalizeTimeInput("17")).toBe("17:00");
  });

  it("keeps existing compact and colon formats valid", () => {
    expect(normalizeTimeInput("730")).toBe("07:30");
    expect(normalizeTimeInput("0730")).toBe("07:30");
    expect(normalizeTimeInput("7:30")).toBe("07:30");
  });

  it("adds a missing final digit when a three digit time has invalid HMM minutes", () => {
    expect(normalizeTimeInput("163")).toBe("16:30");
    expect(normalizeTimeInput("170")).toBe("17:00");
  });

  it("rejects invalid time values", () => {
    expect(normalizeTimeInput("24")).toBeNull();
    expect(normalizeTimeInput("1760")).toBeNull();
    expect(normalizeTimeInput("199")).toBeNull();
    expect(normalizeTimeInput("abc")).toBeNull();
  });
});

describe("parseEuroCentsInput", () => {
  it("parses comma and dot euro amounts into cents", () => {
    expect(parseEuroCentsInput("123,45")).toBe(12345);
    expect(parseEuroCentsInput("123.45")).toBe(12345);
    expect(parseEuroCentsInput("12")).toBe(1200);
  });

  it("rejects empty or invalid euro amounts", () => {
    expect(parseEuroCentsInput("")).toBeNull();
    expect(parseEuroCentsInput("abc")).toBeNull();
    expect(parseEuroCentsInput("12,345")).toBeNull();
  });
});

describe("settings helpers", () => {
  const settings: Settings = {
    id: "main",
    dailyTargetMinutes: 480,
    weeklyTargetMinutes: 2400,
    flexLimitMinutes: 6000,
    flexStartMinutes: null,
    preferredWorkStartTime: null,
    preferredWorkEndTime: null,
    vacationEntitlementMinutes: null,
    vacationUsedMinutes: 0,
    publicTransportTaxFreeYearLimitsCents: {},
    updatedAt: "2026-05-01T08:00:00.000Z"
  };

  it("keeps settings valid without public transport yearly limits", () => {
    const form = settingsToForm(settings);

    expect(validateSettingsForm(form)).toEqual({});
  });

  it("loads saved quick-select times and treats missing legacy values as empty", () => {
    expect(settingsToForm({ ...settings, preferredWorkStartTime: "07:30", preferredWorkEndTime: "16:00" })).toMatchObject({
      preferredWorkStartTime: "07:30",
      preferredWorkEndTime: "16:00"
    });
    const { preferredWorkStartTime: _start, preferredWorkEndTime: _end, ...legacySettings } = settings;
    expect(settingsToForm(legacySettings as Settings)).toMatchObject({
      preferredWorkStartTime: "",
      preferredWorkEndTime: ""
    });
  });

  it("accepts optional normalized quick-select formats and rejects invalid times", () => {
    const form = settingsToForm(settings);

    expect(validateSettingsForm({ ...form, preferredWorkStartTime: "7", preferredWorkEndTime: "163" })).toEqual({});
    expect(validateSettingsForm({ ...form, preferredWorkStartTime: "", preferredWorkEndTime: "" })).toEqual({});
    expect(validateSettingsForm({ ...form, preferredWorkStartTime: "25:00", preferredWorkEndTime: "abc" })).toMatchObject({
      preferredWorkStartTime: expect.any(String),
      preferredWorkEndTime: expect.any(String)
    });
  });

  it("reads public transport tax-free limits per year", () => {
    const nextSettings = { ...settings, publicTransportTaxFreeYearLimitsCents: { "2026": 245000, "2027": null } };

    expect(publicTransportTaxFreeYearLimitForYear(nextSettings, 2026)).toBe(245000);
    expect(publicTransportTaxFreeYearLimitForYear(nextSettings, 2027)).toBeNull();
    expect(publicTransportTaxFreeYearLimitForYear(nextSettings, 2028)).toBe(140000);
    expect(publicTransportYearLimitToForm(nextSettings, 2026)).toBe("2\u00a0450");
    expect(publicTransportYearLimitToForm(nextSettings, 2027)).toBe("");
    expect(publicTransportYearLimitToForm(nextSettings, 2028)).toBe("1\u00a0400");
  });
});

describe("WorkTimeField", () => {
  it("shows a quick-select only when configured and selects only that field", () => {
    const selectStart = vi.fn();
    const selectEnd = vi.fn();
    const commonProps = { value: "", onChange: vi.fn(), onBlur: vi.fn() };
    render(
      <>
        <WorkTimeField {...commonProps} id="work-start-time" label="Dienstbeginn" placeholder="07:30" preferredTime="07:30" onPreferredTime={selectStart} />
        <WorkTimeField {...commonProps} id="work-end-time" label="Dienstende" placeholder="15:30" preferredTime={null} onPreferredTime={selectEnd} />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: "07:30 als Dienstbeginn eintragen" }));

    expect(selectStart).toHaveBeenCalledWith("07:30");
    expect(selectEnd).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Dienstende eintragen/ })).not.toBeInTheDocument();
  });
});

describe("CollapsiblePointLists", () => {
  const storageKey = "arbeits-dashboard:points-list-visibility";

  beforeEach(() => {
    window.localStorage.clear();
  });

  function renderLists() {
    return render(
      <CollapsiblePointLists
        counts={{ audit: 3, uso: 2, other: 1 }}
        content={{
          audit: <p>Inhalt Betriebsprüfungen</p>,
          uso: <p>Inhalt USO</p>,
          other: <p>Inhalt sonstige Maßnahmen</p>
        }}
      />
    );
  }

  it("starts with all lists open and keeps headings and counts in the toggle buttons", () => {
    renderLists();

    expect(screen.getByRole("button", { name: "Betriebsprüfungen einklappen" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Betriebsprüfungen einklappen" })).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: "USO-Fälle einklappen" })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Sonstige Maßnahmen einklappen" })).toHaveTextContent("1");
    expect(screen.getByText("Inhalt Betriebsprüfungen")).toBeVisible();
    expect(screen.getByRole("button", { name: "Alle einklappen" })).toBeInTheDocument();
  });

  it("collapses one list while its accessible heading and count remain visible", () => {
    renderLists();
    const toggle = screen.getByRole("button", { name: "Betriebsprüfungen einklappen" });

    toggle.focus();
    expect(toggle).toHaveFocus();
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("aria-controls", "points-list-audit-content");
    fireEvent.click(toggle);

    const collapsedToggle = screen.getByRole("button", { name: "Betriebsprüfungen ausklappen" });
    expect(collapsedToggle).toHaveAttribute("aria-expanded", "false");
    expect(collapsedToggle).toHaveTextContent("Betriebsprüfungen");
    expect(collapsedToggle).toHaveTextContent("3");
    expect(screen.getByText("Inhalt Betriebsprüfungen").parentElement).toHaveAttribute("hidden");
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}")).toEqual({ audit: false, uso: true, other: true });
  });

  it("collapses all lists and expands all lists from closed and mixed states", () => {
    renderLists();

    fireEvent.click(screen.getByRole("button", { name: "Alle einklappen" }));
    expect(screen.getAllByRole("button", { name: /ausklappen$/ })).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: "Betriebsprüfungen ausklappen" }));
    expect(screen.getByRole("button", { name: "Alle ausklappen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Betriebsprüfungen einklappen" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "USO-Fälle ausklappen" })).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Alle ausklappen" }));
    expect(screen.getByRole("button", { name: "Alle einklappen" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /einklappen$/ })).toHaveLength(4);
  });

  it("restores an individually saved visibility state", () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ audit: false, uso: true, other: false }));

    renderLists();

    expect(screen.getByRole("button", { name: "Betriebsprüfungen ausklappen" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "USO-Fälle einklappen" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Sonstige Maßnahmen ausklappen" })).toHaveAttribute("aria-expanded", "false");
  });

  it.each([
    "kein JSON",
    JSON.stringify({ audit: false, uso: true })
  ])("falls back to all lists open for invalid or incomplete storage: %s", (stored) => {
    window.localStorage.setItem(storageKey, stored);

    renderLists();

    expect(screen.getByRole("button", { name: "Alle einklappen" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /einklappen$/ })).toHaveLength(4);
  });
});

describe("AuditPointsView form tabs", () => {
  const timestamp = "2026-05-01T08:00:00.000Z";
  const auditCase: AuditPointCase = {
    id: "audit-1",
    name: "BP Tab-Test",
    taxNumber: "12 345/6789",
    firm: "Kanzlei Test",
    category: "M1",
    periodStartYear: 2024,
    periodEndYear: 2025,
    additionalResultCents: 0,
    section99: false,
    submissionMonth: "2026-05",
    status: "in_progress",
    submittedPointsTenths: null,
    submittedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const usoCase: UsoCase = {
    id: "uso-1",
    title: "USO Tab-Test",
    submissionMonth: "2026-06",
    status: "in_progress",
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const otherMeasure: OtherMeasure = {
    id: "other-1",
    title: "Sonstige Tab-Test",
    measureType: "CLO-Anfrage",
    submissionMonth: "2026-07",
    status: "in_progress",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  function renderView(withCases = false) {
    const data = {
      auditPointCases: withCases ? [auditCase] : [],
      usoCases: withCases ? [usoCase] : [],
      otherMeasures: withCases ? [otherMeasure] : [],
      saveAuditPointCase: vi.fn(),
      removeAuditPointCase: vi.fn(),
      saveUsoCase: vi.fn(),
      removeUsoCase: vi.fn(),
      saveOtherMeasure: vi.fn(),
      removeOtherMeasure: vi.fn()
    } as unknown as Parameters<typeof AuditPointsView>[0]["data"];

    render(<AuditPointsView data={data} showToast={vi.fn()} />);
  }

  it("starts on the audit form and renders exactly one form panel", () => {
    renderView();

    expect(screen.getByRole("tab", { name: "Betriebsprüfung" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Betriebsprüfung" })).toBeInTheDocument();
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByText("Neuer Fall")).toBeInTheDocument();
    expect(screen.queryByText("Neuer USO-Fall")).not.toBeInTheDocument();
    expect(screen.queryByText("Neue sonstige Maßnahme")).not.toBeInTheDocument();
  });

  it("keeps drafts per form and resets only the active form with Neu", () => {
    renderView();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Entwurf BP" } });
    fireEvent.click(screen.getByRole("tab", { name: "USO-Fall" }));
    fireEvent.change(screen.getByLabelText("Titel"), { target: { value: "Entwurf USO" } });
    fireEvent.click(screen.getByRole("tab", { name: "Sonstige Maßnahme" }));
    fireEvent.change(screen.getByLabelText("Titel"), { target: { value: "Entwurf Sonstige" } });

    fireEvent.click(screen.getByRole("tab", { name: "USO-Fall" }));
    expect(screen.getByLabelText("Titel")).toHaveValue("Entwurf USO");
    fireEvent.click(screen.getByRole("button", { name: "Neu" }));
    expect(screen.getByLabelText("Titel")).toHaveValue("");

    fireEvent.click(screen.getByRole("tab", { name: "Betriebsprüfung" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Entwurf BP");
    fireEvent.click(screen.getByRole("tab", { name: "Sonstige Maßnahme" }));
    expect(screen.getByLabelText("Titel")).toHaveValue("Entwurf Sonstige");
  });

  it("supports arrow, Home and End keyboard navigation with focus", () => {
    renderView();
    const auditTab = screen.getByRole("tab", { name: "Betriebsprüfung" });

    auditTab.focus();
    fireEvent.keyDown(auditTab, { key: "ArrowRight" });
    const usoTab = screen.getByRole("tab", { name: "USO-Fall" });
    expect(usoTab).toHaveFocus();
    expect(usoTab).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(usoTab, { key: "End" });
    const otherTab = screen.getByRole("tab", { name: "Sonstige Maßnahme" });
    expect(otherTab).toHaveFocus();
    expect(otherTab).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(otherTab, { key: "Home" });
    expect(auditTab).toHaveFocus();
    expect(auditTab).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(auditTab, { key: "ArrowLeft" });
    expect(otherTab).toHaveFocus();
    expect(otherTab).toHaveAttribute("aria-selected", "true");
  });

  it("stays on the current form after a validation error", () => {
    renderView();

    fireEvent.click(screen.getByRole("tab", { name: "USO-Fall" }));
    fireEvent.click(screen.getByRole("button", { name: "USO-Fall speichern" }));

    expect(screen.getByRole("tab", { name: "USO-Fall" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "USO-Fall" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Titel/ })).toHaveAttribute("aria-invalid", "true");
  });

  it("opens each saved case in its matching form from the lists", () => {
    renderView(true);
    const editButtons = screen.getAllByRole("button", { name: "Bearbeiten" });

    fireEvent.click(editButtons[1]);
    expect(screen.getByRole("tab", { name: "USO-Fall" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("USO-Fall bearbeiten")).toBeInTheDocument();
    expect(screen.getByLabelText("Titel")).toHaveValue("USO Tab-Test");

    fireEvent.click(editButtons[2]);
    expect(screen.getByRole("tab", { name: "Sonstige Maßnahme" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Sonstige Maßnahme bearbeiten")).toBeInTheDocument();
    expect(screen.getByLabelText("Titel")).toHaveValue("Sonstige Tab-Test");

    fireEvent.click(editButtons[0]);
    expect(screen.getByRole("tab", { name: "Betriebsprüfung" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Fall bearbeiten")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("BP Tab-Test");
  });
});

describe("point case list status presentation", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows only missing-month warnings and dims only completed cases", () => {
    const timestamp = "2026-05-01T08:00:00.000Z";
    const auditCase = {
      id: "audit-open-month",
      name: "BP offen mit Monat",
      taxNumber: "",
      firm: "",
      category: "M1" as const,
      periodStartYear: 2024,
      periodEndYear: 2025,
      additionalResultCents: 0,
      section99: false,
      submissionMonth: "2026-05",
      status: "in_progress" as const,
      submittedPointsTenths: null,
      submittedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const usoCase = {
      id: "uso-open-month",
      title: "USO offen mit Monat",
      submissionMonth: "2026-05",
      status: "in_progress" as const,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const otherMeasure = {
      id: "other-open-month",
      title: "Maßnahme offen mit Monat",
      measureType: "CLO-Anfrage",
      submissionMonth: "2026-05",
      status: "in_progress" as const,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const data = {
      auditPointCases: [
        auditCase,
        { ...auditCase, id: "audit-done-month", name: "BP erledigt mit Monat", status: "completed" as const, submittedPointsTenths: 60, submittedAt: timestamp },
        { ...auditCase, id: "audit-open-empty", name: "BP offen ohne Monat", submissionMonth: "" },
        { ...auditCase, id: "audit-done-empty", name: "BP erledigt ohne Monat", submissionMonth: "", status: "completed" as const, submittedPointsTenths: 60, submittedAt: timestamp }
      ],
      usoCases: [
        usoCase,
        { ...usoCase, id: "uso-done-month", title: "USO erledigt mit Monat", status: "completed" as const },
        { ...usoCase, id: "uso-open-empty", title: "USO offen ohne Monat", submissionMonth: "" },
        { ...usoCase, id: "uso-done-empty", title: "USO erledigt ohne Monat", submissionMonth: "", status: "completed" as const }
      ],
      otherMeasures: [
        otherMeasure,
        { ...otherMeasure, id: "other-done-month", title: "Maßnahme erledigt mit Monat", status: "completed" as const },
        { ...otherMeasure, id: "other-open-empty", title: "Maßnahme offen ohne Monat", submissionMonth: "" },
        { ...otherMeasure, id: "other-done-empty", title: "Maßnahme erledigt ohne Monat", submissionMonth: "", status: "completed" as const }
      ],
      saveAuditPointCase: vi.fn(),
      removeAuditPointCase: vi.fn(),
      saveUsoCase: vi.fn(),
      removeUsoCase: vi.fn(),
      saveOtherMeasure: vi.fn(),
      removeOtherMeasure: vi.fn()
    } as unknown as Parameters<typeof AuditPointsView>[0]["data"];

    render(<AuditPointsView data={data} showToast={vi.fn()} />);

    const rowFor = (title: string) => screen.getByText(title, { selector: "strong" }).closest("article");

    for (const title of ["BP offen mit Monat", "USO offen mit Monat", "Maßnahme offen mit Monat", "BP erledigt mit Monat", "USO erledigt mit Monat", "Maßnahme erledigt mit Monat"]) {
      expect(rowFor(title)?.querySelector(".trip-badges")).not.toBeInTheDocument();
    }

    for (const title of ["BP offen mit Monat", "USO offen mit Monat", "Maßnahme offen mit Monat", "BP offen ohne Monat", "USO offen ohne Monat", "Maßnahme offen ohne Monat"]) {
      expect(rowFor(title)).not.toHaveClass("trip-row-done");
    }

    for (const title of ["BP erledigt mit Monat", "USO erledigt mit Monat", "Maßnahme erledigt mit Monat", "BP erledigt ohne Monat", "USO erledigt ohne Monat", "Maßnahme erledigt ohne Monat"]) {
      expect(rowFor(title)).toHaveClass("trip-row-done");
    }

    for (const title of ["BP offen ohne Monat", "USO offen ohne Monat", "Maßnahme offen ohne Monat", "BP erledigt ohne Monat", "USO erledigt ohne Monat", "Maßnahme erledigt ohne Monat"]) {
      const row = rowFor(title);
      expect(row?.querySelectorAll(".trip-badges em")).toHaveLength(1);
      expect(row?.querySelector(".trip-badges")).toHaveTextContent("ohne Abgabemonat");
      expect(row?.querySelector(".trip-badges")).not.toHaveTextContent(/Offen|Erledigt|fixiert/);
    }
  });
});

describe("audit point helpers", () => {
  const baseForm = {
    name: "BP Muster",
    taxNumber: "12 345/6789",
    firm: "",
    category: "M1" as const,
    periodStartYear: "2020",
    periodEndYear: "2022",
    additionalResultEuros: "125.000,50",
    section99: false,
    submissionMonth: "2026-05",
    status: "in_progress" as const
  };

  const baseCase: AuditPointCase = {
    id: "point-1",
    name: "BP Muster",
    taxNumber: "12 345/6789",
    firm: "",
    category: "M1",
    periodStartYear: 2020,
    periodEndYear: 2022,
    additionalResultCents: 12500050,
    section99: false,
    submissionMonth: "2026-05",
    status: "completed",
    submittedPointsTenths: 60,
    submittedAt: "2026-05-01T08:00:00.000Z",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  };

  it("parses point goals with German decimals into tenths", () => {
    expect(parsePointTenthsInput("12,5")).toBe(125);
    expect(parsePointTenthsInput("12.5")).toBe(125);
    expect(parsePointTenthsInput("12,55")).toBeNull();
  });

  it("parses audit additional result input with comma or point into cents", () => {
    expect(validateAuditPointCaseForm(baseForm)).toMatchObject({ valid: true, additionalResultCents: 12500050 });
    expect(validateAuditPointCaseForm({ ...baseForm, additionalResultEuros: "125000.50" })).toMatchObject({ valid: true, additionalResultCents: 12500050 });
  });

  it("accepts an empty audit point submission month", () => {
    expect(validateAuditPointCaseForm({ ...baseForm, submissionMonth: "" })).toMatchObject({ valid: true });
  });

  it("accepts an empty audit point tax number", () => {
    expect(validateAuditPointCaseForm({ ...baseForm, taxNumber: "" })).toMatchObject({ valid: true });
  });

  it("formats audit point tax numbers while typing or saving", () => {
    expect(formatAuditTaxNumber("123456789")).toBe("12-345/6789");
    expect(formatAuditTaxNumber("12-345/6789")).toBe("12-345/6789");
    expect(formatAuditTaxNumber("1")).toBe("1");
    expect(formatAuditTaxNumber("1234")).toBe("12-34");
    expect(formatAuditTaxNumber("12 abc 345 6789 0")).toBe("12-345/6789");
  });

  it("rejects invalid years, categories and amounts", () => {
    expect(validateAuditPointCaseForm({ ...baseForm, periodEndYear: "2019" }).valid).toBe(false);
    expect(validateAuditPointCaseForm({ ...baseForm, category: "X1" as "M1" }).valid).toBe(false);
    expect(validateAuditPointCaseForm({ ...baseForm, additionalResultEuros: "12,345" }).valid).toBe(false);
    expect(validateAuditPointCaseForm({ ...baseForm, submissionMonth: "2026-13" }).valid).toBe(false);
    expect(validateAuditPointCaseForm({ ...baseForm, submissionMonth: "Mai 2026" }).valid).toBe(false);
  });

  it("summarizes audit points by submission month", () => {
    const summary = summarizeAuditPoints([baseCase, { ...baseCase, id: "point-2", submissionMonth: "2026-06", status: "in_progress", submittedPointsTenths: null }], 2026, "2026-05");

    expect(summary.count).toBe(1);
    expect(summary.completedPointsTenths).toBe(60);
    expect(summary.additionalResultCents).toBe(12500050);
  });

  it("keeps selected and existing months available without blank entries", () => {
    const options = auditPointMonthOptions([{ submissionMonth: "2026-04" }, { submissionMonth: "" }], "2026-05");

    expect(options).toContain("2026-04");
    expect(options).toContain("2026-05");
    expect(options).not.toContain("");
  });

  it("builds point year options from BP, USO and other measure submission months", () => {
    const usoCase: Pick<UsoCase, "submissionMonth"> = { submissionMonth: "2024-12" };
    const otherMeasure: Pick<OtherMeasure, "submissionMonth"> = { submissionMonth: "2023-11" };

    expect(pointYearOptions([baseCase], [usoCase], [otherMeasure], 2026, 2027)).toEqual([2027, 2026, 2024, 2023]);
  });
});

describe("trip copy fields", () => {
  const baseTrip: Trip = {
    id: "trip-1",
    date: "2026-05-09",
    startTime: "07:30",
    endTime: "15:45",
    durationMinutes: 495,
    reason: "Besprechung",
    origin: "Eisenstadt Finanzamt",
    destination: "Stephansplatz 1, 1010 Wien",
    municipalityCode: "90101",
    transportType: "oeffi-zuschuss",
    oneWayKilometers: 60,
    perDiemCents: 0,
    otherCostsCents: 0,
    otherCostsDescription: "",
    employerReimbursedCosts: true,
    ticketPriceCents: 0,
    publicTransportTicketQueryDate: "2026-05-01",
    taxableTransportSubsidyCents: 0,
    transportSubsidyTaxCents: 0,
    note: "",
    done: false,
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z"
  };

  it("formats time copy values without weekday or locale prefix", () => {
    expect(formatTripCopyDateTime(baseTrip, "startTime")).toBe("09.05.2026, 07:30");
    expect(formatTripCopyDateTime(baseTrip, "endTime")).toBe("09.05.2026, 15:45");
  });

  it("keeps missing times unavailable for copying", () => {
    const fields = openTripFields({ ...baseTrip, startTime: undefined });
    expect(fields.find((field) => field.label === "Zeit von")).toMatchObject({ value: "", ready: false });
  });

  it("uses the exact public transport copy text", () => {
    const fields = openTripFields({ ...baseTrip, ticketPriceCents: 1440 }, [
      { code: "90001", name: "Wien", localityName: "Wien", postalCodes: "1010" }
    ]);
    expect(fields.find((field) => field.label === "Ticketpreis je Richtung")).toMatchObject({ value: "14,4", ready: true, layout: "short", unit: "EUR" });
    expect(fields.find((field) => field.label === "Ticketnachweis")).toMatchObject({
      value: "Abfrage im ÖBB Scotty, ÖBB-Ticket, 2. Klasse, ohne Vergünstigungen, Eisenstadt - Wien, je Strecke 14,40 € (=> 28,80 €), Abfrage am 01.05.2026, für die Dienstreise vom 09.05.2026)",
      ready: true,
      layout: "wide",
      unit: ""
    });
    expect(fields.find((field) => field.label === "Beschreibung")).toMatchObject({ value: "Fahrt Öffis", ready: true });
    expect(fields.find((field) => field.label === "Bemerkungen")).toMatchObject({
      value: "Fahrt wurde mit öffentlichen Verkehrsmitteln angetreten. Eisenstadt Finanzamt -> Stephansplatz 1, 1010 Wien\n\nKilometer laut Google Maps",
      ready: true,
      layout: "wide"
    });
    expect(fields.find((field) => field.label === "Anzahl")).toMatchObject({ value: "60", ready: true });
  });

  it("keeps the public transport ticket proof unavailable without a query date", () => {
    const fields = openTripFields({ ...baseTrip, ticketPriceCents: 1440, publicTransportTicketQueryDate: undefined });
    expect(fields.find((field) => field.label === "Ticketnachweis")).toMatchObject({
      ready: false,
      layout: "wide"
    });
  });

  it("derives the public transport ticket destination from locality, municipality, or address", () => {
    expect(publicTransportDestinationPlace("Stephansplatz 1, 1010 Wien", [
      { code: "90001", name: "Wien", localityName: "Wien-Innere Stadt", postalCodes: "1010" }
    ])).toBe("Wien-Innere Stadt");
    expect(publicTransportDestinationPlace("Ernst-Mach-Straße 1, 7100 Neusiedl am See", [
      { code: "10713", name: "Neusiedl am See", postalCodes: "7100" }
    ])).toBe("Neusiedl am See");
    expect(publicTransportDestinationPlace("Hauptstraße 1, 7000 Eisenstadt", [])).toBe("Eisenstadt");
  });

  it("groups copy fields by travel data, route, costs, and remarks", () => {
    const fields = openTripFields({ ...baseTrip, ticketPriceCents: 550 });
    expect(fields.map((field) => [field.group, field.label])).toEqual([
      ["travel", "Zeit von"],
      ["travel", "Zeit bis"],
      ["travel", "Grund"],
      ["route", "Gemeindekennzahl"],
      ["route", "Zieladresse"],
      ["costs", "Ticketpreis je Richtung"],
      ["costs", "Ticketnachweis"],
      ["costs", "Beschreibung"],
      ["costs", "Anzahl"],
      ["remarks", "Bemerkungen"]
    ]);
  });

  it("keeps missing public transport ticket prices unavailable for copying", () => {
    expect(openTripFields(baseTrip).find((field) => field.label === "Ticketpreis je Richtung")).toMatchObject({ value: "0", ready: false, unit: "EUR" });
    expect(openTripFields({ ...baseTrip, ticketPriceCents: undefined }).find((field) => field.label === "Ticketpreis je Richtung")).toMatchObject({ value: "0", ready: false, unit: "EUR" });
  });

  it("loads, strips, and duplicates the public transport ticket query date", () => {
    expect(tripToForm(baseTrip).publicTransportTicketQueryDate).toBe("2026-05-01");
    expect(tripToForm({ ...baseTrip, transportType: "kilometergeld" }).publicTransportTicketQueryDate).toBe("");
    expect(stripTripMeta(baseTrip)).toMatchObject({ publicTransportTicketQueryDate: "2026-05-01" });
    expect(stripTripMeta({ ...baseTrip, transportType: "kilometergeld" })).toMatchObject({ publicTransportTicketQueryDate: undefined });
    expect(duplicatedTripDraft(baseTrip, "2026-05-18")).toMatchObject({ publicTransportTicketQueryDate: "2026-05-01" });
  });

  it("derives missing municipality codes from the destination for trips without kilometers", () => {
    const fields = openTripFields(
      { ...baseTrip, transportType: "dienstauto", municipalityCode: undefined, oneWayKilometers: 0 },
      [{ code: "90001", name: "Wien", localityName: "Wien", postalCodes: "1010" }]
    );

    expect(fields.find((field) => field.label === "Gemeindekennzahl")).toMatchObject({ value: "90001", ready: true });
  });

  it("adds kilometer allowance copy fields with destination and Google Maps remark", () => {
    const fields = openTripFields({ ...baseTrip, transportType: "kilometergeld", oneWayKilometers: 60.25 });
    expect(fields.find((field) => field.label === "Beschreibung")).toMatchObject({ value: "Kilometergeld", ready: true });
    expect(fields.find((field) => field.label === "Zieladresse")).toMatchObject({
      value: "Stephansplatz 1, 1010 Wien",
      ready: true,
      layout: "wide",
      group: "route"
    });
    expect(fields.find((field) => field.label === "Bemerkungen")).toMatchObject({
      value: "Alle Dienstautos waren belegt (siehe Screenshot), daher wurde das amtliche Kilometergeld verrechnet. Eisenstadt Finanzamt -> Stephansplatz 1, 1010 Wien\n\nKilometer laut Google Maps",
      ready: true,
      layout: "wide"
    });
    expect(fields.find((field) => field.label === "Anzahl")).toMatchObject({ value: "120,5", ready: true, unit: "km" });
  });

  it("sorts open trips by date, start time, creation time, and id", () => {
    const trips: Trip[] = [
      { ...baseTrip, id: "done", date: "2026-05-01", startTime: "07:00", done: true },
      { ...baseTrip, id: "third", date: "2026-05-08", startTime: "07:00", createdAt: "2026-05-01T08:00:00.000Z" },
      { ...baseTrip, id: "first", date: "2026-05-07", startTime: "09:00", createdAt: "2026-05-01T09:00:00.000Z" },
      { ...baseTrip, id: "second", date: "2026-05-07", startTime: "10:00", createdAt: "2026-05-01T07:00:00.000Z" },
      { ...baseTrip, id: "tie-b", date: "2026-05-08", startTime: "07:00", createdAt: "2026-05-01T08:00:00.000Z" },
      { ...baseTrip, id: "tie-a", date: "2026-05-08", startTime: "07:00", createdAt: "2026-05-01T08:00:00.000Z" }
    ];

    expect(sortedOpenTrips(trips).map((trip) => trip.id)).toEqual(["first", "second", "third", "tie-a", "tie-b"]);
  });

  it("loads the non-reimbursed checkbox state from saved trips", () => {
    expect(tripToForm(baseTrip).employerDoesNotReimburseCosts).toBe(false);
    expect(tripToForm({ ...baseTrip, employerReimbursedCosts: false }).employerDoesNotReimburseCosts).toBe(true);
  });

  it("keeps the reimbursement flag when saving existing trips without metadata", () => {
    expect(stripTripMeta({ ...baseTrip, employerReimbursedCosts: false })).toMatchObject({
      employerReimbursedCosts: false
    });
  });

  it("duplicates trips without time values or completed state", () => {
    expect(duplicatedTripDraft({ ...baseTrip, done: true, perDiemCents: 2000 }, "2026-05-18")).toMatchObject({
      date: "2026-05-18",
      reason: baseTrip.reason,
      destination: baseTrip.destination,
      startTime: undefined,
      endTime: undefined,
      durationMinutes: 0,
      perDiemCents: 0,
      done: false
    });
  });
});

describe("date display helpers", () => {
  it("formats dashboard week dates without weekday prefixes", () => {
    expect(formatDateOnly("2026-05-26")).toBe("26.05.2026");
    expect(formatDateOnly("")).toBe("-");
  });
});

describe("preferred time entry date", () => {
  it("keeps the newest open weekday selected instead of today", () => {
    expect(preferredTimeEntryDate([
      { date: "2026-05-25", startTime: "07:30" },
      { date: "2026-05-26", startTime: "07:30", endTime: "15:30" },
      { date: "2026-05-27", startTime: "08:00" }
    ], "2026-05-28")).toBe("2026-05-27");
  });

  it("ignores today, weekends, future entries, and completed days", () => {
    expect(preferredTimeEntryDate([
      { date: "2026-05-23", startTime: "07:30" },
      { date: "2026-05-27", startTime: "07:30", endTime: "15:30" },
      { date: "2026-05-28", startTime: "07:30" },
      { date: "2026-05-29", startTime: "08:00" }
    ], "2026-05-28")).toBe("2026-05-28");
  });
});

describe("destination import draft", () => {
  it("uses the first address part as editable name and keeps an existing GKZ", () => {
    expect(destinationImportDraft("Stephansplatz 1, 1010 Wien", "90101", [])).toEqual({
      name: "Stephansplatz 1",
      address: "Stephansplatz 1, 1010 Wien",
      municipalityCode: "90101"
    });
  });

  it("derives the GKZ from municipalities when the form value is empty", () => {
    expect(destinationImportDraft("Stephansplatz 1, 1010 Wien", "", [{ code: "90001", name: "Wien", postalCodes: "1010", localityName: "Wien" }])).toEqual({
      name: "Stephansplatz 1",
      address: "Stephansplatz 1, 1010 Wien",
      municipalityCode: "90001"
    });
  });

  it("derives the GKZ from the municipality name when a postal code matches multiple municipalities", () => {
    expect(destinationImportDraft("Ernst-Mach-Straße 1, 7100 Neusiedl am See", "", [
      { code: "10722", name: "Weiden am See", postalCodes: "7121, 7100", localityName: "Weiden am See" },
      { code: "10713", name: "Neusiedl am See", postalCodes: "7100", localityName: "Neusiedl am See" }
    ])).toEqual({
      name: "Ernst-Mach-Straße 1",
      address: "Ernst-Mach-Straße 1, 7100 Neusiedl am See",
      municipalityCode: "10713"
    });
  });
});

describe("automatic destination draft", () => {
  it("uses the trip reason in brackets as name and keeps an existing GKZ", () => {
    expect(automaticDestinationDraft(" Stephansplatz 1, 1010 Wien ", " Besprechung ", "90101", [], [])).toEqual({
      name: "(Besprechung)",
      address: "Stephansplatz 1, 1010 Wien",
      municipalityCode: "90101"
    });
  });

  it("skips empty addresses", () => {
    expect(automaticDestinationDraft("   ", "Besprechung", "90101", [], [])).toBeNull();
  });

  it("skips already saved trimmed addresses", () => {
    expect(automaticDestinationDraft("Stephansplatz 1, 1010 Wien", "Besprechung", "90101", [{ address: " Stephansplatz 1, 1010 Wien " }], [])).toBeNull();
  });

  it("derives the GKZ from municipalities when the form value is empty", () => {
    expect(automaticDestinationDraft("Stephansplatz 1, 1010 Wien", "Besprechung", "", [], [{ code: "90001", name: "Wien", postalCodes: "1010", localityName: "Wien" }])).toEqual({
      name: "(Besprechung)",
      address: "Stephansplatz 1, 1010 Wien",
      municipalityCode: "90001"
    });
  });
});

describe("trip year navigation helpers", () => {
  it("deduplicates trip years with the current year and sorts descending", () => {
    expect(
      tripYearOptions(
        [
          { date: "2025-01-12" },
          { date: "2024-11-03" },
          { date: "2025-08-21" }
        ],
        2026
      )
    ).toEqual([2026, 2025, 2024]);
  });

  it("falls back to the current year for missing or invalid URL parameters", () => {
    expect(yearFromUrlParam(undefined, 2026)).toBe(2026);
    expect(yearFromUrlParam("abcd", 2026)).toBe(2026);
    expect(yearFromUrlParam("202", 2026)).toBe(2026);
    expect(yearFromUrlParam("2025", 2026)).toBe(2025);
  });
});
