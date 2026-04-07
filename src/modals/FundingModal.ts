import { App, Modal } from "obsidian";
import type { Expense, Funding } from "../types";

function field(parent: HTMLElement, label: string): HTMLElement {
  const wrap = parent.createDiv({ cls: "bsw-field" });
  wrap.createEl("label", { text: label, cls: "bsw-field-label" });
  return wrap;
}

export class FundingSourceModal extends Modal {
  constructor(app: App, private onSave: (f: Funding) => void) { super(app); }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("bsw-modal");
    this.titleEl.setText("Add Funding Source");

    const srcField = field(contentEl, "Source Name *");
    const srcInput = srcField.createEl("input", { cls: "bsw-input", type: "text", placeholder: "e.g. NEH Grant #442" }) as HTMLInputElement;

    const grid = contentEl.createDiv({ cls: "bsw-grid-2" });

    const amtField = field(grid, "Total Amount *");
    const amtInput = amtField.createEl("input", { cls: "bsw-input", type: "number", placeholder: "25000" }) as HTMLInputElement;

    const dlField = field(grid, "Deadline");
    const dlInput = dlField.createEl("input", { cls: "bsw-input", type: "date" }) as HTMLInputElement;

    const notesField = field(contentEl, "Notes");
    const notesInput = notesField.createEl("input", { cls: "bsw-input", type: "text", placeholder: "Grant conditions, scope, etc." }) as HTMLInputElement;

    const actions = contentEl.createDiv({ cls: "bsw-modal-actions" });
    actions.createEl("button", { text: "Cancel", cls: "bsw-btn bsw-btn-secondary" })
           .addEventListener("click", () => this.close());
    actions.createEl("button", { text: "Add Source", cls: "bsw-btn bsw-btn-primary" })
           .addEventListener("click", () => {
             const amt = parseFloat(amtInput.value);
             if (!srcInput.value.trim() || isNaN(amt)) return;
             this.onSave({
               id: Date.now().toString(36),
               source: srcInput.value.trim(),
               amount: amt,
               expenses: [],
               deadline: dlInput.value || undefined,
               notes: notesInput.value.trim() || undefined,
             });
             this.close();
           });

    setTimeout(() => srcInput.focus(), 50);
  }

  onClose(): void { this.contentEl.empty(); }
}

export class ExpenseModal extends Modal {
  constructor(app: App, private currency: string, private onSave: (e: Expense) => void) { super(app); }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("bsw-modal");
    this.titleEl.setText("Add Expense");

    const descField = contentEl.createDiv({ cls: "bsw-field" });
    descField.createEl("label", { text: "Description *", cls: "bsw-field-label" });
    const descInput = descField.createEl("input", { cls: "bsw-input", type: "text", placeholder: "e.g. Archive travel — London" }) as HTMLInputElement;

    const grid = contentEl.createDiv({ cls: "bsw-grid-2" });

    const amtField = grid.createDiv({ cls: "bsw-field" });
    amtField.createEl("label", { text: `Amount (${this.currency}) *`, cls: "bsw-field-label" });
    const amtInput = amtField.createEl("input", { cls: "bsw-input", type: "number", placeholder: "1200" }) as HTMLInputElement;

    const catField = grid.createDiv({ cls: "bsw-field" });
    catField.createEl("label", { text: "Category", cls: "bsw-field-label" });
    const catInput = catField.createEl("input", { cls: "bsw-input", type: "text", placeholder: "Travel, Materials…" }) as HTMLInputElement;

    const actions = contentEl.createDiv({ cls: "bsw-modal-actions" });
    actions.createEl("button", { text: "Cancel", cls: "bsw-btn bsw-btn-secondary" })
           .addEventListener("click", () => this.close());
    actions.createEl("button", { text: "Add Expense", cls: "bsw-btn bsw-btn-primary" })
           .addEventListener("click", () => {
             const amt = parseFloat(amtInput.value);
             if (!descInput.value.trim() || isNaN(amt)) return;
             this.onSave({
               id: Date.now().toString(36),
               description: descInput.value.trim(),
               amount: amt,
               date: new Date().toISOString().split("T")[0],
               reportFiled: false,
               category: catInput.value.trim() || undefined,
             });
             this.close();
           });

    setTimeout(() => descInput.focus(), 50);
  }

  onClose(): void { this.contentEl.empty(); }
}
