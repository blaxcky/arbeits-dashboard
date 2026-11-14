import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlannedAbsence, TravelExpensePayment, Trip, TripFile } from "../db/schema";

const pwaRegistration = vi.hoisted(() => ({
  options: undefined as { onNeedRefresh?: () => void } | undefined,
  updateServiceWorker: vi.fn<() => Promise<void>>()
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (options: { onNeedRefresh?: () => void }) => {
    pwaRegistration.options = options;
    return {
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: pwaRegistration.updateServiceWorker
    };
  }
}));

const workData = vi.hoisted(() => ({
  loading: false,
  error: null,
  clock: new Date("2026-08-08T10:00:00.000Z"),
  settings: {
    id: "main",
    dailyTargetMinutes: 480,
    weeklyTargetMinutes: 2400,
    flexLimitMinutes: 6000,
    flexStartMinutes: null,
    preferredWorkStartTime: null,
    preferredWorkEndTime: null,
    vacationEntitlementMinutes: null,
    vacationUsedMinutes: 0,
    publicTransportTaxFreeYearLimitsCents: {},
    updatedAt: "2026-08-08T08:00:00.000Z"
  },
  timeEntries: [],
  entriesByDate: new Map(),
  flexCorrections: [],
  trips: [] as Trip[],
  tripPayments: [] as TravelExpensePayment[],
  auditPointCases: [],
  auditPointGoals: [],
  usoCases: [],
  usoGoals: [],
  otherMeasures: [],
  files: [] as TripFile[],
  savedDestinations: [],
  todos: [],
  todoProjects: [],
  plannedAbsences: [] as PlannedAbsence[],
  lastBookedAbsences: [] as PlannedAbsence[],
  planAbsence: vi.fn(),
  removePlannedAbsence: vi.fn(),
  setAbsenceStatus: vi.fn(),
  bookAbsences: vi.fn(),
  refresh: vi.fn(),
  saveTimeEntry: vi.fn(),
  removeTimeEntry: vi.fn(),
  saveSettings: vi.fn(),
  addCorrection: vi.fn(),
  removeCorrection: vi.fn(),
  wipeData: vi.fn(),
  saveTodo: vi.fn(),
  completeTodo: vi.fn(),
  removeTodo: vi.fn(),
  saveTodoProject: vi.fn(),
  removeTodoProject: vi.fn(),
  saveTrip: vi.fn(),
  saveTripFile: vi.fn(),
  removeTripFile: vi.fn(),
  saveDestination: vi.fn(),
  removeDestination: vi.fn(),
  removeTrip: vi.fn(),
  saveTripPayment: vi.fn(),
  removeTripPayment: vi.fn()
}));

vi.mock("./useWorkData", () => ({ useWorkData: () => workData }));

import { App, openTripFields, tripEvidenceFileName } from "./App";

describe("task workspace dashboard navigation", () => {
  beforeEach(() => {
    pwaRegistration.updateServiceWorker.mockReset();
    window.localStorage.clear();
    window.location.hash = "#/aufgaben/heute";
  });

  afterEach(() => {
    window.location.hash = "";
  });

  it("labels the case and year overview navigation entries explicitly", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: "Fallübersicht" })).toHaveAttribute("href", "#/punkte");
    expect(screen.getByRole("link", { name: "Punkte - Jahresübersicht" })).toHaveAttribute("href", "#/punkte/jahr");
    expect(screen.getByRole("link", { name: "Reisen - Jahresübersicht" })).toHaveAttribute("href", "#/reisekosten/jahr");
  });

  it("hides only the outer dashboard navigation and remembers the choice", () => {
    const { unmount } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Dashboard-Navigation einklappen" }));

    expect(document.getElementById("dashboard-navigation")).toHaveAttribute("hidden");
    expect(screen.getByRole("complementary", { name: "Aufgabennavigation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Dashboard-Navigation ausklappen" })).toHaveAttribute("aria-expanded", "false");

    unmount();
    render(<App />);
    expect(screen.getByRole("button", { name: "Dashboard-Navigation ausklappen" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dashboard-Navigation ausklappen" }));
    expect(screen.getByRole("complementary", { name: "Hauptnavigation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Dashboard-Navigation einklappen" })).toHaveAttribute("aria-expanded", "true");
  });
});

describe("vacation planning", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "#/urlaub";
    workData.planAbsence.mockReset();
    workData.setAbsenceStatus.mockReset();
    workData.plannedAbsences = [];
  });

  afterEach(() => {
    window.location.hash = "";
    workData.plannedAbsences = [];
  });

  it("links the year planning from the dashboard navigation", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: /Urlaub - Jahresplanung/ })).toHaveAttribute("href", "#/urlaub");
    expect(screen.getByRole("heading", { name: "Jahresplanung" })).toBeInTheDocument();
  });

  it("only plans vacation by day instead of booking it manually on the dashboard", () => {
    window.location.hash = "#/";
    render(<App />);

    expect(screen.queryByRole("button", { name: /Urlaubstag buchen/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Urlaub planen" })).toHaveAttribute("href", "#/urlaub");
  });

  it("plans a free working day as vacation or flex day from the calendar", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Mo 10.08.: frei, als Urlaub planen" }));
    expect(workData.planAbsence).toHaveBeenCalledWith("2026-08-10", "vacation");

    fireEvent.click(screen.getByRole("button", { name: /Gleittag/, pressed: false }));
    fireEvent.click(screen.getByRole("button", { name: "Di 11.08.: frei, als Gleittag planen" }));
    expect(workData.planAbsence).toHaveBeenCalledWith("2026-08-11", "flex");
    expect(screen.getByRole("button", { name: "Sa 15.08.: Feiertag (Mariä Himmelfahrt)" })).toBeDisabled();
  });

  it("reminds on every page to request a planned day and marks it as requested", () => {
    workData.plannedAbsences = [{ id: "a1", date: "2026-08-14", type: "vacation", status: "planned", createdAt: "", updatedAt: "" }];
    window.location.hash = "#/einstellungen";
    render(<App />);

    const alert = screen.getByText("Urlaub Fr 14.08. – dringend beantragen").closest(".absence-alert") as HTMLElement;
    expect(alert).toHaveTextContent("Nur noch 6 Tage bis zum ersten Tag.");
    fireEvent.click(within(alert).getByRole("button", { name: "Im System beantragt" }));
    expect(workData.setAbsenceStatus).toHaveBeenCalledWith(["a1"], "requested");
    expect(screen.getByRole("link", { name: /Urlaub - Jahresplanung/ })).toHaveTextContent("1");
  });

  it("exports planned days as an Outlook calendar file", async () => {
    workData.plannedAbsences = [{ id: "a1", date: "2026-12-21", type: "vacation", status: "planned", createdAt: "", updatedAt: "" }];
    const createObjectURL = vi.fn(() => "blob:ics");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Für Outlook exportieren/ }));

    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe("text/calendar;charset=utf-8");
    expect(await blob.text()).toContain("DTSTART;VALUE=DATE:20261221");
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it("disables the Outlook export without planned days", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /Für Outlook exportieren/ })).toBeDisabled();
  });

  it("groups consecutive planned days into one request with its reminder date", () => {
    workData.plannedAbsences = [
      { id: "a1", date: "2026-12-21", type: "vacation", status: "planned", createdAt: "", updatedAt: "" },
      { id: "a2", date: "2026-12-22", type: "vacation", status: "planned", createdAt: "", updatedAt: "" }
    ];
    render(<App />);

    const request = screen.getByText("Mo 21.12. – Di 22.12.").closest("li") as HTMLElement;
    expect(request).toHaveTextContent("Urlaub · 2 Tage");
    expect(request).toHaveTextContent("Ab Mo 07.12.");
    expect(screen.queryByText(/jetzt beantragen/)).not.toBeInTheDocument();
  });
});

