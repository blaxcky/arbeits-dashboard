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
            <span>Arbeitsdaten bleiben in IndexedDB auf diesem Geraet.</span>
          </div>
        </aside>
        <main className="workspace">
          {data.error ? <Notice tone="danger" title="Datenfehler" text={data.error} /> : null}
          <Routes>
            <Route path="/" element={<Dashboard data={data} />} />
            <Route path="/reisekosten" element={<RoadmapView title="Reisekosten" icon={<Briefcase size={28} />} items={["Reisen erfassen", "Fahrtkostenarten", "Diaeten", "Nachweise", "Jahresuebersicht"]} />} />
            <Route path="/aufgaben" element={<RoadmapView title="Aufgaben" icon={<ClipboardText size={28} />} items={["Aufgaben erfassen", "Faelligkeiten", "Prioritaeten", "Tags", "Filter und Suche"]} />} />
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
  const [message, setMessage] = useState<string | null>(null);
  const previewEntry = {
    date: selectedDate,
    startTime: form.startTime || undefined,
    endTime: form.endTime || undefined,
    breakMinutes: Number(form.breakMinutes) || 0,
    targetMinutes: Number(form.targetMinutes) || settings?.dailyTargetMinutes || 480
  };
  const day = calculateDay(previewEntry, data.clock);
  const week = calculateWeek(data.timeEntries, selectedDate, data.clock);
  const flex = settings ? calculateFlexBalance(settings.flexStartMinutes ?? 0, data.timeEntries, data.flexCorrections) : 0;
  const vacation = settings ? calculateVacation(settings.vacationEntitlementMinutes, settings.vacationUsedMinutes, settings.dailyTargetMinutes) : null;
  const requiredConsumption = settings && vacation ? calculateRequiredYearConsumption(vacation.remainingMinutes, flex, settings.flexLimitMinutes) : 0;
  const setupMissing = settings ? [settings.flexStartMinutes === null ? "Gleitzeitstartwert" : null, settings.vacationEntitlementMinutes === null ? "Urlaubsanspruch" : null].filter(Boolean) : [];

  useEffect(() => {
    setForm(entryToForm(entry, selectedDate, settings));
  }, [entry, selectedDate, settings]);

  async function save() {
    setMessage(null);
    await data.saveTimeEntry({
      date: selectedDate,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      breakMinutes: clampNumber(form.breakMinutes, 0, 720),
      targetMinutes: clampNumber(form.targetMinutes, 0, 900),
      note: form.note
    });
    setMessage("Zeiteintrag gespeichert.");
  }

  async function remove() {
    await data.removeTimeEntry(selectedDate);
    setMessage("Zeiteintrag geloescht.");
  }

  return (
    <section className="page-stack">
      <Header eyebrow="Dashboard" title="Zeiterfassung" description="Tagesdaten manuell pflegen, Live-Stand pruefen und Woche, Gleitzeit sowie Urlaub im Blick behalten." />
      {data.loading ? <SkeletonRows /> : null}
      {message ? <Notice tone="success" title="Status" text={message} /> : null}
      {setupMissing.length ? (
        <Notice
          tone="warning"
          title="Einrichtung offen"
          text={`${setupMissing.join(" und ")} fehlen noch. Die App bleibt nutzbar, rechnet aber mit neutralen Werten.`}
          action={<Link to="/einstellungen">Einstellungen oeffnen</Link>}
        />
      ) : null}
      <div className="dashboard-workflow-grid">
        <form className="panel form-panel day-entry-panel" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="panel-heading">
            <span className="section-label">Tageserfassung</span>
            <strong>{formatDateKey(selectedDate)}</strong>
          </div>
          <div className="date-row">
            <button type="button" className="secondary-button" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>Zurueck</button>
            <label>
              Datum
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
            <button type="button" className="secondary-button" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>Weiter</button>
          </div>
          <div className="form-grid">
            <Field label="Dienstbeginn"><input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></Field>
            <Field label="Dienstende"><input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></Field>
            <Field label="Pause in Minuten"><input type="number" min="0" max="720" value={form.breakMinutes} onChange={(event) => setForm({ ...form, breakMinutes: event.target.value })} /></Field>
            <Field label="Sollzeit in Minuten"><input type="number" min="0" max="900" value={form.targetMinutes} onChange={(event) => setForm({ ...form, targetMinutes: event.target.value })} /></Field>
          </div>
          <Field label="Notiz"><textarea rows={4} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
          <div className="button-row">
            <button className="primary-button" type="submit">Speichern</button>
            <button className="secondary-button" type="button" onClick={() => void remove()} disabled={!entry}>Loeschen</button>
          </div>
        </form>
        <aside className="panel live-panel dashboard-live-panel">
          <span className="section-label">Live-Auswertung</span>
          <strong>{formatMinutes(day.netMinutes)}</strong>
          <p>{day.hasStart ? `Soll-Ende ${day.targetEndTime}, Tagesstand ${formatSignedMinutes(day.deltaMinutes)}` : "Dienstbeginn fehlt."}</p>
          <dl className="detail-list">
            <div><dt>Status</dt><dd>{statusLabel(day.status)}</dd></div>
            <div><dt>Verwendetes Ende</dt><dd>{day.effectiveEndTime ?? "offen"}</dd></div>
            <div><dt>Inklusivpause</dt><dd>30 Minuten</dd></div>
          </dl>
        </aside>
        <div className="dashboard-side-grid">
          <Metric title="Woche" value={formatMinutes(week.workedMinutes)} detail={`${formatSignedMinutes(week.deltaMinutes)} zur Wochenbilanz`} />
          <Metric title="Gleitzeit" value={formatSignedMinutes(flex)} detail={`Grenze ${settings ? formatDecimalHours(settings.flexLimitMinutes) : "100,0 h"}`} tone={settings && flex > settings.flexLimitMinutes ? "warning" : "default"} />
          <Metric title="Resturlaub" value={vacation ? formatDays(vacation.remainingMinutes, settings?.dailyTargetMinutes) : "0,0 Tage"} detail={vacation ? formatMinutes(vacation.remainingMinutes) : "Noch nicht eingerichtet"} icon={<CalendarCheck size={22} />} />
          <Metric title="Dieses Jahr verbrauchen" value={formatMinutes(requiredConsumption)} detail="Resturlaub plus Gleitzeit ueber Grenze" />
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
      dailyTargetMinutes: clampNumber(form.dailyTargetMinutes, 1, 900),
      weeklyTargetMinutes: clampNumber(form.weeklyTargetMinutes, 1, 4000),
      flexLimitMinutes: clampNumber(form.flexLimitMinutes, 0, 20000),
      flexStartMinutes: form.flexStartMinutes === "" ? null : Number(form.flexStartMinutes),
      vacationEntitlementMinutes: form.vacationEntitlementMinutes === "" ? null : Number(form.vacationEntitlementMinutes),
      vacationUsedMinutes: clampNumber(form.vacationUsedMinutes, 0, 20000)
    });
    setNotice("Einstellungen gespeichert.");
  }

  async function handleImport(file: File, replace: boolean) {
    const payload = replace ? await importBackup(file) : await inspectBackup(file);
    setImportPreview(`Backup vom ${new Date(payload.manifest.exportedAt).toLocaleString("de-AT")} mit ${payload.data.timeEntries.length} Zeiteintraegen und ${payload.data.flexCorrections.length} Korrekturen.`);
    if (replace) {
      await data.refresh();
      setNotice("Backup importiert und lokale Daten ersetzt.");
    }
  }

  return (
    <section className="page-stack">
      <Header eyebrow="Einstellungen" title="Lokale Steuerzentrale" description="Arbeitszeit, Urlaub, Backup, PWA-Cache und Datenloeschung." />
      {notice ? <Notice tone="success" title="Status" text={notice} /> : null}
      <div className="settings-grid">
        <div className="panel form-panel">
          <span className="section-label">Arbeitszeit</span>
          <div className="form-grid">
            <Field label="Sollzeit pro Tag (Minuten)"><input type="number" value={form.dailyTargetMinutes} onChange={(event) => setForm({ ...form, dailyTargetMinutes: event.target.value })} /></Field>
            <Field label="Wochenarbeitszeit (Minuten)"><input type="number" value={form.weeklyTargetMinutes} onChange={(event) => setForm({ ...form, weeklyTargetMinutes: event.target.value })} /></Field>
            <Field label="Gleitzeitgrenze (Minuten)"><input type="number" value={form.flexLimitMinutes} onChange={(event) => setForm({ ...form, flexLimitMinutes: event.target.value })} /></Field>
            <Field label="Gleitzeitstartwert (Minuten)"><input type="number" value={form.flexStartMinutes} onChange={(event) => setForm({ ...form, flexStartMinutes: event.target.value })} placeholder="leer" /></Field>
            <Field label="Urlaubsanspruch (Minuten)"><input type="number" value={form.vacationEntitlementMinutes} onChange={(event) => setForm({ ...form, vacationEntitlementMinutes: event.target.value })} placeholder="leer" /></Field>
            <Field label="Verbrauchter Urlaub (Minuten)"><input type="number" value={form.vacationUsedMinutes} onChange={(event) => setForm({ ...form, vacationUsedMinutes: event.target.value })} /></Field>
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
          <UploadSimple size={18} /> Datei waehlen
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
            <button className="icon-button" title="Korrektur loeschen" onClick={() => void data.removeCorrection(correction.id)}>Entfernen</button>
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
      <p className="muted">Cache und Service Worker koennen ohne Datenverlust entfernt werden. Die lokale Datenloeschung ist separat.</p>
      <div className="button-row">
        <button className="secondary-button" onClick={async () => { await resetServiceWorkerAndCaches(); onDone("Cache und Service Worker wurden zurueckgesetzt."); window.location.reload(); }}>
          <ArrowClockwise size={18} /> Cache zuruecksetzen
        </button>
        <button className="danger-button" onClick={async () => { if (window.confirm("Vorher Backup exportieren. Wirklich alle lokalen Arbeitsdaten loeschen?")) { await data.wipeData(); onDone("Lokale Daten geloescht."); } }}>Lokale Daten loeschen</button>
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

function Metric({ title, value, detail, icon, tone = "default" }: { title: string; value: string; detail: string; icon?: React.ReactNode; tone?: "default" | "warning" | "danger" }) {
  return (
    <article className={`metric metric-${tone}`}>
      <div className="metric-title">{icon}{title}</div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
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
    dailyTargetMinutes: String(settings?.dailyTargetMinutes ?? 480),
    weeklyTargetMinutes: String(settings?.weeklyTargetMinutes ?? 2400),
    flexLimitMinutes: String(settings?.flexLimitMinutes ?? 6000),
    flexStartMinutes: settings?.flexStartMinutes === null || settings?.flexStartMinutes === undefined ? "" : String(settings.flexStartMinutes),
    vacationEntitlementMinutes: settings?.vacationEntitlementMinutes === null || settings?.vacationEntitlementMinutes === undefined ? "" : String(settings.vacationEntitlementMinutes),
    vacationUsedMinutes: String(settings?.vacationUsedMinutes ?? 0)
  };
}

function clampNumber(value: string, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(Math.max(Math.round(numeric), min), max);
}

function statusLabel(status: ReturnType<typeof calculateDay>["status"]): string {
  const labels = {
    "missing-start": "Dienstbeginn fehlt",
    running: "Laufender Tag",
    plus: "Plus",
    minus: "Minus",
    balanced: "Ausgeglichen"
  };
  return labels[status];
}
