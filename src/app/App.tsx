import {
  ArrowClockwise,
  Briefcase,
  CalendarCheck,
  CalendarPlus,
  ClipboardText,
  Database,
  DownloadSimple,
  Gear,
  House,
  ListChecks,
  X,
  UploadSimple,
  Warning
} from "@phosphor-icons/react";
import { type ClipboardEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HashRouter, Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import type { Settings, TimeEntry, Trip, TripFile, TripFileType, TripTransportType } from "../db/schema";
import { backupFileName, downloadBackup, importBackup, inspectBackup } from "../services/backup";
import { resetServiceWorkerAndCaches } from "../services/pwa";
import { addDays, currentYear, formatDateKey, isoWeekDays, todayKey, weekdayName } from "../lib/dates";
import { formatAbsoluteMinutes, formatDays, formatMinutes, formatSignedMinutes, formatWholeDays, minutesToHourInput, parseHoursToMinutes } from "../lib/format";
import {
  calculateDay,
  calculateFlexBalance,
  calculateNextVacationUsedMinutes,
  calculateRequiredYearConsumption,
  calculateVacation,
  calculateWeek,
  entriesForFlexBalance
} from "../modules/time/calculations";
import {
  calculateDomesticPerDiemCents,
  calculatePerDiemDifferentialCents,
  calculateTaxablePublicTransportSubsidyCents,
  calculateTaxPerDiemCents,
  calculateTransportDifferentialCents,
  calculateTripDifferentialCents,
  calculateTripDurationMinutes,
  calculateTripTotalCents,
  calculateTripTravelCostCents,
  isTransportSubsidy,
  remainingTransportSubsidyYearLimitCents,
  summarizeTripsByYear,
  TRANSPORT_LABELS,
  TRIP_RULES
} from "../modules/expenses/calculations";
import { APP_VERSION } from "../db/schema";
import { useWorkData } from "./useWorkData";

const navItems = [
  { to: "/", label: "Dashboard", icon: House },
  { to: "/reisekosten", label: "Reisekosten", icon: Briefcase },
  { to: "/aufgaben", label: "Aufgaben", icon: ListChecks },
  { to: "/einstellungen", label: "Einstellungen", icon: Gear }
];

const DEFAULT_TRIP_ORIGIN = "Finanzamt Österreich - Dienststelle Bruck Eisenstadt Oberwart, Neusiedler Str. 46, 7001 Eisenstadt";
type Toast = { id: string; text: string };

export function App() {
  const data = useWorkData();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((text: string) => {
    setToasts((current) => [...current, { id: crypto.randomUUID(), text }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

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
            <Route path="/" element={<Dashboard data={data} showToast={showToast} />} />
            <Route path="/reisekosten" element={<TripsView data={data} showToast={showToast} />} />
            <Route path="/aufgaben" element={<RoadmapView title="Aufgaben" icon={<ClipboardText size={28} />} items={["Aufgaben erfassen", "Fälligkeiten", "Prioritäten", "Tags", "Filter und Suche"]} />} />
            <Route path="/einstellungen" element={<SettingsView data={data} showToast={showToast} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastStack toasts={toasts} onRemove={removeToast} />
        </main>
      </div>
    </HashRouter>
  );
}

type WorkData = ReturnType<typeof useWorkData>;
type ShowToast = (message: string) => void;
type SettingsForm = ReturnType<typeof settingsToForm>;
type SettingsErrors = Partial<Record<keyof SettingsForm, string>>;

function Dashboard({ data, showToast }: { data: WorkData; showToast: ShowToast }) {
  const settings = data.settings;
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const entry = data.entriesByDate.get(selectedDate);
  const [form, setForm] = useState(() => entryToForm(entry, selectedDate, settings));
  const [timeErrors, setTimeErrors] = useState<Partial<Record<"startTime" | "endTime", string>>>({});
  const [breakError, setBreakError] = useState<string | undefined>();
  const previewEntry = {
    date: selectedDate,
    startTime: previewTime(form.startTime),
    endTime: previewTime(form.endTime),
    breakMinutes: Number(form.breakMinutes) || 0,
    targetMinutes: Number(form.targetMinutes) || settings?.dailyTargetMinutes || 480
  };
  const day = calculateDay(previewEntry, data.clock);
  const week = calculateWeek(data.timeEntries, selectedDate, data.clock);
  const flexEntries = entriesForFlexBalance(data.timeEntries, todayKey());
  const flex = settings ? calculateFlexBalance(settings.flexStartMinutes ?? 0, flexEntries, data.flexCorrections) : 0;
  const vacation = settings ? calculateVacation(settings.vacationEntitlementMinutes, settings.vacationUsedMinutes, settings.dailyTargetMinutes) : null;
  const requiredConsumption = settings && vacation ? calculateRequiredYearConsumption(vacation.remainingMinutes, flex, settings.flexLimitMinutes) : 0;
  const setupMissing = settings ? [settings.flexStartMinutes === null ? "Gleitzeitstartwert" : null, settings.vacationEntitlementMinutes === null ? "Urlaubsanspruch" : null].filter(Boolean) : [];
  const weeklyTargetMinutes = settings?.weeklyTargetMinutes ?? 2400;
  const weekDeltaToTarget = week.workedMinutes - weeklyTargetMinutes;
  const flexLimitMinutes = settings?.flexLimitMinutes ?? 6000;
  const flexDistanceToLimit = flexLimitMinutes - flex;
  const vacationEntitlementMinutes = vacation?.entitlementMinutes ?? 0;
  const dailyTargetMinutes = settings?.dailyTargetMinutes ?? 480;
  const breakField = (
    <Field label="Pause in Minuten" className="break-field" error={breakError}>
      <input
        type="number"
        min="0"
        max="720"
        value={form.breakMinutes}
        aria-invalid={Boolean(breakError)}
        onChange={(event) => {
          setBreakError(undefined);
          setForm({ ...form, breakMinutes: event.target.value });
        }}
        onBlur={(event) => void handleBreakBlur(event.target.value)}
      />
    </Field>
  );

  useEffect(() => {
    setForm(entryToForm(entry, selectedDate, settings));
    setTimeErrors({});
    setBreakError(undefined);
  }, [entry, selectedDate, settings]);

  async function autoSave(draft: ReturnType<typeof entryToForm>, createWhenEmpty = true) {
    const startTime = timeForSave(draft.startTime, entry?.startTime);
    const endTime = timeForSave(draft.endTime, entry?.endTime);
    if (!entry && !createWhenEmpty && !startTime && !endTime) return;
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
    const breakMinutes = parseIntegerInRange(value, 0, 720);
    if (breakMinutes === null) {
      setBreakError("Bitte 0 bis 720 Minuten eingeben.");
      return;
    }

    const normalized = String(breakMinutes);
    const draft = { ...form, breakMinutes: normalized };
    setForm(draft);
    setBreakError(undefined);
    await autoSave(draft);
  }

  async function remove() {
    await data.removeTimeEntry(selectedDate);
    showToast("Zeiteintrag gelöscht.");
  }

  async function bookVacationDay() {
    if (!settings) return;
    const minutesPerDay = settings.dailyTargetMinutes || 480;
    const entitlementMinutes = settings.vacationEntitlementMinutes ?? 0;
    const remainingMinutes = Math.max(entitlementMinutes - settings.vacationUsedMinutes, 0);
    if (entitlementMinutes <= 0 || remainingMinutes <= 0) return;
    const nextUsedMinutes = calculateNextVacationUsedMinutes(settings.vacationEntitlementMinutes, settings.vacationUsedMinutes, minutesPerDay);
    const bookedMinutes = nextUsedMinutes - settings.vacationUsedMinutes;
    await data.saveSettings({ vacationUsedMinutes: nextUsedMinutes });
    showToast(`Urlaub mit ${formatMinutes(bookedMinutes)} gebucht.`);
  }

  return (
    <section className="page-stack">
      <Header eyebrow="Dashboard" title="Zeiterfassung" description="Tagesdaten manuell pflegen, Live-Stand prüfen und Woche, Gleitzeit sowie Urlaub im Blick behalten." />
      {data.loading ? <SkeletonRows /> : null}
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
            <strong>{formatLongDateKey(selectedDate)}</strong>
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
            {breakField}
          </div>
        </form>
        <LiveDayClock day={day} targetMinutes={previewEntry.targetMinutes} />
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
            value={vacation ? formatWholeDays(vacation.remainingMinutes, dailyTargetMinutes) : "0 Tage"}
            detail={vacation && vacationEntitlementMinutes > 0 ? `${formatMinutes(vacation.remainingMinutes)} von ${formatMinutes(vacationEntitlementMinutes)} übrig` : "Noch nicht eingerichtet"}
            icon={<CalendarCheck size={22} />}
            action={
              <button className="icon-button metric-action" type="button" title="Urlaubstag buchen" aria-label="Urlaubstag buchen" onClick={() => void bookVacationDay()} disabled={!settings || vacationEntitlementMinutes <= 0 || (vacation?.remainingMinutes ?? 0) <= 0}>
                <CalendarPlus size={18} />
              </button>
            }
            progress={{ value: vacationEntitlementMinutes > 0 ? (vacation?.remainingMinutes ?? 0) / vacationEntitlementMinutes : 0, tone: "vacation" }}
          />
          <Metric title="Dieses Jahr verbrauchen" value={formatDays(requiredConsumption, dailyTargetMinutes)} detail="Resturlaub plus Gleitzeit über Grenze" />
        </div>
      </div>
      <WeekTable week={week} onWeekChange={(offsetDays) => setSelectedDate(addDays(selectedDate, offsetDays))} />
    </section>
  );
}

function SettingsView({ data, showToast }: { data: WorkData; showToast: ShowToast }) {
  const settings = data.settings;
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => settingsToForm(settings));
  const [settingsErrors, setSettingsErrors] = useState<SettingsErrors>({});
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null);

  useEffect(() => {
    setForm(settingsToForm(settings));
    setSettingsErrors({});
  }, [settings]);

  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    void navigator.storage.estimate().then(setStorageEstimate).catch(() => setStorageEstimate(null));
  }, [data.timeEntries.length, data.flexCorrections.length, settings?.updatedAt]);

  if (!settings) return <SkeletonRows />;

  async function saveSettings() {
    const nextErrors = validateSettingsForm(form);
    setSettingsErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await data.saveSettings({
      dailyTargetMinutes: clampHoursToMinutes(form.dailyTargetMinutes, 1, 900),
      weeklyTargetMinutes: clampHoursToMinutes(form.weeklyTargetMinutes, 1, 4000),
      flexLimitMinutes: clampHoursToMinutes(form.flexLimitMinutes, 0, 20000),
      flexStartMinutes: form.flexStartMinutes === "" ? null : hoursToMinutes(form.flexStartMinutes),
      vacationEntitlementMinutes: form.vacationEntitlementMinutes === "" ? null : hoursToMinutes(form.vacationEntitlementMinutes),
      vacationUsedMinutes: clampHoursToMinutes(form.vacationUsedMinutes, 0, 20000)
    });
    showToast("Einstellungen gespeichert.");
  }

  function updateSettingsField(field: keyof SettingsForm, value: string) {
    setSettingsErrors((current) => ({ ...current, [field]: undefined }));
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleImport(file: File, replace: boolean) {
    setImportPreview(null);
    const payload = replace ? await importBackup(file) : await inspectBackup(file);
    setImportPreview(`Backup vom ${new Date(payload.manifest.exportedAt).toLocaleString("de-AT")} mit ${payload.data.timeEntries.length} Zeiteinträgen und ${payload.data.flexCorrections.length} Korrekturen.`);
    if (replace) {
      await data.refresh();
      showToast("Backup importiert und lokale Daten ersetzt.");
    }
  }

  return (
    <section className="page-stack">
      <Header eyebrow="Einstellungen" title="Lokale Steuerzentrale" description="Arbeitszeit, Urlaub, Backup, PWA-Cache und Datenlöschung." />
      <div className="settings-grid">
        <div className="panel form-panel">
          <span className="section-label">Arbeitszeit</span>
          <div className="form-grid">
            <Field label="Sollzeit pro Tag (Stunden)" error={settingsErrors.dailyTargetMinutes}><input type="number" step="0.25" value={form.dailyTargetMinutes} aria-invalid={Boolean(settingsErrors.dailyTargetMinutes)} onChange={(event) => updateSettingsField("dailyTargetMinutes", event.target.value)} /></Field>
            <Field label="Wochenarbeitszeit (Stunden)" error={settingsErrors.weeklyTargetMinutes}><input type="number" step="0.25" value={form.weeklyTargetMinutes} aria-invalid={Boolean(settingsErrors.weeklyTargetMinutes)} onChange={(event) => updateSettingsField("weeklyTargetMinutes", event.target.value)} /></Field>
            <Field label="Gleitzeitgrenze (Stunden)" error={settingsErrors.flexLimitMinutes}><input type="number" step="0.25" value={form.flexLimitMinutes} aria-invalid={Boolean(settingsErrors.flexLimitMinutes)} onChange={(event) => updateSettingsField("flexLimitMinutes", event.target.value)} /></Field>
            <Field label="Gleitzeitstartwert (Stunden)" error={settingsErrors.flexStartMinutes}><input type="number" step="0.25" value={form.flexStartMinutes} aria-invalid={Boolean(settingsErrors.flexStartMinutes)} onChange={(event) => updateSettingsField("flexStartMinutes", event.target.value)} placeholder="leer" /></Field>
            <Field label="Urlaubsanspruch (Stunden)" error={settingsErrors.vacationEntitlementMinutes}><input type="number" step="0.25" value={form.vacationEntitlementMinutes} aria-invalid={Boolean(settingsErrors.vacationEntitlementMinutes)} onChange={(event) => updateSettingsField("vacationEntitlementMinutes", event.target.value)} placeholder="leer" /></Field>
            <Field label="Verbrauchter Urlaub (Stunden)" error={settingsErrors.vacationUsedMinutes}><input type="number" step="0.25" value={form.vacationUsedMinutes} aria-invalid={Boolean(settingsErrors.vacationUsedMinutes)} onChange={(event) => updateSettingsField("vacationUsedMinutes", event.target.value)} /></Field>
          </div>
          <button className="primary-button" onClick={() => void saveSettings()}>Einstellungen speichern</button>
        </div>
        <BackupPanel importRef={importRef} importPreview={importPreview} onPreview={(file) => handleImport(file, false)} onReplace={(file) => handleImport(file, true)} onDone={showToast} refresh={data.refresh} />
        <SystemStatusPanel data={data} storageEstimate={storageEstimate} />
        <CorrectionsPanel data={data} />
        <DangerPanel data={data} onDone={showToast} />
      </div>
    </section>
  );
}

function SystemStatusPanel({ data, storageEstimate }: { data: WorkData; storageEstimate: StorageEstimate | null }) {
  return (
    <div className="panel status-panel">
      <span className="section-label">Status</span>
      <dl className="detail-list">
        <div><dt>App-Version</dt><dd>{APP_VERSION}</dd></div>
        <div><dt>Speicher</dt><dd>{formatStorageEstimate(storageEstimate)}</dd></div>
        <div><dt>Zeiteinträge</dt><dd>{data.timeEntries.length}</dd></div>
        <div><dt>Gleitzeitkorrekturen</dt><dd>{data.flexCorrections.length}</dd></div>
      </dl>
    </div>
  );
}

function BackupPanel({ importRef, importPreview, onPreview, onReplace, onDone, refresh }: { importRef: React.RefObject<HTMLInputElement | null>; importPreview: string | null; onPreview: (file: File) => Promise<void>; onReplace: (file: File) => Promise<void>; onDone: (message: string) => void; refresh: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  async function handleExport() {
    try {
      setBackupError(null);
      await downloadBackup();
      onDone(`Backup ${backupFileName()} vorbereitet.`);
    } catch (error) {
      setBackupError(errorMessage(error, "Backup konnte nicht exportiert werden."));
    }
  }

  async function handlePreview(selected: File | null) {
    setFile(selected);
    setBackupError(null);
    if (!selected) return;
    try {
      await onPreview(selected);
    } catch (error) {
      setFile(null);
      setBackupError(errorMessage(error, "Backup konnte nicht geprüft werden."));
    }
  }

  async function handleReplace() {
    if (!file || !window.confirm("Dieses Backup ersetzt alle lokalen Daten. Fortfahren?")) return;
    try {
      setBackupError(null);
      await onReplace(file);
      await refresh();
    } catch (error) {
      setBackupError(errorMessage(error, "Backup konnte nicht importiert werden."));
    }
  }

  return (
    <div className="panel">
      <span className="section-label">Backup</span>
      <p className="muted">Exportiert wird eine ZIP-Datei mit Manifest und Daten. Import ersetzt nach Vorschau alle lokalen Daten.</p>
      <div className="button-row">
        <button className="primary-button" onClick={() => void handleExport()}>
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
          await handlePreview(selected);
          event.target.value = "";
        }}
      />
      {backupError ? <Notice tone="danger" title="Backup-Fehler" text={backupError} /> : null}
      {importPreview ? <Notice tone="warning" title="Import-Vorschau" text={importPreview} /> : null}
      <div className="backup-import-actions">
        <button className="danger-button" disabled={!file} onClick={() => void handleReplace()}>Backup importieren und ersetzen</button>
      </div>
    </div>
  );
}

function CorrectionsPanel({ data }: { data: WorkData }) {
  const flexEntries = entriesForFlexBalance(data.timeEntries, todayKey());
  const flex = data.settings ? calculateFlexBalance(data.settings.flexStartMinutes ?? 0, flexEntries, data.flexCorrections) : 0;
  const [form, setForm] = useState({ date: todayKey(), newValueHours: minutesToHourInput(flex), note: "" });
  const [valueError, setValueError] = useState<string | undefined>();

  async function saveCorrection() {
    const newValueMinutes = parseHoursToMinutes(form.newValueHours);
    if (newValueMinutes === null) {
      setValueError("Bitte Stunden eingeben, z.B. 97,34.");
      return;
    }

    setValueError(undefined);
    await data.addCorrection({ date: form.date, oldValueMinutes: flex, newValueMinutes, note: form.note });
    setForm({ date: todayKey(), newValueHours: minutesToHourInput(newValueMinutes), note: "" });
  }

  return (
    <div className="panel">
      <span className="section-label">Gleitzeitkorrekturen</span>
      <div className="form-grid">
        <Field label="Datum"><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
        <Field label="Neuer Gesamtwert (Stunden)" error={valueError}>
          <input
            type="text"
            inputMode="decimal"
            placeholder="97,34"
            value={form.newValueHours}
            aria-invalid={Boolean(valueError)}
            onChange={(event) => {
              setValueError(undefined);
              setForm({ ...form, newValueHours: event.target.value });
            }}
          />
        </Field>
      </div>
      <Field label="Grund oder Notiz"><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
      <button className="secondary-button" onClick={() => void saveCorrection()}>Korrektur speichern</button>
      <div className="correction-list">
        {data.flexCorrections.length === 0 ? <p className="muted">Noch keine Korrekturen.</p> : null}
        {data.flexCorrections.map((correction) => (
          <div key={correction.id} className="correction-row">
            <span>{formatDateKey(correction.date)}</span>
            <span className="correction-value">
              <strong>{formatMinutes(correction.newValueMinutes)}</strong>
              <small>Korrektur {formatSignedMinutes(correction.diffMinutes)}</small>
            </span>
            <button className="icon-button" title="Korrektur löschen" onClick={() => void data.removeCorrection(correction.id)}>Entfernen</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DangerPanel({ data, onDone }: { data: WorkData; onDone: (message: string) => void }) {
  const [deleteUnlocked, setDeleteUnlocked] = useState(false);

  async function handleWipeData() {
    if (!deleteUnlocked) return;

    try {
      if (!window.confirm("Vorher Backup exportieren. Wirklich alle lokalen Arbeitsdaten löschen?")) return;

      const typed = window.prompt("Bitte LÖSCHEN eingeben, um die lokale Datenlöschung zu bestätigen.");
      if (typed !== "LÖSCHEN") return;

      if (!window.confirm("Letzte Bestätigung: Lokale Arbeitsdaten endgültig löschen?")) return;

      await data.wipeData();
      onDone("Lokale Daten gelöscht.");
    } finally {
      setDeleteUnlocked(false);
    }
  }

  return (
    <div className="panel danger-panel">
      <span className="section-label">Reset</span>
      <p className="muted">Cache und Service Worker können ohne Datenverlust entfernt werden. Die lokale Datenlöschung ist separat.</p>
      <div className="button-row">
        <button className="secondary-button" onClick={async () => { await resetServiceWorkerAndCaches(); onDone("Cache und Service Worker wurden zurückgesetzt."); window.location.reload(); }}>
          <ArrowClockwise size={18} /> Cache zurücksetzen
        </button>
      </div>
      <div className="locked-delete-box">
        <button className="secondary-button" type="button" onClick={() => setDeleteUnlocked(true)} disabled={deleteUnlocked}>
          Löschen entsperren
        </button>
        <button className="danger-button" type="button" disabled={!deleteUnlocked} onClick={() => void handleWipeData()}>
          Lokale Daten löschen
        </button>
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

const transportOptions: TripTransportType[] = ["kilometergeld", "befoerderungszuschuss", "oeffi-zuschuss", "dienstauto", "sonstige"];

function TripsView({ data, showToast }: { data: WorkData; showToast: ShowToast }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => tripToForm());
  const [tripTimeErrors, setTripTimeErrors] = useState<Partial<Record<"startTime" | "endTime", string>>>({});
  const [mapPreviewOpen, setMapPreviewOpen] = useState(false);
  const [largeMapPreviewOpen, setLargeMapPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<TripFile | null>(null);
  const previewStartTime = previewTime(form.startTime) ?? "";
  const previewEndTime = previewTime(form.endTime) ?? "";
  const previewDurationMinutes = calculateTripDurationMinutes(previewStartTime, previewEndTime);
  const previewTripCosts = {
    transportType: form.transportType,
    oneWayKilometers: parseDecimalNumber(form.oneWayKilometers),
    perDiemCents: calculateDomesticPerDiemCents(previewDurationMinutes),
    otherCostsCents: eurosToCents(form.otherCostsEuros),
    ticketPriceCents: form.transportType === "oeffi-zuschuss" ? eurosToCents(form.ticketPriceEuros) : 0,
    transportSubsidyTaxCents: eurosToCents(form.transportSubsidyTaxEuros)
  };
  const summary = summarizeTripsByYear(data.trips, currentYear());
  const previewTravelCostCents = calculateTripTravelCostCents(previewTripCosts);
  const previewTaxPerDiemCents = calculateTaxPerDiemCents(previewDurationMinutes);
  const previewPerDiemDifferentialCents = calculatePerDiemDifferentialCents(previewDurationMinutes, previewTripCosts.perDiemCents);
  const previewTransportDifferentialCents = calculateTransportDifferentialCents(previewTripCosts);
  const previewTaxableTransportSubsidyCents = calculateTaxablePublicTransportSubsidyCents(previewTripCosts);
  const previewDifferentialCents = calculateTripDifferentialCents({ ...previewTripCosts, durationMinutes: previewDurationMinutes });
  const transportSubsidyRemainingCents = remainingTransportSubsidyYearLimitCents(summary.transportSubsidyCents);
  const mapsUrl = buildGoogleMapsUrl(form.origin, form.destination);
  const mapsEmbedUrl = buildGoogleMapsEmbedUrl(form.origin, form.destination);
  const needsKilometerEvidence = form.transportType === "kilometergeld";
  const needsPublicTransportEvidence = form.transportType === "oeffi-zuschuss";
  const editingTrip = editingId ? data.trips.find((trip) => trip.id === editingId) : undefined;
  const filesByTripId = useMemo(() => {
    const grouped = new Map<string, TripFile[]>();
    data.files.forEach((file) => {
      const tripFiles = grouped.get(file.tripId) ?? [];
      tripFiles.push(file);
      grouped.set(file.tripId, tripFiles);
    });
    return grouped;
  }, [data.files]);
  const currentTripFiles = editingTrip ? filesByTripId.get(editingTrip.id) ?? [] : [];

  useEffect(() => {
    if (editingTrip) setForm(tripToForm(editingTrip));
  }, [editingTrip]);

  useEffect(() => {
    if (!mapsEmbedUrl) setMapPreviewOpen(false);
  }, [mapsEmbedUrl]);

  useEffect(() => {
    if (!mapsEmbedUrl) setLargeMapPreviewOpen(false);
  }, [mapsEmbedUrl]);

  useEffect(() => {
    if (!previewFile) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewFile(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewFile]);

  useEffect(() => {
    if (previewFile && !data.files.some((file) => file.id === previewFile.id)) {
      setPreviewFile(null);
    }
  }, [data.files, previewFile]);

  function updateTripField(field: keyof ReturnType<typeof tripToForm>, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleTripTimeBlur(field: "startTime" | "endTime", value: string) {
    const normalized = normalizeTimeInput(value);
    if (normalized === null || normalized === "") {
      setTripTimeErrors((current) => ({ ...current, [field]: "Bitte als HH:MM eingeben, z.B. 07:30." }));
      return;
    }

    setForm((current) => ({ ...current, [field]: normalized }));
    setTripTimeErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function saveTrip() {
    const startTime = normalizeTimeInput(form.startTime);
    const endTime = normalizeTimeInput(form.endTime);
    const nextErrors: Partial<Record<"startTime" | "endTime", string>> = {};
    if (!startTime) nextErrors.startTime = "Bitte als HH:MM eingeben, z.B. 07:30.";
    if (!endTime) nextErrors.endTime = "Bitte als HH:MM eingeben, z.B. 15:30.";
    if (!startTime || !endTime) {
      setTripTimeErrors(nextErrors);
      return;
    }

    const durationMinutes = calculateTripDurationMinutes(startTime, endTime);
    const perDiemCents = calculateDomesticPerDiemCents(durationMinutes);
    await data.saveTrip({
      id: editingId ?? undefined,
      date: form.date,
      startTime,
      endTime,
      durationMinutes,
      reason: form.reason.trim(),
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      transportType: form.transportType,
      oneWayKilometers: parseDecimalNumber(form.oneWayKilometers),
      perDiemCents,
      otherCostsCents: eurosToCents(form.otherCostsEuros),
      otherCostsDescription: form.otherCostsDescription.trim(),
      ticketPriceCents: previewTripCosts.ticketPriceCents,
      taxableTransportSubsidyCents: previewTaxableTransportSubsidyCents,
      transportSubsidyTaxCents: eurosToCents(form.transportSubsidyTaxEuros),
      note: form.note.trim(),
      done: form.done
    });
    setEditingId(null);
    setForm(tripToForm());
    setTripTimeErrors({});
    showToast("Reise gespeichert.");
  }

  function editTrip(trip: Trip) {
    setEditingId(trip.id);
    setForm(tripToForm(trip));
    setTripTimeErrors({});
  }

  async function removeTrip(id: string) {
    if (!window.confirm("Diese Reise löschen?")) return;
    await data.removeTrip(id);
    if (editingId === id) {
      setEditingId(null);
      setForm(tripToForm());
    }
    showToast("Reise gelöscht.");
  }

  async function toggleDone(trip: Trip) {
    await data.saveTrip({ ...stripTripMeta(trip), id: trip.id, done: !trip.done });
  }

  function openGoogleMaps() {
    if (!mapsUrl) return;
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  }

  async function saveTripScreenshot(trip: Trip, file: File) {
    if (!file.type.startsWith("image/")) {
      showToast("Bitte ein Bild als Screenshot einfügen oder auswählen.");
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    await data.saveTripFile({
      tripId: trip.id,
      type: evidenceTypeForTrip(trip),
      fileName: file.name || `screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
      mimeType: file.type,
      size: file.size,
      dataUrl,
      description: evidenceDescriptionForTrip(trip)
    });
    showToast("Screenshot gespeichert.");
  }

  async function uploadTripScreenshot(trip: Trip | undefined, fileList: FileList | null) {
    if (!trip) {
      showToast("Reise zuerst speichern, dann Screenshots hinzufügen.");
      return;
    }
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Bitte ein Bild als Screenshot einfügen oder auswählen.");
      return;
    }

    await saveTripScreenshot(trip, file);
  }

  async function pasteTripScreenshot(event: ClipboardEvent<HTMLElement>) {
    if (!editingTrip) {
      showToast("Reise zuerst speichern, dann Screenshots hinzufügen.");
      return;
    }

    const imageItem = [...event.clipboardData.items].find((item) => item.type.startsWith("image/"));
    if (!imageItem) {
      showToast("Bitte ein Bild als Screenshot einfügen oder auswählen.");
      return;
    }

    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) {
      showToast("Bitte ein Bild als Screenshot einfügen oder auswählen.");
      return;
    }

    await saveTripScreenshot(editingTrip, file);
  }

  function downloadTripFile(file: TripFile) {
    const anchor = document.createElement("a");
    anchor.href = file.dataUrl;
    anchor.download = file.fileName;
    anchor.click();
  }

  async function removeTripFile(file: TripFile) {
    if (!window.confirm(`Screenshot "${file.fileName}" löschen?`)) return;
    await data.removeTripFile(file.id);
    if (previewFile?.id === file.id) setPreviewFile(null);
    showToast("Screenshot gelöscht.");
  }

  return (
    <section className="page-stack">
      <Header eyebrow="Reisekosten" title="Reisen erfassen" description="Dienstreisen lokal dokumentieren, Fahrtkostenarten zuordnen und Jahreswerte im Blick behalten." />
      <div className={`split-grid trips-layout ${largeMapPreviewOpen && mapsEmbedUrl ? "trips-layout-map-open" : ""}`}>
        <div className="panel form-panel">
          <div className="panel-heading">
            <span className="section-label">{editingId ? "Reise bearbeiten" : "Neue Reise"}</span>
            {editingId ? <button className="secondary-button" onClick={() => { setEditingId(null); setForm(tripToForm()); }}>Neu</button> : null}
          </div>
          <div className="form-grid trip-form-grid">
            <section className="trip-form-section" aria-labelledby="trip-section-dates">
              <h3 id="trip-section-dates" className="trip-form-section-title">Reisedaten</h3>
              <Field label="Grund" className="field-wide"><input value={form.reason} onChange={(event) => updateTripField("reason", event.target.value)} /></Field>
              <Field label="Datum"><input type="date" value={form.date} onChange={(event) => updateTripField("date", event.target.value)} /></Field>
              <Field label="Zeit von" error={tripTimeErrors.startTime}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="07:30"
                  value={form.startTime}
                  aria-invalid={Boolean(tripTimeErrors.startTime)}
                  onChange={(event) => updateTripField("startTime", event.target.value)}
                  onBlur={(event) => handleTripTimeBlur("startTime", event.target.value)}
                />
              </Field>
              <Field label="Zeit bis" error={tripTimeErrors.endTime}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="15:30"
                  value={form.endTime}
                  aria-invalid={Boolean(tripTimeErrors.endTime)}
                  onChange={(event) => updateTripField("endTime", event.target.value)}
                  onBlur={(event) => handleTripTimeBlur("endTime", event.target.value)}
                />
              </Field>
            </section>
            <section className="trip-form-section" aria-labelledby="trip-section-route">
              <h3 id="trip-section-route" className="trip-form-section-title">Route</h3>
              <Field label="Startort" className="trip-field-half"><AutoFitInput value={form.origin} onChange={(value) => updateTripField("origin", value)} /></Field>
              <Field label="Zieladresse" className="trip-field-half"><AutoFitInput value={form.destination} onChange={(value) => updateTripField("destination", value)} /></Field>
              <Field label="Einfache Strecke (km)" className="trip-field-half"><input inputMode="decimal" placeholder="0" value={form.oneWayKilometers} onChange={(event) => updateTripField("oneWayKilometers", event.target.value)} /></Field>
            </section>
            <section className="trip-form-section" aria-labelledby="trip-section-costs">
              <h3 id="trip-section-costs" className="trip-form-section-title">Fahrtkosten</h3>
              <Field label="Fahrtkostenart" className="trip-field-half">
                <select value={form.transportType} onChange={(event) => updateTripField("transportType", event.target.value as TripTransportType)}>
                  {transportOptions.map((option) => <option key={option} value={option}>{TRANSPORT_LABELS[option]}</option>)}
                </select>
              </Field>
              <Field label="Ticketpreis (EUR)" className="trip-field-half trip-cost-field"><input inputMode="decimal" value={form.ticketPriceEuros} disabled={form.transportType !== "oeffi-zuschuss"} onChange={(event) => updateTripField("ticketPriceEuros", event.target.value)} /></Field>
              <Field label="Bezahlte Steuer (EUR)" className="trip-field-half"><input inputMode="decimal" value={form.transportSubsidyTaxEuros} onChange={(event) => updateTripField("transportSubsidyTaxEuros", event.target.value)} /></Field>
            </section>
            <section className="trip-form-section" aria-labelledby="trip-section-other">
              <h3 id="trip-section-other" className="trip-form-section-title">Sonstiges</h3>
              <Field label="Sonstige Kosten (EUR)" className="trip-field-half"><input inputMode="decimal" value={form.otherCostsEuros} onChange={(event) => updateTripField("otherCostsEuros", event.target.value)} /></Field>
              <Field label="Beschreibung sonstige Kosten" className="trip-field-half"><input value={form.otherCostsDescription} onChange={(event) => updateTripField("otherCostsDescription", event.target.value)} /></Field>
              <Field label="Notiz" className="field-wide"><textarea value={form.note} rows={3} onChange={(event) => updateTripField("note", event.target.value)} /></Field>
            </section>
          </div>
          <section className="trip-preview" aria-label="Kennzahlen-Vorschau">
            <div className="trip-preview-group trip-preview-group-primary">
              <span className="trip-preview-title">Reise</span>
              <dl className="trip-preview-list">
                <div><dt>Dauer</dt><dd>{formatMinutes(previewDurationMinutes)}</dd></div>
                {previewTripCosts.oneWayKilometers > 0 ? (
                  <div><dt>Kilometer gesamt</dt><dd>{(previewTripCosts.oneWayKilometers * 2).toLocaleString("de-AT", { maximumFractionDigits: 1 })} km</dd></div>
                ) : null}
                <div className="trip-preview-total"><dt>Gesamt</dt><dd>{formatEuroCents(calculateTripTotalCents(previewTripCosts))}</dd></div>
              </dl>
            </div>
            <div className="trip-preview-group">
              <span className="trip-preview-title">Kosten</span>
              <dl className="trip-preview-list">
                <div><dt>Fahrtkosten</dt><dd>{formatEuroCents(previewTravelCostCents)}</dd></div>
                <div><dt>Diäten Arbeitgeber</dt><dd>{formatEuroCents(previewTripCosts.perDiemCents)}</dd></div>
                <div><dt>Sonstige Kosten</dt><dd>{formatEuroCents(previewTripCosts.otherCostsCents)}</dd></div>
              </dl>
            </div>
            <div className="trip-preview-group trip-preview-group-tax">
              <span className="trip-preview-title">Steuer & Differenz</span>
              <dl className="trip-preview-list">
                <div><dt>Diäten steuerlich</dt><dd>{formatEuroCents(previewTaxPerDiemCents)}</dd></div>
                <div><dt>Steuerpfl. Öffi-BEZU</dt><dd>{formatEuroCents(previewTaxableTransportSubsidyCents)}</dd></div>
                <div><dt>Differenz Diäten</dt><dd>{formatEuroCents(previewPerDiemDifferentialCents)}</dd></div>
                <div><dt>Differenz Fahrtkosten</dt><dd>{formatEuroCents(previewTransportDifferentialCents)}</dd></div>
                <div><dt>Differenz gesamt</dt><dd>{formatEuroCents(previewDifferentialCents)}</dd></div>
              </dl>
            </div>
          </section>
          <div className="trip-helper-grid">
            {mapsUrl ? (
              <div className="button-row trip-map-actions">
                <button className="secondary-button" type="button" onClick={openGoogleMaps}>Google Maps öffnen</button>
                <button className="secondary-button" type="button" onClick={() => setMapPreviewOpen((open) => !open)} disabled={!mapsEmbedUrl}>
                  {mapPreviewOpen ? "Vorschau schließen" : "Vorschau öffnen"}
                </button>
                <button className="secondary-button" type="button" onClick={() => setLargeMapPreviewOpen((open) => !open)} disabled={!mapsEmbedUrl}>
                  {largeMapPreviewOpen ? "Große Vorschau schließen" : "Große Vorschau"}
                </button>
              </div>
            ) : <span className="muted">Google-Maps-Link erscheint nach Startort und Zieladresse.</span>}
            {needsKilometerEvidence ? <span className="inline-warning">Nachweis: Screenshot, dass kein Dienstauto frei war.</span> : null}
            {needsPublicTransportEvidence ? <span className="inline-warning">Nachweis: ÖBB-Verbindungskosten zeitnah sichern.</span> : null}
          </div>
          {mapPreviewOpen && mapsEmbedUrl ? (
            <div className="map-preview">
              <div className="panel-heading">
                <span className="section-label">Google-Maps-Vorschau</span>
                <button className="icon-button" type="button" title="Vorschau schließen" aria-label="Vorschau schließen" onClick={() => setMapPreviewOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <iframe
                title="Google-Maps-Vorschau"
                src={mapsEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          ) : null}
          <section
            className={`trip-form-evidence ${editingTrip ? "" : "trip-form-evidence-disabled"}`.trim()}
            aria-labelledby="trip-form-evidence-title"
            tabIndex={editingTrip ? 0 : -1}
            onPaste={(event) => void pasteTripScreenshot(event)}
          >
            <div className="trip-evidence-heading">
              <div>
                <span id="trip-form-evidence-title" className="section-label">Screenshots / Nachweise</span>
                <p className="muted">{editingTrip ? "Bereich fokussieren und Screenshot mit Strg+V oder Cmd+V einfügen." : "Reise zuerst speichern, dann Screenshots hinzufügen."}</p>
              </div>
              {editingTrip ? (
                <label className="secondary-button file-upload-button">
                  <UploadSimple size={17} />
                  Datei auswählen
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      void uploadTripScreenshot(editingTrip, event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              ) : null}
            </div>
            {editingTrip && currentTripFiles.length === 0 ? <span className="muted">Noch kein Screenshot gespeichert.</span> : null}
            {currentTripFiles.map((file) => (
              <div key={file.id} className="trip-evidence-item">
                <button className="trip-evidence-preview-button" type="button" onClick={() => setPreviewFile(file)}>
                  <img src={file.dataUrl} alt="" />
                  <span>
                    <strong>{file.fileName}</strong>
                    <small>{tripFileTypeLabel(file.type)} · {formatFileSize(file.size)}</small>
                  </span>
                </button>
                <div className="trip-evidence-actions">
                  <button className="secondary-button" type="button" onClick={() => downloadTripFile(file)}>
                    <DownloadSimple size={17} />
                    Herunterladen
                  </button>
                  <button className="danger-button" type="button" onClick={() => void removeTripFile(file)}>Löschen</button>
                </div>
              </div>
            ))}
          </section>
          <label className="check-row"><input type="checkbox" checked={form.done} onChange={(event) => updateTripField("done", event.target.checked)} /> Erledigt</label>
          <button className="primary-button" onClick={() => void saveTrip()}>{editingId ? "Änderungen speichern" : "Reise speichern"}</button>
        </div>
        <div className={`trip-side-layout ${largeMapPreviewOpen && mapsEmbedUrl ? "trip-side-layout-map-open" : ""}`}>
          <div className="panel">
            <div className="trip-summary-panel">
              <span className="section-label">Jahresübersicht {summary.year}</span>
              <dl className="detail-list">
                <div><dt>Reisen</dt><dd>{summary.count}</dd></div>
                <div><dt>Erledigt</dt><dd>{summary.doneCount}</dd></div>
                <div><dt>Dauer</dt><dd>{formatMinutes(summary.durationMinutes)}</dd></div>
                <div><dt>Kilometer</dt><dd>{summary.kilometers.toLocaleString("de-AT", { maximumFractionDigits: 1 })} km</dd></div>
                <div><dt>Reisekosten gesamt</dt><dd>{formatEuroCents(summary.totalCents)}</dd></div>
                <div><dt>BEZU Jahresstand</dt><dd>{formatEuroCents(summary.transportSubsidyCents)}</dd></div>
                <div><dt>BEZU Restgrenze</dt><dd>{formatEuroCents(transportSubsidyRemainingCents)}</dd></div>
                <div><dt>Differenz Diäten</dt><dd>{formatEuroCents(summary.perDiemDifferentialCents)}</dd></div>
                <div><dt>Differenz Fahrtkosten</dt><dd>{formatEuroCents(summary.transportDifferentialCents)}</dd></div>
                <div><dt>Differenz gesamt</dt><dd>{formatEuroCents(summary.differentialCents)}</dd></div>
              </dl>
              <div className="limit-bar" aria-label={`Beförderungszuschuss Jahresgrenze: ${formatEuroCents(summary.transportSubsidyCents)} von ${formatEuroCents(TRIP_RULES.transportSubsidyYearLimitCents)}`}>
                <span style={{ width: `${Math.min(summary.transportSubsidyCents / TRIP_RULES.transportSubsidyYearLimitCents, 1) * 100}%` }} />
              </div>
              {transportSubsidyRemainingCents < 0 ? <Notice tone="warning" title="BEZU-Grenze überschritten" text={`Die Jahresgrenze ist um ${formatEuroCents(Math.abs(transportSubsidyRemainingCents))} überschritten.`} /> : null}
              <p className="muted">Kilometergeld, Beförderungszuschüsse, Arbeitgeber-Diäten und steuerliche Vergleichswerte werden automatisch berechnet. Sonstige Kosten und bezahlte Steuer bleiben manuelle Eingaben.</p>
            </div>
          </div>
          {largeMapPreviewOpen && mapsEmbedUrl ? (
            <div className="panel large-map-card">
              <div className="large-map-preview">
                <div className="panel-heading">
                  <span className="section-label">Große Google-Maps-Vorschau</span>
                  <button className="icon-button" type="button" title="Große Vorschau schließen" aria-label="Große Vorschau schließen" onClick={() => setLargeMapPreviewOpen(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div className="large-map-route">
                  <div>
                    <span>Startort</span>
                    <strong>{form.origin.trim()}</strong>
                  </div>
                  <div>
                    <span>Zieladresse</span>
                    <strong>{form.destination.trim()}</strong>
                  </div>
                  {form.oneWayKilometers.trim() ? (
                    <div>
                      <span>Einfache Strecke</span>
                      <strong>{form.oneWayKilometers.trim()} km</strong>
                    </div>
                  ) : null}
                </div>
                <iframe
                  title="Große Google-Maps-Vorschau"
                  src={mapsEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
                <button className="secondary-button map-external-button" type="button" onClick={openGoogleMaps}>Extern in Google Maps öffnen</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <span className="section-label">Erfasste Reisen</span>
          <strong>{data.trips.length}</strong>
        </div>
        <div className="trip-list">
          {data.trips.length === 0 ? <p className="muted">Noch keine Reisen erfasst.</p> : null}
          {data.trips.map((trip) => (
            <article key={trip.id} className={`trip-row ${trip.done ? "trip-row-done" : ""}`}>
              <div>
                <strong>{formatDateKey(trip.date)} · {trip.reason || "Ohne Grund"}</strong>
                <span>{trip.origin || "-"} → {trip.destination || "-"} · {TRANSPORT_LABELS[trip.transportType]}</span>
                {trip.note ? <span>{trip.note}</span> : null}
              </div>
              <div className="trip-row-metrics">
                <span>{formatMinutes(trip.durationMinutes)}</span>
                <span>{(trip.oneWayKilometers * 2).toLocaleString("de-AT", { maximumFractionDigits: 1 })} km</span>
                <strong>{formatEuroCents(calculateTripTotalCents(trip))}</strong>
                <small>Diff. {formatEuroCents(calculateTripDifferentialCents(trip))}</small>
              </div>
              <div className="trip-actions">
                <button className="secondary-button" onClick={() => void toggleDone(trip)}>{trip.done ? "Offen" : "Erledigt"}</button>
                <button className="secondary-button" onClick={() => editTrip(trip)}>Bearbeiten</button>
                <button className="danger-button" onClick={() => void removeTrip(trip.id)}>Löschen</button>
              </div>
            </article>
          ))}
        </div>
      </div>
      {previewFile ? (
        <div className="trip-file-modal" role="dialog" aria-modal="true" aria-labelledby="trip-file-preview-title" onClick={() => setPreviewFile(null)}>
          <div className="trip-file-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <span id="trip-file-preview-title" className="section-label">Screenshot-Vorschau</span>
                <strong>{previewFile.fileName}</strong>
              </div>
              <button className="icon-button" type="button" title="Vorschau schließen" aria-label="Vorschau schließen" onClick={() => setPreviewFile(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="trip-file-preview-frame">
              <img src={previewFile.dataUrl} alt={previewFile.fileName} />
            </div>
            <div className="trip-file-preview-meta">
              <span>{tripFileTypeLabel(previewFile.type)}</span>
              <span>{formatFileSize(previewFile.size)}</span>
            </div>
            <div className="trip-evidence-actions">
              <button className="secondary-button" type="button" onClick={() => downloadTripFile(previewFile)}>
                <DownloadSimple size={17} />
                Herunterladen
              </button>
              <button className="danger-button" type="button" onClick={() => void removeTripFile(previewFile)}>Löschen</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function WeekTable({ week, onWeekChange }: { week: ReturnType<typeof calculateWeek>; onWeekChange: (offsetDays: number) => void }) {
  return (
    <div className="panel">
      <div className="panel-heading week-heading">
        <div>
          <span className="section-label">Woche ab {formatDateKey(week.weekStart)}</span>
          <div className="week-summary">
            <strong>{formatSignedMinutes(week.deltaMinutes)}</strong>
            <span>Plus {formatMinutes(week.plusMinutes)}</span>
            <span>Minus {formatMinutes(week.minusMinutes)}</span>
          </div>
        </div>
        <div className="week-nav">
          <button type="button" className="secondary-button" onClick={() => onWeekChange(-7)}>Vorwoche</button>
          <button type="button" className="secondary-button" onClick={() => onWeekChange(7)}>Folgewoche</button>
        </div>
      </div>
      <div className="week-table">
        {week.days.map((day) => (
          <div key={day.date} className="week-row">
            <span>{weekdayName(day.date)}</span>
            <span>{formatDateKey(day.date)}</span>
            <span>{day.entry?.startTime ?? "-"}</span>
            <span>{day.entry?.endTime ?? "offen"}</span>
            <strong className={`week-delta week-delta-${deltaTone(day.calculation.deltaMinutes)}`}>{formatAbsoluteMinutes(day.calculation.deltaMinutes)}</strong>
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

function Metric({ title, value, detail, icon, action, tone = "default", progress }: { title: string; value: string; detail: string; icon?: React.ReactNode; action?: React.ReactNode; tone?: "default" | "warning" | "danger"; progress?: MetricProgress }) {
  const progressValue = progress ? clampProgress(progress.value) : 0;
  const overflowValue = progress?.overflow ? clampProgress(progress.overflow) : 0;

  return (
    <article className={`metric metric-${tone}`}>
      <div className="metric-title-row">
        <div className="metric-title">{icon}{title}</div>
        {action}
      </div>
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
  const remainingMinutes = Math.max(targetMinutes - day.netMinutes, 0);
  const ariaLabel = day.hasStart
    ? `Live-Auswertung: ${formatMinutes(remainingMinutes)} verbleibend, bereits gearbeitet ${formatMinutes(day.netMinutes)}.`
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
          <strong>{day.hasStart ? formatMinutes(remainingMinutes) : formatMinutes(targetMinutes)}</strong>
          <span>{centerStatus}</span>
        </div>
      </div>
      <dl className="detail-list live-clock-details">
        <div><dt>arbeiten bis</dt><dd>{day.hasStart ? day.targetEndTime : "-"}</dd></div>
        <div><dt>bereits gearbeitet</dt><dd>{day.hasStart ? formatMinutes(day.netMinutes) : "-"}</dd></div>
      </dl>
      <p className="live-clock-meta">Verwendetes Ende: {day.hasStart ? day.effectiveEndTime ?? "offen" : "-"}</p>
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

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />)}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onRemove(toast.id), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast.id, onRemove]);

  return (
    <div className="toast" role="status">
      <strong>Status</strong>
      <span>{toast.text}</span>
    </div>
  );
}

function Field({ label, children, error, className = "" }: { label: string; children: React.ReactNode; error?: string; className?: string }) {
  return <label className={`field ${className}`.trim()}><span>{label}</span>{children}{error ? <small className="field-error">{error}</small> : null}</label>;
}

function AutoFitInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(16);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const measure = measureRef.current;
    if (!input || !measure) return;

    const updateFontSize = () => {
      const availableWidth = input.clientWidth - 26;
      if (availableWidth <= 0) return;
      measure.textContent = value || input.placeholder || "";
      const fullSizeWidth = measure.scrollWidth;
      const nextFontSize = fullSizeWidth > availableWidth ? Math.max(8, Math.floor((availableWidth / fullSizeWidth) * 16)) : 16;
      setFontSize(nextFontSize);
    };

    updateFontSize();
    const observer = new ResizeObserver(updateFontSize);
    observer.observe(input);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span className="auto-fit-input-wrap">
      <input
        ref={inputRef}
        className="auto-fit-input"
        style={{ fontSize: `${fontSize}px` }}
        value={value}
        title={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span ref={measureRef} className="auto-fit-measure" aria-hidden="true" />
    </span>
  );
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

function tripToForm(trip?: Trip) {
  return {
    date: trip?.date ?? todayKey(),
    startTime: trip?.startTime ?? "",
    endTime: trip?.endTime ?? "",
    reason: trip?.reason ?? "",
    origin: trip?.origin ?? DEFAULT_TRIP_ORIGIN,
    destination: trip?.destination ?? "",
    transportType: trip?.transportType ?? "kilometergeld" as TripTransportType,
    oneWayKilometers: trip ? String(trip.oneWayKilometers) : "",
    otherCostsEuros: trip ? centsToEuroInput(trip.otherCostsCents) : "0",
    otherCostsDescription: trip?.otherCostsDescription ?? "",
    ticketPriceEuros: trip ? centsToEuroInput(trip.ticketPriceCents ?? 0) : "0",
    transportSubsidyTaxEuros: trip ? centsToEuroInput(trip.transportSubsidyTaxCents ?? 0) : "0",
    note: trip?.note ?? "",
    done: trip?.done ?? false
  };
}

function stripTripMeta(trip: Trip): Omit<Trip, "id" | "createdAt" | "updatedAt"> {
  return {
    date: trip.date,
    startTime: trip.startTime,
    endTime: trip.endTime,
    durationMinutes: trip.durationMinutes,
    reason: trip.reason,
    origin: trip.origin,
    destination: trip.destination,
    transportType: trip.transportType,
    oneWayKilometers: trip.oneWayKilometers,
    perDiemCents: trip.perDiemCents,
    otherCostsCents: trip.otherCostsCents,
    otherCostsDescription: trip.otherCostsDescription ?? "",
    ticketPriceCents: trip.ticketPriceCents ?? 0,
    taxableTransportSubsidyCents: trip.taxableTransportSubsidyCents ?? 0,
    transportSubsidyTaxCents: trip.transportSubsidyTaxCents ?? 0,
    note: trip.note ?? "",
    done: trip.done
  };
}

function validateSettingsForm(form: SettingsForm): SettingsErrors {
  const errors: SettingsErrors = {};
  const fields: Array<[keyof SettingsForm, string | undefined]> = [
    ["dailyTargetMinutes", validateHourField(form.dailyTargetMinutes, 1, 900)],
    ["weeklyTargetMinutes", validateHourField(form.weeklyTargetMinutes, 1, 4000)],
    ["flexLimitMinutes", validateHourField(form.flexLimitMinutes, 0, 20000)],
    ["flexStartMinutes", validateHourField(form.flexStartMinutes, -20000, 20000, true)],
    ["vacationEntitlementMinutes", validateHourField(form.vacationEntitlementMinutes, 0, 20000, true)],
    ["vacationUsedMinutes", validateHourField(form.vacationUsedMinutes, 0, 20000)]
  ];

  for (const [field, error] of fields) {
    if (error) errors[field] = error;
  }

  return errors;
}

function validateHourField(value: string, minMinutes: number, maxMinutes: number, optional = false): string | undefined {
  const trimmed = value.trim();
  if (optional && trimmed === "") return undefined;
  const minutes = parseHoursToMinutes(value);
  if (minutes === null || minutes < minMinutes || minutes > maxMinutes) {
    return `Bitte ${minutesToHourInput(minMinutes)} bis ${minutesToHourInput(maxMinutes)} Stunden eingeben.`;
  }
  return undefined;
}

function clampNumber(value: string, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(Math.max(Math.round(numeric), min), max);
}

function parseIntegerInRange(value: string, min: number, max: number): number | null {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) return null;
  return numeric;
}

function hoursToMinutes(value: string): number {
  return parseHoursToMinutes(value) ?? 0;
}

function clampHoursToMinutes(value: string, minMinutes: number, maxMinutes: number): number {
  return Math.min(Math.max(hoursToMinutes(value), minMinutes), maxMinutes);
}

function parseDecimalNumber(value: string): number {
  const numeric = Number(value.trim().replace(",", "."));
  return Number.isFinite(numeric) ? Math.max(numeric, 0) : 0;
}

function eurosToCents(value: string): number {
  return Math.round(parseDecimalNumber(value) * 100);
}

function centsToEuroInput(cents: number): string {
  return (cents / 100).toLocaleString("de-AT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatEuroCents(cents: number): string {
  return `${(cents / 100).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function formatLongDateKey(dateKey: string): string {
  return `${weekdayName(dateKey)}, ${formatDateKey(dateKey).replace(/^[^,]+,\s*/, "")}`;
}

function deltaTone(minutes: number): "plus" | "minus" | "zero" {
  if (minutes > 0) return "plus";
  if (minutes < 0) return "minus";
  return "zero";
}

function buildGoogleMapsUrl(origin: string, destination: string): string | null {
  const trimmedOrigin = origin.trim();
  const trimmedDestination = destination.trim();
  if (!trimmedOrigin || !trimmedDestination) return null;
  const params = new URLSearchParams({
    api: "1",
    origin: trimmedOrigin,
    destination: trimmedDestination
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildGoogleMapsEmbedUrl(origin: string, destination: string): string | null {
  const trimmedOrigin = origin.trim();
  const trimmedDestination = destination.trim();
  if (!trimmedOrigin || !trimmedDestination) return null;
  const query = encodeURIComponent(`${trimmedOrigin} nach ${trimmedDestination}`);
  return `https://www.google.com/maps?q=${query}&output=embed`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Datei konnte nicht gelesen werden."));
    });
    reader.addEventListener("error", () => reject(new Error("Datei konnte nicht gelesen werden.")));
    reader.readAsDataURL(file);
  });
}

function evidenceTypeForTrip(trip: Trip): TripFileType {
  if (trip.transportType === "kilometergeld") return "dienstauto-nachweis";
  if (trip.transportType === "oeffi-zuschuss") return "oebb-verbindungskosten";
  return "sonstiger-beleg";
}

function evidenceDescriptionForTrip(trip: Trip): string {
  if (trip.transportType === "kilometergeld") return "Screenshot, dass kein Dienstauto frei war.";
  if (trip.transportType === "oeffi-zuschuss") return "Screenshot der ÖBB-Verbindungskosten.";
  return "Beleg oder Screenshot zur Reise.";
}

function tripFileTypeLabel(type: TripFileType): string {
  if (type === "dienstauto-nachweis") return "Dienstauto-Nachweis";
  if (type === "oebb-verbindungskosten") return "ÖBB-Verbindungskosten";
  return "Sonstiger Beleg";
}

function formatFileSize(bytes: number): string {
  return formatBytes(bytes);
}

function formatStorageEstimate(estimate: StorageEstimate | null): string {
  if (!estimate?.usage) return "lokal";
  const usage = formatBytes(estimate.usage);
  return estimate.quota ? `${usage} von ${formatBytes(estimate.quota)}` : usage;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toLocaleString("de-AT", { maximumFractionDigits: unitIndex === 0 ? 0 : 1 })} ${units[unitIndex]}`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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

export function normalizeTimeInput(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  const hourMatch = /^(\d{1,2})$/.exec(trimmed);
  const colonMatch = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);
  const compactMatch = /^(\d{3,4})$/.exec(trimmed);
  if (!hourMatch && !colonMatch && !compactMatch) return null;

  const hours = hourMatch ? Number(hourMatch[1]) : colonMatch ? Number(colonMatch[1]) : Number(trimmed.slice(0, -2));
  const minutes = hourMatch ? 0 : colonMatch ? Number(colonMatch[2]) : Number(trimmed.slice(-2));
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
