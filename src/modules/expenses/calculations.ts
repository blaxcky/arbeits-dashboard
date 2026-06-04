import type { TravelExpensePayment, Trip, TripTransportType } from "../../db/schema";

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

type TripReimbursementInput = Partial<Pick<Trip, "employerReimbursedCosts">>;

function employerReimbursesCosts(trip: TripReimbursementInput): boolean {
  return trip.employerReimbursedCosts !== false;
}

export function calculateTripTravelCostCents(trip: Pick<Trip, "transportType" | "oneWayKilometers"> & TripReimbursementInput): number {
  if (!employerReimbursesCosts(trip)) return 0;
  const oneWayKilometers = Math.max(trip.oneWayKilometers, 0);
  if (trip.transportType === "kilometergeld") return calculateFictionalKilometerAllowanceCents(oneWayKilometers);
  if (trip.transportType === "befoerderungszuschuss") return calculateStandardTransportSubsidyCents(oneWayKilometers) * 2;
  if (trip.transportType === "oeffi-zuschuss") return calculatePublicTransportSubsidyCents(oneWayKilometers) * 2;
  return 0;
}

export function calculatePublicTransportPayoutCents(trip: Pick<Trip, "transportType" | "oneWayKilometers"> & Partial<Pick<Trip, "ticketPriceCents">> & TripReimbursementInput): number {
  if (!employerReimbursesCosts(trip)) return 0;
  if (trip.transportType !== "oeffi-zuschuss") return calculateTripTravelCostCents(trip);
  return Math.max(calculateTripTravelCostCents(trip), calculatePublicTransportTicketRoundTripCents(trip));
}

