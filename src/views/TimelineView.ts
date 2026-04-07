import { WorkspaceLeaf, setIcon } from "obsidian";
import type BswPlugin from "../main";
import type { Task, Experiment, Funding } from "../types";
import { BaseView } from "./BaseView";

export const VIEW_TYPE_TIMELINE = "bsw-timeline";

interface TimelineEvent {
  date: string;
  label: string;
  type: "task" | "experiment" | "deadline";
  status: string;
  done: boolean;
  overdue: boolean;
  icon: string;
  dotCls: string;
}

export class TimelineView extends BaseView {
  constructor(leaf: WorkspaceLeaf, plugin: BswPlugin) { super(leaf, plugin); }
  getViewType() { return VIEW_TYPE_TIMELINE; }
  getDisplayText() { return "Boswell Timeline"; }
  getIcon() { return "calendar-days"; }

  async onOpen() { await this.refresh(); }
  async onClose() { this.contentEl.empty(); }

  async refresh() {
    const [tasks, experiments, funding] = await Promise.all([
      this.plugin.dm.loadTasks(),
      this.plugin.dm.loadExperiments(),
      this.plugin.dm.loadFunding(),
    ]);
    this.render(tasks, experiments, funding);
  }

  private render(tasks: Task[], experiments: Experiment[], funding: Funding[]) {
    const el = this.contentEl;
    el.empty();
    el.addClass("bsw-view");

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const header = el.createDiv({ cls: "bsw-view-header" });
    header.createEl("h1", { cls: "bsw-page-title", text: "Timeline" });

    // Filter controls
    const controls = header.createDiv({ cls: "bsw-timeline-controls" });
    let showPast = false;
    const pastBtn = controls.createEl("button", {
      cls: "bsw-btn bsw-btn-secondary bsw-btn-sm",
      text: "Show past",
    });

    // Build events
    const buildEvents = (): TimelineEvent[] => {
      const evs: TimelineEvent[] = [];

      tasks.filter((t) => t.dueDate).forEach((t) => {
        const overdue = t.dueDate! < today && t.status !== "done";
        evs.push({
          date: t.dueDate!,
          label: t.title,
          type: "task",
          status: t.status,
          done: t.status === "done",
          overdue,
          icon: "check-square",
          dotCls: t.status === "done" ? "bsw-dot-neutral" : overdue ? "bsw-dot-danger" : t.status === "blocked" ? "bsw-dot-danger" : "bsw-dot-blue",
        });
      });

      experiments.forEach((e) => {
        evs.push({
          date: e.date,
          label: e.title,
          type: "experiment",
          status: e.status,
          done: e.status === "completed",
          overdue: false,
          icon: "flask-conical",
          dotCls: e.status === "completed" ? "bsw-dot-neutral" : "bsw-dot-purple",
        });
      });

      funding.filter((f) => f.deadline).forEach((f) => {
        const overdue = f.deadline! < today;
        evs.push({
          date: f.deadline!,
          label: `${f.source} deadline`,
          type: "deadline",
          status: "",
          done: false,
          overdue,
          icon: "circle-dollar-sign",
          dotCls: overdue ? "bsw-dot-danger" : "bsw-dot-amber",
        });
      });

      return evs
        .filter((e) => showPast || e.date >= today || e.date === today)
        .sort((a, b) => a.date.localeCompare(b.date));
    };

    const renderTimeline = () => {
      listEl.empty();

      const events = buildEvents();

      if (events.length === 0) {
        listEl.createEl("p", { cls: "bsw-empty", text: showPast ? "No events." : "No upcoming events. Toggle 'Show past' to see history." });
        return;
      }

      // Group by month
      const months = new Map<string, TimelineEvent[]>();
      events.forEach((e) => {
        const key = e.date.slice(0, 7); // YYYY-MM
        if (!months.has(key)) months.set(key, []);
        months.get(key)!.push(e);
      });

      for (const [monthKey, monthEvents] of months) {
        const [year, month] = monthKey.split("-");
        const monthLabel = new Date(`${monthKey}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
        const isPast = monthKey < today.slice(0, 7);

        const monthSection = listEl.createDiv({ cls: `bsw-timeline-month${isPast ? " bsw-timeline-past" : ""}` });

        // Month header
        const monthHeader = monthSection.createDiv({ cls: "bsw-timeline-month-header" });
        monthHeader.createEl("span", { cls: "bsw-timeline-month-label", text: monthLabel });
        monthHeader.createDiv({ cls: "bsw-timeline-month-line" });

        // Events
        monthEvents.forEach((evt) => {
          const isToday = evt.date === today;
          const eventRow = monthSection.createDiv({ cls: `bsw-timeline-event${isToday ? " bsw-timeline-event-today" : ""}` });

          // Date column
          const dateCol = eventRow.createDiv({ cls: "bsw-timeline-date-col" });
          dateCol.createEl("span", {
            cls: `bsw-mono bsw-small${isToday ? " bsw-text-accent" : " bsw-muted"}`,
            text: evt.date.slice(5), // MM-DD
          });
          if (isToday) dateCol.createEl("span", { cls: "bsw-badge bsw-badge-today", text: "today" });

          // Dot
          eventRow.createDiv({ cls: `bsw-dot bsw-timeline-dot ${evt.dotCls}${isToday ? " bsw-dot-ring" : ""}` });

          // Event card
          const evCard = eventRow.createDiv({ cls: `bsw-timeline-ev-card${evt.done ? " bsw-timeline-ev-done" : ""}${evt.overdue && !evt.done ? " bsw-timeline-ev-overdue" : ""}` });
          const ic = evCard.createSpan({ cls: "bsw-timeline-ev-icon" });
          setIcon(ic, evt.icon);
          const text = evCard.createDiv();
          text.createEl("p", { cls: `bsw-timeline-ev-label${evt.done ? " bsw-strikethrough" : ""}`, text: evt.label });
          if (evt.status) text.createEl("p", { cls: "bsw-small bsw-muted bsw-capitalize", text: evt.status });
          if (evt.overdue && !evt.done) {
            evCard.createEl("span", { cls: "bsw-badge bsw-badge-danger", text: "overdue" });
          }
        });
      }
    };

    const listEl = el.createDiv({ cls: "bsw-timeline-list" });
    renderTimeline();

    pastBtn.addEventListener("click", () => {
      showPast = !showPast;
      pastBtn.setText(showPast ? "Hide past" : "Show past");
      renderTimeline();
    });

    // Today marker in header
    header.createEl("p", {
      cls: "bsw-small bsw-muted",
      text: `Today: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
    });
  }
}
