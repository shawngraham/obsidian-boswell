import { WorkspaceLeaf, setIcon } from "obsidian";
import type BswPlugin from "../main";
import type { ProjectMetadata, Researcher, Task, Funding, WritingProject, Experiment, LogEntry } from "../types";
import { BaseView } from "./BaseView";

export const VIEW_TYPE_EXPORT = "bsw-export";

type Section = "overview" | "team" | "tasks" | "funding" | "writing" | "experiments" | "log";

const SECTIONS: { id: Section; label: string; desc: string }[] = [
  { id: "overview",     label: "Project Overview",   desc: "Title, PI, institution, dates" },
  { id: "team",         label: "Team Members",        desc: "Researchers, roles, task counts" },
  { id: "tasks",        label: "Task Summary",        desc: "Kanban breakdown, blocked and overdue" },
  { id: "funding",      label: "Funding & Expenses",  desc: "Grant balances and expense log" },
  { id: "writing",      label: "Writing Progress",    desc: "Word counts and status per project" },
  { id: "experiments",  label: "Experiments",         desc: "All experiments with dates and status" },
  { id: "log",          label: "Recent Log",          desc: "Last N days of the research log" },
];

function generateMarkdown(
  meta: ProjectMetadata,
  researchers: Researcher[],
  tasks: Task[],
  funding: Funding[],
  writing: WritingProject[],
  experiments: Experiment[],
  logEntries: LogEntry[],
  selected: Set<Section>,
  reportDate: string,
  logDays: number,
): string {
  const c = meta.currency || "$";
  const now = new Date();
  const lines: string[] = [
    `# Status Report`,
    `*Generated: ${now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}*`,
    `*Report date: ${reportDate}*`,
    "",
  ];

  if (selected.has("overview")) {
    lines.push("## Project Overview", "");
    lines.push(`**Project:** ${meta.title}`);
    if (meta.pi) lines.push(`**PI:** ${meta.pi}`);
    if (meta.institution) lines.push(`**Institution:** ${meta.institution}`);
    if (meta.startDate || meta.endDate) lines.push(`**Period:** ${meta.startDate ?? "?"} — ${meta.endDate ?? "ongoing"}`);
    if (meta.description) { lines.push(""); lines.push(meta.description); }
    lines.push("");
  }

  if (selected.has("team") && researchers.length > 0) {
    lines.push("## Team Members", "");
    researchers.forEach((r) => {
      const assigned = tasks.filter((t) => t.assigneeId === r.id);
      const done = assigned.filter((t) => t.status === "done").length;
      lines.push(`### ${r.name}`, `*${r.role}*`);
      if (r.email) lines.push(`- Email: ${r.email}`);
      if (r.studentID) lines.push(`- Student ID: ${r.studentID}`);
      if (assigned.length > 0) lines.push(`- Tasks: ${done}/${assigned.length} completed`);
      lines.push("");
    });
  }

  if (selected.has("tasks")) {
    lines.push("## Task Summary", "");
    const todo = tasks.filter((t) => t.status === "todo");
    const inProg = tasks.filter((t) => t.status === "in-progress");
    const blocked = tasks.filter((t) => t.status === "blocked");
    const done = tasks.filter((t) => t.status === "done");
    const overdue = tasks.filter((t) => t.dueDate && t.status !== "done" && t.dueDate < reportDate);
    lines.push(`| Status | Count |`, `|---|---|`,
      `| To Do | ${todo.length} |`, `| In Progress | ${inProg.length} |`,
      `| Blocked | ${blocked.length} |`, `| Done | ${done.length} |`,
      `| **Total** | **${tasks.length}** |`, "");
    if (inProg.length > 0) {
      lines.push("### In Progress");
      inProg.forEach((t) => {
        const who = researchers.find((r) => r.id === t.assigneeId);
        lines.push(`- ${t.title}${who ? ` — ${who.name}` : ""}${t.dueDate ? ` *(due ${t.dueDate})*` : ""}`);
      });
      lines.push("");
    }
    if (blocked.length > 0) {
      lines.push("### Blocked");
      blocked.forEach((t) => {
        const who = researchers.find((r) => r.id === t.assigneeId);
        lines.push(`- ⚠ ${t.title}${who ? ` — ${who.name}` : ""}`);
      });
      lines.push("");
    }
    if (overdue.length > 0) {
      lines.push("### Overdue");
      overdue.forEach((t) => {
        const who = researchers.find((r) => r.id === t.assigneeId);
        lines.push(`- **${t.title}** *(due ${t.dueDate})*${who ? ` — ${who.name}` : ""}`);
      });
      lines.push("");
    }
  }

  if (selected.has("funding") && funding.length > 0) {
    lines.push("## Funding & Expenses", "");
    const total = funding.reduce((s, f) => s + f.amount, 0);
    const spent = funding.reduce((s, f) => s + f.expenses.reduce((es, e) => es + e.amount, 0), 0);
    lines.push(`**Total:** ${c}${total.toLocaleString()} | **Spent:** ${c}${spent.toLocaleString()} | **Remaining:** ${c}${(total - spent).toLocaleString()}`, "");
    funding.forEach((f) => {
      const fSpent = f.expenses.reduce((s, e) => s + e.amount, 0);
      const unfiled = f.expenses.filter((e) => !e.reportFiled).length;
      lines.push(`### ${f.source}`);
      lines.push(`${c}${f.amount.toLocaleString()} total · ${c}${fSpent.toLocaleString()} spent · ${c}${(f.amount - fSpent).toLocaleString()} remaining`);
      if (f.deadline) lines.push(`Deadline: ${f.deadline}`);
      if (unfiled > 0) lines.push(`⚠ ${unfiled} report${unfiled > 1 ? "s" : ""} not filed`);
      if (f.expenses.length > 0) {
        lines.push("", "| Description | Date | Amount | Filed |", "|---|---|---|---|");
        f.expenses.forEach((e) => lines.push(`| ${e.description} | ${e.date} | ${c}${e.amount.toLocaleString()} | ${e.reportFiled ? "✓" : "✗"} |`));
      }
      lines.push("");
    });
  }

  if (selected.has("writing") && writing.length > 0) {
    lines.push("## Writing Progress", "");
    lines.push("| Project | Words | Target | Progress | Status |", "|---|---|---|---|---|");
    writing.forEach((w) => {
      const pct = w.targetWordCount > 0 ? Math.round((w.wordCount / w.targetWordCount) * 100) : 0;
      const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
      lines.push(`| ${w.title} | ${w.wordCount.toLocaleString()} | ${w.targetWordCount.toLocaleString()} | ${bar} ${pct}% | ${w.status} |`);
    });
    lines.push("");
  }

  if (selected.has("experiments") && experiments.length > 0) {
    lines.push("## Experiments", "");
    experiments.forEach((e) => {
      lines.push(`### ${e.title}`, `*${e.date} — ${e.status}*`);
      if (e.summaryPreview) lines.push("", e.summaryPreview);
      if (e.codeRepoUrl) lines.push(`Code: ${e.codeRepoUrl}`);
      lines.push("");
    });
  }

  if (selected.has("log") && logEntries.length > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - logDays);
    const cutStr = cutoff.toISOString().split("T")[0];
    const recent = logEntries.filter((e) => e.date >= cutStr);
    if (recent.length > 0) {
      lines.push(`## Research Log (last ${logDays} days)`, "");
      recent.forEach((e) => lines.push(`### ${e.date}`, "", e.preview ?? "", ""));
    }
  }

  return lines.join("\n");
}

