import { describe, expect, it } from "vitest";
import {
  calculateDomesticPerDiemCents,
  calculatePublicTransportPayoutCents,
  calculatePerDiemDifferentialCents,
  calculateTaxablePublicTransportSubsidyCents,
  calculateTaxPerDiemCents,
  calculateTransportDifferentialCents,
  calculateTripDifferentialCents,
  calculateTripDurationMinutes,
  calculateTripTotalCents,
  calculateTripTravelCostCents,
  remainingTransportSubsidyYearLimitCents,
  summarizeTripsByYear
} from "./calculations";
import type { Trip } from "../../db/schema";

const baseTrip: Trip = {
  id: "trip-1",
  date: "2026-05-06",
  startTime: "08:00",
  endTime: "11:30",
  durationMinutes: 210,
  reason: "Termin",
  origin: "Wien",
  destination: "Linz",
  transportType: "kilometergeld",
  oneWayKilometers: 10,
  perDiemCents: 1200,
  otherCostsCents: 500,
  otherCostsDescription: "",
  employerReimbursedCosts: true,
  ticketPriceCents: 0,
  taxableTransportSubsidyCents: 0,
  transportSubsidyTaxCents: 0,
  note: "",
  done: false,
  createdAt: "2026-05-06T08:00:00.000Z",
  updatedAt: "2026-05-06T08:00:00.000Z"
};

