import { WorkspaceLeaf, Modal, setIcon } from "obsidian";
import type BswPlugin from "../main";
import type { ProjectMetadata, Task, Funding, WritingProject, Experiment, LogEntry, Researcher } from "../types";
import { BaseView } from "./BaseView";
import { VIEW_TYPE_KANBAN }       from "./KanbanView";
import { VIEW_TYPE_RESEARCHERS }  from "./ResearchersView";
import { VIEW_TYPE_FUNDING }      from "./FundingView";
import { VIEW_TYPE_WRITING }      from "./WritingView";
import { VIEW_TYPE_EXPERIMENTS }  from "./ExperimentsView";
import { VIEW_TYPE_LOG }          from "./LogView";
import { VIEW_TYPE_TIMELINE }     from "./TimelineView";
import { VIEW_TYPE_EXPORT }       from "./ExportView";

export const VIEW_TYPE_DASHBOARD = "bsw-dashboard";

export class DashboardView extends BaseView {
  constructor(leaf: WorkspaceLeaf, plugin: BswPlugin) { super(leaf, plugin); }

  getViewType()    { return VIEW_TYPE_DASHBOARD; }
  getDisplayText() { return "Boswell Dashboard"; }
  getIcon()        { return "layout-dashboard"; }

  async onOpen()  { await this.refresh(); }
  async onClose() { this.contentEl.empty(); }

