import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/**
 * Create a reasonably unique id for client-side-only tasks.
 * Avoids adding dependencies; good enough for local persistence.
 */
function createId() {
  return `task_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatDateTime(isoString) {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

const STORAGE_KEY = "kavia_simple_todo_tasks_v1";

// PUBLIC_INTERFACE
function App() {
  /**
   * Task model:
   * { id: string, title: string, createdAt: string (ISO) }
   */
  const [tasks, setTasks] = useState(() => {
    // Hydrate from localStorage on first load.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((t) => t && typeof t.id === "string" && typeof t.title === "string")
        .map((t) => ({
          id: t.id,
          title: t.title,
          createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
        }));
    } catch {
      return [];
    }
  });

  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  const newInputRef = useRef(null);
  const editInputRef = useRef(null);

  const totalCount = tasks.length;

  const trimmedNewTitle = newTitle.trim();
  const canAdd = trimmedNewTitle.length > 0;

  const isEditing = editingId !== null;
  const editingTask = useMemo(
    () => tasks.find((t) => t.id === editingId) || null,
    [tasks, editingId]
  );

  // Persist tasks to localStorage.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // If storage is blocked/full, the app still works in-memory.
    }
  }, [tasks]);

  // Keep editingTitle in sync if tasks change while editing (edge case).
  useEffect(() => {
    if (!editingId) return;
    if (!editingTask) {
      setEditingId(null);
      setEditingTitle("");
      return;
    }
    // If the task was modified elsewhere (unlikely here), keep displayed value stable.
  }, [editingId, editingTask]);

  // Focus management for accessibility.
  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
      editInputRef.current?.select?.();
    }
  }, [isEditing]);

  // PUBLIC_INTERFACE
  function addTask(e) {
    /** Add a new task to the list. */
    e.preventDefault();
    const title = trimmedNewTitle;
    if (!title) return;

    const task = {
      id: createId(),
      title,
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => [task, ...prev]);
    setNewTitle("");
    newInputRef.current?.focus();
  }

  // PUBLIC_INTERFACE
  function startEdit(task) {
    /** Begin editing the given task. */
    setEditingId(task.id);
    setEditingTitle(task.title);
  }

  // PUBLIC_INTERFACE
  function cancelEdit() {
    /** Cancel edit mode without saving. */
    setEditingId(null);
    setEditingTitle("");
  }

  // PUBLIC_INTERFACE
  function saveEdit(taskId) {
    /** Save the current edit title to the task. */
    const title = editingTitle.trim();
    if (!title) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, title } : t))
    );
    setEditingId(null);
    setEditingTitle("");
    newInputRef.current?.focus();
  }

  // PUBLIC_INTERFACE
  function deleteTask(taskId) {
    /** Delete a task by id. */
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (editingId === taskId) {
      setEditingId(null);
      setEditingTitle("");
      newInputRef.current?.focus();
    }
  }

  // PUBLIC_INTERFACE
  function clearAll() {
    /** Remove all tasks. */
    setTasks([]);
    cancelEdit();
    setNewTitle("");
    newInputRef.current?.focus();
  }

  return (
    <div className="App">
      <main className="page" aria-label="Simple To‑Do App">
        <header className="header">
          <div className="brand">
            <h1 className="title">To‑Do</h1>
            <p className="subtitle">
              Add tasks, edit them inline, and delete when done.
            </p>
          </div>

          <button
            type="button"
            className="btn btnGhost"
            onClick={clearAll}
            disabled={tasks.length === 0}
            aria-label="Clear all tasks"
            title="Clear all tasks"
          >
            Clear all
          </button>
        </header>

        <section className="surface formCard" aria-label="Add a new task">
          <form onSubmit={addTask}>
            <div className="formRow">
              <input
                ref={newInputRef}
                className="input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="What do you want to do?"
                aria-label="Task title"
                maxLength={200}
              />
              <button
                type="submit"
                className="btn btnPrimary"
                disabled={!canAdd}
                aria-label="Add task"
              >
                Add
              </button>
            </div>

            <div className="metaRow" aria-live="polite">
              <span className="hint">
                <span aria-hidden="true">Tip:</span> Press Enter to add
              </span>
              <span>
                {totalCount} task{totalCount === 1 ? "" : "s"}
              </span>
            </div>
          </form>
        </section>

        <section className="surface listCard" aria-label="Task list">
          {tasks.length === 0 ? (
            <div className="emptyState">
              <p className="emptyTitle">No tasks yet</p>
              <p className="emptyText">
                Add your first task above to get started.
              </p>
            </div>
          ) : (
            <ul className="taskList">
              {tasks.map((task) => {
                const isThisEditing = editingId === task.id;

                return (
                  <li className="taskItem" key={task.id}>
                    {isThisEditing ? (
                      <div className="inlineEditRow" aria-label="Edit task">
                        <input
                          ref={editInputRef}
                          className="input"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          aria-label="Edit task title"
                          maxLength={200}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") cancelEdit();
                            if (e.key === "Enter") {
                              // Allow enter-to-save without submitting outer form
                              e.preventDefault();
                              saveEdit(task.id);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btnSuccess"
                          onClick={() => saveEdit(task.id)}
                          disabled={editingTitle.trim().length === 0}
                          aria-label="Save task"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btnGhost"
                          onClick={cancelEdit}
                          aria-label="Cancel editing"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="taskTextWrap">
                          <p className="taskText">{task.title}</p>
                          <span className="taskCreated">
                            Added {formatDateTime(task.createdAt)}
                          </span>
                        </div>

                        <div className="taskActions" aria-label="Task actions">
                          <button
                            type="button"
                            className="btn btnGhost"
                            onClick={() => startEdit(task)}
                            aria-label={`Edit task: ${task.title}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btnDanger"
                            onClick={() => deleteTask(task.id)}
                            aria-label={`Delete task: ${task.title}`}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
