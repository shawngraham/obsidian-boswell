import { ItemView, WorkspaceLeaf } from "obsidian";
import type BswPlugin from "../main";

export abstract class BaseView extends ItemView {
  constructor(leaf: WorkspaceLeaf, protected plugin: BswPlugin) {
    super(leaf);
  }

  /** Called by the plugin whenever data changes — re-renders the view. */
  abstract refresh(): Promise<void>;

  getIcon(): string { return "layout-dashboard"; }
}
