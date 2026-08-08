import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workData = vi.hoisted(() => ({
  loading: false,
  error: null,
  clock: new Date("2026-08-08T10:00:00.000Z"),
  todos: [],
  todoProjects: [],
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
