import type { TravelExpensePayment, Trip, TripTransportType } from "../../db/schema";
import {
  calculateOtherCostsDifferentialCents,
  calculatePerDiemDifferentialCents,
  calculatePublicTransportPayoutCents,
  calculateTaxablePublicTransportSubsidyCents,
  calculateTransportDifferentialCents,
  TRANSPORT_LABELS
} from "./calculations";

export interface TripAdvertisingCostsExportRow {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  origin: string;
  destination: string;
  municipalityCode: string;
  transportType: TripTransportType;
  transportLabel: string;
  oneWayKilometers: number;
  totalKilometers: number;
  ticketPriceCents: number;
  employerPerDiemCents: number;
  perDiemAdvertisingCostsCents: number;
  employerTransportPayoutCents: number;
  transportAdvertisingCostsCents: number;
  employerOtherCostsCents: number;
  otherAdvertisingCostsCents: number;
  taxablePublicTransportSubsidyCents: number;
  advertisingCostsTotalCents: number;
}

export interface TripAdvertisingCostsExportSummary {
  year: number;
  count: number;
  durationMinutes: number;
  kilometers: number;
  employerPerDiemCents: number;
  perDiemAdvertisingCostsCents: number;
  employerTransportPayoutCents: number;
  transportAdvertisingCostsCents: number;
  employerOtherCostsCents: number;
  otherAdvertisingCostsCents: number;
  taxablePublicTransportSubsidyCents: number;
  advertisingCostsTotalCents: number;
  employerReimbursementTotalCents: number;
  paidCents: number;
  remainingReconciliationCents: number;
}

export function buildTripAdvertisingCostsExportRows(trips: Trip[], year: number): TripAdvertisingCostsExportRow[] {
  return trips
    .filter((trip) => trip.date.startsWith(`${year}-`))
    .sort(compareTripsForExport)
    .map((trip) => {
      const employerReimbursedCosts = trip.employerReimbursedCosts !== false;
      const employerPerDiemCents = employerReimbursedCosts ? Math.max(trip.perDiemCents, 0) : 0;
      const perDiemAdvertisingCostsCents = calculatePerDiemDifferentialCents(trip.durationMinutes, trip.perDiemCents, employerReimbursedCosts);
      const employerTransportPayoutCents = calculatePublicTransportPayoutCents(trip);
      const transportAdvertisingCostsCents = calculateTransportDifferentialCents(trip);
      const employerOtherCostsCents = employerReimbursedCosts ? Math.max(trip.otherCostsCents, 0) : 0;
      const otherAdvertisingCostsCents = calculateOtherCostsDifferentialCents(trip);
      const taxablePublicTransportSubsidyCents = calculateTaxablePublicTransportSubsidyCents(trip);
      const advertisingCostsTotalCents = perDiemAdvertisingCostsCents + transportAdvertisingCostsCents + otherAdvertisingCostsCents;

      return {
        id: trip.id,
        date: trip.date,
        startTime: trip.startTime ?? "",
        endTime: trip.endTime ?? "",
        durationMinutes: trip.durationMinutes,
        origin: trip.origin,
        destination: trip.destination,
        municipalityCode: trip.municipalityCode ?? "",
        transportType: trip.transportType,
        transportLabel: TRANSPORT_LABELS[trip.transportType],
        oneWayKilometers: trip.oneWayKilometers,
        totalKilometers: trip.oneWayKilometers * 2,
        ticketPriceCents: Math.max(trip.ticketPriceCents ?? 0, 0),
        employerPerDiemCents,
        perDiemAdvertisingCostsCents,
        employerTransportPayoutCents,
        transportAdvertisingCostsCents,
        employerOtherCostsCents,
        otherAdvertisingCostsCents,
        taxablePublicTransportSubsidyCents,
        advertisingCostsTotalCents
      };
    });
}

