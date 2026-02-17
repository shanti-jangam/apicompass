import * as vscode from 'vscode';
import * as path from 'path';
import { Route, HttpMethod } from '../models/route';

/**
 * Represents a single item in the APICompass tree view.
 *
 * Can be either:
 * - A **group node** (file, method, or framework) with children.
 * - A **route leaf** representing a single API endpoint.
 */
export class RouteTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly route?: Route,
  ) {
    super(label, collapsibleState);

    if (route) {
      // Leaf node — a single route
      this.description = route.path;
      this.tooltip = `${route.method} ${route.path}\n${path.basename(route.filePath)}:${route.lineNumber}`;
      this.iconPath = this.getMethodIcon(route.method);

      // Click opens the file at the route's line
      this.command = {
        command: 'apicompass.navigateToRoute',
        title: 'Navigate to Route',
        arguments: [route],
      };

      this.contextValue = 'route';
    } else {
      // Group node
      this.contextValue = 'routeGroup';
    }
  }

  /**
   * Returns a ThemeIcon with a colour matching the HTTP method.
   */
  private getMethodIcon(method: HttpMethod): vscode.ThemeIcon {
    switch (method) {
      case 'GET':
        return new vscode.ThemeIcon('arrow-down', new vscode.ThemeColor('charts.green'));
      case 'POST':
        return new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('charts.blue'));
      case 'PUT':
        return new vscode.ThemeIcon('arrow-both', new vscode.ThemeColor('charts.orange'));
      case 'DELETE':
        return new vscode.ThemeIcon('trash', new vscode.ThemeColor('charts.red'));
      case 'PATCH':
        return new vscode.ThemeIcon('edit', new vscode.ThemeColor('charts.yellow'));
      default:
        return new vscode.ThemeIcon('globe');
    }
  }
}
