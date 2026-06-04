import { describe, expect, it } from "vitest";
import type { TravelExpensePayment, Trip } from "../../db/schema";
import {
  calculateFictionalKilometerAllowanceCents,
  calculatePerDiemDifferentialCents,
  calculatePublicTransportPayoutCents
} from "./calculations";
import { buildTripAdvertisingCostsExportRows, buildTripAdvertisingCostsPrintHtml, summarizeTripAdvertisingCostsExport } from "./advertisingCostsExport";

const baseTrip: Trip = {
  id: "trip-1",
  date: "2026-05-06",
  startTime: "08:00",
  endTime: "14:10",
  durationMinutes: 370,
  reason: "PRIVATE_REASON_SENTINEL",
  origin: "Wien Hauptbahnhof",
  destination: "Linz, Hauptplatz 1",
  municipalityCode: "40101",
  transportType: "befoerderungszuschuss",
  oneWayKilometers: 10,
  perDiemCents: 1000,
  otherCostsCents: 500,
  otherCostsDescription: "PRIVATE_OTHER_COSTS_SENTINEL",
  employerReimbursedCosts: true,
  ticketPriceCents: 0,
  taxableTransportSubsidyCents: 0,
  transportSubsidyTaxCents: 0,
  note: "PRIVATE_NOTE_SENTINEL",
  done: true,
  createdAt: "2026-05-06T08:00:00.000Z",
  updatedAt: "2026-05-06T08:00:00.000Z"
};

const basePayment: TravelExpensePayment = {
  id: "payment-1",
  year: 2026,
  date: "2026-05-20",
  amountCents: 1000,
  note: "PRIVATE_PAYMENT_NOTE_SENTINEL",
  createdAt: "2026-05-20T08:00:00.000Z",
  updatedAt: "2026-05-20T08:00:00.000Z"
};

describe("trip advertising costs export", () => {
  it("builds rows for the selected year without private free text", () => {
    const privateFreeTextTrip = {
      ...baseTrip,
      employerReimbursedCosts: false,
      transportType: "kilometergeld" as const,
      oneWayKilometers: 25
    };
    const rows = buildTripAdvertisingCostsExportRows([
      { ...baseTrip, id: "trip-3", date: "2025-12-31" },
      { ...baseTrip, id: "trip-2", date: "2026-05-06", startTime: "09:00", createdAt: "2026-05-06T07:00:00.000Z" },
      privateFreeTextTrip
    ], 2026);

    expect(rows.map((row) => row.id)).toEqual(["trip-1", "trip-2"]);
    expect(rows[0]).toMatchObject({
      origin: "Wien Hauptbahnhof",
      destination: "Linz, Hauptplatz 1",
      employerPerDiemCents: 0
    });
    expect(JSON.stringify(rows)).not.toContain("40101");
    expect(JSON.stringify(rows)).not.toContain("PRIVATE_REASON_SENTINEL");
    expect(JSON.stringify(rows)).not.toContain("PRIVATE_NOTE_SENTINEL");
    expect(JSON.stringify(rows)).not.toContain("PRIVATE_OTHER_COSTS_SENTINEL");
    expect(JSON.stringify(rows)).not.toContain("befoerderungszuschuss");
    expect(JSON.stringify(rows)).not.toContain("Beförderungszuschuss");
  });

  it("uses the tax-free part of employer transport payout for public transport rows", () => {
    const trip = {
      ...baseTrip,
      transportType: "oeffi-zuschuss" as const,
      oneWayKilometers: 50,
      ticketPriceCents: 1500
    };
    const [row] = buildTripAdvertisingCostsExportRows([trip], 2026, 3000);

    expect(row.employerPerDiemCents).toBe(trip.perDiemCents);
    expect(row.perDiemAdvertisingCostsCents).toBe(calculatePerDiemDifferentialCents(trip.durationMinutes, trip.perDiemCents, trip.employerReimbursedCosts));
    expect(calculatePublicTransportPayoutCents(trip)).toBe(5000);
    expect(row.employerTaxFreeTransportPayoutCents).toBe(3000);
    expect(row.transportTaxAllowanceCents).toBe(calculateFictionalKilometerAllowanceCents(trip.oneWayKilometers));
    expect(row.transportAdvertisingCostsCents).toBe(2000);
  });

  it("uses zero tax-free public transport payout in exports when the limit is empty", () => {
    const trip = {
      ...baseTrip,
      transportType: "oeffi-zuschuss" as const,
      oneWayKilometers: 50,
      ticketPriceCents: 1500
    };
    const [row] = buildTripAdvertisingCostsExportRows([trip], 2026);

    expect(row.employerTaxFreeTransportPayoutCents).toBe(0);
    expect(row.transportAdvertisingCostsCents).toBe(5000);
  });

  it("summarizes advertising costs and keeps employer payments separate", () => {
    const rows = buildTripAdvertisingCostsExportRows([
      baseTrip,
      {
        ...baseTrip,
        id: "trip-2",
        employerReimbursedCosts: false,
        oneWayKilometers: 10,
        durationMinutes: 370,
        otherCostsCents: 850
      }
    ], 2026);
    const summary = summarizeTripAdvertisingCostsExport(rows, [
      basePayment,
      { ...basePayment, id: "payment-2", amountCents: 500 },
      { ...basePayment, id: "payment-3", year: 2025, amountCents: 5000 }
    ], 2026);

    expect(summary.count).toBe(2);
    expect(summary.paidCents).toBe(1500);
    expect(summary.employerTaxFreeTransportPayoutCents).toBe(rows[0].employerTaxFreeTransportPayoutCents);
    expect(summary.transportTaxAllowanceCents).toBe(rows[0].transportTaxAllowanceCents + rows[1].transportTaxAllowanceCents);
    expect(summary.paidCents).not.toBe(summary.employerTaxFreeTransportPayoutCents);
    expect(summary.advertisingCostsTotalCents).toBe(rows[0].advertisingCostsTotalCents + rows[1].advertisingCostsTotalCents);
    expect(summary.remainingReconciliationCents).toBe(summary.employerReimbursementTotalCents - summary.paidCents);
  });

  it("omits private free text from generated HTML", () => {
    const rows = buildTripAdvertisingCostsExportRows([baseTrip], 2026);
    const summary = summarizeTripAdvertisingCostsExport(rows, [basePayment], 2026);
    const html = buildTripAdvertisingCostsPrintHtml({ year: 2026, rows, summary, payments: [basePayment] });

    expect(html).toContain("Wien Hauptbahnhof");
    expect(html).toContain("Linz, Hauptplatz 1");
    expect(html).toContain("Fahrt AG steuerfrei");
    expect(html).toContain("Fahrt steuerlich");
    expect(html).not.toContain("Öffi steuerpfl.");
    expect(html).not.toContain("40101");
    expect(html).not.toContain("GKZ");
    expect(html).not.toContain("Jahressummen");
    expect(html).not.toContain("Werbungskosten gesamt");
    expect(html).not.toContain("Fahrtkostenart");
    expect(html).not.toContain("Beförderungszuschuss");
    expect(html).not.toContain("PRIVATE_REASON_SENTINEL");
    expect(html).not.toContain("PRIVATE_NOTE_SENTINEL");
    expect(html).not.toContain("PRIVATE_OTHER_COSTS_SENTINEL");
    expect(html).not.toContain("PRIVATE_PAYMENT_NOTE_SENTINEL");
  });
});