export function summarizeTripAdvertisingCostsExport(rows: TripAdvertisingCostsExportRow[], payments: TravelExpensePayment[], year: number): TripAdvertisingCostsExportSummary {
  const paidCents = payments
    .filter((payment) => payment.year === year)
    .reduce((sum, payment) => sum + Math.max(payment.amountCents, 0), 0);
  const employerReimbursementTotalCents = sumRows(rows, (row) => row.employerPerDiemCents + row.employerTransportPayoutCents + row.employerOtherCostsCents);

  return {
    year,
    count: rows.length,
    durationMinutes: sumRows(rows, (row) => row.durationMinutes),
    kilometers: sumRows(rows, (row) => row.totalKilometers),
    employerPerDiemCents: sumRows(rows, (row) => row.employerPerDiemCents),
    perDiemAdvertisingCostsCents: sumRows(rows, (row) => row.perDiemAdvertisingCostsCents),
    employerTransportPayoutCents: sumRows(rows, (row) => row.employerTransportPayoutCents),
    transportAdvertisingCostsCents: sumRows(rows, (row) => row.transportAdvertisingCostsCents),
    employerOtherCostsCents: sumRows(rows, (row) => row.employerOtherCostsCents),
    otherAdvertisingCostsCents: sumRows(rows, (row) => row.otherAdvertisingCostsCents),
    taxablePublicTransportSubsidyCents: sumRows(rows, (row) => row.taxablePublicTransportSubsidyCents),
    advertisingCostsTotalCents: sumRows(rows, (row) => row.advertisingCostsTotalCents),
    employerReimbursementTotalCents,
    paidCents,
    remainingReconciliationCents: employerReimbursementTotalCents - paidCents
  };
}

