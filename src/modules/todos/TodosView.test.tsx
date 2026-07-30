import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Todo } from "../../db/schema";
import { TodosView } from "./TodosView";

const baseTodo: Todo = {
  id: "todo-1",
  title: "Prüfung vorbereiten",
  description: "Unterlagen kontrollieren",
  dueDate: "2026-07-30",
  priority: "P2",
  labels: ["Wichtig"],
  completedAt: null,
  createdAt: "2026-07-29T08:00:00.000Z",
  updatedAt: "2026-07-29T08:00:00.000Z"
};

function todoData(todos: Todo[] = [baseTodo]) {
  return {
    loading: false,
    error: null,
    clock: new Date("2026-07-30T10:00:00.000Z"),
    todos,
    todoProjects: [],
    saveTodo: vi.fn().mockResolvedValue(baseTodo),
    completeTodo: vi.fn().mockResolvedValue(undefined),
    removeTodo: vi.fn().mockResolvedValue(undefined),
    saveTodoProject: vi.fn().mockResolvedValue(undefined),
    removeTodoProject: vi.fn().mockResolvedValue(undefined)
  };
}

describe("TodosView", () => {
  it("creates a task with the Today default and supports the quick form keyboard shortcut", async () => {
    const data = todoData([]);
    render(<MemoryRouter initialEntries={["/aufgaben/heute"]}><TodosView data={data as never} showToast={vi.fn()} /></MemoryRouter>);

    fireEvent.click(screen.getAllByRole("button", { name: "Aufgabe hinzufügen" })[0]);
    expect(screen.getAllByRole("button", { name: "Aufgabe hinzufügen" })[1]).toBeDisabled();
    const title = screen.getByRole("textbox", { name: "Aufgabenname" });
    fireEvent.change(title, { target: { value: "Bescheid prüfen" } });
    fireEvent.keyDown(title, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(data.saveTodo).toHaveBeenCalledWith(expect.objectContaining({ title: "Bescheid prüfen", dueDate: "2026-07-30", priority: "P4" })));
  });

  it("opens the addressable detail dialog and exposes reference-only features as disabled", () => {
    const data = todoData();
    render(<MemoryRouter initialEntries={["/aufgaben/heute?task=todo-1"]}><TodosView data={data as never} showToast={vi.fn()} /></MemoryRouter>);

    expect(screen.getByRole("dialog", { name: "Aufgabe Prüfung vorbereiten" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unteraufgabe hinzufügen" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Kommentieren/ })).toBeDisabled();
    expect(screen.getByText("Deadline").closest("div")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Erinnerungen").closest("div")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Standort").closest("div")).toHaveAttribute("aria-disabled", "true");
  });

  it("autosaves title edits on blur and changes completion from the list", async () => {
    const data = todoData();
    render(<MemoryRouter initialEntries={["/aufgaben/heute?task=todo-1"]}><TodosView data={data as never} showToast={vi.fn()} /></MemoryRouter>);
    const title = screen.getByRole("textbox", { name: "Aufgabenname" });
    fireEvent.change(title, { target: { value: "Prüfung abschließen" } });
    fireEvent.blur(title);
    await waitFor(() => expect(data.saveTodo).toHaveBeenCalledWith(expect.objectContaining({ id: "todo-1", title: "Prüfung abschließen" })));
  });

  it("rejects duplicate project names inline and creates a unique project", async () => {
    const data = todoData([]);
    data.todoProjects = [{ id: "project-1", name: "Außenprüfung", sortOrder: 0, createdAt: "2026-07-29T08:00:00.000Z", updatedAt: "2026-07-29T08:00:00.000Z" }];
    render(<MemoryRouter initialEntries={["/aufgaben/heute"]}><TodosView data={data as never} showToast={vi.fn()} /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Projekt hinzufügen" }));
    const input = screen.getByRole("textbox", { name: "Projektname" });
    fireEvent.change(input, { target: { value: "außenprüfung" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(screen.getByText("Dieses Projekt gibt es bereits.")).toBeInTheDocument();
    expect(data.saveTodoProject).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "Nachschau" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(data.saveTodoProject).toHaveBeenCalledWith({ name: "Nachschau" }));
  });
});
