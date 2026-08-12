import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Trip } from "../db/schema";

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
  files: [],
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
  removeTodoProject: vi.fn()
}));

vi.mock("./useWorkData", () => ({ useWorkData: () => workData }));

import { App } from "./App";

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
    expect(screen.queryByText("Neu", { exact: true })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Zeit von"), { target: { value: "08:15" } });
    fireEvent.click(newTripButton);

    expect(screen.getByLabelText("Zeit von")).toHaveValue("");
    expect(screen.getByText("Neue Reise", { selector: ".section-label" })).toBeInTheDocument();
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
    window.location.hash = "#/reisekosten";
  });

  afterEach(() => {
    workData.trips = [];
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
});