export class ExportView extends BaseView {
  constructor(leaf: WorkspaceLeaf, plugin: BswPlugin) { super(leaf, plugin); }
  getViewType() { return VIEW_TYPE_EXPORT; }
  getDisplayText() { return "Boswell Export"; }
  getIcon() { return "download"; }

  async onOpen() { await this.refresh(); }
  async onClose() { this.contentEl.empty(); }

  async refresh() {
    const [meta, researchers, tasks, funding, writing, experiments, logEntries] = await Promise.all([
      this.plugin.dm.loadProject(),
      this.plugin.dm.loadResearchers(),
      this.plugin.dm.loadTasks(),
      this.plugin.dm.loadFunding(),
      this.plugin.dm.loadWriting(),
      this.plugin.dm.loadExperiments(),
      this.plugin.dm.loadLogEntries(),
    ]);
    this.render(meta, researchers, tasks, funding, writing, experiments, logEntries);
  }

  private render(
    meta: ProjectMetadata, researchers: Researcher[], tasks: Task[],
    funding: Funding[], writing: WritingProject[], experiments: Experiment[], logEntries: LogEntry[],
  ) {
    const el = this.contentEl;
    el.empty();
    el.addClass("bsw-view");

    el.createEl("h1", { cls: "bsw-page-title", text: "Export Status Report" });
    el.createEl("p", { cls: "bsw-muted", text: "Generate a formatted report from your project data. The report saves as a note in your vault." });

    const layout = el.createDiv({ cls: "bsw-export-layout" });
    const left = layout.createDiv({ cls: "bsw-export-left" });
    const right = layout.createDiv({ cls: "bsw-export-right" });

    // Options
    const optsCard = left.createDiv({ cls: "bsw-card" });
    optsCard.createEl("h3", { cls: "bsw-card-title", text: "Options" });

    const today = new Date().toISOString().split("T")[0];
    const dateField = optsCard.createDiv({ cls: "bsw-field" });
    dateField.createEl("label", { cls: "bsw-field-label", text: "Report Date" });
    const dateInput = dateField.createEl("input", { cls: "bsw-input", type: "date" }) as HTMLInputElement;
    dateInput.value = today;

    const logField = optsCard.createDiv({ cls: "bsw-field" });
    logField.createEl("label", { cls: "bsw-field-label", text: "Log: days to include" });
    const logInput = logField.createEl("input", { cls: "bsw-input", type: "number" }) as HTMLInputElement;
    logInput.value = "14";
    logInput.min = "1";

    // Sections
    const secCard = left.createDiv({ cls: "bsw-card" });
    secCard.createEl("h3", { cls: "bsw-card-title", text: "Sections" });
    const selected = new Set<Section>(["overview", "team", "tasks", "funding", "writing", "experiments"]);
    const checkboxes: Record<Section, HTMLInputElement> = {} as any;

    SECTIONS.forEach(({ id, label, desc }) => {
      const row = secCard.createEl("label", { cls: `bsw-section-toggle${selected.has(id) ? " bsw-section-toggle-active" : ""}` });
      const cb = row.createEl("input", { type: "checkbox" }) as HTMLInputElement;
      cb.checked = selected.has(id);
      checkboxes[id] = cb;
      const text = row.createDiv();
      text.createEl("span", { cls: "bsw-section-label", text: label });
      text.createEl("span", { cls: "bsw-section-desc bsw-muted bsw-small", text: desc });

      cb.addEventListener("change", () => {
        if (cb.checked) { selected.add(id); row.addClass("bsw-section-toggle-active"); }
        else { selected.delete(id); row.removeClass("bsw-section-toggle-active"); }
        updatePreview();
      });
    });

    // Actions
    const actions = left.createDiv({ cls: "bsw-export-actions" });

    const saveBtn = actions.createEl("button", { cls: "bsw-btn bsw-btn-primary" });
    setIcon(saveBtn, "save");
    saveBtn.createEl("span", { text: " Save to Vault" });

    const copyBtn = actions.createEl("button", { cls: "bsw-btn bsw-btn-secondary" });
    setIcon(copyBtn, "copy");
    copyBtn.createEl("span", { text: " Copy Markdown" });

    // Preview pane
    right.createEl("h3", { cls: "bsw-card-title", text: "Preview" });
    const preview = right.createEl("pre", { cls: "bsw-export-preview" });

    const getMarkdown = () => generateMarkdown(
      meta, researchers, tasks, funding, writing, experiments, logEntries,
      selected, dateInput.value || today, Math.max(1, parseInt(logInput.value, 10) || 14),
    );

    const updatePreview = () => { preview.setText(getMarkdown()); };
    updatePreview();

    dateInput.addEventListener("change", updatePreview);
    logInput.addEventListener("change", updatePreview);

    saveBtn.addEventListener("click", async () => {
      const md = getMarkdown();
      const fileName = `${this.plugin.settings.dataFolder}/reports/status-report-${dateInput.value || today}.md`;
      const { normalizePath } = require("obsidian");
      const path = normalizePath(fileName);
      const folder = path.substring(0, path.lastIndexOf("/"));
      const folderAbs = this.app.vault.getAbstractFileByPath(folder);
      if (!folderAbs) await this.app.vault.createFolder(folder);
      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing) {
        await this.app.vault.modify(existing as any, md);
      } else {
        await this.app.vault.create(path, md);
      }
      await this.app.workspace.openLinkText(path, "", false);
    });

    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(getMarkdown());
      const orig = copyBtn.querySelector("span")!;
      orig.textContent = " Copied!";
      setTimeout(() => { orig.textContent = " Copy Markdown"; }, 2000);
    });
  }
}
