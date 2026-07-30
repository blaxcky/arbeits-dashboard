import {
  CalendarBlank,
  CalendarDots,
  Check,
  CheckCircle,
  DotsThree,
  Flag,
  Hash,
  Tray,
  ListChecks,
  LockSimple,
  MagnifyingGlass,
  MapPin,
  NotePencil,
  Paperclip,
  Plus,
  SlidersHorizontal,
  Tag,
  Trash,
  X
} from "@phosphor-icons/react";
import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { Todo, TodoPriority, TodoProject } from "../../db/schema";
import { todayKey } from "../../lib/dates";
import { activeTodosForToday, filterTodos, inboxTodos, projectTodos, searchTodos, sortTodos, upcomingTodoGroups, type TodoFilter } from "./calculations";
import type { useWorkData } from "../../app/useWorkData";

type TodoData = ReturnType<typeof useWorkData>;
type TodoDraft = {
  title: string;
  description: string;
  projectId: string;
  dueDate: string;
  priority: TodoPriority;
  labelsText: string;
};

const emptyFilter: TodoFilter = { projectId: "", priority: "", label: "", status: "active" };

export function TodosView({ data, showToast }: { data: TodoData; showToast: (message: string) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const today = todayKey(data.clock);
  const pathParts = location.pathname.split("/");
  const projectId = location.pathname.startsWith("/aufgaben/projekt/") ? decodeURIComponent(pathParts[pathParts.length - 1] ?? "") : "";
  const currentProject = data.todoProjects.find((project) => project.id === projectId);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<TodoFilter>(emptyFilter);
  const [projectEditor, setProjectEditor] = useState<{ id?: string; name: string } | null>(null);
  const [projectError, setProjectError] = useState("");
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const projectNames = useMemo(() => new Map(data.todoProjects.map((project) => [project.id, project.name])), [data.todoProjects]);
  const labels = useMemo(() => [...new Set(data.todos.flatMap((todo) => todo.labels))].sort((a, b) => a.localeCompare(b, "de-AT")), [data.todos]);
  const selectedTaskId = new URLSearchParams(location.search).get("task");
  const selectedTask = data.todos.find((todo) => todo.id === selectedTaskId);

  const view = useMemo(() => {
    if (location.pathname.endsWith("/eingang")) return { title: "Eingang", todos: inboxTodos(data.todos), groups: null };
    if (location.pathname.endsWith("/demnaechst")) return { title: "Demnächst", todos: [], groups: upcomingTodoGroups(data.todos, today) };
    if (location.pathname.endsWith("/suche")) return { title: "Suchen", todos: searchTodos(data.todos, searchQuery, projectNames), groups: null };
    if (location.pathname.endsWith("/filter")) return { title: "Filter und Etiketten", todos: filterTodos(data.todos, filter), groups: null };
    if (currentProject) return { title: currentProject.name, todos: projectTodos(data.todos, currentProject.id), groups: null };
    return { title: "Heute", todos: activeTodosForToday(data.todos, today), groups: null };
  }, [currentProject, data.todos, filter, location.pathname, projectNames, searchQuery, today]);

  const defaultDraft = (): TodoDraft => ({
    title: "",
    description: "",
    projectId: currentProject?.id ?? "",
    dueDate: location.pathname.endsWith("/heute") ? today : "",
    priority: "P4",
    labelsText: ""
  });

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    if (!projectEditor) return;
    const name = projectEditor.name.trim();
    if (!name) return setProjectError("Bitte einen Projektnamen eingeben.");
    if (data.todoProjects.some((project) => project.id !== projectEditor.id && project.name.toLocaleLowerCase("de-AT") === name.toLocaleLowerCase("de-AT"))) {
      return setProjectError("Dieses Projekt gibt es bereits.");
    }
    await data.saveTodoProject({ ...projectEditor, name });
    setProjectEditor(null);
    setProjectError("");
    showToast(projectEditor.id ? "Projekt umbenannt." : "Projekt hinzugefügt.");
  }

  async function removeProject(project: TodoProject) {
    if (!window.confirm(`Projekt „${project.name}“ löschen? Die Aufgaben werden in den Eingang verschoben.`)) return;
    await data.removeTodoProject(project.id);
    if (project.id === projectId) navigate("/aufgaben/eingang");
    showToast("Projekt gelöscht. Aufgaben wurden in den Eingang verschoben.");
  }

  function openTask(todo: Todo, trigger: HTMLElement) {
    trigger.dataset.todoTrigger = todo.id;
    const params = new URLSearchParams(location.search);
    params.set("task", todo.id);
    navigate(`${location.pathname}?${params.toString()}`);
  }

  function closeTask() {
    const triggerId = selectedTaskId;
    navigate(location.pathname);
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-todo-trigger="${triggerId}"]`)?.focus(), 0);
  }

  return (
    <section className="todos-shell">
      <aside className="todos-nav" aria-label="Aufgabennavigation">
        <button ref={addButtonRef} className="todos-add-top" type="button" onClick={() => setAdding(true)}><Plus size={21} weight="fill" /> Aufgabe hinzufügen</button>
        <nav>
          <TodoNavLink to="/aufgaben/suche" icon={<MagnifyingGlass />} label="Suchen" />
          <TodoNavLink to="/aufgaben/eingang" icon={<Tray />} label="Eingang" count={inboxTodos(data.todos).length} />
          <TodoNavLink to="/aufgaben/heute" icon={<CalendarBlank />} label="Heute" count={activeTodosForToday(data.todos, today).length} />
          <TodoNavLink to="/aufgaben/demnaechst" icon={<CalendarDots />} label="Demnächst" />
          <TodoNavLink to="/aufgaben/filter" icon={<SlidersHorizontal />} label="Filter und Etiketten" />
          <span className="todos-nav-disabled" aria-disabled="true" title="Diese Funktion ist noch nicht verfügbar"><ListChecks /> Reporting</span>
        </nav>
        <div className="todos-projects">
          <strong>Meine Projekte</strong>
          {data.todoProjects.map((project) => (
            <div className="todo-project-row" key={project.id}>
              <NavLink to={`/aufgaben/projekt/${encodeURIComponent(project.id)}`}><Hash /> <span>{project.name}</span></NavLink>
              <button type="button" aria-label={`Projekt ${project.name} bearbeiten`} onClick={() => setProjectEditor({ id: project.id, name: project.name })}><DotsThree weight="bold" /></button>
              {projectEditor?.id === project.id ? <ProjectEditor editor={projectEditor} error={projectError} onChange={setProjectEditor} onSubmit={saveProject} onCancel={() => setProjectEditor(null)} onDelete={() => void removeProject(project)} /> : null}
            </div>
          ))}
          {projectEditor && !projectEditor.id ? <ProjectEditor editor={projectEditor} error={projectError} onChange={setProjectEditor} onSubmit={saveProject} onCancel={() => setProjectEditor(null)} /> : null}
          {!projectEditor ? <button className="todo-project-add" type="button" onClick={() => setProjectEditor({ name: "" })}><Plus /> Projekt hinzufügen</button> : null}
        </div>
      </aside>
      <main className="todos-main">
        <div className="todos-content">
          <h1>{view.title}</h1>
          <p className="todos-count"><CheckCircle /> {view.groups ? view.groups.reduce((sum, group) => sum + group.todos.length, 0) : view.todos.length} Aufgaben</p>
          {location.pathname.endsWith("/suche") ? <label className="todo-search"><MagnifyingGlass /><span className="sr-only">Aufgaben durchsuchen</span><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Aufgaben durchsuchen" /></label> : null}
          {location.pathname.endsWith("/filter") ? <TodoFilters filter={filter} projects={data.todoProjects} labels={labels} onChange={setFilter} /> : null}
          {data.loading ? <TodoSkeleton /> : view.groups ? (
            view.groups.length ? view.groups.map((group) => <TodoGroup key={group.date} title={formatGroupDate(group.date, today)} todos={group.todos} projects={projectNames} today={today} onOpen={openTask} onComplete={(id) => void data.completeTodo(id, true)} />) : <TodoEmpty text="Keine kommenden Aufgaben." />
          ) : view.todos.length ? <TodoGroup title={location.pathname.endsWith("/heute") ? "Aufgaben" : undefined} todos={view.todos} projects={projectNames} today={today} onOpen={openTask} onComplete={(id, completed) => void data.completeTodo(id, completed)} /> : <TodoEmpty text={searchQuery ? "Keine passenden Aufgaben gefunden." : "Hier sind noch keine Aufgaben."} />}
          {adding ? <QuickTodoForm initial={defaultDraft()} projects={data.todoProjects} labels={labels} onCancel={() => { setAdding(false); addButtonRef.current?.focus(); }} onSave={async (draft) => {
            await data.saveTodo({ ...draftToTodo(draft), completedAt: null });
            setAdding(false);
            showToast("Aufgabe hinzugefügt.");
          }} /> : <button className="todo-add-inline" type="button" onClick={() => setAdding(true)}><Plus /> Aufgabe hinzufügen</button>}
        </div>
      </main>
      {selectedTask ? <TodoDetail todo={selectedTask} projects={data.todoProjects} labels={labels} onClose={closeTask} onSave={async (draft) => { await data.saveTodo({ id: selectedTask.id, ...draftToTodo(draft), completedAt: selectedTask.completedAt }); }} onComplete={(completed) => void data.completeTodo(selectedTask.id, completed)} onDelete={async () => { await data.removeTodo(selectedTask.id); closeTask(); showToast("Aufgabe gelöscht."); }} /> : null}
    </section>
  );
}

function TodoNavLink({ to, icon, label, count }: { to: string; icon: React.ReactElement; label: string; count?: number }) {
  return <NavLink to={to} className={({ isActive }) => isActive ? "active" : ""}>{icon}<span>{label}</span>{count ? <small>{count}</small> : null}</NavLink>;
}

function TodoGroup({ title, todos, projects, today, onOpen, onComplete }: { title?: string; todos: Todo[]; projects: Map<string, string>; today: string; onOpen: (todo: Todo, trigger: HTMLElement) => void; onComplete: (id: string, completed: boolean) => void }) {
  return <section className="todo-group">{title ? <h2>{title}</h2> : null}<div className="todo-list">{todos.map((todo) => <article className={`todo-row priority-${todo.priority.toLowerCase()}${todo.completedAt ? " completed" : ""}`} key={todo.id}>
    <button className="todo-check" type="button" aria-label={todo.completedAt ? `${todo.title} reaktivieren` : `${todo.title} erledigen`} onClick={() => onComplete(todo.id, !todo.completedAt)}>{todo.completedAt ? <Check weight="bold" /> : null}</button>
    <button className="todo-row-body" type="button" onClick={(event) => onOpen(todo, event.currentTarget)}>
      <span className="todo-title">{todo.title}</span>
      <span className="todo-meta">{todo.dueDate ? <span className={todo.dueDate < today ? "overdue" : todo.dueDate === today ? "today" : ""}><CalendarBlank />{todo.dueDate === today ? "Heute" : formatShortDate(todo.dueDate)}</span> : null}{todo.labels.map((label) => <span key={label}><Tag />{label}</span>)}</span>
    </button>
    <span className="todo-project-name">{projects.get(todo.projectId ?? "") ?? "Eingang"} <Tray /></span>
  </article>)}</div></section>;
}

function QuickTodoForm({ initial, projects, labels, onCancel, onSave }: { initial: TodoDraft; projects: TodoProject[]; labels: string[]; onCancel: () => void; onSave: (draft: TodoDraft) => Promise<void> }) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => titleRef.current?.focus(), []);
  async function submit() {
    if (!draft.title.trim()) return setError("Bitte einen Aufgabennamen eingeben.");
    await onSave(draft);
  }
  function keyDown(event: ReactKeyboardEvent) {
    if (event.key === "Escape") onCancel();
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void submit(); }
  }
  return <div className="todo-quick-form" onKeyDown={keyDown}>
    <input ref={titleRef} className="todo-quick-title" value={draft.title} onChange={(event) => { setError(""); setDraft({ ...draft, title: event.target.value }); }} placeholder="Aufgabenname" aria-label="Aufgabenname" />
    <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Beschreibung" aria-label="Beschreibung" />
    {error ? <span className="todo-error">{error}</span> : null}
    <div className="todo-quick-options">
      <label><CalendarBlank /><span className="sr-only">Datum</span><input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label>
      <label><Flag /><span className="sr-only">Priorität</span><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as TodoPriority })}>{["P1", "P2", "P3", "P4"].map((priority) => <option key={priority}>{priority}</option>)}</select></label>
      <label><Tag /><span className="sr-only">Etiketten</span><input list="todo-labels" value={draft.labelsText} onChange={(event) => setDraft({ ...draft, labelsText: event.target.value })} placeholder="Etiketten" /></label>
      <datalist id="todo-labels">{labels.map((label) => <option key={label} value={label} />)}</datalist>
    </div>
    <div className="todo-quick-footer"><label><Tray /><span className="sr-only">Projekt</span><select value={draft.projectId} onChange={(event) => setDraft({ ...draft, projectId: event.target.value })}><option value="">Eingang</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><span><button type="button" className="todo-cancel" onClick={onCancel}>Abbrechen</button><button type="button" className="todo-save" disabled={!draft.title.trim()} onClick={() => void submit()}>Aufgabe hinzufügen</button></span></div>
  </div>;
}

function TodoDetail({ todo, projects, labels, onClose, onSave, onComplete, onDelete }: { todo: Todo; projects: TodoProject[]; labels: string[]; onClose: () => void; onSave: (draft: TodoDraft) => Promise<void>; onComplete: (completed: boolean) => void; onDelete: () => Promise<void> }) {
  const [draft, setDraft] = useState(todoToDraft(todo));
  const [menuOpen, setMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.focus();
    const handle = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);
  const save = (next = draft) => { if (next.title.trim()) void onSave(next); };
  return <div className="todo-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="todo-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Aufgabe ${todo.title}`} tabIndex={-1}>
      <header><span><Tray /> {projects.find((project) => project.id === draft.projectId)?.name ?? "Eingang"}</span><div><button type="button" aria-label="Weitere Aktionen" onClick={() => setMenuOpen(!menuOpen)}><DotsThree /></button><button type="button" aria-label="Aufgabe schließen" onClick={onClose}><X /></button>{menuOpen ? <button className="todo-delete-menu" type="button" onClick={() => void onDelete()}><Trash /> Aufgabe löschen</button> : null}</div></header>
      <div className="todo-modal-body"><div className="todo-modal-editor"><div className="todo-modal-title"><button className={`todo-check priority-${draft.priority.toLowerCase()}`} type="button" aria-label={todo.completedAt ? "Aufgabe reaktivieren" : "Aufgabe erledigen"} onClick={() => onComplete(!todo.completedAt)}>{todo.completedAt ? <Check /> : null}</button><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} onBlur={() => save()} aria-label="Aufgabenname" /></div><label className="todo-description"><NotePencil /><span className="sr-only">Beschreibung</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} onBlur={() => save()} placeholder="Beschreibung" /></label><button className="todo-disabled-action" type="button" disabled><Plus /> Unteraufgabe hinzufügen</button><div className="todo-comment"><span aria-hidden="true">AD</span><button type="button" disabled>Kommentieren <Paperclip /></button></div></div>
        <aside className="todo-modal-properties">
          <Property label="Projekt"><select value={draft.projectId} onChange={(event) => { const next = { ...draft, projectId: event.target.value }; setDraft(next); save(next); }}><option value="">Eingang</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Property>
          <Property label="Datum"><input type="date" value={draft.dueDate} onChange={(event) => { const next = { ...draft, dueDate: event.target.value }; setDraft(next); save(next); }} /></Property>
          <DisabledProperty label="Deadline" icon={<CalendarDots />} />
          <Property label="Priorität"><select value={draft.priority} onChange={(event) => { const next = { ...draft, priority: event.target.value as TodoPriority }; setDraft(next); save(next); }}>{["P1", "P2", "P3", "P4"].map((priority) => <option key={priority}>{priority}</option>)}</select></Property>
          <Property label="Etiketten"><input list="todo-detail-labels" value={draft.labelsText} onChange={(event) => setDraft({ ...draft, labelsText: event.target.value })} onBlur={() => save()} placeholder="Etiketten hinzufügen" /><datalist id="todo-detail-labels">{labels.map((label) => <option key={label} value={label} />)}</datalist></Property>
          <DisabledProperty label="Erinnerungen" icon={<CalendarBlank />} />
          <DisabledProperty label="Standort" icon={<MapPin />} />
        </aside></div>
    </div>
  </div>;
}

