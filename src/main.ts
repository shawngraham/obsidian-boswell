import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { DataManager } from "./data-manager";
import { BswSettingTab } from "./settings";
import type { BswSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

import { DashboardView, VIEW_TYPE_DASHBOARD } from "./views/DashboardView";
import { KanbanView, VIEW_TYPE_KANBAN } from "./views/KanbanView";
import { ResearchersView, VIEW_TYPE_RESEARCHERS } from "./views/ResearchersView";
import { FundingView, VIEW_TYPE_FUNDING } from "./views/FundingView";
import { WritingView, VIEW_TYPE_WRITING } from "./views/WritingView";
import { ExperimentsView, VIEW_TYPE_EXPERIMENTS } from "./views/ExperimentsView";
import { LogView, VIEW_TYPE_LOG } from "./views/LogView";
import { TimelineView, VIEW_TYPE_TIMELINE } from "./views/TimelineView";
import { ExportView, VIEW_TYPE_EXPORT } from "./views/ExportView";
import { BaseView } from "./views/BaseView";

export default class BswPlugin extends Plugin {
  settings!: BswSettings;
  dm!: DataManager;

  async onload() {
    await this.loadSettings();
    this.dm = new DataManager(this.app, this.settings);

    // Register all view types
    this.registerView(VIEW_TYPE_DASHBOARD,  (leaf) => new DashboardView(leaf, this));
    this.registerView(VIEW_TYPE_KANBAN,     (leaf) => new KanbanView(leaf, this));
    this.registerView(VIEW_TYPE_RESEARCHERS,(leaf) => new ResearchersView(leaf, this));
    this.registerView(VIEW_TYPE_FUNDING,    (leaf) => new FundingView(leaf, this));
    this.registerView(VIEW_TYPE_WRITING,    (leaf) => new WritingView(leaf, this));
    this.registerView(VIEW_TYPE_EXPERIMENTS,(leaf) => new ExperimentsView(leaf, this));
    this.registerView(VIEW_TYPE_LOG,        (leaf) => new LogView(leaf, this));
    this.registerView(VIEW_TYPE_TIMELINE,   (leaf) => new TimelineView(leaf, this));
    this.registerView(VIEW_TYPE_EXPORT,     (leaf) => new ExportView(leaf, this));

    // Ribbon icon → dashboard
    this.addRibbonIcon("layout-dashboard", "Boswell Dashboard", async () => {
      await this.activateView(VIEW_TYPE_DASHBOARD);
    });

    // Commands
    const commands: Array<{ id: string; name: string; view: string }> = [
      { id: "open-dashboard",    name: "Open Dashboard",       view: VIEW_TYPE_DASHBOARD },
      { id: "open-kanban",       name: "Open Tasks (Kanban)",  view: VIEW_TYPE_KANBAN },
      { id: "open-researchers",  name: "Open Researchers",     view: VIEW_TYPE_RESEARCHERS },
      { id: "open-funding",      name: "Open Funding",         view: VIEW_TYPE_FUNDING },
      { id: "open-writing",      name: "Open Writing",         view: VIEW_TYPE_WRITING },
      { id: "open-experiments",  name: "Open Experiments",     view: VIEW_TYPE_EXPERIMENTS },
      { id: "open-log",          name: "Open Research Log",    view: VIEW_TYPE_LOG },
      { id: "open-timeline",     name: "Open Timeline",        view: VIEW_TYPE_TIMELINE },
      { id: "open-export",       name: "Open Export",          view: VIEW_TYPE_EXPORT },
    ];

    commands.forEach(({ id, name, view }) => {
      this.addCommand({
        id,
        name,
        callback: () => this.activateView(view),
      });
    });

    // Quick-add today's log entry
    this.addCommand({
      id: "new-log-entry",
      name: "New log entry for today",
      callback: async () => {
        const today = new Date().toISOString().split("T")[0];
        const file = await this.dm.getOrCreateLogNote(today);
        await this.app.workspace.openLinkText(file.path, "", false);
        await this.refreshViews();
      },
    });

    // Quick-add experiment
    this.addCommand({
      id: "new-experiment",
      name: "New experiment note",
      callback: async () => {
        const exp = await this.dm.createExperiment();
        const file = this.dm.getExperimentFile(exp.id);
        if (file) await this.app.workspace.openLinkText(file.path, "", false);
        await this.refreshViews();
      },
    });

    // Settings tab
    this.addSettingTab(new BswSettingTab(this.app, this));

    // Initialise data folder on first load
    this.app.workspace.onLayoutReady(async () => {
      await this.dm.initProject();
      if (this.settings.openOnStartup) {
        await this.activateView(VIEW_TYPE_DASHBOARD);
      }
    });

    // Refresh views when files change (catches external edits and direct vault writes)
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        const dataPath = this.settings.dataFolder;
        if (file.path.startsWith(dataPath)) {
          // Debounce to avoid flood during auto-saves
          this.debouncedRefresh();
        }
      })
    );

    console.log("Boswell loaded.");
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_DASHBOARD);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_KANBAN);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_RESEARCHERS);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_FUNDING);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_WRITING);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_EXPERIMENTS);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_LOG);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_TIMELINE);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_EXPORT);
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.dm = new DataManager(this.app, this.settings);
  }

  // ── View management ───────────────────────────────────────────────────────

  async activateView(viewType: string): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const existing = workspace.getLeavesOfType(viewType);
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: viewType, active: true });
    }
    workspace.revealLeaf(leaf!);
  }

  /** Re-render all currently open Boswell views. */
  async refreshViews(): Promise<void> {
    const allTypes = [
      VIEW_TYPE_DASHBOARD, VIEW_TYPE_KANBAN, VIEW_TYPE_RESEARCHERS,
      VIEW_TYPE_FUNDING, VIEW_TYPE_WRITING, VIEW_TYPE_EXPERIMENTS,
      VIEW_TYPE_LOG, VIEW_TYPE_TIMELINE, VIEW_TYPE_EXPORT,
    ];
    for (const type of allTypes) {
      for (const leaf of this.app.workspace.getLeavesOfType(type)) {
        const view = leaf.view as BaseView;
        if (view && typeof view.refresh === "function") {
          await view.refresh();
        }
      }
    }
  }

  // ── Debounced refresh (for vault file-change events) ──────────────────────

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  private debouncedRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshViews();
      this.refreshTimer = null;
    }, 800);
  }
}
