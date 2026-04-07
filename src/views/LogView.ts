import { WorkspaceLeaf, setIcon } from "obsidian";
import type BswPlugin from "../main";
import type { LogEntry } from "../types";
import { BaseView } from "./BaseView";
import { ConfirmModal } from "../modals/ConfirmModal";

export const VIEW_TYPE_LOG = "bsw-log";

export class LogView extends BaseView {
  constructor(leaf: WorkspaceLeaf, plugin: BswPlugin) { super(leaf, plugin); }
  getViewType() { return VIEW_TYPE_LOG; }
  getDisplayText() { return "Boswell Log"; }
  getIcon() { return "book-marked"; }

  async onOpen() { await this.refresh(); }
  async onClose() { this.contentEl.empty(); }

  async refresh() {
    const entries = await this.plugin.dm.loadLogEntries();
    this.render(entries);
  }

  private render(entries: LogEntry[]) {
    const el = this.contentEl;
    el.empty();
    el.addClass("bsw-view");

    const today = new Date().toISOString().split("T")[0];

    const header = el.createDiv({ cls: "bsw-view-header" });
    header.createEl("h1", { cls: "bsw-page-title", text: "Research Log" });
    const addBtn = header.createEl("button", { cls: "bsw-btn bsw-btn-primary" });
    setIcon(addBtn, "plus");
    addBtn.createEl("span", { text: " Today's Entry" });
    addBtn.addEventListener("click", async () => {
      const file = await this.plugin.dm.getOrCreateLogNote(today);
      await this.app.workspace.openLinkText(file.path, "", false);
      await this.plugin.refreshViews();
    });

    // Info banner
    const banner = el.createDiv({ cls: "bsw-info-banner" });
    setIcon(banner.createSpan(), "info");
    banner.createEl("span", {
      text: " Each log entry is a vault note in _boswell/log/. Click an entry to open and write in Obsidian's editor.",
    });

    if (entries.length === 0) {
      el.createEl("p", { cls: "bsw-empty", text: "No log entries yet. Start with today's entry." });
      return;
    }

    // Group by week (ISO week)
    const getWeekKey = (dateStr: string): string => {
      const d = new Date(dateStr + "T12:00:00");
      const day = d.getDay();
      const diffToMon = (day === 0 ? -6 : 1 - day);
      const mon = new Date(d);
      mon.setDate(d.getDate() + diffToMon);
      return mon.toISOString().split("T")[0];
    };

    const weeks = new Map<string, LogEntry[]>();
    entries.forEach((e) => {
      const k = getWeekKey(e.date);
      if (!weeks.has(k)) weeks.set(k, []);
      weeks.get(k)!.push(e);
    });

    for (const [weekStart, weekEntries] of weeks) {
      const section = el.createDiv({ cls: "bsw-log-week" });
      const weekEnd = new Date(weekStart + "T12:00:00");
      weekEnd.setDate(weekEnd.getDate() + 6);
      section.createEl("h3", {
        cls: "bsw-log-week-label",
        text: `Week of ${weekStart}`,
      });

      weekEntries.forEach((entry) => {
        const row = section.createDiv({ cls: "bsw-log-entry-row" });
        const isToday = entry.date === today;

        const left = row.createDiv({ cls: "bsw-log-entry-left" });
        if (isToday) left.createEl("span", { cls: "bsw-badge bsw-badge-today", text: "Today" });
        left.createEl("span", { cls: "bsw-mono bsw-small", text: entry.date });

        const content = row.createDiv({ cls: "bsw-log-entry-content" });
        content.createEl("p", { cls: "bsw-log-preview", text: entry.preview ?? "(no content)" });
        content.addEventListener("click", async () => {
          const file = this.plugin.dm.getLogFile(entry.date);
          if (file) await this.app.workspace.openLinkText(file.path, "", false);
        });

        // Delete button
        const delBtn = row.createEl("button", { cls: "bsw-icon-btn bsw-text-danger bsw-log-del-btn" });
        setIcon(delBtn, "trash-2");
        delBtn.title = "Delete this log entry";
        delBtn.addEventListener("click", () => {
          new ConfirmModal(this.app, `Delete log entry for ${entry.date}?`, async () => {
            await this.plugin.dm.deleteLogEntry(entry.date);
            await this.plugin.refreshViews();
          }, "Delete").open();
        });
      });
    }
  }
}
