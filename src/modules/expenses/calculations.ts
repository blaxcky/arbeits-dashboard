import type { Trip, TripTransportType } from "../../db/schema";

export const TRANSPORT_LABELS: Record<TripTransportType, string> = {
  kilometergeld: "Kilometergeld",
  befoerderungszuschuss: "Beförderungszuschuss",
  "oeffi-zuschuss": "Beförderungszuschuss Öffis",
  dienstauto: "Dienstauto",
  sonstige: "Sonstige Kosten"
};

export const TRIP_RULES = {
  kilometerAllowanceCents: 50,
  standardTransportSubsidy: {
    first50KmCents: 26,
    next250KmCents: 13,
    beyond300KmCents: 7,
    shortDistanceCents: 200,
    maxPerWayCents: 6930
  },
  publicTransportSubsidy: {
    first50KmCents: 50,
    next250KmCents: 20,
    beyond300KmCents: 10,
    maxPerWayCents: 10900
  },
  transportSubsidyYearLimitCents: 245000,
  taxPerDiemHourlyCents: 250,
  taxPerDiemMaxCents: 3000,
  domesticPerDiemCents: {
    over5HoursCents: 1000,
    over8HoursCents: 2000,
    over12HoursCents: 3000
  }
};

export function calculateTripDurationMinutes(startTime: string, endTime: string): number {
  const start = parseClockMinutes(startTime);
  const end = parseClockMinutes(endTime);
  if (start === null || end === null || end < start) return 0;
  return end - start;
}

export function calculateTripTravelCostCents(trip: Pick<Trip, "transportType" | "oneWayKilometers">): number {
  const oneWayKilometers = Math.max(trip.oneWayKilometers, 0);
  if (trip.transportType === "kilometergeld") return calculateFictionalKilometerAllowanceCents(oneWayKilometers);
  if (trip.transportType === "befoerderungszuschuss") return calculateStandardTransportSubsidyCents(oneWayKilometers) * 2;
  if (trip.transportType === "oeffi-zuschuss") return calculatePublicTransportSubsidyCents(oneWayKilometers) * 2;
  return 0;
}

export function calculateTripTotalCents(trip: Pick<Trip, "transportType" | "oneWayKilometers" | "perDiemCents" | "otherCostsCents">): number {
  return calculateTripTravelCostCents(trip) + Math.max(trip.perDiemCents, 0) + Math.max(trip.otherCostsCents, 0);
}

export function calculateDomesticPerDiemCents(durationMinutes: number): number {
  if (durationMinutes > 12 * 60) return TRIP_RULES.domesticPerDiemCents.over12HoursCents;
  if (durationMinutes > 8 * 60) return TRIP_RULES.domesticPerDiemCents.over8HoursCents;
  if (durationMinutes > 5 * 60) return TRIP_RULES.domesticPerDiemCents.over5HoursCents;
  return 0;
}

export function calculateTaxPerDiemCents(durationMinutes: number): number {
  if (durationMinutes <= 0) return 0;
  return Math.min(Math.ceil(durationMinutes / 60) * TRIP_RULES.taxPerDiemHourlyCents, TRIP_RULES.taxPerDiemMaxCents);
}

export function calculatePerDiemDifferentialCents(durationMinutes: number, employerPerDiemCents = calculateDomesticPerDiemCents(durationMinutes)): number {
  return Math.max(calculateTaxPerDiemCents(durationMinutes) - Math.max(employerPerDiemCents, 0), 0);
}

export function calculateFictionalKilometerAllowanceCents(oneWayKilometers: number): number {
  return Math.round(Math.max(oneWayKilometers, 0) * 2 * TRIP_RULES.kilometerAllowanceCents);
}

export function calculateTransportDifferentialCents(trip: Pick<Trip, "transportType" | "oneWayKilometers"> & Partial<Pick<Trip, "transportSubsidyTaxCents">>): number {
  if (trip.transportType !== "befoerderungszuschuss" && trip.transportType !== "oeffi-zuschuss") return 0;
  const fictionalKilometerAllowanceCents = calculateFictionalKilometerAllowanceCents(trip.oneWayKilometers);
  const paidTransportSubsidyCents = calculateTripTravelCostCents(trip);
  const paidTaxCents = Math.max(trip.transportSubsidyTaxCents ?? 0, 0);
  return Math.max(fictionalKilometerAllowanceCents - paidTransportSubsidyCents + paidTaxCents, 0);
}

