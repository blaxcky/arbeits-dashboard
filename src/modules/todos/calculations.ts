import type { Todo, TodoPriority } from "../../db/schema";

export type TodoFilter = {
  projectId: string;
  priority: "" | TodoPriority;
  label: string;
  status: "active" | "completed" | "all";
};

export function activeTodosForToday(todos: Todo[], today: string): Todo[] {
  return sortTodos(todos.filter((todo) => !todo.completedAt && Boolean(todo.dueDate) && todo.dueDate! <= today));
}

export function upcomingTodoGroups(todos: Todo[], today: string): Array<{ date: string; todos: Todo[] }> {
  const groups = new Map<string, Todo[]>();
  sortTodos(todos.filter((todo) => !todo.completedAt && Boolean(todo.dueDate) && todo.dueDate! > today)).forEach((todo) => {
    const date = todo.dueDate!;
    groups.set(date, [...(groups.get(date) ?? []), todo]);
  });
  return [...groups].map(([date, groupedTodos]) => ({ date, todos: groupedTodos }));
}

export function inboxTodos(todos: Todo[]): Todo[] {
  return sortTodos(todos.filter((todo) => !todo.completedAt && !todo.projectId));
}

export function projectTodos(todos: Todo[], projectId: string): Todo[] {
  return sortTodos(todos.filter((todo) => !todo.completedAt && todo.projectId === projectId));
}

export function searchTodos(todos: Todo[], query: string, projectNames: Map<string, string>): Todo[] {
  const normalized = query.trim().toLocaleLowerCase("de-AT");
  if (!normalized) return [];
  return sortTodos(todos.filter((todo) => [
    todo.title,
    todo.description,
    projectNames.get(todo.projectId ?? "") ?? "",
    ...todo.labels
  ].some((value) => value.toLocaleLowerCase("de-AT").includes(normalized))));
}

export function filterTodos(todos: Todo[], filter: TodoFilter): Todo[] {
  return sortTodos(todos.filter((todo) => (
    (!filter.projectId || (filter.projectId === "inbox" ? !todo.projectId : todo.projectId === filter.projectId))
    && (!filter.priority || todo.priority === filter.priority)
    && (!filter.label || todo.labels.includes(filter.label))
    && (filter.status === "all" || (filter.status === "completed" ? Boolean(todo.completedAt) : !todo.completedAt))
  )));
}

export function sortTodos(todos: Todo[]): Todo[] {
  const priorityOrder: Record<TodoPriority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
  return [...todos].sort((a, b) => (
    (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31")
    || priorityOrder[a.priority] - priorityOrder[b.priority]
    || a.createdAt.localeCompare(b.createdAt)
    || a.id.localeCompare(b.id)
  ));
}

export function countActiveTodos(todos: Todo[]): number {
  return todos.filter((todo) => !todo.completedAt).length;
}
