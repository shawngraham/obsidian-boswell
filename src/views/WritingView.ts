import { WorkspaceLeaf, setIcon } from "obsidian";
import type BswPlugin from "../main";
import type { WritingProject, Task } from "../types";
import { BaseView } from "./BaseView";
import { WritingModal } from "../modals/WritingModal";
import { ConfirmModal } from "../modals/ConfirmModal";

export const VIEW_TYPE_WRITING = "bsw-writing";

const STATUS_LABELS: Record<WritingProject["status"], string> = {
  drafting: "Drafting",
  review: "Review",
  final: "Final",
};

export class WritingView extends BaseView {
  constructor(leaf: WorkspaceLeaf, plugin: BswPlugin) { super(leaf, plugin); }
  getViewType() { return VIEW_TYPE_WRITING; }
  getDisplayText() { return "Boswell Writing"; }
  getIcon() { return "file-text"; }

  async onOpen() { await this.refresh(); }
  async onClose() { this.contentEl.empty(); }

  async refresh() {
    const [writing, tasks] = await Promise.all([
      this.plugin.dm.loadWriting(),
      this.plugin.dm.loadTasks(),
    ]);
    this.render(writing, tasks);
  }

  private render(writing: WritingProject[], tasks: Task[]) {
    const el = this.contentEl;
    el.empty();
    el.addClass("bsw-view");

    const header = el.createDiv({ cls: "bsw-view-header" });
    header.createEl("h1", { cls: "bsw-page-title", text: "Writing in Progress" });
    const addBtn = header.createEl("button", { cls: "bsw-btn bsw-btn-primary" });
    setIcon(addBtn, "plus");
    addBtn.createEl("span", { text: " New Project" });
    addBtn.addEventListener("click", () => {
      new WritingModal(this.app, async (w) => {
        await this.plugin.dm.saveWriting([...writing, w]);
        await this.plugin.refreshViews();
      }).open();
    });

    if (writing.length === 0) {
      el.createEl("p", { cls: "bsw-empty", text: "No writing projects yet." });
      return;
    }

    writing.forEach((w) => {
      const pct = w.targetWordCount > 0
        ? Math.min(100, Math.round((w.wordCount / w.targetWordCount) * 100))
        : 0;

      const card = el.createDiv({ cls: "bsw-card bsw-writing-card" });

      // Title row
      const titleRow = card.createDiv({ cls: "bsw-row-between bsw-align-start" });
      const left = titleRow.createDiv({ cls: "bsw-writing-left" });

      const titleInput = left.createEl("input", {
        cls: "bsw-inline-input bsw-writing-title",
        type: "text",
      }) as HTMLInputElement;
      titleInput.value = w.title;
      titleInput.addEventListener("change", async () => {
        const updated = writing.map((p) => p.id === w.id ? { ...p, title: titleInput.value } : p);
        await this.plugin.dm.saveWriting(updated);
      });

      // Status buttons
      const statusRow = left.createDiv({ cls: "bsw-status-row" });
      (["drafting", "review", "final"] as WritingProject["status"][]).forEach((s) => {
        const btn = statusRow.createEl("button", {
          cls: `bsw-status-btn${w.status === s ? " bsw-status-btn-active" : ""}`,
          text: s,
        });
        btn.addEventListener("click", async () => {
          const updated = writing.map((p) => p.id === w.id ? { ...p, status: s } : p);
          await this.plugin.dm.saveWriting(updated);
          await this.plugin.refreshViews();
        });
      });

      // Word count controls (right)
      const right = titleRow.createDiv({ cls: "bsw-writing-counts" });
      const wcInput = right.createEl("input", { cls: "bsw-count-input", type: "number" }) as HTMLInputElement;
      wcInput.value = String(w.wordCount);
      wcInput.min = "0";
      wcInput.title = "Current word count";
      wcInput.addEventListener("change", async () => {
        const val = Math.max(0, parseInt(wcInput.value, 10) || 0);
        const updated = writing.map((p) => p.id === w.id ? { ...p, wordCount: val } : p);
        await this.plugin.dm.saveWriting(updated);
        await this.plugin.refreshViews();
      });
      right.createEl("span", { cls: "bsw-muted", text: " / " });
      const targetInput = right.createEl("input", { cls: "bsw-count-input bsw-count-target", type: "number" }) as HTMLInputElement;
      targetInput.value = String(w.targetWordCount);
      targetInput.min = "1";
      targetInput.title = "Target word count";
      targetInput.addEventListener("change", async () => {
        const val = Math.max(1, parseInt(targetInput.value, 10) || 1);
        const updated = writing.map((p) => p.id === w.id ? { ...p, targetWordCount: val } : p);
        await this.plugin.dm.saveWriting(updated);
      });
      right.createEl("span", { cls: "bsw-muted bsw-small", text: " words" });

      // Progress bar
      const track = card.createDiv({ cls: "bsw-progress-track" });
      track.createDiv({ cls: "bsw-progress-fill" }).style.width = `${pct}%`;
      card.createEl("p", { cls: "bsw-small bsw-muted", text: `${pct}% of target` });

      // Footer: linked note + task + delete
      const footer = card.createDiv({ cls: "bsw-card-footer" });

      // Linked note chip
      if (w.linkedNotePath) {
        const chip = footer.createDiv({ cls: "bsw-note-chip-sm" });
        const ic = chip.createSpan();
        setIcon(ic, "link");
        chip.createEl("span", { text: w.linkedNotePath.split("/").pop() ?? w.linkedNotePath });
        chip.addEventListener("click", () => {
          this.app.workspace.openLinkText(w.linkedNotePath!, "", false);
        });
      }

      // Generate task button
      const taskBtn = footer.createEl("button", {
        cls: `bsw-btn bsw-btn-xs${w.taskId ? " bsw-btn-done" : ""}`,
        text: w.taskId ? "✓ Task linked" : "Generate task",
      });
      taskBtn.disabled = !!w.taskId;
      taskBtn.addEventListener("click", async () => {
        if (w.taskId) return;
        const taskId = Date.now().toString(36);
        const newTask: Task = {
          id: taskId, title: `Writing: ${w.title}`,
          status: "todo", parentType: "writing", parentId: w.id, parentTitle: w.title,
        };
        const updatedTasks = [...tasks, newTask];
        const updatedWriting = writing.map((p) => p.id === w.id ? { ...p, taskId } : p);
        await this.plugin.dm.saveTasks(updatedTasks);
        await this.plugin.dm.saveWriting(updatedWriting);
        await this.plugin.refreshViews();
      });

      // Delete
      const delBtn = footer.createEl("button", { cls: "bsw-btn bsw-btn-ghost bsw-text-danger bsw-small", text: "Delete" });
      delBtn.addEventListener("click", () => {
        new ConfirmModal(this.app, `Delete "${w.title}"?`, async () => {
          await this.plugin.dm.saveWriting(writing.filter((p) => p.id !== w.id));
          await this.plugin.refreshViews();
        }, "Delete").open();
      });
    });
  }
}
