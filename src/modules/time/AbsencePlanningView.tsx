import { ArrowCounterClockwise, BellRinging, BellSimple, CalendarCheck, CaretLeft, CaretRight, Check, CheckCircle, Clock, DownloadSimple, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { PlannedAbsence, PlannedAbsenceType } from "../../db/schema";
import { todayKey } from "../../lib/dates";
import { formatDays, formatMinutes, formatSignedMinutes } from "../../lib/format";
import type { useWorkData } from "../../app/useWorkData";
import { calculateFlexBalance, calculateVacation, entriesForFlexBalance } from "./calculations";
import { formatShortDayLabel } from "./dashboard";
import { absenceCalendarEvents, downloadAbsenceIcs } from "./absenceCalendarExport";
import {
  ABSENCE_TYPE_LABELS,
  ABSENCE_TYPE_LETTERS,
  absenceOpenDays,
  absencePlanAction,
  absenceRequestInfo,
  DEFAULT_REQUEST_LEAD_DAYS,
  DEFAULT_REQUEST_URGENT_DAYS,
  dueAbsenceRequests,
  groupOpenAbsences,
  holidayName,
  isWeekend,
  missedAbsences,
  planningMonths,
  summarizeAbsencePlan,
  type AbsenceOpenDays,
  type AbsencePlanSummary,
  type AbsenceRequestGroup,
  type AbsenceRequestInfo
} from "./absencePlanning";

type PlanningData = ReturnType<typeof useWorkData>;
type ShowToast = (message: string) => void;

export function daysLabel(count: number): string {
  return count === 1 ? "1 Tag" : `${count} Tage`;
}

export function formatAbsenceRange(group: Pick<AbsenceRequestGroup, "start" | "end">): string {
  return group.start === group.end ? formatShortDayLabel(group.start) : `${formatShortDayLabel(group.start)} – ${formatShortDayLabel(group.end)}`;
}

export function computeAbsencePlanning(data: PlanningData) {
  const settings = data.settings;
  const today = todayKey(data.clock);
  const dailyTargetMinutes = settings?.dailyTargetMinutes || 480;
  const flexLimitMinutes = settings?.flexLimitMinutes ?? 6000;
  const leadDays = settings?.absenceRequestLeadDays ?? DEFAULT_REQUEST_LEAD_DAYS;
  const urgentDays = settings?.absenceRequestUrgentDays ?? DEFAULT_REQUEST_URGENT_DAYS;
  const absences = data.plannedAbsences ?? [];
  const flexBalanceMinutes = settings ? calculateFlexBalance(settings.flexStartMinutes ?? 0, entriesForFlexBalance(data.timeEntries, today), data.flexCorrections) : 0;
  const vacation = settings ? calculateVacation(settings.vacationEntitlementMinutes, settings.vacationUsedMinutes, dailyTargetMinutes) : null;
  const summary = summarizeAbsencePlan({
    absences,
    today,
    vacationRemainingMinutes: vacation?.remainingMinutes ?? 0,
    flexBalanceMinutes,
    flexLimitMinutes,
    dailyTargetMinutes
  });
  const byDate = new Map(absences.map((absence) => [absence.date, absence]));
  return {
    today,
    dailyTargetMinutes,
    flexLimitMinutes,
    leadDays,
    urgentDays,
    absences,
    byDate,
    flexBalanceMinutes,
    vacationEntitlementMinutes: vacation?.entitlementMinutes ?? 0,
    vacationRemainingMinutes: vacation?.remainingMinutes ?? 0,
    summary,
    due: dueAbsenceRequests(absences, today, leadDays, urgentDays),
    missed: missedAbsences(absences, today)
  };
}

export type AbsencePlanning = ReturnType<typeof computeAbsencePlanning>;

export function absencePlanHeadline(summary: AbsencePlanSummary, dailyTargetMinutes: number): { text: string; tone: "done" | "open" | "danger" } {
  if (summary.status === "overplanned") return { text: `Mehr Urlaub geplant als vorhanden: ${daysLabel(Math.round(-summary.vacationAfterMinutes / dailyTargetMinutes))} zu viel.`, tone: "danger" };
  if (summary.status === "flex-too-low") return { text: "Gleitzeit fällt nach Planung unter -10:00 h.", tone: "danger" };
  if (summary.status === "done") return { text: "Alles verplant – am 31.12. verfällt nichts.", tone: "done" };
  if (summary.status === "almost") return { text: `Fast geschafft: nur noch ${formatMinutes(summary.flexOverLimitAfterMinutes)} über der Grenze – weniger als ein Gleittag.`, tone: "open" };
  const parts: string[] = [];
  if (summary.vacationAfterMinutes > 0) {
    const days = summary.vacationAfterMinutes / dailyTargetMinutes;
    parts.push(`${Number.isInteger(days) ? daysLabel(days) : formatDays(summary.vacationAfterMinutes, dailyTargetMinutes)} Urlaub`);
  }
  if (summary.flexOverLimitAfterMinutes > 0) parts.push(`${formatMinutes(summary.flexOverLimitAfterMinutes)} Gleitzeit über der Grenze`);
  return { text: `Noch offen: ${parts.join(" · ")}`, tone: "open" };
}

export function dayAmount(minutes: number, dailyTargetMinutes: number): string {
  const days = dailyTargetMinutes > 0 ? minutes / dailyTargetMinutes : 0;
  return days.toLocaleString("de-AT", { maximumFractionDigits: 1 });
}

export function dayAmountLabel(minutes: number, dailyTargetMinutes: number): string {
  const days = dailyTargetMinutes > 0 ? minutes / dailyTargetMinutes : 0;
  return Number.isInteger(days) ? daysLabel(days) : `${dayAmount(minutes, dailyTargetMinutes)} Tage`;
}

export interface AbsencePlanHero {
  title: string;
  value: string;
  detail: string;
  tone: "done" | "open" | "danger";
}

function openDayParts(open: AbsenceOpenDays): string[] {
  const parts: string[] = [];
  if (open.vacationDays > 0) parts.push(open.vacationDays === 1 ? "1 Urlaubstag" : `${open.vacationDays} Urlaubstage`);
  if (open.flexDays > 0) parts.push(open.flexDays === 1 ? "1 Gleittag" : `${open.flexDays} Gleittage`);
  if (open.vacationRestMinutes > 0) parts.push(`${formatMinutes(open.vacationRestMinutes)} Resturlaub`);
  return parts;
}

export function absencePlanHero(summary: AbsencePlanSummary, dailyTargetMinutes: number): AbsencePlanHero {
  if (summary.status === "overplanned") {
    return { title: "Zu viel geplant", value: daysLabel(Math.round(-summary.vacationAfterMinutes / dailyTargetMinutes)), detail: "mehr Urlaub geplant als vorhanden", tone: "danger" };
  }
  if (summary.status === "flex-too-low") {
    return { title: "Gleitzeit zu niedrig", value: formatSignedMinutes(summary.flexAfterMinutes), detail: "Gleitzeit fällt nach Planung unter -10:00 h", tone: "danger" };
  }
  if (summary.status === "done") return { title: "Alles verplant", value: daysLabel(0), detail: "am 31.12. verfällt nichts", tone: "done" };
  if (summary.status === "almost") {
    return { title: "Fast geschafft", value: formatMinutes(summary.flexOverLimitAfterMinutes), detail: "Gleitzeit über der Grenze – ein Gleittag reicht", tone: "open" };
  }
  const open = absenceOpenDays(summary, dailyTargetMinutes);
  const days = open.vacationDays + open.flexDays;
  if (days === 0) {
    return { title: "Bis 31.12. noch einplanen", value: formatMinutes(summary.openMinutes), detail: "Resturlaub – weniger als ein Tag", tone: "open" };
  }
  return { title: "Bis 31.12. noch einplanen", value: daysLabel(days), detail: openDayParts(open).join(" · "), tone: "open" };
}

function planCounts(planned: number, requested: number): string {
  return requested > 0 ? `${planned} geplant · ${requested} beantragt` : `${planned} geplant`;
}

function percent(part: number, total: number): number {
  return total > 0 ? Math.min(Math.max((part / total) * 100, 0), 100) : 0;
}

export function PlanBar({ requested, planned, total, label }: { requested: number; planned: number; total: number; label: string }) {
  const requestedPercent = percent(requested, total);
  const plannedPercent = Math.min(percent(planned, total), 100 - requestedPercent);
  return (
    <span className="absence-plan-bar" role="img" aria-label={label}>
      <span className="absence-plan-bar-requested" style={{ width: `${requestedPercent}%` }} />
      <span className="absence-plan-bar-planned" style={{ width: `${plannedPercent}%` }} />
      <span className="absence-plan-bar-open" style={{ width: `${total > 0 ? Math.max(100 - requestedPercent - plannedPercent, 0) : 0}%` }} />
    </span>
  );
}

export function AbsenceRequestAlert({ data, showToast }: { data: PlanningData; showToast: ShowToast }) {
  const planning = computeAbsencePlanning(data);
  const first = planning.due[0];
  if (!first) return null;
  const { group, info } = first;
  const urgent = info.state === "urgent";
  const more = planning.due.length - 1;
  const label = `${ABSENCE_TYPE_LABELS[group.type]} ${formatAbsenceRange(group)}`;
  const timing = urgent
    ? info.daysUntil === 0 ? "Der Tag ist heute." : `Nur noch ${daysLabel(info.daysUntil)} bis zum ersten Tag.`
    : `Das Antragsfenster ist seit ${formatShortDayLabel(info.opensOn)} offen, noch ${daysLabel(info.daysUntil)} bis zum ersten Tag.`;
  const moreText = more > 0 ? ` Dazu ${more} ${more === 1 ? "weiterer fälliger Antrag" : "weitere fällige Anträge"}.` : "";

  async function markRequested() {
    await data.setAbsenceStatus(group.ids, "requested");
    showToast(`${label} als beantragt markiert.`);
  }

  return (
    <div className={`deadline-alert absence-alert${urgent ? " is-urgent" : ""}`} role="status">
      <span className="deadline-alert-mark" aria-hidden="true"><BellRinging size={19} weight="bold" /></span>
      <div className="absence-alert-copy">
        <strong>{urgent ? `${label} – dringend beantragen` : `${label} jetzt beantragen`}</strong>
        <p>{timing} Im System beim Chef beantragen und hier abhaken.{moreText}</p>
      </div>
      <div className="absence-alert-actions">
        <Link className="link-button" to="/urlaub">Zur Planung</Link>
        <button className="secondary-button" type="button" onClick={() => void markRequested()}>Im System beantragt</button>
      </div>
    </div>
  );
}

function shortDate(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.`;
}

export function compactAbsenceRange(group: Pick<AbsenceRequestGroup, "start" | "end">): string {
  if (group.start === group.end) return formatShortDayLabel(group.start);
  if (group.start.slice(0, 7) === group.end.slice(0, 7)) return `${group.start.slice(8, 10)}.–${shortDate(group.end)}`;
  return `${shortDate(group.start)} – ${shortDate(group.end)}`;
}

export function requestStatusLabel(info: AbsenceRequestInfo): string {
  switch (info.state) {
    case "missed":
      return "vorbei";
    case "urgent":
    case "open":
      return info.daysUntil === 0 ? "heute" : `noch ${daysLabel(info.daysUntil)}`;
    case "requested":
      return "wird am Tag gebucht";
    default:
      return `ab ${formatShortDayLabel(info.opensOn)}`;
  }
}

function requestCopy(group: AbsenceRequestGroup, info: AbsenceRequestInfo, leadDays: number) {
  switch (info.state) {
    case "requested":
      return { pill: "Beantragt", detail: "Im System beantragt. Wird am Tag selbst gebucht." };
    case "urgent":
      return { pill: "Dringend", detail: info.daysUntil === 0 ? "Der Tag ist heute – sofort beantragen." : `Nur noch ${daysLabel(info.daysUntil)} bis zum ersten Tag – heute beantragen.` };
    case "open":
      return { pill: "Jetzt beantragen", detail: `Antragsfenster offen seit ${formatShortDayLabel(info.opensOn)} · noch ${daysLabel(info.daysUntil)}.` };
    case "missed":
      return { pill: "Nicht beantragt", detail: `${formatAbsenceRange(group)} ist vorbei, aber nicht als beantragt markiert.` };
    default:
      return { pill: `Ab ${formatShortDayLabel(info.opensOn)}`, detail: `Erinnerung am ${formatShortDayLabel(info.opensOn)} (${leadDays} Tage vorher).` };
  }
}

export function PlannedDayNotice({ data, absence, showToast }: { data: PlanningData; absence: PlannedAbsence; showToast: ShowToast }) {
  const planning = computeAbsencePlanning(data);
  const label = ABSENCE_TYPE_LABELS[absence.type];
  if (absence.status === "booked") {
    return (
      <div className={`planned-day-notice is-${absence.type} is-booked`}>
        <strong>{label} gebucht</strong>
        <p>Dieser Tag wurde laut Planung als {label} gebucht.</p>
      </div>
    );
  }
  const group = groupOpenAbsences(planning.absences).find((candidate) => candidate.ids.includes(absence.id));
  const info = absenceRequestInfo(group ?? { start: absence.date, status: absence.status === "requested" ? "requested" : "planned" }, planning.today, planning.leadDays, planning.urgentDays);
  const copy = requestCopy(group ?? { type: absence.type, status: "planned", start: absence.date, end: absence.date, dates: [absence.date], ids: [absence.id] }, info, planning.leadDays);
  return (
    <div className={`planned-day-notice is-${absence.type}${absence.status === "requested" ? " is-requested" : ""}`}>
      <strong>Für diesen Tag ist {label} {absence.status === "requested" ? "beantragt" : "geplant"}</strong>
      <p>{copy.detail} {absence.status === "planned" && info.state !== "missed" ? "Abgezogen wird erst am Tag selbst." : ""}</p>
      <div className="planned-day-notice-actions">
        {info.state === "missed" ? (
          <button className="secondary-button" type="button" onClick={() => void data.bookAbsences([absence.id]).then(() => showToast(`${label} gebucht.`))}>Jetzt buchen</button>
        ) : absence.status === "planned" ? (
          <button className="secondary-button" type="button" onClick={() => void data.setAbsenceStatus([absence.id], "requested").then(() => showToast(`${label} als beantragt markiert.`))}>Als beantragt markieren</button>
        ) : (
          <button className="link-button" type="button" onClick={() => void data.setAbsenceStatus([absence.id], "planned")}>Zurück auf geplant</button>
        )}
        <button className="link-button" type="button" onClick={() => void data.removePlannedAbsence(absence.id).then(() => showToast("Planung entfernt."))}>Planung entfernen</button>
      </div>
    </div>
  );
}

export function AbsencePlanningView({ data, showToast }: { data: PlanningData; showToast: ShowToast }) {
  const navigate = useNavigate();
  const params = useParams();
  const planning = computeAbsencePlanning(data);
  const todayYear = Number(planning.today.slice(0, 4));
  const yearOptions = [todayYear, todayYear + 1];
  const requestedYear = params.year && /^\d{4}$/.test(params.year) ? Number(params.year) : todayYear;
  const year = yearOptions.includes(requestedYear) ? requestedYear : todayYear;
  const months = useMemo(() => planningMonths(year, planning.today), [year, planning.today]);
  const [mode, setMode] = useModeState();
  const { summary, dailyTargetMinutes } = planning;
  const hero = absencePlanHero(summary, dailyTargetMinutes);
  const open = absenceOpenDays(summary, dailyTargetMinutes);
  const requestedDays = summary.vacationRequestedDays + summary.flexRequestedDays;
  const plannedDays = summary.vacationPlannedDays + summary.flexPlannedDays;
  const openDays = open.vacationDays + open.flexDays;
  const groups = groupOpenAbsences(planning.absences, planning.today).map((group) => ({ group, info: absenceRequestInfo(group, planning.today, planning.leadDays, planning.urgentDays) }));
  const missedGroups = groupOpenAbsences(planning.missed).map((group) => ({ group, info: absenceRequestInfo(group, planning.today, planning.leadDays, planning.urgentDays) }));
  const allGroups = [...missedGroups, ...groups];
  const dueGroups = allGroups.filter(({ info }) => info.state === "missed" || info.state === "urgent" || info.state === "open");
  const laterGroups = allGroups.filter(({ info }) => info.state === "later");
  const requestedGroups = allGroups.filter(({ info }) => info.state === "requested");
  const nextReminder = laterGroups.map(({ info }) => info.opensOn).sort()[0];

  const exportEvents = absenceCalendarEvents(planning.absences, planning.today);

  function exportCalendar() {
    downloadAbsenceIcs(planning.absences, planning.today);
    showToast(`Kalenderdatei mit ${exportEvents.length} ${exportEvents.length === 1 ? "Eintrag" : "Einträgen"} erstellt – in Outlook öffnen.`);
  }

  async function toggleDay(date: string) {
    const existing = planning.byDate.get(date);
    const action = absencePlanAction(existing, mode);
    if (action === "locked") {
      showToast("Bereits gebucht – Änderungen bitte über die Einstellungen.");
      return;
    }
    if (action === "remove" && existing) {
      await data.removePlannedAbsence(existing.id);
      return;
    }
    await data.planAbsence(date, mode);
  }

  async function markGroup(group: AbsenceRequestGroup, status: "planned" | "requested") {
    await data.setAbsenceStatus(group.ids, status);
    if (status === "requested") showToast(`${ABSENCE_TYPE_LABELS[group.type]} ${formatAbsenceRange(group)} als beantragt markiert.`);
  }

  async function bookGroup(group: AbsenceRequestGroup) {
    await data.bookAbsences(group.ids);
    showToast(`${ABSENCE_TYPE_LABELS[group.type]} ${formatAbsenceRange(group)} gebucht.`);
  }

  async function removeGroup(group: AbsenceRequestGroup) {
    for (const id of group.ids) await data.removePlannedAbsence(id);
    showToast("Planung entfernt.");
  }

  return (
    <section className="page-stack dashboard-page absence-page">
      <header className="dashboard-header">
        <div className="trips-title">
          <span className="section-label">Urlaub</span>
          <h1>Jahresplanung</h1>
        </div>
        <div className="trips-header-actions">
          <button className="secondary-button" type="button" disabled={exportEvents.length === 0} title="Geplante und beantragte Tage ab heute als .ics-Datei für Outlook" onClick={exportCalendar}>
            <DownloadSimple size={17} aria-hidden="true" /> Für Outlook exportieren
          </button>
          <div className="year-stepper" role="group" aria-label="Jahr wählen">
            <button className="icon-button" type="button" title="Vorjahr" aria-label="Vorjahr" disabled={year <= yearOptions[0]} onClick={() => navigate(`/urlaub/${year - 1}`)}>
              <CaretLeft size={17} aria-hidden="true" />
            </button>
            <label className="year-stepper-select">
              <span>Jahr</span>
              <select value={year} onChange={(event) => navigate(`/urlaub/${event.target.value}`)}>
                {yearOptions.map((optionYear) => <option key={optionYear} value={optionYear}>{optionYear}</option>)}
              </select>
            </label>
            <button className="icon-button" type="button" title="Folgejahr" aria-label="Folgejahr" disabled={year >= yearOptions[yearOptions.length - 1]} onClick={() => navigate(`/urlaub/${year + 1}`)}>
              <CaretRight size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <section className="absence-year-metrics" aria-label="Jahresende">
        <article className={`metric absence-hero is-${hero.tone}`} aria-labelledby="absence-hero-title">
          <span id="absence-hero-title" className="metric-title">
            {hero.tone === "done" ? <CheckCircle size={18} weight="bold" aria-hidden="true" /> : hero.tone === "danger" ? <WarningCircle size={18} weight="bold" aria-hidden="true" /> : null}
            {hero.title}
          </span>
          <div className="absence-hero-value">
            <strong>{hero.value}</strong>
            {hero.detail ? <span>{hero.detail}</span> : null}
          </div>
          <div className="absence-hero-plan">
            <PlanBar requested={requestedDays} planned={plannedDays} total={requestedDays + plannedDays + openDays} label={`${daysLabel(requestedDays)} beantragt, ${daysLabel(plannedDays)} geplant, ${daysLabel(openDays)} offen`} />
            <div className="absence-hero-legend" aria-hidden="true">
              <span><i className="is-requested" />{daysLabel(requestedDays)} beantragt</span>
              <span><i className="is-planned" />{daysLabel(plannedDays)} geplant</span>
              <span><i className="is-open" /><b>{daysLabel(openDays)} offen</b></span>
            </div>
          </div>
        </article>

        <article className="metric absence-source">
          <div className="metric-title"><CalendarCheck size={18} />Urlaub</div>
          {planning.vacationEntitlementMinutes > 0 ? (
            <>
              <div className="absence-source-value">
                <strong>{summary.vacationAfterMinutes < 0 ? daysLabel(Math.round(-summary.vacationAfterMinutes / dailyTargetMinutes)) : dayAmountLabel(summary.vacationAfterMinutes, dailyTargetMinutes)}</strong>
                <span className={summary.vacationAfterMinutes < 0 ? "is-danger" : summary.vacationAfterMinutes === 0 ? "is-done" : "is-open"}>{summary.vacationAfterMinutes < 0 ? "zu viel" : "offen"}</span>
              </div>
              <p>Resturlaub {dayAmountLabel(planning.vacationRemainingMinutes, dailyTargetMinutes)} · {planCounts(summary.vacationPlannedDays, summary.vacationRequestedDays)}</p>
            </>
          ) : (
            <>
              <div className="absence-source-value"><strong>–</strong></div>
              <p>Noch nicht eingerichtet</p>
            </>
          )}
        </article>

        <article className="metric absence-source">
          <div className="metric-title"><Clock size={18} />Gleitzeit</div>
          <div className="absence-source-value">
            {summary.status === "flex-too-low" ? (
              <>
                <strong>{formatSignedMinutes(summary.flexAfterMinutes)}</strong>
                <span className="is-danger">nach Planung</span>
              </>
            ) : (
              <>
                <strong>{daysLabel(open.flexDays)}</strong>
                <span className={open.flexDays > 0 ? "is-open" : "is-done"}>offen</span>
              </>
            )}
          </div>
          <p>
            {summary.flexOverLimitAfterMinutes > 0 ? `${formatMinutes(summary.flexOverLimitAfterMinutes)} über der Grenze` : `Grenze ${formatMinutes(planning.flexLimitMinutes)}`} · Saldo {formatSignedMinutes(planning.flexBalanceMinutes)}
            {summary.flexPlannedDays + summary.flexRequestedDays > 0 ? ` · ${planCounts(summary.flexPlannedDays, summary.flexRequestedDays)}` : ""}
          </p>
        </article>
      </section>

      <div className="absence-layout">
        <section className="panel absence-calendar" aria-labelledby="absence-calendar-title">
          <div className="absence-calendar-toolbar">
            <span id="absence-calendar-title" className="section-label">Kalender {year}</span>
            <div className="trip-tabs absence-mode" role="group" aria-label="Eintragen als">
              {(["vacation", "flex"] as PlannedAbsenceType[]).map((type) => (
                <button key={type} type="button" aria-pressed={mode === type} onClick={() => setMode(type)}>
                  <span className={`absence-letter is-${type}`} aria-hidden="true">{ABSENCE_TYPE_LETTERS[type]}</span>
                  {ABSENCE_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
          <div className="absence-months">
            {months.map((month) => (
              <div key={month.key} className="absence-month">
                <h3>{month.label}</h3>
                <div className="absence-grid absence-weekdays" aria-hidden="true">
                  {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label) => <span key={label}>{label}</span>)}
                </div>
                <div className="absence-grid">
                  {Array.from({ length: month.leadingBlanks }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
                  {month.days.map((date) => (
                    <CalendarDay key={date} date={date} today={planning.today} absence={planning.byDate.get(date)} mode={mode} onToggle={() => void toggleDay(date)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="absence-legend">
            <span><i className="absence-swatch is-vacation" aria-hidden="true">U</i>Urlaub geplant</span>
            <span><i className="absence-swatch is-vacation is-requested" aria-hidden="true">U✓</i>Urlaub beantragt</span>
            <span><i className="absence-swatch is-flex" aria-hidden="true">G</i>Gleittag geplant</span>
            <span><i className="absence-swatch is-flex is-requested" aria-hidden="true">G✓</i>Gleittag beantragt</span>
            <span><i className="absence-swatch is-booked" aria-hidden="true">U</i>gebucht</span>
            <span><i className="absence-swatch is-holiday" aria-hidden="true">FT</i>Feiertag</span>
          </div>
        </section>

        <section className="panel absence-requests" aria-labelledby="absence-requests-title">
          <div className="absence-requests-heading">
            <span id="absence-requests-title" className="section-label">Anträge</span>
            <span className={dueGroups.length > 0 ? "is-due" : undefined}>{dueGroups.length > 0 ? `${dueGroups.length} fällig` : `${allGroups.length} gesamt`}</span>
          </div>
          {allGroups.length === 0 ? <p className="absence-empty">Noch nichts geplant. Tage im Kalender anklicken.</p> : null}
          {allGroups.length > 0 && dueGroups.length === 0 ? (
            <p className="absence-requests-calm">
              <BellSimple size={17} aria-hidden="true" />
              {nextReminder ? `Nichts fällig. Nächste Erinnerung am ${formatShortDayLabel(nextReminder)}` : "Nichts fällig."}
            </p>
          ) : null}
          {dueGroups.length > 0 ? (
            <div className="absence-request-group">
              <h3>Jetzt beantragen</h3>
              <ul className="absence-request-cards">
                {dueGroups.map(({ group, info }) => (
                  <li key={`${group.start}-${group.type}-${group.status}`} className={`absence-request-card is-${info.state}`}>
                    <div className="absence-request-row">
                      <span className={`absence-letter is-${group.type}`} aria-hidden="true">{ABSENCE_TYPE_LETTERS[group.type]}</span>
                      <div className="absence-request-text">
                        <strong>{compactAbsenceRange(group)}</strong>
                        <small>{ABSENCE_TYPE_LABELS[group.type]} · {daysLabel(group.dates.length)}</small>
                      </div>
                      <span className="absence-request-status">{requestStatusLabel(info)}</span>
                    </div>
                    <div className="absence-request-actions">
                      {info.state === "missed" ? (
                        <>
                          <button className="secondary-button" type="button" onClick={() => void bookGroup(group)}>Jetzt buchen</button>
                          <button className="link-button" type="button" onClick={() => void removeGroup(group)}>Entfernen</button>
                        </>
                      ) : (
                        <button className="secondary-button" type="button" onClick={() => void markGroup(group, "requested")}>Als beantragt markieren</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {laterGroups.length > 0 ? (
            <div className="absence-request-group">
              <h3>Später beantragen</h3>
              <ul className="absence-request-rows">
                {laterGroups.map(({ group, info }) => (
                  <li key={`${group.start}-${group.type}-${group.status}`} className="absence-request-row">
                    <span className={`absence-letter is-${group.type}`} aria-hidden="true">{ABSENCE_TYPE_LETTERS[group.type]}</span>
                    <div className="absence-request-text">
                      <strong>{compactAbsenceRange(group)}</strong>
                      <small>{ABSENCE_TYPE_LABELS[group.type]} · {daysLabel(group.dates.length)}</small>
                    </div>
                    <span className="absence-request-status">{requestStatusLabel(info)}</span>
                    <button className="icon-button absence-request-icon" type="button" title="Als beantragt markieren" aria-label={`${compactAbsenceRange(group)} als beantragt markieren`} onClick={() => void markGroup(group, "requested")}>
                      <Check size={16} weight="bold" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {requestedGroups.length > 0 ? (
            <div className="absence-request-group">
              <h3>Beantragt</h3>
              <ul className="absence-request-rows">
                {requestedGroups.map(({ group, info }) => (
                  <li key={`${group.start}-${group.type}-${group.status}`} className="absence-request-row is-requested">
                    <span className="absence-letter is-requested" aria-hidden="true"><Check size={14} weight="bold" /></span>
                    <div className="absence-request-text">
                      <strong>{compactAbsenceRange(group)}</strong>
                      <small>{ABSENCE_TYPE_LABELS[group.type]} · {daysLabel(group.dates.length)}</small>
                    </div>
                    <span className="absence-request-status">{requestStatusLabel(info)}</span>
                    <button className="icon-button absence-request-icon" type="button" title="Zurück auf geplant" aria-label={`${compactAbsenceRange(group)} zurück auf geplant`} onClick={() => void markGroup(group, "planned")}>
                      <ArrowCounterClockwise size={16} weight="bold" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function CalendarDay({ date, today, absence, mode, onToggle }: { date: string; today: string; absence: PlannedAbsence | undefined; mode: PlannedAbsenceType; onToggle: () => void }) {
  const holiday = holidayName(date);
  const weekend = isWeekend(date);
  const past = date < today;
  const isToday = date === today;
  const day = Number(date.slice(8, 10));
  const classes = ["absence-day"];
  let tag = "";
  let label = formatShortDayLabel(date);
  let disabled = false;

  if (absence) {
    classes.push(`is-${absence.type}`, `is-${absence.status}`);
    tag = ABSENCE_TYPE_LETTERS[absence.type] + (absence.status === "requested" ? "✓" : "");
    label += `: ${ABSENCE_TYPE_LABELS[absence.type]} ${absence.status === "booked" ? "gebucht" : absence.status === "requested" ? "beantragt" : "geplant"}`;
    disabled = past || absence.status === "booked";
  } else if (holiday) {
    classes.push("is-holiday");
    tag = "FT";
    label += `: Feiertag (${holiday})`;
    disabled = true;
  } else if (weekend) {
    classes.push("is-weekend");
    label += ": Wochenende";
    disabled = true;
  } else if (past) {
    classes.push("is-past");
    label += ": vergangen";
    disabled = true;
  } else {
    label += `: frei, als ${ABSENCE_TYPE_LABELS[mode]} planen`;
  }
  if (past) classes.push("is-past-day");
  if (isToday) {
    classes.push("is-today");
    if (!tag) tag = "heute";
    label += " (heute)";
  }

  return (
    <button type="button" className={classes.join(" ")} disabled={disabled} aria-label={label} title={holiday ?? undefined} onClick={onToggle}>
      <span className="absence-day-number">{day}</span>
      <span className="absence-day-tag">{tag}</span>
    </button>
  );
}

const MODE_STORAGE_KEY = "absence-plan-mode";

function readStoredMode(): PlannedAbsenceType {
  try {
    return window.localStorage.getItem(MODE_STORAGE_KEY) === "flex" ? "flex" : "vacation";
  } catch {
    return "vacation";
  }
}

export function rememberAbsencePlanMode(mode: PlannedAbsenceType): void {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Speicher nicht verfügbar – Auswahl gilt nur für diese Sitzung.
  }
}

function useModeState(): [PlannedAbsenceType, (mode: PlannedAbsenceType) => void] {
  const [mode, setMode] = useState<PlannedAbsenceType>(readStoredMode);
  return [mode, (next) => {
    setMode(next);
    rememberAbsencePlanMode(next);
  }];
}