describe("expense calculations", () => {
  it("calculates trip duration from clock times", () => {
    expect(calculateTripDurationMinutes("08:00", "11:30")).toBe(210);
    expect(calculateTripDurationMinutes("11:30", "08:00")).toBe(0);
  });

  it("calculates kilometer allowance as round trip", () => {
    expect(calculateTripTravelCostCents(baseTrip)).toBe(1000);
  });

  it("calculates standard transport subsidy as round trip", () => {
    expect(calculateTripTravelCostCents({ ...baseTrip, transportType: "befoerderungszuschuss", oneWayKilometers: 10 })).toBe(520);
    expect(calculateTripTravelCostCents({ ...baseTrip, transportType: "befoerderungszuschuss", oneWayKilometers: 400 })).toBe(10500);
  });

  it("calculates public transport subsidy as round trip", () => {
    expect(calculateTripTravelCostCents({ ...baseTrip, transportType: "oeffi-zuschuss", oneWayKilometers: 100 })).toBe(7000);
    expect(calculateTripTravelCostCents({ ...baseTrip, transportType: "oeffi-zuschuss", oneWayKilometers: 1000 })).toBe(21800);
  });

  it("calculates domestic per diem from duration", () => {
    expect(calculateDomesticPerDiemCents(300)).toBe(0);
    expect(calculateDomesticPerDiemCents(301)).toBe(1000);
    expect(calculateDomesticPerDiemCents(480)).toBe(1000);
    expect(calculateDomesticPerDiemCents(481)).toBe(2000);
    expect(calculateDomesticPerDiemCents(720)).toBe(2000);
    expect(calculateDomesticPerDiemCents(721)).toBe(3000);
  });

  it("calculates tax per diem and per diem differential", () => {
    expect(calculateTaxPerDiemCents(0)).toBe(0);
    expect(calculateTaxPerDiemCents(301)).toBe(1500);
    expect(calculateTaxPerDiemCents(721)).toBe(3000);
    expect(calculatePerDiemDifferentialCents(301, 1000)).toBe(500);
    expect(calculatePerDiemDifferentialCents(721, 3000)).toBe(0);
  });

  it("calculates transport differential against fictional kilometer allowance", () => {
    expect(calculateTransportDifferentialCents({ ...baseTrip, transportType: "befoerderungszuschuss", oneWayKilometers: 10 })).toBe(480);
    expect(calculateTransportDifferentialCents({ ...baseTrip, transportType: "kilometergeld", oneWayKilometers: 10 })).toBe(0);
  });

  it("uses ticket price as tax-free amount for public transport advertising costs", () => {
    const normal = { ...baseTrip, transportType: "oeffi-zuschuss" as const, oneWayKilometers: 60, ticketPriceCents: 500 };
    expect(calculateTripTravelCostCents(normal)).toBe(5400);
    expect(calculatePublicTransportPayoutCents(normal)).toBe(5400);
    expect(calculateTaxablePublicTransportSubsidyCents(normal)).toBe(4900);
    expect(calculateTransportDifferentialCents(normal)).toBe(5500);

    const ticketAboveSubsidy = { ...normal, ticketPriceCents: 5500 };
    expect(calculatePublicTransportPayoutCents(ticketAboveSubsidy)).toBe(5500);
    expect(calculateTaxablePublicTransportSubsidyCents(ticketAboveSubsidy)).toBe(0);
    expect(calculateTransportDifferentialCents(ticketAboveSubsidy)).toBe(500);
  });

  it("does not add taxable public transport subsidy to the differential", () => {
    const trip = { ...baseTrip, transportType: "oeffi-zuschuss" as const, oneWayKilometers: 60, durationMinutes: 301, perDiemCents: 1000, ticketPriceCents: 500 };
    expect(calculateTaxablePublicTransportSubsidyCents(trip)).toBe(4900);
    expect(calculateTripDifferentialCents(trip)).toBe(6000);
  });

  it("calculates taxable public transport subsidy from ticket price without going below zero", () => {
    expect(calculateTaxablePublicTransportSubsidyCents({ ...baseTrip, transportType: "oeffi-zuschuss", oneWayKilometers: 100, ticketPriceCents: 3000 })).toBe(4000);
    expect(calculateTaxablePublicTransportSubsidyCents({ ...baseTrip, transportType: "oeffi-zuschuss", oneWayKilometers: 100, ticketPriceCents: 8000 })).toBe(0);
    expect(calculateTaxablePublicTransportSubsidyCents({ ...baseTrip, transportType: "befoerderungszuschuss", oneWayKilometers: 100, ticketPriceCents: 3000 })).toBe(0);
  });

  it("keeps old trip objects without ticket price calculable", () => {
    const oldTrip = { ...baseTrip, transportType: "oeffi-zuschuss" as const, oneWayKilometers: 100 };
    delete oldTrip.ticketPriceCents;
    expect(calculateTaxablePublicTransportSubsidyCents(oldTrip)).toBe(7000);
    expect(calculateTripTotalCents(oldTrip)).toBe(8700);
  });

  it("keeps old trip objects without reimbursement flag behaving like reimbursed trips", () => {
    const oldTrip = { ...baseTrip };
    delete (oldTrip as Partial<Trip>).employerReimbursedCosts;
    expect(calculateTripTotalCents(oldTrip)).toBe(2700);
    expect(calculateTripDifferentialCents(oldTrip)).toBe(0);
  });

  it("adds travel cost, per diem and other costs", () => {
    expect(calculateTripTotalCents(baseTrip)).toBe(2700);
  });

  it("adds per diem and transport differential", () => {
    const trip = { ...baseTrip, transportType: "befoerderungszuschuss" as const, oneWayKilometers: 10, durationMinutes: 301, perDiemCents: 1000 };
    expect(calculateTripDifferentialCents(trip)).toBe(980);
  });

  it("sets employer total to zero and uses fictional kilometer allowance when costs are not reimbursed", () => {
    const trip = { ...baseTrip, employerReimbursedCosts: false, transportType: "kilometergeld" as const, oneWayKilometers: 25, durationMinutes: 0, perDiemCents: 0, otherCostsCents: 0 };
    expect(calculateTripTravelCostCents(trip)).toBe(0);
    expect(calculateTripTotalCents(trip)).toBe(0);
    expect(calculateTransportDifferentialCents(trip)).toBe(2500);
    expect(calculateTripDifferentialCents(trip)).toBe(2500);
  });

  it("uses tax per diem as advertising costs when per diem is not reimbursed", () => {
    const trip = { ...baseTrip, employerReimbursedCosts: false, durationMinutes: 301, perDiemCents: 1000, otherCostsCents: 0, oneWayKilometers: 0 };
    expect(calculateTaxPerDiemCents(trip.durationMinutes)).toBe(1500);
    expect(calculatePerDiemDifferentialCents(trip.durationMinutes, trip.perDiemCents, trip.employerReimbursedCosts)).toBe(1500);
    expect(calculateTripDifferentialCents(trip)).toBe(1500);
  });

  it("adds other costs to advertising costs when costs are not reimbursed", () => {
    const trip = { ...baseTrip, employerReimbursedCosts: false, durationMinutes: 0, perDiemCents: 0, oneWayKilometers: 0, otherCostsCents: 850 };
    expect(calculateTripTotalCents(trip)).toBe(0);
    expect(calculateTripDifferentialCents(trip)).toBe(850);
  });

  it("keeps public transport subsidy and taxable subsidy at zero when costs are not reimbursed", () => {
    const trip = { ...baseTrip, employerReimbursedCosts: false, transportType: "oeffi-zuschuss" as const, oneWayKilometers: 60, durationMinutes: 0, ticketPriceCents: 500, perDiemCents: 0, otherCostsCents: 0 };
    expect(calculateTripTravelCostCents(trip)).toBe(0);
    expect(calculatePublicTransportPayoutCents(trip)).toBe(0);
    expect(calculateTaxablePublicTransportSubsidyCents(trip)).toBe(0);
    expect(calculateTransportDifferentialCents(trip)).toBe(6000);
    expect(calculateTripDifferentialCents(trip)).toBe(6000);
  });

  it("summarizes trips by calendar year", () => {
    const summary = summarizeTripsByYear([{ ...baseTrip, done: true, transportType: "befoerderungszuschuss", durationMinutes: 301, perDiemCents: 1000 }, { ...baseTrip, id: "trip-2", date: "2025-12-31" }], 2026);
    expect(summary.count).toBe(1);
    expect(summary.doneCount).toBe(1);
    expect(summary.durationMinutes).toBe(301);
    expect(summary.kilometers).toBe(20);
    expect(summary.totalCents).toBe(2020);
    expect(summary.transportSubsidyCents).toBe(520);
    expect(summary.perDiemDifferentialCents).toBe(500);
    expect(summary.transportDifferentialCents).toBe(480);
    expect(summary.otherCostsDifferentialCents).toBe(0);
    expect(summary.differentialCents).toBe(980);
    expect(summary.openCount).toBe(0);
    expect(summary.openTotalCents).toBe(0);
    expect(summary.openTransportDifferentialCents).toBe(0);
    expect(summary.openOtherCostsDifferentialCents).toBe(0);
    expect(remainingTransportSubsidyYearLimitCents(summary.transportSubsidyCents)).toBe(244480);
  });

  it("summarizes additional advertising costs for non-reimbursed trips", () => {
    const summary = summarizeTripsByYear([{ ...baseTrip, employerReimbursedCosts: false, durationMinutes: 301, perDiemCents: 1000, otherCostsCents: 850, oneWayKilometers: 10 }], 2026);
    expect(summary.totalCents).toBe(0);
    expect(summary.transportSubsidyCents).toBe(0);
    expect(summary.perDiemDifferentialCents).toBe(1500);
    expect(summary.transportDifferentialCents).toBe(1000);
    expect(summary.otherCostsDifferentialCents).toBe(850);
    expect(summary.differentialCents).toBe(3350);
    expect(summary.openTotalCents).toBe(0);
    expect(summary.openTransportDifferentialCents).toBe(1000);
    expect(summary.openOtherCostsDifferentialCents).toBe(850);
  });
});