export function buildTripAdvertisingCostsPrintHtml({
  year,
  rows,
  summary,
  payments
}: {
  year: number;
  rows: TripAdvertisingCostsExportRow[];
  summary: TripAdvertisingCostsExportSummary;
  payments: TravelExpensePayment[];
}): string {
  const yearPayments = payments.filter((payment) => payment.year === year).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const title = `Reisekosten Werbungskosten ${year}`;
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; font-family: Arial, sans-serif; font-size: 8.5px; line-height: 1.25; }
    h1 { margin: 0 0 4px; font-size: 15px; }
    h2 { margin: 8px 0 4px; font-size: 10px; }
    .meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; color: #374151; }
    .summary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; margin-bottom: 6px; }
    .summary div { border: 1px solid #d1d5db; padding: 2px 3px; }
    .summary span { display: block; color: #4b5563; font-size: 7.5px; }
    .summary strong { display: block; font-size: 9px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #d1d5db; padding: 2px 3px; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #f3f4f6; font-weight: 700; }
    tbody tr:nth-child(4n + 1), tbody tr:nth-child(4n + 2) { background: #fafafa; }
    .num { text-align: right; white-space: nowrap; }
    .label { width: 18mm; color: #4b5563; font-weight: 700; }
    .payments { width: 60%; margin-top: 3px; }
    .print-action { margin-bottom: 8px; }
    @media print { .print-action { display: none; } }
  </style>
</head>
<body>
  <button class="print-action" type="button" onclick="window.print()">Drucken / Als PDF speichern</button>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      <span>Erstellt: ${escapeHtml(formatDateTime(new Date()))}</span>
      <span>Private Freitexte wie Reisegrund, Notizen und Beschreibungen sonstiger Kosten sind nicht enthalten.</span>
    </div>
  </header>
  <section class="summary" aria-label="Jahressummen">
    ${summaryItem("Reisen", String(summary.count))}
    ${summaryItem("Dauer", formatDuration(summary.durationMinutes))}
    ${summaryItem("Kilometer", formatKilometers(summary.kilometers))}
    ${summaryItem("Diäten Arbeitgeber", formatEuroCents(summary.employerPerDiemCents))}
    ${summaryItem("Diäten Werbungskosten", formatEuroCents(summary.perDiemAdvertisingCostsCents))}
    ${summaryItem("Fahrtkostenersatz Arbeitgeber", formatEuroCents(summary.employerTransportPayoutCents))}
    ${summaryItem("Kilometergeld offen", formatEuroCents(summary.transportAdvertisingCostsCents))}
    ${summaryItem("Sonstige Werbungskosten", formatEuroCents(summary.otherAdvertisingCostsCents))}
    ${summaryItem("Steuerpfl. Öffi-BEZU", formatEuroCents(summary.taxablePublicTransportSubsidyCents))}
    ${summaryItem("Werbungskosten gesamt", formatEuroCents(summary.advertisingCostsTotalCents))}
    ${summaryItem("AG-Überweisungen erfasst", formatEuroCents(summary.paidCents))}
    ${summaryItem("Abgleich offen", formatEuroCents(summary.remainingReconciliationCents))}
  </section>
  <table aria-label="Reisekosten Rohdaten">
    <thead>
      <tr>
        <th class="label">Zeile</th>
        <th>Datum</th>
        <th>Start</th>
        <th>Ende</th>
        <th>Dauer</th>
        <th>Startort</th>
        <th>Zieladresse</th>
        <th>GKZ</th>
        <th>Fahrtkostenart</th>
        <th class="num">km einfach</th>
        <th class="num">km gesamt</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(renderTripRows).join("")}
    </tbody>
  </table>
  <h2>Erfasste Arbeitgeber-Überweisungen ${escapeHtml(String(year))}</h2>
  <table class="payments" aria-label="Arbeitgeber-Überweisungen">
    <thead><tr><th>Datum</th><th class="num">Betrag</th></tr></thead>
    <tbody>
      ${yearPayments.length ? yearPayments.map((payment) => `<tr><td>${escapeHtml(formatDate(payment.date))}</td><td class="num">${escapeHtml(formatEuroCents(payment.amountCents))}</td></tr>`).join("") : `<tr><td colspan="2">Keine Überweisungen erfasst.</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;
}

function compareTripsForExport(a: Trip, b: Trip): number {
  return a.date.localeCompare(b.date)
    || (a.startTime ?? "").localeCompare(b.startTime ?? "")
    || a.createdAt.localeCompare(b.createdAt)
    || a.id.localeCompare(b.id);
}

function renderTripRows(row: TripAdvertisingCostsExportRow): string {
  return `<tr>
    <td class="label">Basis</td>
    <td>${escapeHtml(formatDate(row.date))}</td>
    <td>${escapeHtml(row.startTime || "-")}</td>
    <td>${escapeHtml(row.endTime || "-")}</td>
    <td>${escapeHtml(formatDuration(row.durationMinutes))}</td>
    <td>${escapeHtml(row.origin || "-")}</td>
    <td>${escapeHtml(row.destination || "-")}</td>
    <td>${escapeHtml(row.municipalityCode || "-")}</td>
    <td>${escapeHtml(row.transportLabel)}</td>
    <td class="num">${escapeHtml(formatKilometers(row.oneWayKilometers))}</td>
    <td class="num">${escapeHtml(formatKilometers(row.totalKilometers))}</td>
  </tr>
  <tr>
    <td class="label">Kosten</td>
    <td colspan="2">Ticket: <strong>${escapeHtml(formatEuroCents(row.ticketPriceCents))}</strong></td>
    <td colspan="2">Diäten AG: <strong>${escapeHtml(formatEuroCents(row.employerPerDiemCents))}</strong></td>
    <td>Diäten WK: <strong>${escapeHtml(formatEuroCents(row.perDiemAdvertisingCostsCents))}</strong></td>
    <td>Fahrt AG: <strong>${escapeHtml(formatEuroCents(row.employerTransportPayoutCents))}</strong></td>
    <td>KM offen: <strong>${escapeHtml(formatEuroCents(row.transportAdvertisingCostsCents))}</strong></td>
    <td>Sonst. AG: <strong>${escapeHtml(formatEuroCents(row.employerOtherCostsCents))}</strong></td>
    <td>Sonst. WK: <strong>${escapeHtml(formatEuroCents(row.otherAdvertisingCostsCents))}</strong></td>
    <td>Öffi steuerpfl. / WK ges.: <strong>${escapeHtml(formatEuroCents(row.taxablePublicTransportSubsidyCents))} / ${escapeHtml(formatEuroCents(row.advertisingCostsTotalCents))}</strong></td>
  </tr>`;
}

function summaryItem(label: string, value: string): string {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function sumRows(rows: TripAdvertisingCostsExportRow[], value: (row: TripAdvertisingCostsExportRow) => number): number {
  return rows.reduce((sum, row) => sum + value(row), 0);
}

function formatEuroCents(cents: number): string {
  return `${(cents / 100).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function formatKilometers(kilometers: number): string {
  return `${kilometers.toLocaleString("de-AT", { maximumFractionDigits: 1 })} km`;
}

function formatDuration(minutes: number): string {
  const rounded = Math.max(Math.round(minutes), 0);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${hours}:${String(rest).padStart(2, "0")} h`;
}

function formatDate(dateKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const [year, month, day] = dateKey.split("-");
  return `${day}.${month}.${year}`;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("de-AT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
