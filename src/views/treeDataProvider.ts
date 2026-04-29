import * as path from 'path';
import * as vscode from 'vscode';
import { Route } from '../models/route';
import { RouteManager } from '../services/routeManager';
import { Config } from '../utils/config';
import { RouteTreeItem } from './treeItem';

/**
 * Provides data for the APICompass tree view in the VS Code sidebar.
 *
 * Implements vscode.TreeDataProvider to render routes as a tree.
 * Supports grouping by file, HTTP method, or framework.
 *
 * Design pattern: Observer - listens to RouteManager's onRoutesChanged event
 * and refreshes the tree automatically.
 */
export class RouteTreeDataProvider implements vscode.TreeDataProvider<RouteTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<RouteTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private routeManager: RouteManager;
  private config: Config;

  constructor(routeManager: RouteManager) {
    this.routeManager = routeManager;
    this.config = Config.getInstance();

    // Listen for route changes and refresh the tree
    routeManager.onRoutesChanged(() => {
      this.refresh();
    });
  }

  /**
   * Triggers a full refresh of the tree view.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Returns the tree item representation for a given element.
   */
  getTreeItem(element: RouteTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Returns children for the given element, or root elements if no parent.
   */
  getChildren(element?: RouteTreeItem): RouteTreeItem[] {
    if (!element) {
      // Root level - return groups
      return this.getRootItems();
    }

    // Children of a group
    return this.getGroupChildren(element);
  }

  /**
   * Builds root-level tree items based on the configured grouping.
   */
  private getRootItems(): RouteTreeItem[] {
    if (!this.config.enabled) {
      return [
        new RouteTreeItem(
          'APICompass is disabled for this workspace (apicompass.enabled = false).',
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }

    const routes = this.routeManager.getAllRoutes();

    if (routes.length === 0) {
      return [
        new RouteTreeItem(
          'No API routes found. Click refresh to scan.',
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }

    const groupBy = this.config.groupBy;

    switch (groupBy) {
      case 'method':
        return this.groupByMethod(routes);
      case 'framework':
        return this.groupByFramework(routes);
      case 'file':
      default:
        return this.groupByFile(routes);
    }
  }

  /**
   * Returns children for a group node.
   */
  private getGroupChildren(element: RouteTreeItem): RouteTreeItem[] {
    // The label of the group is used to look up children
    const routes = this.routeManager.getAllRoutes();
    const groupBy = this.config.groupBy;
    const label = element.label as string;

    let filteredRoutes: Route[];

    switch (groupBy) {
      case 'method':
        filteredRoutes = routes.filter((r) => r.method === label);
        break;
      case 'framework':
        filteredRoutes = routes.filter((r) => r.framework === label);
        break;
      case 'file':
      default:
        filteredRoutes = routes.filter((r) => this.getRelativePath(r.filePath) === label);
        break;
    }

    return filteredRoutes.map(
      (route) =>
        new RouteTreeItem(
          `${route.method} ${route.path}`,
          vscode.TreeItemCollapsibleState.None,
          route,
        ),
    );
  }

  /**
   * Groups routes by source file.
   */
  private groupByFile(routes: Route[]): RouteTreeItem[] {
    const groups = new Map<string, number>();

    for (const route of routes) {
      const relativePath = this.getRelativePath(route.filePath);
      groups.set(relativePath, (groups.get(relativePath) ?? 0) + 1);
    }

    return Array.from(groups.entries()).map(
      ([filePath, _count]) =>
        new RouteTreeItem(filePath, vscode.TreeItemCollapsibleState.Collapsed),
    );
  }

  /**
   * Groups routes by HTTP method.
   */
  private groupByMethod(routes: Route[]): RouteTreeItem[] {
    const groups = new Map<string, number>();

    for (const route of routes) {
      groups.set(route.method, (groups.get(route.method) ?? 0) + 1);
    }

    return Array.from(groups.entries()).map(
      ([method, _count]) => new RouteTreeItem(method, vscode.TreeItemCollapsibleState.Collapsed),
    );
  }

  /**
   * Groups routes by framework.
   */
  private groupByFramework(routes: Route[]): RouteTreeItem[] {
    const groups = new Map<string, number>();

    for (const route of routes) {
      groups.set(route.framework, (groups.get(route.framework) ?? 0) + 1);
    }

    return Array.from(groups.entries()).map(
      ([framework, _count]) =>
        new RouteTreeItem(framework, vscode.TreeItemCollapsibleState.Collapsed),
    );
  }

  /**
   * Converts an absolute file path to a workspace-relative path.
   */
  private getRelativePath(filePath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        if (filePath.startsWith(folder.uri.fsPath)) {
          return path.relative(folder.uri.fsPath, filePath);
        }
      }
    }
    return filePath;
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