export function calculateTripTotalCents(trip: Pick<Trip, "transportType" | "oneWayKilometers" | "perDiemCents" | "otherCostsCents"> & Partial<Pick<Trip, "ticketPriceCents">> & TripReimbursementInput): number {
  if (!employerReimbursesCosts(trip)) return 0;
  return calculatePublicTransportPayoutCents(trip) + Math.max(trip.perDiemCents, 0) + Math.max(trip.otherCostsCents, 0);
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

export function calculatePerDiemDifferentialCents(durationMinutes: number, employerPerDiemCents = calculateDomesticPerDiemCents(durationMinutes), employerReimbursedCosts = true): number {
  const reimbursedPerDiemCents = employerReimbursedCosts ? employerPerDiemCents : 0;
  return Math.max(calculateTaxPerDiemCents(durationMinutes) - Math.max(reimbursedPerDiemCents, 0), 0);
}

export function calculateFictionalKilometerAllowanceCents(oneWayKilometers: number): number {
  return Math.round(Math.max(oneWayKilometers, 0) * 2 * TRIP_RULES.kilometerAllowanceCents);
}

export function calculateTransportDifferentialCents(trip: Pick<Trip, "transportType" | "oneWayKilometers"> & Partial<Pick<Trip, "ticketPriceCents">> & TripReimbursementInput): number {
  if (!employerReimbursesCosts(trip)) return calculateFictionalKilometerAllowanceCents(trip.oneWayKilometers);
  if (trip.transportType !== "befoerderungszuschuss" && trip.transportType !== "oeffi-zuschuss") return 0;
  const fictionalKilometerAllowanceCents = calculateFictionalKilometerAllowanceCents(trip.oneWayKilometers);
  const taxFreeAmountCents = trip.transportType === "oeffi-zuschuss" ? calculatePublicTransportTicketRoundTripCents(trip) : calculateTripTravelCostCents(trip);
  return Math.max(fictionalKilometerAllowanceCents - taxFreeAmountCents, 0);
}

export interface PublicTransportTripTaxBreakdown {
  tripId: string;
  employerTransportPayoutCents: number;
  publicTransportTicketRoundTripCents: number;
  publicTransportTaxFreeCents: number;
  taxablePublicTransportSubsidyCents: number;
  transportDifferentialCents: number;
}

export function calculateTripTaxBreakdown(
  trip: Pick<Trip, "id" | "transportType" | "oneWayKilometers"> & Partial<Pick<Trip, "ticketPriceCents">> & TripReimbursementInput,
  publicTransportTaxFreeCents?: number
): PublicTransportTripTaxBreakdown {
  const employerTransportPayoutCents = calculatePublicTransportPayoutCents(trip);
  const fictionalKilometerAllowanceCents = calculateFictionalKilometerAllowanceCents(trip.oneWayKilometers);
  if (!employerReimbursesCosts(trip)) {
    return {
      tripId: trip.id,
      employerTransportPayoutCents,
      publicTransportTicketRoundTripCents: 0,
      publicTransportTaxFreeCents: 0,
      taxablePublicTransportSubsidyCents: 0,
      transportDifferentialCents: fictionalKilometerAllowanceCents
    };
  }

  if (trip.transportType !== "oeffi-zuschuss") {
    return {
      tripId: trip.id,
      employerTransportPayoutCents,
      publicTransportTicketRoundTripCents: 0,
      publicTransportTaxFreeCents: 0,
      taxablePublicTransportSubsidyCents: 0,
      transportDifferentialCents: calculateTransportDifferentialCents(trip)
    };
  }

  const publicTransportTicketRoundTripCents = calculatePublicTransportTicketRoundTripCents(trip);
  const taxFreeCents = Math.min(Math.max(publicTransportTaxFreeCents ?? publicTransportTicketRoundTripCents, 0), publicTransportTicketRoundTripCents);
  return {
    tripId: trip.id,
    employerTransportPayoutCents,
    publicTransportTicketRoundTripCents,
    publicTransportTaxFreeCents: taxFreeCents,
    taxablePublicTransportSubsidyCents: Math.max(employerTransportPayoutCents - taxFreeCents, 0),
    transportDifferentialCents: Math.max(fictionalKilometerAllowanceCents - taxFreeCents, 0)
  };
}

export function calculatePublicTransportYearBreakdown<T extends Pick<Trip, "id" | "date" | "createdAt" | "transportType" | "oneWayKilometers"> & Partial<Pick<Trip, "startTime" | "ticketPriceCents">> & TripReimbursementInput>(
  trips: T[],
  year: number,
  publicTransportTaxFreeYearLimitCents: number | null = null
): Map<string, PublicTransportTripTaxBreakdown> {
  const remainingByYear = Math.max(publicTransportTaxFreeYearLimitCents ?? 0, 0);
  let remainingCents = remainingByYear;
  const breakdowns = new Map<string, PublicTransportTripTaxBreakdown>();

  trips
    .filter((trip) => trip.date.startsWith(`${year}-`))
    .sort(compareTripsChronologically)
    .forEach((trip) => {
      const ticketRoundTripCents = trip.transportType === "oeffi-zuschuss" && employerReimbursesCosts(trip)
        ? calculatePublicTransportTicketRoundTripCents(trip)
        : 0;
      const taxFreeCents = Math.min(ticketRoundTripCents, remainingCents);
      remainingCents -= taxFreeCents;
      breakdowns.set(trip.id, calculateTripTaxBreakdown(trip, taxFreeCents));
    });

  return breakdowns;
}

export function calculateTaxablePublicTransportSubsidyCents(trip: Pick<Trip, "transportType" | "oneWayKilometers"> & Partial<Pick<Trip, "ticketPriceCents">> & TripReimbursementInput): number {
  if (!employerReimbursesCosts(trip)) return 0;
  if (trip.transportType !== "oeffi-zuschuss") return 0;
  return Math.max(calculatePublicTransportPayoutCents(trip) - calculatePublicTransportTicketRoundTripCents(trip), 0);
}

export function calculatePublicTransportTicketRoundTripCents(trip: Partial<Pick<Trip, "ticketPriceCents">>): number {
  return Math.max(trip.ticketPriceCents ?? 0, 0) * 2;
}

export function calculateOtherCostsDifferentialCents(trip: Pick<Trip, "otherCostsCents"> & TripReimbursementInput): number {
  if (employerReimbursesCosts(trip)) return 0;
  return Math.max(trip.otherCostsCents, 0);
}

export function calculateTripDifferentialCents(trip: Pick<Trip, "durationMinutes" | "perDiemCents" | "transportType" | "oneWayKilometers"> & Partial<Pick<Trip, "ticketPriceCents" | "otherCostsCents">> & TripReimbursementInput, transportDifferentialCents = calculateTransportDifferentialCents(trip)): number {
  return calculatePerDiemDifferentialCents(trip.durationMinutes, trip.perDiemCents, employerReimbursesCosts(trip)) + transportDifferentialCents + calculateOtherCostsDifferentialCents({ otherCostsCents: trip.otherCostsCents ?? 0, employerReimbursedCosts: trip.employerReimbursedCosts });
}

export function summarizeTripsByYear(trips: Trip[], year: number, payments: TravelExpensePayment[] = [], publicTransportTaxFreeYearLimitCents: number | null = null) {
  const yearTrips = trips.filter((trip) => trip.date.startsWith(`${year}-`));
  const yearBreakdowns = calculatePublicTransportYearBreakdown(yearTrips, year, publicTransportTaxFreeYearLimitCents);
  const paidCents = payments.filter((payment) => payment.year === year).reduce((sum, payment) => sum + Math.max(payment.amountCents, 0), 0);
  const totalCents = yearTrips.reduce((sum, trip) => sum + calculateTripTotalCents(trip), 0);
  return {
    year,
    count: yearTrips.length,
    doneCount: yearTrips.filter((trip) => trip.done).length,
    durationMinutes: yearTrips.reduce((sum, trip) => sum + trip.durationMinutes, 0),
    kilometers: yearTrips.reduce((sum, trip) => sum + trip.oneWayKilometers * 2, 0),
    totalCents,
    paidCents,
    remainingPayoutCents: totalCents - paidCents,
    transportSubsidyCents: yearTrips.reduce((sum, trip) => sum + (yearBreakdowns.get(trip.id)?.publicTransportTaxFreeCents ?? 0), 0),
    perDiemDifferentialCents: yearTrips.reduce((sum, trip) => sum + calculatePerDiemDifferentialCents(trip.durationMinutes, trip.perDiemCents, employerReimbursesCosts(trip)), 0),
    transportDifferentialCents: yearTrips.reduce((sum, trip) => sum + (yearBreakdowns.get(trip.id)?.transportDifferentialCents ?? calculateTransportDifferentialCents(trip)), 0),
    otherCostsDifferentialCents: yearTrips.reduce((sum, trip) => sum + calculateOtherCostsDifferentialCents(trip), 0),
    differentialCents: yearTrips.reduce((sum, trip) => sum + calculateTripDifferentialCents(trip, yearBreakdowns.get(trip.id)?.transportDifferentialCents), 0),
    openCount: yearTrips.filter((trip) => !trip.done).length,
    openTotalCents: yearTrips.filter((trip) => !trip.done).reduce((sum, trip) => sum + calculateTripTotalCents(trip), 0),
    openTransportDifferentialCents: yearTrips.filter((trip) => !trip.done).reduce((sum, trip) => sum + (yearBreakdowns.get(trip.id)?.transportDifferentialCents ?? calculateTransportDifferentialCents(trip)), 0),
    openOtherCostsDifferentialCents: yearTrips.filter((trip) => !trip.done).reduce((sum, trip) => sum + calculateOtherCostsDifferentialCents(trip), 0),
    oldestOpenTrip: yearTrips.filter((trip) => !trip.done).sort((a, b) => a.date.localeCompare(b.date))[0]
  };
}

export function remainingTransportSubsidyYearLimitCents(transportSubsidyCents: number, publicTransportTaxFreeYearLimitCents: number | null = null): number {
  return Math.max(publicTransportTaxFreeYearLimitCents ?? 0, 0) - Math.max(transportSubsidyCents, 0);
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

function compareTripsChronologically(a: Pick<Trip, "id" | "date" | "createdAt"> & Partial<Pick<Trip, "startTime">>, b: Pick<Trip, "id" | "date" | "createdAt"> & Partial<Pick<Trip, "startTime">>): number {
  return a.date.localeCompare(b.date)
    || (a.startTime ?? "").localeCompare(b.startTime ?? "")
    || a.createdAt.localeCompare(b.createdAt)
    || a.id.localeCompare(b.id);
}

function parseClockMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
