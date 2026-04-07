import { WorkspaceLeaf, setIcon } from "obsidian";
import type BswPlugin from "../main";
import type { Experiment, Task } from "../types";
import { BaseView } from "./BaseView";
import { ConfirmModal } from "../modals/ConfirmModal";

export const VIEW_TYPE_EXPERIMENTS = "bsw-experiments";

const STATUS_DOT: Record<Experiment["status"], string> = {
  planned: "bsw-dot-neutral",
  running: "bsw-dot-blue",
  completed: "bsw-dot-green",
};

export class ExperimentsView extends BaseView {
  constructor(leaf: WorkspaceLeaf, plugin: BswPlugin) { super(leaf, plugin); }
  getViewType() { return VIEW_TYPE_EXPERIMENTS; }
  getDisplayText() { return "Boswell Experiments"; }
  getIcon() { return "flask-conical"; }

  async onOpen() { await this.refresh(); }
  async onClose() { this.contentEl.empty(); }

  async refresh() {
    const [experiments, tasks] = await Promise.all([
      this.plugin.dm.loadExperiments(),
      this.plugin.dm.loadTasks(),
    ]);
    this.render(experiments, tasks);
  }

  private render(experiments: Experiment[], tasks: Task[]) {
    const el = this.contentEl;
    el.empty();
    el.addClass("bsw-view");

    const header = el.createDiv({ cls: "bsw-view-header" });
    header.createEl("h1", { cls: "bsw-page-title", text: "Experiments & Methods" });
    const addBtn = header.createEl("button", { cls: "bsw-btn bsw-btn-primary" });
    setIcon(addBtn, "plus");
    addBtn.createEl("span", { text: " New Experiment" });
    addBtn.addEventListener("click", async () => {
      const exp = await this.plugin.dm.createExperiment();
      const file = this.plugin.dm.getExperimentFile(exp.id);
      if (file) await this.app.workspace.openLinkText(file.path, "", false);
      await this.plugin.refreshViews();
    });

    const note = el.createDiv({ cls: "bsw-info-banner" });
    setIcon(note.createSpan(), "info");
    note.createEl("span", {
      text: " Experiment records are vault notes — click Open to write the full methodology and results in Obsidian's editor.",
    });

    if (experiments.length === 0) {
      el.createEl("p", { cls: "bsw-empty", text: "No experiments logged yet." });
      return;
    }

    experiments.forEach((exp) => {
      const card = el.createDiv({ cls: "bsw-card bsw-experiment-card" });

      // Header row
      const top = card.createDiv({ cls: "bsw-row-between bsw-align-start" });
      const left = top.createDiv({ cls: "bsw-experiment-left" });

      const titleRow = left.createDiv({ cls: "bsw-row-gap bsw-align-center" });
      titleRow.createDiv({ cls: `bsw-dot ${STATUS_DOT[exp.status]}` });
      const titleInput = titleRow.createEl("input", { cls: "bsw-inline-input bsw-experiment-title", type: "text" }) as HTMLInputElement;
      titleInput.value = exp.title;
      titleInput.addEventListener("change", async () => {
        const updated = { ...exp, title: titleInput.value };
        await this.plugin.dm.saveExperimentMeta(updated);
      });

      const dateInput = left.createEl("input", { cls: "bsw-inline-input bsw-mono bsw-small", type: "date" }) as HTMLInputElement;
      dateInput.value = exp.date;
      dateInput.addEventListener("change", async () => {
        const updated = { ...exp, date: dateInput.value };
        await this.plugin.dm.saveExperimentMeta(updated);
      });

      // Open in editor button
      const openBtn = top.createEl("button", { cls: "bsw-btn bsw-btn-secondary bsw-btn-sm" });
      setIcon(openBtn, "external-link");
      openBtn.createEl("span", { text: " Open" });
      openBtn.addEventListener("click", () => {
        const file = this.plugin.dm.getExperimentFile(exp.id);
        if (file) this.app.workspace.openLinkText(file.path, "", false);
      });

      // Status selector
      const statusRow = card.createDiv({ cls: "bsw-status-row" });
      (["planned", "running", "completed"] as Experiment["status"][]).forEach((s) => {
        const btn = statusRow.createEl("button", {
          cls: `bsw-status-btn${exp.status === s ? " bsw-status-btn-active" : ""}`,
          text: s,
        });
        btn.addEventListener("click", async () => {
          await this.plugin.dm.saveExperimentMeta({ ...exp, status: s });
          await this.plugin.refreshViews();
        });
      });

      // Summary preview
      if (exp.summaryPreview) {
        card.createEl("p", { cls: "bsw-experiment-preview bsw-muted bsw-small", text: exp.summaryPreview });
      }

      // Code repo URL (GitHub etc.)
      const repoInput = card.createDiv({ cls: "bsw-field bsw-experiment-code-field" });
      repoInput.createEl("label", { cls: "bsw-field-label", text: "Code Repository (URL)" });
      const repoRow = repoInput.createDiv({ cls: "bsw-row-gap" });
      const repoInp = repoRow.createEl("input", { cls: "bsw-input bsw-input-sm bsw-mono", type: "url", placeholder: "https://github.com/…" }) as HTMLInputElement;
      repoInp.value = exp.codeRepoUrl ?? "";
      repoInp.addEventListener("change", async () => {
        await this.plugin.dm.saveExperimentMeta({ ...exp, codeRepoUrl: repoInp.value.trim() || undefined });
      });
      if (exp.codeRepoUrl) {
        const openLink = repoRow.createEl("a", { cls: "bsw-btn bsw-btn-xs bsw-btn-secondary", href: exp.codeRepoUrl, text: "Open" });
        openLink.target = "_blank"; openLink.rel = "noreferrer";
      }

      // Local code folder (vault path)
      const folderField = card.createDiv({ cls: "bsw-field bsw-experiment-code-field" });
      folderField.createEl("label", { cls: "bsw-field-label", text: "Local Code Folder (vault path)" });
      const folderInp = folderField.createEl("input", { cls: "bsw-input bsw-input-sm bsw-mono", type: "text", placeholder: "e.g. code/experiment-1/" }) as HTMLInputElement;
      folderInp.value = exp.codeFolderPath ?? "";
      folderInp.addEventListener("change", async () => {
        await this.plugin.dm.saveExperimentMeta({ ...exp, codeFolderPath: folderInp.value.trim() || undefined });
      });

      // Aliases note
      if (exp.aliases && exp.aliases.length > 0) {
        const aliasRow = card.createDiv({ cls: "bsw-experiment-aliases" });
        const aliasIc = aliasRow.createSpan();
        setIcon(aliasIc, "link-2");
        aliasRow.createEl("span", { cls: "bsw-small bsw-muted", text: `Wikilink: ` });
        exp.aliases.forEach((a) => {
          aliasRow.createEl("code", { cls: "bsw-alias-chip", text: `[[${a}]]` });
        });
      }

      // Footer: generate task + delete
      const footer = card.createDiv({ cls: "bsw-card-footer" });
      const taskBtn = footer.createEl("button", {
        cls: `bsw-btn bsw-btn-xs${exp.taskId ? " bsw-btn-done" : ""}`,
        text: exp.taskId ? "✓ Task linked" : "Generate task",
      });
      taskBtn.disabled = !!exp.taskId;
      taskBtn.addEventListener("click", async () => {
        if (exp.taskId) return;
        const taskId = Date.now().toString(36);
        const newTask: Task = {
          id: taskId, title: `Experiment: ${exp.title}`,
          status: "todo", parentType: "experiment", parentId: exp.id, parentTitle: exp.title,
        };
        await this.plugin.dm.saveTasks([...tasks, newTask]);
        await this.plugin.dm.saveExperimentMeta({ ...exp, taskId });
        await this.plugin.refreshViews();
      });

      footer.createEl("button", { cls: "bsw-btn bsw-btn-ghost bsw-text-danger bsw-small", text: "Delete" })
            .addEventListener("click", () => {
              new ConfirmModal(this.app, `Delete experiment "${exp.title}"?`, async () => {
                await this.plugin.dm.deleteExperiment(exp.id);
                await this.plugin.refreshViews();
              }, "Delete").open();
            });
    });
  }
}
