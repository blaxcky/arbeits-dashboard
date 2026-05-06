import {
  ArrowClockwise,
  Briefcase,
  CalendarCheck,
  ClipboardText,
  Database,
  DownloadSimple,
  Gear,
  House,
  ListChecks,
  UploadSimple,
  Warning
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { HashRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import type { Settings, TimeEntry } from "../db/schema";
import { backupFileName, downloadBackup, importBackup, inspectBackup } from "../services/backup";
import { resetServiceWorkerAndCaches } from "../services/pwa";
import { addDays, formatDateKey, isoWeekDays, todayKey, weekdayName } from "../lib/dates";
import { formatDays, formatDecimalHours, formatMinutes, formatSignedMinutes } from "../lib/format";
import {
  calculateDay,
  calculateFlexBalance,
  calculateRequiredYearConsumption,
  calculateVacation,
  calculateWeek
} from "../modules/time/calculations";
import { useWorkData } from "./useWorkData";

const navItems = [
  { to: "/", label: "Dashboard", icon: House },
  { to: "/reisekosten", label: "Reisekosten", icon: Briefcase },
  { to: "/aufgaben", label: "Aufgaben", icon: ListChecks },
  { to: "/einstellungen", label: "Einstellungen", icon: Gear }
];

export function App() {
  const data = useWorkData();

  return (
    <HashRouter>
      <div className="app-shell">
        <aside className="sidebar" aria-label="Hauptnavigation">
          <Link className="brand" to="/">
            <span className="brand-mark">AD</span>
            <span>
              <strong>Arbeits-Dashboard</strong>
              <small>Lokal und offline</small>
            </span>
          </Link>
          <nav className="nav-list">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                <item.icon size={20} weight="duotone" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="privacy-note">
            <Database size={18} />
            <span>Arbeitsdaten bleiben in IndexedDB auf diesem Gerät.</span>
          </div>
        </aside>
        <main className="workspace">
          {data.error ? <Notice tone="danger" title="Datenfehler" text={data.error} /> : null}
          <Routes>
            <Route path="/" element={<Dashboard data={data} />} />
            <Route path="/reisekosten" element={<RoadmapView title="Reisekosten" icon={<Briefcase size={28} />} items={["Reisen erfassen", "Fahrtkostenarten", "Diäten", "Nachweise", "Jahresübersicht"]} />} />
            <Route path="/aufgaben" element={<RoadmapView title="Aufgaben" icon={<ClipboardText size={28} />} items={["Aufgaben erfassen", "Fälligkeiten", "Prioritäten", "Tags", "Filter und Suche"]} />} />
            <Route path="/einstellungen" element={<SettingsView data={data} />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

type WorkData = ReturnType<typeof useWorkData>;

function Dashboard({ data }: { data: WorkData }) {
  const settings = data.settings;
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const entry = data.entriesByDate.get(selectedDate);
  const [form, setForm] = useState(() => entryToForm(entry, selectedDate, settings));
  const [timeErrors, setTimeErrors] = useState<Partial<Record<"startTime" | "endTime", string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const previewEntry = {
    date: selectedDate,
    startTime: previewTime(form.startTime),
    endTime: previewTime(form.endTime),
    breakMinutes: Number(form.breakMinutes) || 0,
    targetMinutes: Number(form.targetMinutes) || settings?.dailyTargetMinutes || 480
  };
  const day = calculateDay(previewEntry, data.clock);
  const week = calculateWeek(data.timeEntries, selectedDate, data.clock);
  const flex = settings ? calculateFlexBalance(settings.flexStartMinutes ?? 0, data.timeEntries, data.flexCorrections) : 0;
  const vacation = settings ? calculateVacation(settings.vacationEntitlementMinutes, settings.vacationUsedMinutes, settings.dailyTargetMinutes) : null;
  const requiredConsumption = settings && vacation ? calculateRequiredYearConsumption(vacation.remainingMinutes, flex, settings.flexLimitMinutes) : 0;
  const setupMissing = settings ? [settings.flexStartMinutes === null ? "Gleitzeitstartwert" : null, settings.vacationEntitlementMinutes === null ? "Urlaubsanspruch" : null].filter(Boolean) : [];
  const weeklyTargetMinutes = settings?.weeklyTargetMinutes ?? 2400;
  const weekDeltaToTarget = week.workedMinutes - weeklyTargetMinutes;
  const flexLimitMinutes = settings?.flexLimitMinutes ?? 6000;
  const flexDistanceToLimit = flexLimitMinutes - flex;
  const vacationEntitlementMinutes = vacation?.entitlementMinutes ?? 0;
  const breakField = (
    <Field label="Pause in Minuten" className="break-field">
      <input
        type="number"
        min="0"
        max="720"
        value={form.breakMinutes}
        onChange={(event) => setForm({ ...form, breakMinutes: event.target.value })}
        onBlur={(event) => void handleBreakBlur(event.target.value)}
      />
    </Field>
  );

  useEffect(() => {
    setForm(entryToForm(entry, selectedDate, settings));
    setTimeErrors({});
  }, [entry, selectedDate, settings]);

  async function autoSave(draft: ReturnType<typeof entryToForm>, createWhenEmpty = true) {
    const startTime = timeForSave(draft.startTime, entry?.startTime);
    const endTime = timeForSave(draft.endTime, entry?.endTime);
    if (!entry && !createWhenEmpty && !startTime && !endTime) return;
    setMessage(null);
    await data.saveTimeEntry({
      date: selectedDate,
      startTime,
      endTime,
      breakMinutes: clampNumber(draft.breakMinutes, 0, 720),
      targetMinutes: clampNumber(draft.targetMinutes, 0, 900),
      note: entry?.note ?? ""
    });
  }

  async function handleTimeBlur(field: "startTime" | "endTime", value: string) {
    const normalized = normalizeTimeInput(value);
    if (normalized === null) {
      setTimeErrors((current) => ({ ...current, [field]: "Bitte als HH:MM eingeben, z.B. 07:30." }));
      return;
    }

    const draft = { ...form, [field]: normalized };
    setForm(draft);
    setTimeErrors((current) => ({ ...current, [field]: undefined }));
    await autoSave(draft, normalized !== "");
  }

  async function handleBreakBlur(value: string) {
    const normalized = String(clampNumber(value, 0, 720));
    const draft = { ...form, breakMinutes: normalized };
    setForm(draft);
    await autoSave(draft);
  }

  async function remove() {
    await data.removeTimeEntry(selectedDate);
    setMessage("Zeiteintrag gelöscht.");
  }

  return (
    <section className="page-stack">
      <Header eyebrow="Dashboard" title="Zeiterfassung" description="Tagesdaten manuell pflegen, Live-Stand prüfen und Woche, Gleitzeit sowie Urlaub im Blick behalten." />
      {data.loading ? <SkeletonRows /> : null}
      {message ? <Notice tone="success" title="Status" text={message} /> : null}
      {setupMissing.length ? (
        <Notice
          tone="warning"
          title="Einrichtung offen"
          text={`${setupMissing.join(" und ")} fehlen noch. Die App bleibt nutzbar, rechnet aber mit neutralen Werten.`}
          action={<Link to="/einstellungen">Einstellungen öffnen</Link>}
        />
      ) : null}
      <div className="dashboard-workflow-grid">
        <form className="panel form-panel day-entry-panel" onSubmit={(event) => event.preventDefault()}>
          <div className="panel-heading">
            <span className="section-label">Tageserfassung</span>
            <strong>{formatDateKey(selectedDate)}</strong>
          </div>
          <div className="date-row">
            <button type="button" className="secondary-button" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>Zurück</button>
            <label>
              Datum
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
            <button type="button" className="secondary-button" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>Weiter</button>
          </div>
          <div className="form-grid day-entry-grid">
            <Field label="Dienstbeginn" error={timeErrors.startTime}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="07:30"
                value={form.startTime}
                aria-invalid={Boolean(timeErrors.startTime)}
                onChange={(event) => setForm({ ...form, startTime: event.target.value })}
                onBlur={(event) => void handleTimeBlur("startTime", event.target.value)}
              />
            </Field>
            <Field label="Dienstende" error={timeErrors.endTime}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="15:30"
                value={form.endTime}
                aria-invalid={Boolean(timeErrors.endTime)}
                onChange={(event) => setForm({ ...form, endTime: event.target.value })}
                onBlur={(event) => void handleTimeBlur("endTime", event.target.value)}
              />
            </Field>
          </div>
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => void remove()} disabled={!entry}>Löschen</button>
          </div>
        </form>
        <div className="live-clock-stack">
          <LiveDayClock day={day} targetMinutes={previewEntry.targetMinutes} />
          <div className="panel break-panel">{breakField}</div>
        </div>
        <div className="dashboard-side-grid">
          <Metric
            title="Woche"
            value={formatMinutes(week.workedMinutes)}
            detail={weekDeltaToTarget >= 0 ? `${formatMinutes(weekDeltaToTarget)} über Wochensoll` : `noch ${formatMinutes(Math.abs(weekDeltaToTarget))} bis Wochensoll`}
            progress={{ value: week.workedMinutes / weeklyTargetMinutes }}
          />
          <Metric
            title="Gleitzeit"
            value={formatSignedMinutes(flex)}
            detail={flexDistanceToLimit >= 0 ? `noch ${formatMinutes(flexDistanceToLimit)} bis Grenze` : `${formatMinutes(Math.abs(flexDistanceToLimit))} über Grenze`}
            tone={settings && flex > settings.flexLimitMinutes ? "warning" : "default"}
            progress={{
              value: flexLimitMinutes > 0 ? flex / flexLimitMinutes : 0,
              overflow: flexLimitMinutes > 0 && flex > flexLimitMinutes ? (flex - flexLimitMinutes) / flexLimitMinutes : 0,
              tone: flex > flexLimitMinutes ? "warning" : "default"
            }}
          />
          <Metric
            title="Resturlaub"
            value={vacation ? formatDays(vacation.remainingMinutes, settings?.dailyTargetMinutes) : "0,0 Tage"}
            detail={vacation && vacationEntitlementMinutes > 0 ? `${formatMinutes(vacation.remainingMinutes)} von ${formatMinutes(vacationEntitlementMinutes)} übrig` : "Noch nicht eingerichtet"}
            icon={<CalendarCheck size={22} />}
            progress={{ value: vacationEntitlementMinutes > 0 ? (vacation?.remainingMinutes ?? 0) / vacationEntitlementMinutes : 0, tone: "vacation" }}
          />
          <Metric title="Dieses Jahr verbrauchen" value={formatMinutes(requiredConsumption)} detail="Resturlaub plus Gleitzeit über Grenze" />
        </div>
      </div>
      <WeekTable week={week} />
    </section>
  );
}

function SettingsView({ data }: { data: WorkData }) {
  const settings = data.settings;
  const [notice, setNotice] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => settingsToForm(settings));

  useEffect(() => {
    setForm(settingsToForm(settings));
  }, [settings]);

  if (!settings) return <SkeletonRows />;

  async function saveSettings() {
    await data.saveSettings({
      dailyTargetMinutes: clampHoursToMinutes(form.dailyTargetMinutes, 1, 900),
      weeklyTargetMinutes: clampHoursToMinutes(form.weeklyTargetMinutes, 1, 4000),
      flexLimitMinutes: clampHoursToMinutes(form.flexLimitMinutes, 0, 20000),
      flexStartMinutes: form.flexStartMinutes === "" ? null : hoursToMinutes(form.flexStartMinutes),
      vacationEntitlementMinutes: form.vacationEntitlementMinutes === "" ? null : hoursToMinutes(form.vacationEntitlementMinutes),
      vacationUsedMinutes: clampHoursToMinutes(form.vacationUsedMinutes, 0, 20000)
    });
    setNotice("Einstellungen gespeichert.");
  }

  async function handleImport(file: File, replace: boolean) {
    const payload = replace ? await importBackup(file) : await inspectBackup(file);
    setImportPreview(`Backup vom ${new Date(payload.manifest.exportedAt).toLocaleString("de-AT")} mit ${payload.data.timeEntries.length} Zeiteinträgen und ${payload.data.flexCorrections.length} Korrekturen.`);
    if (replace) {
      await data.refresh();
      setNotice("Backup importiert und lokale Daten ersetzt.");
    }
  }

  return (
    <section className="page-stack">
      <Header eyebrow="Einstellungen" title="Lokale Steuerzentrale" description="Arbeitszeit, Urlaub, Backup, PWA-Cache und Datenlöschung." />
      {notice ? <Notice tone="success" title="Status" text={notice} /> : null}
      <div className="settings-grid">
        <div className="panel form-panel">
          <span className="section-label">Arbeitszeit</span>
          <div className="form-grid">
            <Field label="Sollzeit pro Tag (Stunden)"><input type="number" step="0.25" value={form.dailyTargetMinutes} onChange={(event) => setForm({ ...form, dailyTargetMinutes: event.target.value })} /></Field>
            <Field label="Wochenarbeitszeit (Stunden)"><input type="number" step="0.25" value={form.weeklyTargetMinutes} onChange={(event) => setForm({ ...form, weeklyTargetMinutes: event.target.value })} /></Field>
            <Field label="Gleitzeitgrenze (Stunden)"><input type="number" step="0.25" value={form.flexLimitMinutes} onChange={(event) => setForm({ ...form, flexLimitMinutes: event.target.value })} /></Field>
            <Field label="Gleitzeitstartwert (Stunden)"><input type="number" step="0.25" value={form.flexStartMinutes} onChange={(event) => setForm({ ...form, flexStartMinutes: event.target.value })} placeholder="leer" /></Field>
            <Field label="Urlaubsanspruch (Stunden)"><input type="number" step="0.25" value={form.vacationEntitlementMinutes} onChange={(event) => setForm({ ...form, vacationEntitlementMinutes: event.target.value })} placeholder="leer" /></Field>
            <Field label="Verbrauchter Urlaub (Stunden)"><input type="number" step="0.25" value={form.vacationUsedMinutes} onChange={(event) => setForm({ ...form, vacationUsedMinutes: event.target.value })} /></Field>
          </div>
          <button className="primary-button" onClick={() => void saveSettings()}>Einstellungen speichern</button>
        </div>
        <BackupPanel importRef={importRef} importPreview={importPreview} onPreview={(file) => handleImport(file, false)} onReplace={(file) => handleImport(file, true)} onDone={setNotice} refresh={data.refresh} />
        <CorrectionsPanel data={data} />
        <DangerPanel data={data} onDone={setNotice} />
      </div>
    </section>
  );
}

function BackupPanel({ importRef, importPreview, onPreview, onReplace, onDone, refresh }: { importRef: React.RefObject<HTMLInputElement | null>; importPreview: string | null; onPreview: (file: File) => Promise<void>; onReplace: (file: File) => Promise<void>; onDone: (message: string) => void; refresh: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="panel">
      <span className="section-label">Backup</span>
      <p className="muted">Exportiert wird eine ZIP-Datei mit Manifest und Daten. Import ersetzt nach Vorschau alle lokalen Daten.</p>
      <div className="button-row">
        <button className="primary-button" onClick={async () => { await downloadBackup(); onDone(`Backup ${backupFileName()} vorbereitet.`); }}>
          <DownloadSimple size={18} /> Exportieren
        </button>
        <button className="secondary-button" onClick={() => importRef.current?.click()}>
          <UploadSimple size={18} /> Datei wählen
        </button>
      </div>
      <input
        ref={importRef}
        className="hidden-input"
        type="file"
        accept=".zip,application/zip"
        onChange={async (event) => {
          const selected = event.target.files?.[0] ?? null;
          setFile(selected);
          if (selected) await onPreview(selected);
        }}
      />
      {importPreview ? <Notice tone="warning" title="Import-Vorschau" text={importPreview} /> : null}
      <button className="danger-button" disabled={!file} onClick={async () => { if (file && window.confirm("Dieses Backup ersetzt alle lokalen Daten. Fortfahren?")) { await onReplace(file); await refresh(); } }}>Backup importieren und ersetzen</button>
    </div>
  );
}

function CorrectionsPanel({ data }: { data: WorkData }) {
  const flex = data.settings ? calculateFlexBalance(data.settings.flexStartMinutes ?? 0, data.timeEntries, data.flexCorrections) : 0;
  const [form, setForm] = useState({ date: todayKey(), newValueMinutes: String(flex), note: "" });
  return (
    <div className="panel">
      <span className="section-label">Gleitzeitkorrekturen</span>
      <div className="form-grid">
        <Field label="Datum"><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
        <Field label="Neuer Gesamtwert (Minuten)"><input type="number" value={form.newValueMinutes} onChange={(event) => setForm({ ...form, newValueMinutes: event.target.value })} /></Field>
      </div>
      <Field label="Grund oder Notiz"><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
      <button className="secondary-button" onClick={() => void data.addCorrection({ date: form.date, oldValueMinutes: flex, newValueMinutes: Number(form.newValueMinutes), note: form.note })}>Korrektur speichern</button>
      <div className="correction-list">
        {data.flexCorrections.length === 0 ? <p className="muted">Noch keine Korrekturen.</p> : null}
        {data.flexCorrections.map((correction) => (
          <div key={correction.id} className="correction-row">
            <span>{formatDateKey(correction.date)}</span>
            <strong>{formatSignedMinutes(correction.diffMinutes)}</strong>
            <button className="icon-button" title="Korrektur löschen" onClick={() => void data.removeCorrection(correction.id)}>Entfernen</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DangerPanel({ data, onDone }: { data: WorkData; onDone: (message: string) => void }) {
  return (
    <div className="panel danger-panel">
      <span className="section-label">Reset</span>
      <p className="muted">Cache und Service Worker können ohne Datenverlust entfernt werden. Die lokale Datenlöschung ist separat.</p>
      <div className="button-row">
        <button className="secondary-button" onClick={async () => { await resetServiceWorkerAndCaches(); onDone("Cache und Service Worker wurden zurückgesetzt."); window.location.reload(); }}>
          <ArrowClockwise size={18} /> Cache zurücksetzen
        </button>
        <button className="danger-button" onClick={async () => { if (window.confirm("Vorher Backup exportieren. Wirklich alle lokalen Arbeitsdaten löschen?")) { await data.wipeData(); onDone("Lokale Daten gelöscht."); } }}>Lokale Daten löschen</button>
      </div>
    </div>
  );
}

function RoadmapView({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <section className="page-stack">
      <Header eyebrow="Roadmap" title={title} description="Dieses Modul ist vorbereitet, aber in V1 noch kein aktiver Arbeitsbereich." />
      <div className="panel roadmap-panel">
        {icon}
        <div>
          <h2>Geplante Funktionen</h2>
          <ul className="roadmap-list">
            {items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

function WeekTable({ week }: { week: ReturnType<typeof calculateWeek> }) {
  return (
    <div className="panel">
      <div className="panel-heading">
        <span className="section-label">Woche ab {formatDateKey(week.weekStart)}</span>
        <strong>{formatSignedMinutes(week.deltaMinutes)}</strong>
      </div>
      <div className="week-table">
        {week.days.map((day) => (
          <div key={day.date} className="week-row">
            <span>{weekdayName(day.date)}</span>
            <span>{formatDateKey(day.date)}</span>
            <span>{day.entry?.startTime ?? "-"}</span>
            <span>{day.entry?.endTime ?? "offen"}</span>
            <strong>{formatSignedMinutes(day.calculation.deltaMinutes)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function Header({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="page-header">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

type MetricProgress = {
  value: number;
  overflow?: number;
  tone?: "default" | "warning" | "vacation";
};

function Metric({ title, value, detail, icon, tone = "default", progress }: { title: string; value: string; detail: string; icon?: React.ReactNode; tone?: "default" | "warning" | "danger"; progress?: MetricProgress }) {
  const progressValue = progress ? clampProgress(progress.value) : 0;
  const overflowValue = progress?.overflow ? clampProgress(progress.overflow) : 0;

  return (
    <article className={`metric metric-${tone}`}>
      <div className="metric-title">{icon}{title}</div>
      <strong>{value}</strong>
      {progress ? (
        <div className={`metric-progress metric-progress-${progress.tone ?? "default"}`} aria-label={`${title}: ${Math.round(progressValue * 100)} Prozent`}>
          {overflowValue > 0 ? <span className="metric-progress-overflow" style={{ width: `${overflowValue * 100}%` }} /> : null}
          <span className="metric-progress-track">
            <span className="metric-progress-fill" style={{ width: `${progressValue * 100}%` }} />
          </span>
        </div>
      ) : null}
      <p>{detail}</p>
    </article>
  );
}

function LiveDayClock({ day, targetMinutes }: { day: ReturnType<typeof calculateDay>; targetMinutes: number }) {
  const mainProgress = day.hasStart ? ringProgress(day.netMinutes, targetMinutes) : 0;
  const overtimeProgress = day.deltaMinutes > 0 ? ringProgress(day.deltaMinutes, targetMinutes) : 0;
  const centerStatus = liveClockStatus(day);
  const ariaLabel = day.hasStart
    ? `Live-Auswertung: ${formatMinutes(day.netMinutes)} gearbeitet, Tagesstand ${formatSignedMinutes(day.deltaMinutes)}.`
    : "Live-Auswertung: Dienstbeginn fehlt.";

  return (
    <aside className={`panel live-clock-panel live-clock-${day.status}${overtimeProgress > 0 ? " live-clock-has-overtime" : ""}`} aria-label={ariaLabel}>
      <span className="section-label">Live-Auswertung</span>
      <div className="live-clock-face">
        <svg className="live-clock-svg" viewBox="0 0 200 200" role="img" aria-hidden="true">
          <circle className="live-clock-track live-clock-track-main" cx="100" cy="100" r="70" pathLength="100" />
          <circle
            className="live-clock-ring live-clock-ring-main"
            cx="100"
            cy="100"
            r="70"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={100 - mainProgress * 100}
          />
          {overtimeProgress > 0 ? (
            <>
              <circle className="live-clock-track live-clock-track-overtime" cx="100" cy="100" r="86" pathLength="100" />
              <circle
                className="live-clock-ring live-clock-ring-overtime"
                cx="100"
                cy="100"
                r="86"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - overtimeProgress * 100}
              />
            </>
          ) : null}
        </svg>
        <div className="live-clock-center">
          <strong>{formatMinutes(day.netMinutes)}</strong>
          <span>{centerStatus}</span>
        </div>
      </div>
      <dl className="detail-list live-clock-details">
        <div><dt>Soll-Ende</dt><dd>{day.hasStart ? day.targetEndTime : "-"}</dd></div>
        <div><dt>Verwendetes Ende</dt><dd>{day.hasStart ? day.effectiveEndTime ?? "offen" : "-"}</dd></div>
        <div><dt>Tagesstand</dt><dd>{day.hasStart ? formatSignedMinutes(day.deltaMinutes) : "-"}</dd></div>
      </dl>
    </aside>
  );
}

function Notice({ title, text, action, tone = "success" }: { title: string; text: string; action?: React.ReactNode; tone?: "success" | "warning" | "danger" }) {
  return (
    <div className={`notice notice-${tone}`}>
      <Warning size={20} weight="duotone" />
      <div><strong>{title}</strong><p>{text}</p>{action}</div>
    </div>
  );
}

function Field({ label, children, error, className = "" }: { label: string; children: React.ReactNode; error?: string; className?: string }) {
  return <label className={`field ${className}`.trim()}><span>{label}</span>{children}{error ? <small className="field-error">{error}</small> : null}</label>;
}

function SkeletonRows() {
  return <div className="skeleton-stack"><div /><div /><div /></div>;
}

function entryToForm(entry: TimeEntry | undefined, selectedDate: string, settings: Settings | null) {
  return {
    date: selectedDate,
    startTime: entry?.startTime ?? "",
    endTime: entry?.endTime ?? "",
    breakMinutes: String(entry?.breakMinutes ?? 30),
    targetMinutes: String(entry?.targetMinutes ?? settings?.dailyTargetMinutes ?? 480),
    note: entry?.note ?? ""
  };
}

function settingsToForm(settings: Settings | null) {
  return {
    dailyTargetMinutes: minutesToHourInput(settings?.dailyTargetMinutes ?? 480),
    weeklyTargetMinutes: minutesToHourInput(settings?.weeklyTargetMinutes ?? 2400),
    flexLimitMinutes: minutesToHourInput(settings?.flexLimitMinutes ?? 6000),
    flexStartMinutes: settings?.flexStartMinutes === null || settings?.flexStartMinutes === undefined ? "" : minutesToHourInput(settings.flexStartMinutes),
    vacationEntitlementMinutes: settings?.vacationEntitlementMinutes === null || settings?.vacationEntitlementMinutes === undefined ? "" : minutesToHourInput(settings.vacationEntitlementMinutes),
    vacationUsedMinutes: minutesToHourInput(settings?.vacationUsedMinutes ?? 0)
  };
}

function clampNumber(value: string, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(Math.max(Math.round(numeric), min), max);
}

function hoursToMinutes(value: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 60);
}

function clampHoursToMinutes(value: string, minMinutes: number, maxMinutes: number): number {
  return Math.min(Math.max(hoursToMinutes(value), minMinutes), maxMinutes);
}

function minutesToHourInput(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : String(Number(hours.toFixed(2)));
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

function ringProgress(minutes: number, targetMinutes: number): number {
  if (targetMinutes <= 0) return 0;
  return Math.min(Math.max(minutes / targetMinutes, 0), 1);
}

function liveClockStatus(day: ReturnType<typeof calculateDay>): string {
  if (!day.hasStart) return "Start fehlt";
  if (day.deltaMinutes > 0) return formatCompactSignedMinutes(day.deltaMinutes);
  if (day.deltaMinutes === 0) return "erfüllt";
  if (day.status === "running") return "läuft";
  return formatCompactSignedMinutes(day.deltaMinutes);
}

function formatCompactSignedMinutes(minutes: number): string {
  const sign = minutes > 0 ? "+" : "-";
  const absolute = Math.abs(Math.round(minutes));
  if (absolute < 60) return `${sign} ${absolute} min`;
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  return rest === 0 ? `${sign} ${hours} h` : `${sign} ${hours} h ${rest} min`;
}

function normalizeTimeInput(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  const colonMatch = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);
  const compactMatch = /^(\d{3,4})$/.exec(trimmed);
  if (!colonMatch && !compactMatch) return null;

  const hours = colonMatch ? Number(colonMatch[1]) : Number(trimmed.slice(0, -2));
  const minutes = colonMatch ? Number(colonMatch[2]) : Number(trimmed.slice(-2));
  if (hours > 23 || minutes > 59) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function previewTime(value: string): string | undefined {
  const normalized = normalizeTimeInput(value);
  return normalized === null || normalized === "" ? undefined : normalized;
}

function timeForSave(value: string, fallback?: string): string | undefined {
  const normalized = normalizeTimeInput(value);
  if (normalized === null) return fallback;
  return normalized || undefined;
}
