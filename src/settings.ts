import { App, PluginSettingTab, Setting } from "obsidian";
import type BswPlugin from "./main";

export class BswSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: BswPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Boswell Settings" });
    containerEl.createEl("p", {
      text: "Boswell stores all project data as plain Markdown files inside your vault. Change the folder path below to move where data lives.",
      cls: "bsw-settings-description",
    });

    new Setting(containerEl)
      .setName("Data folder")
      .setDesc(
        "Vault-relative path for Boswell data files (researchers.md, tasks.md, experiments/, log/, etc.). " +
        "Changing this does not move existing files — rename the folder in your vault first."
      )
      .addText((text) =>
        text
          .setPlaceholder("_boswell")
          .setValue(this.plugin.settings.dataFolder)
          .onChange(async (value) => {
            this.plugin.settings.dataFolder = value.trim() || "_boswell";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Open dashboard on startup")
      .setDesc("Automatically open the Boswell Dashboard when Obsidian loads.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.openOnStartup).onChange(async (value) => {
          this.plugin.settings.openOnStartup = value;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h3", { text: "About" });
    containerEl.createEl("p", {
      text: 'Boswell is a local-first research project manager for humanities scholars. ' +
            'All data is stored as plain-text Markdown with YAML frontmatter — readable without Obsidian, ' +
            'version-controllable with Git, and compatible with the Boswell web app.',
    });
  }
}
