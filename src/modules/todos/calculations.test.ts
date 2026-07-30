import { describe, expect, it } from "vitest";
import type { Todo } from "../../db/schema";
import { activeTodosForToday, countActiveTodos, filterTodos, inboxTodos, projectTodos, searchTodos, upcomingTodoGroups } from "./calculations";

const timestamp = "2026-07-28T08:00:00.000Z";
function todo(id: string, patch: Partial<Todo> = {}): Todo {
  return { id, title: `Aufgabe ${id}`, description: "", priority: "P4", labels: [], completedAt: null, createdAt: timestamp, updatedAt: timestamp, ...patch };
}

describe("todo calculations", () => {
  const todos = [
    todo("overdue", { dueDate: "2026-07-29", priority: "P2" }),
    todo("today", { dueDate: "2026-07-30", priority: "P1", labels: ["Prüfung"] }),
    todo("future-b", { dueDate: "2026-08-02" }),
    todo("future-a", { dueDate: "2026-08-01", projectId: "project-1", description: "Aktenvermerk erstellen" }),
    todo("inbox"),
    todo("completed", { dueDate: "2026-07-30", completedAt: "2026-07-30T09:00:00.000Z" })
  ];

  it("includes overdue and due-today tasks in Today, but no completed tasks", () => {
    expect(activeTodosForToday(todos, "2026-07-30").map((item) => item.id)).toEqual(["overdue", "today"]);
  });

  it("groups upcoming tasks by date and sorts the groups", () => {
    expect(upcomingTodoGroups(todos, "2026-07-30").map((group) => [group.date, group.todos.map((item) => item.id)])).toEqual([
      ["2026-08-01", ["future-a"]],
      ["2026-08-02", ["future-b"]]
    ]);
  });

  it("assigns tasks without a project to Inbox and project tasks to their project", () => {
    expect(inboxTodos(todos).map((item) => item.id)).toEqual(["overdue", "today", "future-b", "inbox"]);
    expect(projectTodos(todos, "project-1").map((item) => item.id)).toEqual(["future-a"]);
  });

  it("searches title, description, project and labels", () => {
    const projects = new Map([["project-1", "Außenprüfung"]]);
    expect(searchTodos(todos, "aktenvermerk", projects).map((item) => item.id)).toEqual(["future-a"]);
    expect(searchTodos(todos, "außenprüfung", projects).map((item) => item.id)).toEqual(["future-a"]);
    expect(searchTodos(todos, "prüfung", projects).map((item) => item.id)).toEqual(["today", "future-a"]);
  });

  it("combines project, priority, label and completion filters and counts active tasks", () => {
    expect(filterTodos(todos, { projectId: "", priority: "P1", label: "Prüfung", status: "active" }).map((item) => item.id)).toEqual(["today"]);
    expect(filterTodos(todos, { projectId: "", priority: "", label: "", status: "completed" }).map((item) => item.id)).toEqual(["completed"]);
    expect(countActiveTodos(todos)).toBe(5);
  });
});