export function calculateTaxablePublicTransportSubsidyCents(trip: Pick<Trip, "transportType" | "oneWayKilometers"> & Partial<Pick<Trip, "ticketPriceCents">>): number {
  if (trip.transportType !== "oeffi-zuschuss") return 0;
  return Math.max(calculateTripTravelCostCents(trip) - Math.max(trip.ticketPriceCents ?? 0, 0), 0);
}

export function calculateTripDifferentialCents(trip: Pick<Trip, "durationMinutes" | "perDiemCents" | "transportType" | "oneWayKilometers"> & Partial<Pick<Trip, "transportSubsidyTaxCents">>): number {
  return calculatePerDiemDifferentialCents(trip.durationMinutes, trip.perDiemCents) + calculateTransportDifferentialCents(trip);
}

export function summarizeTripsByYear(trips: Trip[], year: number) {
  const yearTrips = trips.filter((trip) => trip.date.startsWith(`${year}-`));
  return {
    year,
    count: yearTrips.length,
    doneCount: yearTrips.filter((trip) => trip.done).length,
    durationMinutes: yearTrips.reduce((sum, trip) => sum + trip.durationMinutes, 0),
    kilometers: yearTrips.reduce((sum, trip) => sum + trip.oneWayKilometers * 2, 0),
    totalCents: yearTrips.reduce((sum, trip) => sum + calculateTripTotalCents(trip), 0),
    transportSubsidyCents: yearTrips.reduce((sum, trip) => sum + (isTransportSubsidy(trip.transportType) ? calculateTripTravelCostCents(trip) : 0), 0),
    perDiemDifferentialCents: yearTrips.reduce((sum, trip) => sum + calculatePerDiemDifferentialCents(trip.durationMinutes, trip.perDiemCents), 0),
    transportDifferentialCents: yearTrips.reduce((sum, trip) => sum + calculateTransportDifferentialCents(trip), 0),
    differentialCents: yearTrips.reduce((sum, trip) => sum + calculateTripDifferentialCents(trip), 0)
  };
}

export function remainingTransportSubsidyYearLimitCents(transportSubsidyCents: number): number {
  return TRIP_RULES.transportSubsidyYearLimitCents - Math.max(transportSubsidyCents, 0);
}

export function isTransportSubsidy(transportType: TripTransportType): boolean {
  return transportType === "befoerderungszuschuss" || transportType === "oeffi-zuschuss";
}

function calculateStandardTransportSubsidyCents(oneWayKilometers: number): number {
  if (oneWayKilometers <= 0) return 0;
  if (oneWayKilometers <= 8) return TRIP_RULES.standardTransportSubsidy.shortDistanceCents;
  const amount = calculateTieredAmountCents(oneWayKilometers, TRIP_RULES.standardTransportSubsidy.first50KmCents, TRIP_RULES.standardTransportSubsidy.next250KmCents, TRIP_RULES.standardTransportSubsidy.beyond300KmCents);
  return Math.min(amount, TRIP_RULES.standardTransportSubsidy.maxPerWayCents);
}

function calculatePublicTransportSubsidyCents(oneWayKilometers: number): number {
  const amount = calculateTieredAmountCents(oneWayKilometers, TRIP_RULES.publicTransportSubsidy.first50KmCents, TRIP_RULES.publicTransportSubsidy.next250KmCents, TRIP_RULES.publicTransportSubsidy.beyond300KmCents);
  return Math.min(amount, TRIP_RULES.publicTransportSubsidy.maxPerWayCents);
}

function calculateTieredAmountCents(oneWayKilometers: number, first50Cents: number, next250Cents: number, beyond300Cents: number): number {
  const first = Math.min(oneWayKilometers, 50) * first50Cents;
  const second = Math.min(Math.max(oneWayKilometers - 50, 0), 250) * next250Cents;
  const beyond = Math.max(oneWayKilometers - 300, 0) * beyond300Cents;
  return Math.round(first + second + beyond);
}

function parseClockMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
