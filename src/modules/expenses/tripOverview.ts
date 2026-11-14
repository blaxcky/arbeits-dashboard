import type { Trip } from "../../db/schema";
import { isValidDateKey, parseDateKey } from "../../lib/dates";
import { calculateTripDifferentialCents, calculateTripTotalCents } from "./calculations";

export type TripListTotals = {
  count: number;
  durationMinutes: number;
  kilometers: number;
  totalCents: number;
  differentialCents: number;
};

export type TripMonthGroup = {
  monthKey: string;
  label: string;
  trips: Trip[];
  totalCents: number;
};

export type TripCostShares = {
  perDiem: number;
  travel: number;
  other: number;
};

export function summarizeTripList(trips: Trip[]): TripListTotals {
  return trips.reduce<TripListTotals>((totals, trip) => ({
    count: totals.count + 1,
    durationMinutes: totals.durationMinutes + Math.max(trip.durationMinutes, 0),
    kilometers: totals.kilometers + Math.max(trip.oneWayKilometers, 0) * 2,
    totalCents: totals.totalCents + calculateTripTotalCents(trip),
    differentialCents: totals.differentialCents + calculateTripDifferentialCents(trip)
  }), { count: 0, durationMinutes: 0, kilometers: 0, totalCents: 0, differentialCents: 0 });
}

export function formatTripMonthLabel(monthKey: string): string {
  const dateKey = `${monthKey}-01`;
  if (!isValidDateKey(dateKey)) return monthKey;
  return new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric" }).format(parseDateKey(dateKey));
}

export function groupTripsByMonth(trips: Trip[]): TripMonthGroup[] {
  const sorted = [...trips].sort((left, right) => right.date.localeCompare(left.date) || (right.startTime ?? "").localeCompare(left.startTime ?? ""));
  const groups: TripMonthGroup[] = [];
  sorted.forEach((trip) => {
    const monthKey = trip.date.slice(0, 7);
    let group = groups.find((candidate) => candidate.monthKey === monthKey);
    if (!group) {
      group = { monthKey, label: formatTripMonthLabel(monthKey), trips: [], totalCents: 0 };
      groups.push(group);
    }
    group.trips.push(trip);
    group.totalCents += calculateTripTotalCents(trip);
  });
  return groups;
}

export function tripCostShares(perDiemCents: number, travelCents: number, otherCents: number): TripCostShares {
  const perDiem = Math.max(perDiemCents, 0);
  const travel = Math.max(travelCents, 0);
  const other = Math.max(otherCents, 0);
  const total = perDiem + travel + other;
  if (total <= 0) return { perDiem: 0, travel: 0, other: 0 };
  return { perDiem: (perDiem / total) * 100, travel: (travel / total) * 100, other: (other / total) * 100 };
}

export function splitTripDateLabel(dateKey: string): { weekday: string; date: string } {
  if (!isValidDateKey(dateKey)) return { weekday: "", date: "-" };
  const [year, month, day] = dateKey.split("-");
  const weekday = new Intl.DateTimeFormat("de-AT", { weekday: "short" }).format(parseDateKey(dateKey));
  return { weekday: weekday.endsWith(".") ? weekday : `${weekday}.`, date: `${day}.${month}.${year}` };
}
