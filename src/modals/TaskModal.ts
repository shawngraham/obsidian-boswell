import { App, Modal, setIcon } from "obsidian";
import type { Task, Researcher } from "../types";
import { NotePicker } from "./NotePicker";

interface TaskModalOpts {
  task?: Task;
  researchers: Researcher[];
  onSave: (task: Task) => void;
  onDelete?: (id: string) => void;
}

function field(parent: HTMLElement, label: string): HTMLElement {
  const wrap = parent.createDiv({ cls: "bsw-field" });
  wrap.createEl("label", { text: label, cls: "bsw-field-label" });
  return wrap;
}

export class TaskModal extends Modal {
  private draft: Task;

  constructor(app: App, private opts: TaskModalOpts) {
    super(app);
    this.draft = opts.task
      ? { ...opts.task }
      : { id: Date.now().toString(36), title: "", status: "todo" };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("bsw-modal");
    this.titleEl.setText(this.opts.task ? "Edit Task" : "Add Task");
    this.render(contentEl);
  }

  private render(el: HTMLElement): void {
    el.empty();

    // Title
    const titleField = field(el, "Title");
    const titleInput = titleField.createEl("input", {
      cls: "bsw-input",
      type: "text",
      placeholder: "Task title",
    }) as HTMLInputElement;
    titleInput.value = this.draft.title;
    titleInput.addEventListener("input", () => { this.draft.title = titleInput.value; });
    titleInput.addEventListener("keydown", (e) => { if (e.key === "Enter") this.save(); });

    // Description
    const descField = field(el, "Description");
    const descArea = descField.createEl("textarea", {
      cls: "bsw-textarea",
      placeholder: "Notes, context, acceptance criteria…",
    }) as HTMLTextAreaElement;
    descArea.value = this.draft.description ?? "";
    descArea.rows = 3;
    descArea.addEventListener("input", () => { this.draft.description = descArea.value || undefined; });

    // Grid: status / due / assignee
    const grid = el.createDiv({ cls: "bsw-grid-3" });

    const statusField = field(grid, "Status");
    const statusSel = statusField.createEl("select", { cls: "bsw-select" }) as HTMLSelectElement;
    (["todo", "in-progress", "blocked", "done"] as Task["status"][]).forEach((s) => {
      const opt = statusSel.createEl("option", { text: s, value: s });
      if (s === this.draft.status) opt.selected = true;
    });
    statusSel.addEventListener("change", () => { this.draft.status = statusSel.value as Task["status"]; });

    const dueField = field(grid, "Due Date");
    const dueInput = dueField.createEl("input", { cls: "bsw-input", type: "date" }) as HTMLInputElement;
    dueInput.value = this.draft.dueDate ?? "";
    dueInput.addEventListener("change", () => { this.draft.dueDate = dueInput.value || undefined; });

    const assigneeField = field(grid, "Assignee");
    const assigneeSel = assigneeField.createEl("select", { cls: "bsw-select" }) as HTMLSelectElement;
    assigneeSel.createEl("option", { text: "Unassigned", value: "" });
    this.opts.researchers.forEach((r) => {
      const opt = assigneeSel.createEl("option", { text: r.name, value: r.id });
      if (r.id === this.draft.assigneeId) opt.selected = true;
    });
    assigneeSel.addEventListener("change", () => { this.draft.assigneeId = assigneeSel.value || undefined; });

    // Linked note
    const noteField = field(el, "Linked Note");
    const noteRow = noteField.createDiv({ cls: "bsw-row-gap" });
    const noteDisplay = noteRow.createEl("span", {
      cls: "bsw-note-chip",
      text: this.draft.linkedNotePath ?? "No note linked",
    });
    if (!this.draft.linkedNotePath) noteDisplay.addClass("bsw-muted");

    const pickBtn = noteRow.createEl("button", { cls: "bsw-btn bsw-btn-xs", text: "Browse" });
    pickBtn.addEventListener("click", () => {
      new NotePicker(this.app, (file) => {
        this.draft.linkedNotePath = file.path;
        noteDisplay.setText(file.path);
        noteDisplay.removeClass("bsw-muted");
        clearBtn.style.display = "";
      }).open();
    });

    const clearBtn = noteRow.createEl("button", { cls: "bsw-btn bsw-btn-xs bsw-btn-ghost" });
    setIcon(clearBtn, "x");
    clearBtn.title = "Remove link";
    clearBtn.style.display = this.draft.linkedNotePath ? "" : "none";
    clearBtn.addEventListener("click", () => {
      this.draft.linkedNotePath = undefined;
      noteDisplay.setText("No note linked");
      noteDisplay.addClass("bsw-muted");
      clearBtn.style.display = "none";
    });

    noteField.createEl("p", {
      cls: "bsw-help-text",
      text: "Link any vault note to this task. Open it from the task card.",
    });

    // Parent badge (read-only)
    if (this.draft.parentTitle) {
      const parentRow = el.createDiv({ cls: "bsw-row-gap" });
      parentRow.createEl("span", { cls: "bsw-label-muted", text: "Generated from" });
      parentRow.createEl("span", { cls: "bsw-badge bsw-badge-info", text: this.draft.parentTitle });
    }

    // Action row
    const actions = el.createDiv({ cls: "bsw-modal-actions bsw-modal-actions-split" });
    if (this.opts.task && this.opts.onDelete) {
      const delBtn = actions.createEl("button", { text: "Delete task", cls: "bsw-btn bsw-btn-ghost bsw-text-danger" });
      delBtn.addEventListener("click", () => {
        this.opts.onDelete!(this.draft.id);
        this.close();
      });
    } else {
      actions.createDiv(); // spacer
    }
    const right = actions.createDiv({ cls: "bsw-row-gap" });
    right.createEl("button", { text: "Cancel", cls: "bsw-btn bsw-btn-secondary" })
         .addEventListener("click", () => this.close());
    right.createEl("button", { text: "Save", cls: "bsw-btn bsw-btn-primary" })
         .addEventListener("click", () => this.save());

    setTimeout(() => titleInput.focus(), 50);
  }

  private save(): void {
    if (!this.draft.title.trim()) return;
    this.opts.onSave({ ...this.draft, title: this.draft.title.trim() });
    this.close();
  }

  onClose(): void { this.contentEl.empty(); }
}
