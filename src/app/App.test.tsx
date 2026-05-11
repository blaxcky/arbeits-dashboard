import { describe, expect, it } from "vitest";
import type { Trip } from "../db/schema";
import { destinationImportDraft, formatTripCopyDateTime, normalizeTimeInput, openTripFields, tripYearOptions, yearFromUrlParam } from "./App";

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

  it("rejects invalid time values", () => {
    expect(normalizeTimeInput("24")).toBeNull();
    expect(normalizeTimeInput("1760")).toBeNull();
    expect(normalizeTimeInput("abc")).toBeNull();
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
    ticketPriceCents: 0,
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
    const fields = openTripFields(baseTrip);
    expect(fields.find((field) => field.label === "Beschreibung")).toMatchObject({ value: "Fahrt Oeffis", ready: true });
    expect(fields.find((field) => field.label === "Bemerkungen")).toMatchObject({
      value: "Fahrt wurde mit oeffentlichen Verkehrsmitteln angetreten. Eisenstadt Finanzamt -> Stephansplatz 1, 1010 Wien Kilometer lt. Google Maps",
      ready: true
    });
    expect(fields.find((field) => field.label === "Anzahl")).toMatchObject({ value: "60", ready: true });
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