function Property({ label, children }: { label: string; children: React.ReactNode }) { return <label className="todo-property"><strong>{label}</strong>{children}</label>; }
function DisabledProperty({ label, icon }: { label: string; icon: React.ReactNode }) { return <div className="todo-property disabled" aria-disabled="true"><strong>{label}</strong><span>{icon}<LockSimple /></span></div>; }

function TodoFilters({ filter, projects, labels, onChange }: { filter: TodoFilter; projects: TodoProject[]; labels: string[]; onChange: (filter: TodoFilter) => void }) {
  return <div className="todo-filters"><label>Projekt<select value={filter.projectId} onChange={(event) => onChange({ ...filter, projectId: event.target.value })}><option value="">Alle</option><option value="inbox">Eingang</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Priorität<select value={filter.priority} onChange={(event) => onChange({ ...filter, priority: event.target.value as TodoFilter["priority"] })}><option value="">Alle</option>{["P1", "P2", "P3", "P4"].map((priority) => <option key={priority}>{priority}</option>)}</select></label><label>Etikett<select value={filter.label} onChange={(event) => onChange({ ...filter, label: event.target.value })}><option value="">Alle</option>{labels.map((label) => <option key={label}>{label}</option>)}</select></label><label>Status<select value={filter.status} onChange={(event) => onChange({ ...filter, status: event.target.value as TodoFilter["status"] })}><option value="active">Offen</option><option value="completed">Erledigt</option><option value="all">Alle</option></select></label></div>;
}

