import { WorkspaceLeaf, setIcon } from "obsidian";
import type BswPlugin from "../main";
import type { Funding } from "../types";
import { BaseView } from "./BaseView";
import { FundingSourceModal, ExpenseModal } from "../modals/FundingModal";
import { ConfirmModal } from "../modals/ConfirmModal";

export const VIEW_TYPE_FUNDING = "bsw-funding";

export class FundingView extends BaseView {
  constructor(leaf: WorkspaceLeaf, plugin: BswPlugin) { super(leaf, plugin); }
  getViewType() { return VIEW_TYPE_FUNDING; }
  getDisplayText() { return "Boswell Funding"; }
  getIcon() { return "circle-dollar-sign"; }

  async onOpen() { await this.refresh(); }
  async onClose() { this.contentEl.empty(); }

  async refresh() {
    const [funding, meta] = await Promise.all([
      this.plugin.dm.loadFunding(),
      this.plugin.dm.loadProject(),
    ]);
    const currency = meta.currency ?? "$";
    this.renderAll(funding, currency);
  }

  private renderAll(funding: Funding[], currency: string) {
    const el = this.contentEl;
    el.empty();
    el.addClass("bsw-view");

    const header = el.createDiv({ cls: "bsw-view-header" });
    header.createEl("h1", { cls: "bsw-page-title", text: "Funding & Grants" });
    const addBtn = header.createEl("button", { cls: "bsw-btn bsw-btn-primary" });
    setIcon(addBtn, "plus");
    addBtn.createEl("span", { text: " Add Source" });
    addBtn.addEventListener("click", () => {
      new FundingSourceModal(this.app, async (f) => {
        await this.plugin.dm.saveFunding([...funding, f]);
        await this.plugin.refreshViews();
      }).open();
    });

    if (funding.length === 0) {
      el.createEl("p", { cls: "bsw-empty", text: "No funding sources added yet." });
      return;
    }

    funding.forEach((f) => {
      const spent = f.expenses.reduce((s, e) => s + e.amount, 0);
      const remaining = f.amount - spent;
      const pct = f.amount > 0 ? Math.min(100, Math.round((spent / f.amount) * 100)) : 0;
      const unfiledCount = f.expenses.filter((e) => !e.reportFiled).length;
      const now = new Date();
      const daysToDeadline = f.deadline
        ? Math.round((new Date(f.deadline).getTime() - now.getTime()) / 86400000)
        : null;

      const card = el.createDiv({ cls: "bsw-card bsw-funding-card" });

      // Header row
      const top = card.createDiv({ cls: "bsw-row-between bsw-align-start" });
      const info = top.createDiv();
      info.createEl("h3", { cls: "bsw-funding-title", text: f.source });
      const meta = info.createEl("p", { cls: "bsw-small bsw-muted" });
      meta.createEl("span", { text: `Total: ${currency}${f.amount.toLocaleString()}` });
      if (f.deadline) {
        const urgentCls = daysToDeadline !== null && daysToDeadline <= 14 ? " bsw-text-warn" : "";
        meta.createEl("span", { text: ` · Deadline: ${f.deadline}${daysToDeadline !== null ? ` (${daysToDeadline < 0 ? "passed" : daysToDeadline + "d"})` : ""}`, cls: urgentCls });
      }
      if (f.notes) info.createEl("p", { cls: "bsw-small bsw-muted bsw-italic", text: f.notes });

      top.createDiv({ cls: "bsw-funding-remaining" })
         .createEl("span", { text: `${currency}${remaining.toLocaleString()}`, cls: "bsw-funding-remaining-val" })
         .parentElement!.createEl("p", { cls: "bsw-label-muted bsw-small", text: "remaining" });

      // Alerts
      if (unfiledCount > 0 || (daysToDeadline !== null && daysToDeadline <= 14)) {
        const alerts = card.createDiv({ cls: "bsw-alert-row" });
        if (daysToDeadline !== null && daysToDeadline <= 14) {
          alerts.createDiv({ cls: "bsw-alert bsw-alert-warn", text: "Deadline approaching" });
        }
        if (unfiledCount > 0) {
          alerts.createDiv({ cls: "bsw-alert bsw-alert-danger", text: `${unfiledCount} expense report${unfiledCount > 1 ? "s" : ""} not filed` });
        }
      }

      // Progress bar
      const track = card.createDiv({ cls: "bsw-progress-track" });
      const fill = track.createDiv({ cls: "bsw-progress-fill" });
      fill.style.width = `${pct}%`;
      if (pct > 90) fill.addClass("bsw-progress-danger");
      else if (pct > 70) fill.addClass("bsw-progress-warn");

      // Expenses table
      const expHeader = card.createDiv({ cls: "bsw-row-between bsw-align-center" });
      expHeader.createEl("p", { cls: "bsw-label-muted", text: `Expenses (${f.expenses.length})` });
      const addExpBtn = expHeader.createEl("button", { cls: "bsw-btn bsw-btn-xs" });
      setIcon(addExpBtn, "plus");
      addExpBtn.createEl("span", { text: " Add" });
      addExpBtn.addEventListener("click", () => {
        new ExpenseModal(this.app, currency, async (exp) => {
          const updated = funding.map((fnd) => fnd.id === f.id ? { ...fnd, expenses: [...fnd.expenses, exp] } : fnd);
          await this.plugin.dm.saveFunding(updated);
          await this.plugin.refreshViews();
        }).open();
      });

      if (f.expenses.length > 0) {
        const table = card.createEl("table", { cls: "bsw-table" });
        const thead = table.createEl("thead");
        const hr = thead.createEl("tr");
        ["Description", "Date", "Amount", "Filed", ""].forEach((h) => hr.createEl("th", { text: h }));
        const tbody = table.createEl("tbody");
        f.expenses.forEach((exp) => {
          const row = tbody.createEl("tr");
          const descTd = row.createEl("td");
          descTd.createEl("span", { text: exp.description });
          if (exp.category) descTd.createEl("span", { cls: "bsw-small bsw-muted bsw-italic", text: ` ${exp.category}` });
          row.createEl("td", { cls: "bsw-mono bsw-small", text: exp.date });
          row.createEl("td", { cls: "bsw-mono", text: `${currency}${exp.amount.toLocaleString()}` });

          const filedTd = row.createEl("td");
          const cb = filedTd.createEl("input", { type: "checkbox" }) as HTMLInputElement;
          cb.checked = exp.reportFiled;
          cb.addEventListener("change", async () => {
            const updated = funding.map((fnd) => fnd.id === f.id ? {
              ...fnd, expenses: fnd.expenses.map((e) => e.id === exp.id ? { ...e, reportFiled: cb.checked } : e)
            } : fnd);
            await this.plugin.dm.saveFunding(updated);
            await this.plugin.refreshViews();
          });

          const delTd = row.createEl("td");
          const delBtn = delTd.createEl("button", { cls: "bsw-icon-btn bsw-text-danger" });
          setIcon(delBtn, "trash-2");
          delBtn.addEventListener("click", async () => {
            const updated = funding.map((fnd) => fnd.id === f.id ? {
              ...fnd, expenses: fnd.expenses.filter((e) => e.id !== exp.id)
            } : fnd);
            await this.plugin.dm.saveFunding(updated);
            await this.plugin.refreshViews();
          });
        });
      }

      // Remove source
      const footer = card.createDiv({ cls: "bsw-card-footer bsw-justify-end" });
      footer.createEl("button", { cls: "bsw-btn bsw-btn-ghost bsw-text-danger bsw-small", text: "Remove funding source" })
            .addEventListener("click", () => {
              new ConfirmModal(this.app, `Remove "${f.source}" and all its expenses?`, async () => {
                await this.plugin.dm.saveFunding(funding.filter((fnd) => fnd.id !== f.id));
                await this.plugin.refreshViews();
              }, "Remove").open();
            });
    });
  }
}