describe("time tracking dashboard", () => {
  const entries = [
    { id: "a", date: "2026-08-03", startTime: "07:30", endTime: "15:45", breakMinutes: 30, targetMinutes: 480, note: "", createdAt: "", updatedAt: "" },
    { id: "b", date: "2026-08-04", startTime: "07:30", endTime: "15:00", breakMinutes: 30, targetMinutes: 480, note: "", createdAt: "", updatedAt: "" }
  ];

  beforeEach(() => {
    window.location.hash = "#/";
    workData.timeEntries = entries as never;
    workData.entriesByDate = new Map(entries.map((entry) => [entry.date, entry])) as never;
    workData.saveTimeEntry.mockReset();
  });

  afterEach(() => {
    window.location.hash = "";
    workData.timeEntries = [];
    workData.entriesByDate = new Map();
  });

  it("links open setup items from the sidebar instead of a page notice", () => {
    render(<App />);

    const setupLink = screen.getByRole("link", { name: /Einrichtung offen/ });
    expect(setupLink).toHaveAttribute("href", "#/einstellungen");
    expect(setupLink).toHaveTextContent("Gleitzeitstartwert und Urlaubsanspruch fehlen noch.");
  });

  it("shows the working week as a timeline with totals and opens a day on click", () => {
    render(<App />);

    const week = screen.getByRole("region", { name: "Wochenübersicht" });
    expect(within(week).getByText("Woche 32 · 03.–07.08.2026")).toBeInTheDocument();
    expect(within(week).getByText("+0:15 h")).toBeInTheDocument();
    expect(within(week).getByText("-0:15 h")).toBeInTheDocument();
    expect(within(week).getByText("15:45 h")).toBeInTheDocument();

    fireEvent.click(within(week).getByRole("button", { name: /Mo 03\.08\./ }));

    expect(screen.getByText("Montag, 03.08.2026 · KW 32")).toBeInTheDocument();
    expect(screen.getByLabelText("Dienstbeginn")).toHaveValue("07:30");
    expect(screen.getByText("8:15 h gearbeitet")).toBeInTheDocument();
    expect(within(week).getByRole("button", { name: /Mo 03\.08\./ })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the end of the working day and the running day in the week", () => {
    const previousClock = workData.clock;
    const running = { id: "c", date: "2026-08-06", startTime: "07:30", breakMinutes: 30, targetMinutes: 480, note: "", createdAt: "", updatedAt: "" };
    workData.clock = new Date(2026, 7, 6, 12, 0);
    workData.timeEntries = [...entries, running] as never;
    workData.entriesByDate = new Map([...entries, running].map((entry) => [entry.date, entry])) as never;

    try {
      render(<App />);

      const dayCard = screen.getByRole("form", { name: "Tageserfassung" });
      expect(within(dayCard).getByText("Feierabend um")).toBeInTheDocument();
      expect(within(dayCard).getAllByText("15:30").length).toBeGreaterThan(0);
      expect(within(dayCard).getByText("noch 3:30 h")).toBeInTheDocument();
      expect(within(screen.getByRole("region", { name: "Wochenübersicht" })).getByText("bis 15:30")).toBeInTheDocument();
    } finally {
      workData.clock = previousClock;
    }
  });

  it("saves the break immediately when using the stepper", async () => {
    render(<App />);

    fireEvent.click(within(screen.getByRole("region", { name: "Wochenübersicht" })).getByRole("button", { name: /Di 04\.08\./ }));
    fireEvent.click(screen.getByRole("button", { name: "Pause um 5 Minuten verlängern" }));

    await waitFor(() => expect(workData.saveTimeEntry).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-08-04", breakMinutes: 35 })));
  });
});

describe("PWA updates", () => {
  beforeEach(() => {
    pwaRegistration.options = undefined;
    pwaRegistration.updateServiceWorker.mockReset();
    pwaRegistration.updateServiceWorker.mockResolvedValue();
    window.location.hash = "#/";
  });

  afterEach(() => {
    window.location.hash = "";
  });

  it("does not show an update notice before an update is detected", () => {
    render(<App />);

    expect(screen.queryByRole("region", { name: "App-Update" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Jetzt aktualisieren" })).not.toBeInTheDocument();
  });

  it.each(["#/", "#/einstellungen", "#/aufgaben/heute"])("shows a detected update globally on route %s", (route) => {
    window.location.hash = route;
    render(<App />);

    act(() => pwaRegistration.options?.onNeedRefresh?.());

    const notice = screen.getByRole("region", { name: "App-Update" });
    expect(notice).toHaveTextContent("Update verfügbar");
    expect(notice).toHaveTextContent("Eine neue Version ist bereit.");
    expect(screen.getByRole("button", { name: "Jetzt aktualisieren" })).toBeEnabled();
  });

  it("applies the registered update exactly once and disables the button while it is loading", () => {
    let finishUpdate: (() => void) | undefined;
    pwaRegistration.updateServiceWorker.mockReturnValue(new Promise((resolve) => {
      finishUpdate = resolve;
    }));
    render(<App />);
    act(() => pwaRegistration.options?.onNeedRefresh?.());

    fireEvent.click(screen.getByRole("button", { name: "Jetzt aktualisieren" }));

    expect(pwaRegistration.updateServiceWorker).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Update wird geladen …" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Update wird geladen …" }));
    expect(pwaRegistration.updateServiceWorker).toHaveBeenCalledTimes(1);
    finishUpdate?.();
  });

  it("keeps the notice open and allows retrying when the update fails", async () => {
    pwaRegistration.updateServiceWorker.mockRejectedValueOnce(new Error("Aktivierung fehlgeschlagen"));
    render(<App />);
    act(() => pwaRegistration.options?.onNeedRefresh?.());

    fireEvent.click(screen.getByRole("button", { name: "Jetzt aktualisieren" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Jetzt aktualisieren" })).toBeEnabled());
    expect(screen.getByRole("region", { name: "App-Update" })).toBeVisible();
    expect(screen.getByText("Update konnte nicht geladen werden. Bitte erneut versuchen.")).toBeVisible();
  });
});

describe("settings layout", () => {
  beforeEach(() => {
    window.location.hash = "#/einstellungen";
  });

  afterEach(() => {
    window.location.hash = "";
  });

  it("groups all settings panels in their mobile reading order", () => {
    render(<App />);

    const workGroup = screen.getByRole("region", { name: "Arbeitszeit & Saldo" });
    const systemGroup = screen.getByRole("region", { name: "Daten & System" });

    expect(workGroup.querySelectorAll(":scope > .panel")).toHaveLength(2);
    expect(systemGroup.querySelectorAll(":scope > .panel")).toHaveLength(3);
    expect(Array.from(document.querySelectorAll(".section-label"), (label) => label.textContent)).toEqual([
      "Arbeitszeit",
      "Gleitzeitkorrekturen",
      "Backup",
      "Status",
      "Reset"
    ]);
  });
});

describe("Google Maps route action", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    window.location.hash = "#/reisekosten";
  });

  afterEach(() => {
    window.location.hash = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows only the external Maps action for a complete route and opens it in a new tab", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Startort"), { target: { value: "Eisenstadt Finanzamt" } });
    fireEvent.change(screen.getByLabelText("Zieladresse"), { target: { value: "Stephansplatz 1, 1010 Wien" } });
    fireEvent.click(screen.getByRole("radio", { name: "Dienstauto" }));

    const mapsButton = screen.getByRole("button", { name: "Google Maps öffnen" });
    expect(mapsButton).toBeInTheDocument();
    expect(mapsButton).toBeEnabled();
    expect(screen.getByLabelText("Einfache Strecke (km)").parentElement).toContainElement(mapsButton);
    expect(screen.getAllByRole("button", { name: "Google Maps öffnen" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Vorschau öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Große Vorschau" })).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
    expect(document.querySelector(".trip-helper-grid")).not.toBeInTheDocument();

    fireEvent.click(mapsButton);

    expect(openSpy).toHaveBeenCalledWith(
      "https://www.google.com/maps/dir/?api=1&origin=Eisenstadt+Finanzamt&destination=Stephansplatz+1%2C+1010+Wien",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("keeps the Maps action disabled without rendering route helper notices", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Startort"), { target: { value: "Eisenstadt Finanzamt" } });

    expect(screen.queryByText("Google-Maps-Link erscheint nach Startort und Zieladresse.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nachweis: Screenshot, dass kein Dienstauto frei war.")).not.toBeInTheDocument();
    expect(document.querySelector(".trip-helper-grid")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google Maps öffnen" })).toBeDisabled();
    expect(screen.getByLabelText("Einfache Strecke (km)").parentElement).toContainElement(
      screen.getByRole("button", { name: "Google Maps öffnen" })
    );
    expect(screen.queryByRole("button", { name: "Vorschau öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Große Vorschau" })).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("places a labelled new-trip action in the page header and resets the form", () => {
    render(<App />);

    const header = screen.getByRole("heading", { name: "Reise erfassen" }).closest("header") as HTMLElement;
    const newTripButton = within(header).getByRole("button", { name: "Neue Reise" });

    expect(newTripButton).toHaveAttribute("type", "button");
    expect(newTripButton).toHaveClass("primary-button");
    expect(newTripButton).toHaveTextContent("Neue Reise");
    expect(within(header).getByRole("link", { name: "Reisen - Jahresübersicht" })).toHaveAttribute("href", "#/reisekosten/jahr");
    expect(screen.getAllByRole("button", { name: "Neue Reise" })).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Zeit von"), { target: { value: "08:15" } });
    fireEvent.click(newTripButton);

    expect(screen.getByLabelText("Zeit von")).toHaveValue("");
  });

  it("shows the default origin read-only until it is changed", () => {
    render(<App />);

    const origin = screen.getByLabelText("Startort");
    expect(origin).toHaveAttribute("readonly");
    expect((origin as HTMLTextAreaElement).value).toContain("Finanzamt Österreich");

    fireEvent.click(screen.getByRole("button", { name: "Startort ändern" }));

    expect(screen.getByLabelText("Startort")).not.toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Startort ändern" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Startort")).toHaveFocus();

    fireEvent.blur(screen.getByLabelText("Startort"));

    expect(screen.getByLabelText("Startort")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Startort ändern" })).toBeInTheDocument();
  });

  it("chooses the transport type with labelled options and shows ticket fields only for public transport", () => {
    render(<App />);

    expect(screen.getByRole("group", { name: "Fahrtkostenart" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Kilometergeld" })).toBeChecked();
    expect(screen.queryByLabelText("Ticketpreis je Richtung (EUR)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("ÖBB-Abfrage am")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Beförderungszuschuss Öffis" }));

    expect(screen.getByRole("radio", { name: "Beförderungszuschuss Öffis" })).toBeChecked();
    expect(screen.getByLabelText("Ticketpreis je Richtung (EUR)")).toBeEnabled();
    expect(screen.getByLabelText("ÖBB-Abfrage am")).toBeEnabled();
  });
});

describe("travel expense view", () => {
  const baseTrip: Trip = {
    id: "trip-open",
    date: "2026-08-08",
    startTime: "07:30",
    endTime: "15:30",
    durationMinutes: 480,
    reason: "Besprechung",
    origin: "Eisenstadt",
    destination: "Wien",
    transportType: "dienstauto",
    oneWayKilometers: 50,
    perDiemCents: 0,
    otherCostsCents: 0,
    otherCostsDescription: "",
    employerReimbursedCosts: true,
    taxableTransportSubsidyCents: 0,
    transportSubsidyTaxCents: 0,
    note: "",
    done: false,
    createdAt: "2026-08-08T06:00:00.000Z",
    updatedAt: "2026-08-08T06:00:00.000Z"
  };

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    workData.trips = [baseTrip, { ...baseTrip, id: "trip-done", reason: "Nachbesprechung", done: true }];
    workData.files = [];
    workData.saveTrip.mockReset();
    workData.saveTrip.mockResolvedValue(undefined);
    workData.saveTripFile.mockReset();
    workData.saveTripFile.mockResolvedValue(undefined);
    workData.removeTripFile.mockReset();
    workData.removeTripFile.mockResolvedValue(undefined);
    workData.removeTrip.mockReset();
    workData.removeTrip.mockResolvedValue(undefined);
    window.location.hash = "#/reisekosten";
  });

  afterEach(() => {
    workData.trips = [];
    workData.files = [];
    window.location.hash = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the trip form state in the page title", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Reise erfassen" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Bearbeiten" })[0]);

    expect(screen.getByRole("heading", { name: "Reise bearbeiten" })).toBeInTheDocument();
    expect(screen.queryByText("Reise bearbeiten", { selector: ".section-label" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Neue Reise" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Reise erfassen" })).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Bearbeiten" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Speichern und Schließen" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Reise erfassen" })).toBeInTheDocument());
  });

  it("renders only the current cost analysis and keeps the completed checkbox", () => {
    render(<App />);

    expect(screen.getAllByText("Aktuelle Kostenauswertung")).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Kennzahlen-Vorschau" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Erledigt" })).toBeInTheDocument();
  });

  it.each(["Kilometergeld", "Beförderungszuschuss", "Beförderungszuschuss Öffis", "Dienstauto", "Sonstige Kosten"])(
    "shows all three screenshot areas for transport type %s",
    (transportLabel) => {
      render(<App />);
      fireEvent.click(screen.getByRole("radio", { name: transportLabel }));

      for (const name of ["Google Maps", "Ticketpreis", "Sonstige Screenshots"]) {
        expect(screen.getByRole("region", { name })).toBeInTheDocument();
      }
    }
  );

  it("assigns pasted images by hover first and keyboard focus second", async () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Bearbeiten" })[0]);
    const mapsZone = screen.getByRole("region", { name: "Google Maps" });
    const ticketZone = screen.getByRole("region", { name: "Ticketpreis" });
    const screenshot = new File(["image-content"], "route.webp", { type: "image/webp" });
    const clipboardData = { items: [{ type: "image/webp", getAsFile: () => screenshot }] };

    fireEvent.focus(mapsZone);
    fireEvent.mouseEnter(ticketZone);
    fireEvent.paste(window, { clipboardData });

    await waitFor(() => expect(workData.saveTripFile).toHaveBeenCalledWith(expect.objectContaining({
      tripId: baseTrip.id,
      type: "oebb-verbindungskosten",
      fileName: "route.webp",
      mimeType: "image/webp",
      description: "Screenshot des Ticketpreises.",
      dataUrl: expect.stringMatching(/^data:image\/webp;base64,/)
    })));

    fireEvent.mouseLeave(ticketZone);
    fireEvent.paste(window, { clipboardData });
    await waitFor(() => expect(workData.saveTripFile).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "google-maps-nachweis",
      description: "Screenshot der Route in Google Maps."
    })));
    unmount();
  });

  it("does not save a paste without an active screenshot area", async () => {
    render(<App />);
    const screenshot = new File(["image"], "unassigned.png", { type: "image/png" });

    fireEvent.paste(window, { clipboardData: { items: [{ type: "image/png", getAsFile: () => screenshot }] } });

    expect(await screen.findByText(
      "Zum Einfügen zuerst den gewünschten Screenshot-Bereich fokussieren oder mit der Maus darauf zeigen.",
      { selector: ".toast span" }
    )).toBeInTheDocument();
    expect(workData.saveTripFile).not.toHaveBeenCalled();
  });

  it("supports image selection and blocks invalid files, invalid dates, and unsaved trips", async () => {
    const { unmount } = render(<App />);
    const disabledMapsInput = screen.getByLabelText("Google Maps: Datei auswählen");
    expect(disabledMapsInput).toBeDisabled();

    const disabledMapsZone = screen.getByRole("region", { name: "Google Maps" });
    fireEvent.mouseEnter(disabledMapsZone);
    fireEvent.paste(window, { clipboardData: { items: [] } });
    expect(await screen.findByText("Reise zuerst speichern, dann Screenshots hinzufügen.", { selector: ".toast span" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Bearbeiten" })[0]);
    const mapsInput = screen.getByLabelText("Google Maps: Datei auswählen");
    const invalidFile = new File(["plain"], "not-image.txt", { type: "text/plain" });
    fireEvent.change(mapsInput, { target: { files: [invalidFile] } });
    expect(await screen.findByText("Bitte ein Bild als Screenshot einfügen oder auswählen.", { selector: ".toast span" })).toBeInTheDocument();
    expect(workData.saveTripFile).not.toHaveBeenCalled();

    const image = new File(["image"], "map.jpg", { type: "image/jpeg" });
    fireEvent.change(mapsInput, { target: { files: [image] } });
    await waitFor(() => expect(workData.saveTripFile).toHaveBeenCalledWith(expect.objectContaining({ type: "google-maps-nachweis", fileName: "map.jpg" })));

    fireEvent.change(screen.getByLabelText("Datum"), { target: { value: "" } });
    expect(screen.getByLabelText("Google Maps: Datei auswählen")).toBeDisabled();
    const mapsZone = screen.getByRole("region", { name: "Google Maps" });
    fireEvent.mouseEnter(mapsZone);
    fireEvent.paste(window, { clipboardData: { items: [{ type: "image/jpeg", getAsFile: () => image }] } });
    expect(await screen.findByText("Bitte zuerst ein gültiges Reisedatum eingeben und speichern.", { selector: ".toast span" })).toBeInTheDocument();
    unmount();
  });

  it("groups existing evidence and keeps preview, download, and deletion actions", async () => {
    const files: TripFile[] = [
      { id: "maps", tripId: baseTrip.id, type: "google-maps-nachweis", fileName: "route.jpg", mimeType: "image/jpeg", size: 100, dataUrl: "data:image/jpeg;base64,AA==", description: "", createdAt: "2026-08-08T06:01:00.000Z" },
      { id: "ticket", tripId: baseTrip.id, type: "oebb-verbindungskosten", fileName: "ticket.png", mimeType: "image/png", size: 200, dataUrl: "data:image/png;base64,AA==", description: "", createdAt: "2026-08-08T06:02:00.000Z" },
      { id: "car", tripId: baseTrip.id, type: "dienstauto-nachweis", fileName: "dienstauto.png", mimeType: "image/png", size: 300, dataUrl: "data:image/png;base64,AA==", description: "", createdAt: "2026-08-08T06:03:00.000Z" },
      { id: "other", tripId: baseTrip.id, type: "sonstiger-beleg", fileName: "parkplatz.webp", mimeType: "image/webp", size: 400, dataUrl: "data:image/webp;base64,AA==", description: "", createdAt: "2026-08-08T06:04:00.000Z" }
    ];
    workData.files = files;
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { unmount } = render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Bearbeiten" })[0]);

    expect(within(screen.getByRole("region", { name: "Google Maps" })).getByText("google_maps_08.08.26.jpg")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Ticketpreis" })).getByText("ticketpreis_08.08.26.png")).toBeInTheDocument();
    const otherZone = screen.getByRole("region", { name: "Sonstige Screenshots" });
    expect(within(otherZone).getByText("dienstauto.png")).toBeInTheDocument();
    expect(within(otherZone).getByText("parkplatz.webp")).toBeInTheDocument();
    const mapsZone = screen.getByRole("region", { name: "Google Maps" });
    const uploadLabel = within(mapsZone).getByLabelText("Google Maps: Datei auswählen").closest("label") as HTMLLabelElement;
    const downloadButton = within(mapsZone).getByRole("button", { name: "Herunterladen" });
    const deleteButton = within(mapsZone).getByRole("button", { name: "Löschen" });
    expect(uploadLabel).toHaveTextContent("");
    expect(uploadLabel.querySelector("svg")).toBeInTheDocument();
    expect(downloadButton).toHaveTextContent("");
    expect(downloadButton.querySelector("svg")).toBeInTheDocument();
    expect(deleteButton).toHaveTextContent("");
    expect(deleteButton).toHaveClass("danger-icon-button");
    expect(deleteButton.querySelector("svg")).toBeInTheDocument();

    fireEvent.click(within(mapsZone).getByText("google_maps_08.08.26.jpg"));
    const previewDialog = screen.getByRole("dialog", { name: "Screenshot-Vorschau" });
    fireEvent.click(within(previewDialog).getByRole("button", { name: "Herunterladen" }));
    expect(downloads).toEqual(["google_maps_08.08.26.jpg"]);
    fireEvent.click(within(previewDialog).getByRole("button", { name: "Löschen" }));
    await waitFor(() => expect(workData.removeTripFile).toHaveBeenCalledWith("maps"));
    unmount();
  });

  it("renders trip tabs with aligned columns, totals and directly available actions", () => {
    render(<App />);

    expect(screen.queryByRole("button", { name: "Als erledigt markieren" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auf offen setzen" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Bearbeiten" })).toHaveLength(1);
    expect(screen.queryByRole("menuitem", { name: "Duplizieren" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Löschen" })).not.toBeInTheDocument();

    const openTab = screen.getByRole("tab", { name: /Offene Reisen/ });
    expect(openTab).toHaveAttribute("aria-selected", "true");
    expect(openTab).toHaveTextContent("1");

    const openTripsTable = screen.getByRole("table", { name: "Offene Reisen" });
    expect(within(openTripsTable).getAllByRole("columnheader").map((heading) => heading.textContent)).toEqual([
      "Datum", "Reise", "Dauer", "Strecke", "Betrag", "Differenz", "Aktionen"
    ]);
    const row = within(openTripsTable).getByRole("row", { name: /Besprechung/ });
    expect(within(row).getByText("08.08.2026")).toBeInTheDocument();
    expect(within(row).getByText("Sa.")).toBeInTheDocument();
    expect(within(row).getByText("8:00 h")).toHaveAttribute("data-label", "Dauer");
    expect(within(row).getByText("100 km")).toHaveAttribute("data-label", "Strecke");
    expect(within(row).getByText("0,00 EUR")).toHaveAttribute("data-label", "Betrag");
    expect(within(row).getByText("20,00 EUR")).toHaveAttribute("data-label", "Differenz");
    const totalRow = within(openTripsTable).getByRole("row", { name: /Summe/ });
    expect(within(totalRow).getByText("1 Reise")).toBeInTheDocument();
    expect(within(totalRow).getByText("20,00 EUR")).toBeInTheDocument();

    const worklistButton = screen.getByRole("button", { name: "Offene Reisen abarbeiten" });
    expect(worklistButton).toHaveAttribute("type", "button");
    expect(worklistButton).toHaveTextContent("Offene Reisen abarbeiten");
    expect(screen.queryByText("1 offen")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Erledigte Reisen/ }));
    const completedTable = screen.getByRole("table", { name: "Erledigte Reisen" });
    expect(within(completedTable).getByText("Nachbesprechung")).toBeInTheDocument();
    expect(within(completedTable).getByText("August 2026")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Offene Reisen" })).not.toBeInTheDocument();

    fireEvent.click(worklistButton);

    expect(screen.getByRole("button", { name: "Als erledigt markieren" })).toBeInTheDocument();
  });

  it("highlights the trip that is being edited", () => {
    const { unmount } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));

    const row = within(screen.getByRole("table", { name: "Offene Reisen" })).getByRole("row", { name: /Besprechung/ });
    expect(row).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Sa., 08.08.2026 · Besprechung", { selector: ".trips-title-detail" })).toBeInTheDocument();
    unmount();
  });

  it("shows open trip status figures above the form", () => {
    render(<App />);

    const metrics = screen.getByRole("region", { name: "Kennzahlen" });
    expect(within(metrics).getByText("Offene Reisen")).toBeInTheDocument();
    expect(within(metrics).getByText("0,00 EUR offen")).toBeInTheDocument();
    expect(within(metrics).getByText("BEZU Jahresstand")).toBeInTheDocument();
    fireEvent.click(within(metrics).getByRole("button", { name: "Abarbeiten" }));
    expect(screen.getByRole("dialog", { name: "Offene Reisekosten abarbeiten" })).toBeInTheDocument();
  });

  it("operates and closes the accessible trip action menu", async () => {
    workData.saveTrip.mockResolvedValue({ ...baseTrip, id: "trip-copy" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { unmount } = render(<App />);

    const openTripsTable = screen.getByRole("table", { name: "Offene Reisen" });
    const trigger = within(openTripsTable).getByRole("button", { name: /Weitere Aktionen für/ });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(openTripsTable).getByRole("menuitem", { name: "Duplizieren" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    fireEvent.click(within(openTripsTable).getByRole("menuitem", { name: "Duplizieren" }));
    await waitFor(() => expect(workData.saveTrip).toHaveBeenCalled());
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    fireEvent.click(within(openTripsTable).getByRole("menuitem", { name: "Löschen" }));
    await waitFor(() => expect(workData.removeTrip).toHaveBeenCalledWith(baseTrip.id));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    unmount();
  });

  it("keeps empty trip panels unchanged and omits column headers for empty lists", () => {
    workData.trips = [];
    render(<App />);

    expect(screen.getByText("Keine offenen Reisen.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Erledigte Reisen/ }));
    expect(screen.getByText("Keine erledigten Reisen.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Offene Reisen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader")).not.toBeInTheDocument();
  });

  it("labels incomplete trips in the compact row", () => {
    workData.trips = [{ ...baseTrip, startTime: undefined, endTime: undefined }];
    render(<App />);

    const row = within(screen.getByRole("table", { name: "Offene Reisen" })).getByRole("row", { name: /Besprechung/ });
    expect(row).toHaveClass("trip-row-incomplete");
    expect(within(row).getByText("Unvollständig")).toBeInTheDocument();
  });

  it("shows the complete worklist as continuous data sections and copies values unchanged", async () => {
    const publicTransportTrip: Trip = {
      ...baseTrip,
      reason: "Außenprüfung",
      destination: "Hauptplatz 7, 7000 Eisenstadt",
      municipalityCode: "10101",
      transportType: "oeffi-zuschuss",
      oneWayKilometers: 12.5,
      ticketPriceCents: 1440,
      publicTransportTicketQueryDate: "2026-08-07"
    };
    const evidence: TripFile = {
      id: "file-1",
      tripId: publicTransportTrip.id,
      type: "oebb-verbindungskosten",
      fileName: "oebb-ticket-nachweis.png",
      mimeType: "image/png",
      size: 2048,
      dataUrl: "data:image/png;base64,AA==",
      description: "",
      createdAt: "2026-08-08T06:05:00.000Z"
    };
    const writeText = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    workData.trips = [publicTransportTrip];
    workData.files = [evidence];

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Offene Reisen abarbeiten" }));

    const dialog = screen.getByRole("dialog", { name: "Offene Reisekosten abarbeiten" });
    expect(within(dialog).getByRole("progressbar", { name: "Fortschritt" })).toHaveAttribute("aria-valuenow", "0");
    expect(within(dialog).getByText("1 offen")).toBeInTheDocument();
    expect(within(dialog).getByText("1 von 1")).toBeInTheDocument();
    for (const sectionName of ["Reisedaten", "Route", "Fahrtkosten", "Bemerkungen", "Nachweise"]) {
      expect(within(dialog).getByRole("heading", { name: sectionName })).toBeInTheDocument();
    }
    for (const label of ["Zeit von", "Zeit bis", "Grund", "Gemeindekennzahl", "Zieladresse", "Fahrtkostenart", "Ticketpreis je Richtung · EUR", "Ticketnachweis", "Beschreibung", "Anzahl · km", "Bemerkungen", "Screenshots / Nachweise"]) {
      expect(within(dialog).getByText(label, { selector: "span" })).toBeInTheDocument();
    }
    expect(within(dialog).getByText("ticketpreis_08.08.26.png")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Anzeigen" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Herunterladen" })).toBeInTheDocument();
    expect(within(dialog).getByText("Gesamtbetrag")).toBeInTheDocument();

    const expectedFields = openTripFields(publicTransportTrip);
    const reason = expectedFields.find((field) => field.label === "Grund")?.value ?? "";
    const remarks = expectedFields.find((field) => field.label === "Bemerkungen")?.value ?? "";
    expect(remarks).toContain("\n\n");
    const remarksRow = within(dialog).getByRole("button", { name: "Bemerkungen kopieren" }).closest(".open-trip-data-row") as HTMLElement;
    expect(remarksRow.querySelector(".open-trip-field-value")).toHaveTextContent(remarks, { normalizeWhitespace: false });

    fireEvent.click(within(dialog).getByRole("button", { name: "Grund kopieren" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(reason));
    expect(within(dialog).getByRole("button", { name: "Grund kopiert" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Bemerkungen kopieren" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(remarks));
  });

  it("keeps missing values disabled and exposes evidence and completion actions", async () => {
    const incompleteTrip: Trip = {
      ...baseTrip,
      startTime: undefined,
      municipalityCode: undefined,
      reason: "",
      destination: "",
      transportType: "kilometergeld",
      oneWayKilometers: 0
    };
    const evidence: TripFile = {
      id: "file-2",
      tripId: incompleteTrip.id,
      type: "dienstauto-nachweis",
      fileName: "dienstauto-belegt.png",
      mimeType: "image/png",
      size: 1024,
      dataUrl: "data:image/png;base64,AA==",
      description: "",
      createdAt: "2026-08-08T06:05:00.000Z"
    };
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    workData.trips = [incompleteTrip];
    workData.files = [evidence];

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Offene Reisen abarbeiten" }));
    const dialog = screen.getByRole("dialog", { name: "Offene Reisekosten abarbeiten" });

    expect(within(dialog).getByRole("button", { name: "Zeit von kopieren" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Grund kopieren" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Gemeindekennzahl kopieren" })).toBeDisabled();
    expect(within(dialog).getAllByText("Nicht kopierfertig").length).toBeGreaterThanOrEqual(3);

    fireEvent.click(within(dialog).getByRole("button", { name: "Herunterladen" }));
    expect(anchorClick).toHaveBeenCalledOnce();
    fireEvent.click(within(dialog).getByRole("button", { name: "Anzeigen" }));
    expect(screen.getByText("Screenshot-Vorschau")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vorschau schließen" }));

    fireEvent.click(within(dialog).getByRole("button", { name: "Als erledigt markieren" }));
    await waitFor(() => expect(workData.saveTrip).toHaveBeenCalledWith(expect.objectContaining({ id: incompleteTrip.id, done: true })));
  });
});

describe("travel expense year overview", () => {
  const yearTrip: Trip = {
    id: "trip-march",
    date: "2026-03-01",
    startTime: "07:30",
    endTime: "15:30",
    durationMinutes: 480,
    reason: "Prüfung Altfall",
    origin: "Eisenstadt",
    destination: "Wien",
    transportType: "dienstauto",
    oneWayKilometers: 50,
    perDiemCents: 0,
    otherCostsCents: 0,
    otherCostsDescription: "",
    employerReimbursedCosts: true,
    taxableTransportSubsidyCents: 0,
    transportSubsidyTaxCents: 0,
    note: "",
    done: false,
    createdAt: "2026-03-01T06:00:00.000Z",
    updatedAt: "2026-03-01T06:00:00.000Z"
  };

  beforeEach(() => {
    workData.trips = [yearTrip, { ...yearTrip, id: "trip-july", date: "2026-07-20", reason: "Nachschau", done: true }];
    workData.tripPayments = [];
    workData.saveSettings.mockReset();
    workData.saveSettings.mockResolvedValue(undefined);
    workData.saveTripPayment.mockReset();
    workData.saveTripPayment.mockResolvedValue(undefined);
    window.location.hash = "#/reisekosten/jahr/2026";
  });

  afterEach(() => {
    workData.trips = [];
    workData.tripPayments = [];
    window.location.hash = "";
    vi.restoreAllMocks();
  });

  it("warns prominently when the oldest open trip is older than five months", () => {
    render(<App />);

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Älteste offene Reise ist über 5 Monate alt")).toBeInTheDocument();
    expect(alert).toHaveTextContent("Reise vom 01.03.2026 (Prüfung Altfall)");
    expect(alert).toHaveTextContent("Frist endet am 01.09.2026 – noch 24 Tage.");
    expect(screen.getByText("Frist bis 01.09.2026")).toBeInTheDocument();

    const months = screen.getByRole("table", { name: "Reisen je Monat 2026" });
    const march = within(months).getByRole("row", { name: /März/ });
    expect(within(march).getByText("1 offen")).toHaveClass("is-late");
    expect(within(within(months).getByRole("row", { name: /Juli/ })).getByText("erledigt")).toBeInTheDocument();
    expect(within(months).getAllByRole("row")).toHaveLength(10);
  });

  it("shows the deadline warning on every page", () => {
    vi.stubGlobal("ResizeObserver", class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    for (const hash of ["#/", "#/reisekosten", "#/punkte", "#/einstellungen"]) {
      window.location.hash = hash;
      const { unmount } = render(<App />);
      expect(screen.getByRole("alert")).toHaveTextContent("Älteste offene Reise ist über 5 Monate alt");
      unmount();
    }
    vi.unstubAllGlobals();
  });

  it("does not warn for recent open trips", () => {
    workData.trips = [{ ...yearTrip, date: "2026-07-01" }];
    render(<App />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Frist bis/)).not.toBeInTheDocument();
  });

  it("edits the yearly limit inline from the BEZU figure", async () => {
    render(<App />);

    const metrics = screen.getByRole("region", { name: "Kennzahlen" });
    expect(within(metrics).getByText(/^Jahresdeckel 2026: \d/)).toBeInTheDocument();
    fireEvent.click(within(metrics).getByRole("button", { name: "Jahresdeckel 2026 ändern" }));
    const input = within(metrics).getByLabelText("Jahresdeckel 2026");
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(within(metrics).queryByLabelText("Jahresdeckel 2026")).not.toBeInTheDocument();

    fireEvent.click(within(metrics).getByRole("button", { name: "Jahresdeckel 2026 ändern" }));
    fireEvent.change(within(metrics).getByLabelText("Jahresdeckel 2026"), { target: { value: "500" } });
    fireEvent.click(within(metrics).getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(workData.saveSettings).toHaveBeenCalledWith({ publicTransportTaxFreeYearLimitsCents: { 2026: 50000 } }));
    await waitFor(() => expect(within(metrics).queryByLabelText("Jahresdeckel 2026")).not.toBeInTheDocument());
  });

  it("shows payouts as a calculation and lists transfers with their sum", async () => {
    workData.tripPayments = [
      { id: "pay-1", year: 2026, date: "2026-04-15", amountCents: 1000, note: "Jänner bis März", createdAt: "2026-04-15T08:00:00.000Z", updatedAt: "2026-04-15T08:00:00.000Z" }
    ];
    render(<App />);

    const payout = screen.getByRole("region", { name: "Auszahlung" });
    expect(within(payout).getByText("Offen nach Überweisung")).toBeInTheDocument();
    const transfers = within(payout).getByRole("list", { name: "Überweisungen 2026" });
    expect(within(transfers).getByText("15.04.2026")).toBeInTheDocument();
    expect(within(transfers).getByText("Jänner bis März")).toBeInTheDocument();
    expect(within(transfers).getAllByText("10,00 EUR")).toHaveLength(2);

    fireEvent.change(within(payout).getByLabelText("Betrag (EUR)"), { target: { value: "25,50" } });
    fireEvent.click(within(payout).getByRole("button", { name: "Überweisung speichern" }));
    await waitFor(() => expect(workData.saveTripPayment).toHaveBeenCalledWith(expect.objectContaining({ year: 2026, amountCents: 2550 })));

    const differential = screen.getByRole("table", { name: /Differenz und Werbungskosten 2026/ });
    expect(within(differential).getByRole("columnheader", { name: "davon offen" })).toBeInTheDocument();
  });
});

describe("trip evidence file names", () => {
  const file = (id: string, type: TripFile["type"], fileName: string, mimeType: string, createdAt: string): TripFile => ({
    id,
    tripId: "trip-1",
    type,
    fileName,
    mimeType,
    size: 1,
    dataUrl: "data:image/png;base64,AA==",
    description: "",
    createdAt
  });

  it("uses the current date, preserves image formats, and numbers later files chronologically", () => {
    const first = file("maps-1", "google-maps-nachweis", "route.PNG", "image/png", "2026-05-23T08:00:00.000Z");
    const second = file("maps-2", "google-maps-nachweis", "route.jpg", "image/jpeg", "2026-05-23T09:00:00.000Z");
    const third = file("maps-3", "google-maps-nachweis", "clipboard", "image/webp", "2026-05-23T10:00:00.000Z");
    const ticket = file("ticket-1", "oebb-verbindungskosten", "oebb.jpeg", "image/jpeg", "2026-05-23T11:00:00.000Z");
    const files = [third, ticket, second, first];

    expect(tripEvidenceFileName(first, "2026-05-23", files)).toBe("google_maps_23.05.26.png");
    expect(tripEvidenceFileName(second, "2026-05-23", files)).toBe("google_maps_23.05.26_2.jpg");
    expect(tripEvidenceFileName(third, "2026-05-23", files)).toBe("google_maps_23.05.26_3.webp");
    expect(tripEvidenceFileName(ticket, "2026-05-23", files)).toBe("ticketpreis_23.05.26.jpeg");
    expect(tripEvidenceFileName(ticket, "2026-06-01", files)).toBe("ticketpreis_01.06.26.jpeg");
  });

  it("keeps original names for legacy and other evidence", () => {
    const legacy = file("legacy", "dienstauto-nachweis", "dienstauto-alt.png", "image/png", "2026-05-23T08:00:00.000Z");
    const other = file("other", "sonstiger-beleg", "Parkbeleg 7.webp", "image/webp", "2026-05-23T09:00:00.000Z");
    expect(tripEvidenceFileName(legacy, "2026-05-23", [legacy, other])).toBe("dienstauto-alt.png");
    expect(tripEvidenceFileName(other, "2026-05-23", [legacy, other])).toBe("Parkbeleg 7.webp");
  });
});