function ProjectEditor({ editor, error, onChange, onSubmit, onCancel, onDelete }: { editor: { id?: string; name: string }; error: string; onChange: (editor: { id?: string; name: string }) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void; onDelete?: () => void }) {
  return <form className="todo-project-editor" onSubmit={onSubmit}><input autoFocus aria-label="Projektname" value={editor.name} onChange={(event) => onChange({ ...editor, name: event.target.value })} />{error ? <span>{error}</span> : null}<div>{onDelete ? <button type="button" className="danger" onClick={onDelete}>Löschen</button> : null}<button type="button" onClick={onCancel}>Abbrechen</button><button type="submit">Speichern</button></div></form>;
}

function TodoEmpty({ text }: { text: string }) { return <div className="todo-empty"><CheckCircle /><p>{text}</p></div>; }
function TodoSkeleton() { return <div className="todo-skeleton" aria-label="Aufgaben werden geladen"><span /><span /><span /></div>; }

function draftToTodo(draft: TodoDraft): Pick<Todo, "title" | "description" | "projectId" | "dueDate" | "priority" | "labels"> {
  return { title: draft.title.trim(), description: draft.description.trim(), projectId: draft.projectId || undefined, dueDate: draft.dueDate || undefined, priority: draft.priority, labels: [...new Set(draft.labelsText.split(",").map((label) => label.trim()).filter(Boolean))] };
}
function todoToDraft(todo: Todo): TodoDraft { return { title: todo.title, description: todo.description, projectId: todo.projectId ?? "", dueDate: todo.dueDate ?? "", priority: todo.priority, labelsText: todo.labels.join(", ") }; }
function formatShortDate(date: string): string { return new Intl.DateTimeFormat("de-AT", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`)); }
function formatGroupDate(date: string, today: string): string { return date === today ? "Heute" : new Intl.DateTimeFormat("de-AT", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`)); }
