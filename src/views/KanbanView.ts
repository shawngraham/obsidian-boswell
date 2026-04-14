import { WorkspaceLeaf, setIcon } from "obsidian";
import type BswPlugin from "../main";
import type { Task, Researcher } from "../types";
import type { Experiment } from "../types";
import { BaseView } from "./BaseView";
import { TaskModal } from "../modals/TaskModal";
import { ConfirmModal } from "../modals/ConfirmModal";

// "blocked" has no experiment equivalent — keep the experiment as "running"
const TASK_TO_EXP_STATUS: Record<Task["status"], Experiment["status"]> = {
  "todo":        "planned",
  "in-progress": "running",
  "blocked":     "running",
  "done":        "completed",
};

export const VIEW_TYPE_KANBAN = "bsw-kanban";

const COLUMNS: { id: Task["status"]; label: string; dotCls: string }[] = [
  { id: "todo",        label: "To Do",       dotCls: "bsw-dot-neutral" },
  { id: "in-progress", label: "In Progress", dotCls: "bsw-dot-blue" },
  { id: "blocked",     label: "Blocked",     dotCls: "bsw-dot-danger" },
  { id: "done",        label: "Done",        dotCls: "bsw-dot-green" },
];

export class KanbanView extends BaseView {
  private tasks: Task[] = [];
  private researchers: Researcher[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: BswPlugin) { super(leaf, plugin); }

  getViewType() { return VIEW_TYPE_KANBAN; }
  getDisplayText() { return "Boswell Tasks"; }
  getIcon() { return "check-square"; }

  async onOpen() { await this.refresh(); }
  async onClose() { this.contentEl.empty(); }

  async refresh() {
    [this.tasks, this.researchers] = await Promise.all([
      this.plugin.dm.loadTasks(),
      this.plugin.dm.loadResearchers(),
    ]);
    this.render();
  }

  private render() {
    const el = this.contentEl;
    el.empty();
    el.addClass("bsw-view");

    // Header
    const header = el.createDiv({ cls: "bsw-view-header" });
    const left = header.createDiv();
    left.createEl("h1", { cls: "bsw-page-title", text: "Tasks" });
    left.createEl("p", { cls: "bsw-muted bsw-small", text: "Drag to change status · double-click to edit" });

    const addBtn = header.createEl("button", { cls: "bsw-btn bsw-btn-primary", text: "Add Task" });
    setIcon(addBtn, "plus");
    addBtn.addEventListener("click", () => this.openTaskModal(null));

    // Board
    const board = el.createDiv({ cls: "bsw-kanban-board" });
    COLUMNS.forEach(({ id, label, dotCls }) => {
      const col = board.createDiv({ cls: "bsw-kanban-col" });
      const colHeader = col.createDiv({ cls: "bsw-kanban-col-header" });
      colHeader.createDiv({ cls: `bsw-dot ${dotCls}` });
      colHeader.createEl("span", { cls: "bsw-col-label", text: label });
      const count = this.tasks.filter((t) => t.status === id).length;
      colHeader.createEl("span", { cls: "bsw-col-count", text: String(count) });

      const cardZone = col.createDiv({ cls: "bsw-kanban-cards" });
      this.setupDropZone(cardZone, id);

      this.tasks.filter((t) => t.status === id).forEach((task) => {
        this.renderCard(cardZone, task);
      });
    });
  }

  private renderCard(container: HTMLElement, task: Task) {
    const assignee = this.researchers.find((r) => r.id === task.assigneeId);
    const now = Date.now();
    const dueTime = task.dueDate ? new Date(task.dueDate).getTime() : null;
    const overdue = dueTime && task.status !== "done" && dueTime < now;
    const soon = dueTime && task.status !== "done" && !overdue && (dueTime - now) < 3 * 86400000;

    const card = container.createDiv({ cls: "bsw-kanban-card" });
    if (overdue) card.addClass("bsw-card-overdue");
    card.draggable = true;

    // Drag events
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer?.setData("text/plain", task.id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      setTimeout(() => card.addClass("bsw-dragging"), 0);
    });
    card.addEventListener("dragend", () => card.removeClass("bsw-dragging"));

    // Double-click to edit
    card.addEventListener("dblclick", () => this.openTaskModal(task));

