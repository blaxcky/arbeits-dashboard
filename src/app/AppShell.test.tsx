import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Trip, TripFile } from "../db/schema";

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
  tripPayments: [],
  auditPointCases: [],
  auditPointGoals: [],
  usoCases: [],
  usoGoals: [],
  otherMeasures: [],
  files: [] as TripFile[],
  savedDestinations: [],
  todos: [],
  todoProjects: [],
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
  saveTrip: vi.fn()
}));

vi.mock("./useWorkData", () => ({ useWorkData: () => workData }));

import { App, openTripFields } from "./App";

describe("task workspace dashboard navigation", () => {
  beforeEach(() => {
    pwaRegistration.updateServiceWorker.mockReset();
    window.localStorage.clear();
    window.location.hash = "#/aufgaben/heute";
  });

  afterEach(() => {
    window.location.hash = "";
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
    fireEvent.change(screen.getByLabelText("Fahrtkostenart"), { target: { value: "dienstauto" } });

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

  it("places the new-trip action in the Reisedaten heading and resets the form", () => {
    render(<App />);

    const travelSection = screen.getByRole("heading", { name: "Reisedaten" }).closest("section") as HTMLElement;
    const newTripButton = within(travelSection).getByRole("button", { name: "Neue Reise" });

    expect(newTripButton).toHaveAttribute("type", "button");
    expect(newTripButton).toHaveAttribute("title", "Neue Reise");
    expect(newTripButton).toHaveClass("icon-button");
    expect(newTripButton).toHaveTextContent("");
    expect(newTripButton.querySelector("svg")).toHaveAttribute("width", "18");
    expect(newTripButton.querySelector("svg")).toHaveAttribute("height", "18");
    expect(newTripButton.closest(".form-section-header")).toContainElement(
      screen.getByRole("heading", { name: "Reisedaten" })
    );
    expect(screen.queryByText("Neue Reise", { selector: ".section-label" })).not.toBeInTheDocument();
    expect(screen.queryByText("Neu", { exact: true })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Zeit von"), { target: { value: "08:15" } });
    fireEvent.click(newTripButton);

    expect(screen.getByLabelText("Zeit von")).toHaveValue("");
    expect(screen.queryByText("Neue Reise", { selector: ".section-label" })).not.toBeInTheDocument();
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
    window.location.hash = "#/reisekosten";
  });

  afterEach(() => {
    workData.trips = [];
    workData.files = [];
    window.location.hash = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders only the current cost analysis and keeps the completed checkbox", () => {
    render(<App />);

    expect(screen.getAllByText("Aktuelle Kostenauswertung")).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Kennzahlen-Vorschau" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Erledigt" })).toBeInTheDocument();
  });

  it("places the accessible worklist icon action in the open-trips heading", () => {
    render(<App />);

    expect(screen.queryByRole("button", { name: "Als erledigt markieren" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auf offen setzen" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Bearbeiten" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Duplizieren" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Löschen" })).toHaveLength(2);

    const openTripsHeading = screen.getByText("Offene Reisen", { selector: ".section-label" }).closest(".panel-heading") as HTMLElement;
    const worklistButton = within(openTripsHeading).getByRole("button", { name: "Offene Reisen abarbeiten" });

    expect(worklistButton).toHaveAttribute("type", "button");
    expect(worklistButton).toHaveAttribute("title", "Offene Reisen abarbeiten");
    expect(worklistButton).toHaveClass("icon-button");
    expect(worklistButton).toHaveTextContent("");
    expect(within(openTripsHeading).getByText("1", { selector: "strong" })).toBeInTheDocument();
    expect(document.querySelector(".trips-overview-actions")).not.toBeInTheDocument();
    expect(screen.queryByText("1 offen")).not.toBeInTheDocument();

    fireEvent.click(worklistButton);

    expect(screen.getByRole("button", { name: "Als erledigt markieren" })).toBeInTheDocument();
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
    expect(within(dialog).getByText("oebb-ticket-nachweis.png")).toBeInTheDocument();
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