  async refresh() {
    const dm = this.plugin.dm;
    const [meta, tasks, funding, writing, experiments, logEntries, researchers] = await Promise.all([
      dm.loadProject(),
      dm.loadTasks(),
      dm.loadFunding(),
      dm.loadWriting(),
      dm.loadExperiments(),
      dm.loadLogEntries(),
      dm.loadResearchers(),
    ]);

    const el = this.contentEl;
    el.empty();
    el.addClasses(["bsw-view", "bsw-dashboard"]);

    this.renderHeader(el, meta);
    this.renderNavPanels(el, tasks, funding, writing, experiments, researchers, logEntries, meta);
    this.renderDeadlines(el, tasks, funding);
    this.renderWritingProgress(el, writing);
    this.renderRecentLog(el, logEntries);
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  private renderHeader(el: HTMLElement, meta: ProjectMetadata) {
    const header = el.createDiv({ cls: "bsw-dash-header" });

    const titleRow = header.createDiv({ cls: "bsw-dash-title-row" });
    titleRow.createEl("h1", { cls: "bsw-dash-title", text: meta.title || "Research Project" });

    const editBtn = titleRow.createEl("button", { cls: "bsw-icon-btn bsw-dash-edit-btn", title: "Edit project details" });
    setIcon(editBtn, "pencil");
    editBtn.addEventListener("click", () => this.openMetaModal(meta));

    if (meta.pi || meta.institution) {
      header.createEl("p", {
        cls: "bsw-dash-byline",
        text: [meta.pi, meta.institution].filter(Boolean).join(" · "),
      });
    }
    if (meta.description) {
      header.createEl("p", { cls: "bsw-dash-description", text: meta.description });
    }
    if (meta.startDate || meta.endDate) {
      header.createEl("p", {
        cls: "bsw-dash-dates",
        text: `${meta.startDate ?? "?"} — ${meta.endDate ?? "ongoing"}`,
      });
    }
  }

  // ── Navigation panels ──────────────────────────────────────────────────────

  private renderNavPanels(
    el: HTMLElement,
    tasks: Task[],
    funding: Funding[],
    writing: WritingProject[],
    experiments: Experiment[],
    researchers: Researcher[],
    logEntries: LogEntry[],
    meta: ProjectMetadata,
  ) {
    const totalFunds   = funding.reduce((s, f) => s + f.amount, 0);
    const totalSpent   = funding.reduce((s, f) => s + f.expenses.reduce((es, e) => es + e.amount, 0), 0);
    const totalWords   = writing.reduce((s, w) => s + w.wordCount, 0);
    const totalTarget  = writing.reduce((s, w) => s + w.targetWordCount, 0);
    const wordPct      = totalTarget > 0 ? Math.round((totalWords / totalTarget) * 100) : 0;
    const openTasks    = tasks.filter((t) => t.status !== "done").length;
    const blocked      = tasks.filter((t) => t.status === "blocked").length;
    const doneTasks    = tasks.filter((t) => t.status === "done").length;
    const c            = meta.currency || "$";

    const grid = el.createDiv({ cls: "bsw-nav-grid" });

    // Each panel: { viewType, icon, label, value, sub, accent?, warning? }
    const panels: Array<{
      viewType: string; icon: string; label: string;
      value: string; sub?: string; badge?: string; badgeCls?: string;
    }> = [
      {
        viewType: VIEW_TYPE_KANBAN,
        icon: "check-square",
        label: "Tasks",
        value: `${doneTasks} / ${tasks.length}`,
        sub: "completed",
        badge: blocked ? `${blocked} blocked` : openTasks ? `${openTasks} open` : undefined,
        badgeCls: blocked ? "bsw-panel-badge-danger" : "bsw-panel-badge-neutral",
      },
      {
        viewType: VIEW_TYPE_RESEARCHERS,
        icon: "users",
        label: "Researchers",
        value: String(researchers.length),
        sub: researchers.length === 1 ? "team member" : "team members",
      },
      {
        viewType: VIEW_TYPE_FUNDING,
        icon: "circle-dollar-sign",
        label: "Funding",
        value: `${c}${(totalFunds - totalSpent).toLocaleString()}`,
        sub: "remaining",
        badge: totalFunds > 0 ? `${Math.round((totalSpent / totalFunds) * 100)}% spent` : undefined,
        badgeCls: "bsw-panel-badge-neutral",
      },
      {
        viewType: VIEW_TYPE_WRITING,
        icon: "file-text",
        label: "Writing",
        value: `${totalWords.toLocaleString()}`,
        sub: "words written",
        badge: totalTarget > 0 ? `${wordPct}%` : undefined,
        badgeCls: "bsw-panel-badge-neutral",
      },
      {
        viewType: VIEW_TYPE_EXPERIMENTS,
        icon: "flask-conical",
        label: "Experiments",
        value: String(experiments.length),
        sub: experiments.filter((e) => e.status === "running").length
          ? `${experiments.filter((e) => e.status === "running").length} running`
          : experiments.filter((e) => e.status === "completed").length
          ? `${experiments.filter((e) => e.status === "completed").length} completed`
          : "logged",
      },
      {
        viewType: VIEW_TYPE_LOG,
        icon: "book-marked",
        label: "Research Log",
        value: String(logEntries.length),
        sub: logEntries.length === 1 ? "entry" : "entries",
        badge: logEntries[0]?.date === new Date().toISOString().split("T")[0] ? "today ✓" : undefined,
        badgeCls: "bsw-panel-badge-green",
      },
      {
        viewType: VIEW_TYPE_TIMELINE,
        icon: "calendar-days",
        label: "Timeline",
        value: String(tasks.filter((t) => t.dueDate && t.status !== "done").length),
        sub: "upcoming deadlines",
      },
      {
        viewType: VIEW_TYPE_EXPORT,
        icon: "download",
        label: "Export",
        value: "Report",
        sub: "generate status report",
      },
    ];

    panels.forEach(({ viewType, icon, label, value, sub, badge, badgeCls }) => {
      const panel = grid.createDiv({ cls: "bsw-nav-panel" });
      panel.addEventListener("click", () => this.plugin.activateView(viewType));

      const top = panel.createDiv({ cls: "bsw-panel-top" });
      const iconEl = top.createDiv({ cls: "bsw-panel-icon" });
      setIcon(iconEl, icon);

      if (badge) {
        top.createEl("span", { cls: `bsw-panel-badge ${badgeCls ?? ""}`, text: badge });
      }

      panel.createEl("p", { cls: "bsw-panel-value", text: value });
      panel.createEl("p", { cls: "bsw-panel-label", text: label });
      if (sub) panel.createEl("p", { cls: "bsw-panel-sub", text: sub });

      // Hover arrow hint
      const arrow = panel.createDiv({ cls: "bsw-panel-arrow" });
      setIcon(arrow, "arrow-right");
    });
  }

  // ── Deadlines ──────────────────────────────────────────────────────────────

  private renderDeadlines(el: HTMLElement, tasks: Task[], funding: Funding[]) {
    const now = Date.now();
    const events = [
      ...tasks.filter((t) => t.dueDate && t.status !== "done").map((t) => ({
        label: t.title, type: "task",
        days: Math.round((new Date(t.dueDate!).getTime() - now) / 86400000),
      })),
      ...funding.filter((f) => f.deadline).map((f) => ({
        label: `${f.source} deadline`, type: "funding",
        days: Math.round((new Date(f.deadline!).getTime() - now) / 86400000),
      })),
    ].filter((e) => e.days >= -1).sort((a, b) => a.days - b.days).slice(0, 6);

    if (events.length === 0) return;

    const section = el.createDiv({ cls: "bsw-dash-section" });
    const secHeader = section.createDiv({ cls: "bsw-dash-section-header" });
    secHeader.createEl("h2", { cls: "bsw-dash-section-title", text: "Upcoming Deadlines" });
    const viewBtn = secHeader.createEl("button", { cls: "bsw-dash-section-link", text: "View timeline" });
    viewBtn.addEventListener("click", () => this.plugin.activateView(VIEW_TYPE_TIMELINE));

    const list = section.createDiv({ cls: "bsw-deadline-list" });
    events.forEach(({ label, days, type }) => {
      const row = list.createDiv({ cls: "bsw-deadline-row" });
      const dot = row.createDiv({ cls: "bsw-dot" });
      dot.addClass(days < 0 ? "bsw-dot-danger" : days <= 3 ? "bsw-dot-warn" : type === "funding" ? "bsw-dot-amber" : "bsw-dot-neutral");
      row.createEl("span", { cls: "bsw-deadline-label", text: label });
      const daysEl = row.createEl("span", { cls: "bsw-deadline-days" });
      daysEl.setText(days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`);
      if (days < 0) daysEl.addClass("bsw-text-danger");
      else if (days <= 3) daysEl.addClass("bsw-text-warn");
    });
  }

  // ── Writing progress ───────────────────────────────────────────────────────

  private renderWritingProgress(el: HTMLElement, writing: WritingProject[]) {
    if (writing.length === 0) return;
    const section = el.createDiv({ cls: "bsw-dash-section" });
    const secHeader = section.createDiv({ cls: "bsw-dash-section-header" });
    secHeader.createEl("h2", { cls: "bsw-dash-section-title", text: "Writing Progress" });
    const viewBtn = secHeader.createEl("button", { cls: "bsw-dash-section-link", text: "View all" });
    viewBtn.addEventListener("click", () => this.plugin.activateView(VIEW_TYPE_WRITING));

    writing.slice(0, 5).forEach((w) => {
      const pct = w.targetWordCount > 0 ? Math.min(100, Math.round((w.wordCount / w.targetWordCount) * 100)) : 0;
      const item = section.createDiv({ cls: "bsw-writing-item" });
      const row = item.createDiv({ cls: "bsw-row-between" });
      row.createEl("span", { cls: "bsw-writing-title", text: w.title });
      row.createEl("span", { cls: "bsw-mono bsw-small bsw-muted", text: `${pct}%` });
      item.createDiv({ cls: "bsw-progress-track" }).createDiv({ cls: "bsw-progress-fill" }).style.width = `${pct}%`;
    });
  }

  // ── Recent log ─────────────────────────────────────────────────────────────

  private renderRecentLog(el: HTMLElement, entries: LogEntry[]) {
    if (entries.length === 0) return;
    const section = el.createDiv({ cls: "bsw-dash-section" });
    const secHeader = section.createDiv({ cls: "bsw-dash-section-header" });
    secHeader.createEl("h2", { cls: "bsw-dash-section-title", text: "Recent Log" });
    const viewBtn = secHeader.createEl("button", { cls: "bsw-dash-section-link", text: "Open log" });
    viewBtn.addEventListener("click", () => this.plugin.activateView(VIEW_TYPE_LOG));

    const grid = section.createDiv({ cls: "bsw-log-preview-grid" });
    entries.slice(0, 3).forEach((e) => {
      const card = grid.createDiv({ cls: "bsw-log-preview-card" });
      card.createEl("p", { cls: "bsw-mono bsw-small bsw-muted", text: e.date });
      card.createEl("p", { cls: "bsw-log-preview-text", text: e.preview ?? "(no content)" });
      card.addEventListener("click", () => {
        const file = this.plugin.dm.getLogFile(e.date);
        if (file) this.app.workspace.openLinkText(file.path, "", false);
      });
    });
  }

  // ── Project metadata modal ─────────────────────────────────────────────────

  private openMetaModal(current: ProjectMetadata) {
    const plugin = this.plugin;

    class MetaModal extends Modal {
      onOpen() {
        this.titleEl.setText("Edit Project Details");
        const el = this.contentEl;
        el.addClass("bsw-modal");
        const draft = { ...current };

        const defs: Array<{ key: keyof ProjectMetadata; label: string; placeholder: string; type?: string }> = [
          { key: "title",       label: "Project Title",            placeholder: "Your project title" },
          { key: "pi",          label: "Principal Investigator",   placeholder: "Your name" },
          { key: "institution", label: "Institution",              placeholder: "University / Department" },
          { key: "description", label: "Description",              placeholder: "One sentence about this project" },
          { key: "currency",    label: "Currency Symbol",          placeholder: "$" },
          { key: "startDate",   label: "Start Date",               placeholder: "", type: "date" },
          { key: "endDate",     label: "End Date",                 placeholder: "", type: "date" },
        ];

        defs.forEach(({ key, label, placeholder, type }) => {
          const f = el.createDiv({ cls: "bsw-field" });
          f.createEl("label", { text: label, cls: "bsw-field-label" });
          const inp = f.createEl("input", { cls: "bsw-input", type: type ?? "text", placeholder }) as HTMLInputElement;
          inp.value = (draft[key] as string) ?? "";
          inp.addEventListener("input", () => { (draft as any)[key] = inp.value || undefined; });
          if (key === "title") setTimeout(() => inp.focus(), 50);
        });

        const actions = el.createDiv({ cls: "bsw-modal-actions" });
        actions.createEl("button", { text: "Cancel", cls: "bsw-btn bsw-btn-secondary" })
               .addEventListener("click", () => this.close());
        actions.createEl("button", { text: "Save", cls: "bsw-btn bsw-btn-primary" })
               .addEventListener("click", async () => {
                 await plugin.dm.saveProject({ ...draft, currency: draft.currency || "$" });
                 await plugin.refreshViews();
                 this.close();
               });
      }
      onClose() { this.contentEl.empty(); }
    }

    new MetaModal(this.app).open();
  }
}