    // Delete button
    const delBtn = card.createEl("button", { cls: "bsw-card-del-btn" });
    setIcon(delBtn, "trash-2");
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      new ConfirmModal(this.app, `Delete "${task.title}"?`, async () => {
        await this.deleteTask(task.id);
      }, "Delete").open();
    });

    // Title
    card.createEl("p", { cls: "bsw-card-title", text: task.title });

    // Description snippet
    if (task.description) {
      card.createEl("p", { cls: "bsw-card-desc", text: task.description });
    }

    // Parent badge
    if (task.parentTitle) {
      card.createEl("span", { cls: "bsw-badge bsw-badge-info bsw-small", text: task.parentTitle });
    }

    // Linked note chip
    if (task.linkedNotePath) {
      const noteChip = card.createDiv({ cls: "bsw-card-note-chip" });
      const noteIcon = noteChip.createSpan();
      setIcon(noteIcon, "link");
      noteChip.createEl("span", { text: task.linkedNotePath.split("/").pop() ?? task.linkedNotePath });
      noteChip.addEventListener("click", (e) => {
        e.stopPropagation();
        this.app.workspace.openLinkText(task.linkedNotePath!, "", false);
      });
    }

    // Footer: due date + assignee
    const footer = card.createDiv({ cls: "bsw-card-footer" });
    if (task.dueDate) {
      const dueEl = footer.createEl("span", { cls: "bsw-card-due mono", text: task.dueDate });
      if (overdue) dueEl.addClass("bsw-text-danger");
      else if (soon) dueEl.addClass("bsw-text-warn");
    } else {
      footer.createSpan();
    }
    if (assignee) {
      footer.createEl("span", { cls: "bsw-card-assignee", text: assignee.name });
    }
  }

  private setupDropZone(el: HTMLElement, status: Task["status"]) {
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      el.addClass("bsw-drag-over");
    });
    el.addEventListener("dragleave", (e) => {
      if (!el.contains(e.relatedTarget as Node)) el.removeClass("bsw-drag-over");
    });
    el.addEventListener("drop", async (e) => {
      e.preventDefault();
      el.removeClass("bsw-drag-over");
      const taskId = e.dataTransfer?.getData("text/plain");
      if (!taskId) return;
      const task = this.tasks.find((t) => t.id === taskId);
      if (!task || task.status === status) return;
      this.tasks = this.tasks.map((t) => (t.id === taskId ? { ...t, status } : t));
      await this.plugin.dm.saveTasks(this.tasks);
      // Keep the linked experiment in sync
      if (task.parentType === "experiment" && task.parentId) {
        await this.syncExperimentFromTaskStatus(task.parentId, status);
      }
      await this.plugin.refreshViews();
    });
  }

  private openTaskModal(task: Task | null) {
    new TaskModal(this.app, {
      task: task ?? undefined,
      researchers: this.researchers,
      onSave: async (updated) => {
        if (task) {
          // Update
          if (task.assigneeId !== updated.assigneeId) {
            this.researchers = this.researchers.map((r) => {
              const without = r.tasks.filter((id) => id !== updated.id);
              if (updated.assigneeId && r.id === updated.assigneeId) return { ...r, tasks: [...without, updated.id] };
              return { ...r, tasks: without };
            });
          }
          this.tasks = this.tasks.map((t) => (t.id === updated.id ? updated : t));
          // Keep linked experiment in sync if status changed
          if (task.status !== updated.status && updated.parentType === "experiment" && updated.parentId) {
            await this.syncExperimentFromTaskStatus(updated.parentId, updated.status);
          }
        } else {
          // Add
          this.tasks = [...this.tasks, updated];
          if (updated.assigneeId) {
            this.researchers = this.researchers.map((r) =>
              r.id === updated.assigneeId ? { ...r, tasks: [...r.tasks, updated.id] } : r
            );
          }
        }
        await this.plugin.dm.saveTasks(this.tasks);
        await this.plugin.dm.saveResearchers(this.researchers);
        await this.plugin.refreshViews();
      },
      onDelete: async (id) => { await this.deleteTask(id); },
    }).open();
  }

  private async deleteTask(id: string) {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.researchers = this.researchers.map((r) => ({ ...r, tasks: r.tasks.filter((tid) => tid !== id) }));
    await this.plugin.dm.saveTasks(this.tasks);
    await this.plugin.dm.saveResearchers(this.researchers);
    await this.plugin.refreshViews();
  }

  /** Update the parent experiment's status to match a changed task status. */
  private async syncExperimentFromTaskStatus(experimentId: string, taskStatus: Task["status"]) {
    const expStatus = TASK_TO_EXP_STATUS[taskStatus];
    const experiments = await this.plugin.dm.loadExperiments();
    const exp = experiments.find((e) => e.id === experimentId);
    if (!exp || exp.status === expStatus) return;
    await this.plugin.dm.saveExperimentMeta({ ...exp, status: expStatus });
  }
}