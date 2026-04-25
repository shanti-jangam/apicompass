import * as vscode from 'vscode';
import { Route } from './models/route';
import { RouteManager } from './services/routeManager';
import { RouteExporter } from './services/routeExporter';
import { Logger } from './utils/logger';
import { RouteTreeDataProvider } from './views/treeDataProvider';

/**
 * Extension entry point.
 * Called by VS Code when the extension is activated.
 */
export function activate(context: vscode.ExtensionContext): void {
  const logger = Logger.getInstance();
  logger.info('APICompass extension is activating...');

  // ── Core services ──────────────────────────────────────────────
  const routeManager = new RouteManager();
  const treeDataProvider = new RouteTreeDataProvider(routeManager);

  // ── Tree view ──────────────────────────────────────────────────
  const treeView = vscode.window.createTreeView('apicompassRoutesView', {
    treeDataProvider,
    showCollapseAll: true,
  });

  // ── Commands ───────────────────────────────────────────────────

  // Refresh: re-scan the whole workspace
  const refreshCmd = vscode.commands.registerCommand('apicompass.refresh', async () => {
    await routeManager.fullScan();
  });

  // Navigate: open file and scroll to route line
  const navigateCmd = vscode.commands.registerCommand(
    'apicompass.navigateToRoute',
    async (route: Route) => {
      if (!route) {
        return;
      }
      const uri = vscode.Uri.file(route.filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      const line = Math.max(0, route.lineNumber - 1);
      const range = new vscode.Range(line, 0, line, 0);
      editor.selection = new vscode.Selection(range.start, range.start);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    },
  );

  // Search: quick-pick search across all routes
  const searchCmd = vscode.commands.registerCommand('apicompass.searchRoutes', async () => {
    const query = await vscode.window.showInputBox({
      prompt: 'Search API routes by path, method, or file name',
      placeHolder: 'e.g. /users, POST, auth',
    });

    if (!query) {
      return;
    }

    const results = routeManager.searchRoutes(query);

    if (results.length === 0) {
      vscode.window.showInformationMessage(`No routes found matching "${query}".`);
      return;
    }

    const items = results.map((r) => ({
      label: `${r.method} ${r.path}`,
      description: `${r.filePath}:${r.lineNumber}`,
      route: r,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Found ${results.length} route(s)`,
    });

    if (selected) {
      vscode.commands.executeCommand('apicompass.navigateToRoute', selected.route);
    }
  });

  // Copy Route Path: copies "METHOD /path" to clipboard
  const copyRoutePathCmd = vscode.commands.registerCommand(
    'apicompass.copyRoutePath',
    async (treeItem: { route?: Route }) => {
      const route = treeItem?.route;
      if (!route) {
        return;
      }
      const text = `${route.method} ${route.path}`;
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage(`Copied: ${text}`);
    },
  );

  // Copy as cURL: copies a cURL command to clipboard
  const copyAsCurlCmd = vscode.commands.registerCommand(
    'apicompass.copyAsCurl',
    async (treeItem: { route?: Route }) => {
      const route = treeItem?.route;
      if (!route) {
        return;
      }
      const method = route.method === 'ALL' ? 'GET' : route.method;
      const curl = `curl -X ${method} http://localhost:3000${route.path}`;
      await vscode.env.clipboard.writeText(curl);
      vscode.window.showInformationMessage(`Copied: ${curl}`);
    },
  );

  // Export as JSON
  const exportJsonCmd = vscode.commands.registerCommand('apicompass.exportJson', async () => {
    const routes = routeManager.getAllRoutes();
    if (routes.length === 0) {
      vscode.window.showInformationMessage('No routes to export. Run a scan first.');
      return;
    }
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('api-routes.json'),
      filters: { JSON: ['json'] },
    });
    if (uri) {
      const json = RouteExporter.toJson(routes);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
      vscode.window.showInformationMessage(`Exported ${routes.length} routes to ${uri.fsPath}`);
    }
  });

  // Export as OpenAPI
  const exportOpenApiCmd = vscode.commands.registerCommand('apicompass.exportOpenApi', async () => {
    const routes = routeManager.getAllRoutes();
    if (routes.length === 0) {
      vscode.window.showInformationMessage('No routes to export. Run a scan first.');
      return;
    }
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('openapi.yaml'),
      filters: { YAML: ['yaml', 'yml'], JSON: ['json'] },
    });
    if (uri) {
      const isJson = uri.fsPath.endsWith('.json');
      const output = RouteExporter.toOpenApi(routes, isJson);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(output, 'utf-8'));
      vscode.window.showInformationMessage(`Exported OpenAPI spec to ${uri.fsPath}`);
    }
  });

  // ── File watcher ───────────────────────────────────────────────
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.{js,ts,mjs,cjs,py,go}');

  // Debounce helper
  let debounceTimer: NodeJS.Timeout | undefined;
  const debouncedUpdate = (filePath: string) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(async () => {
      await routeManager.updateFile(filePath);
    }, 500);
  };

  watcher.onDidChange((uri) => debouncedUpdate(uri.fsPath));
  watcher.onDidCreate((uri) => debouncedUpdate(uri.fsPath));
  watcher.onDidDelete((uri) => routeManager.removeFile(uri.fsPath));

  // ── Register disposables ───────────────────────────────────────
  context.subscriptions.push(
    treeView,
    refreshCmd,
    navigateCmd,
    searchCmd,
    copyRoutePathCmd,
    copyAsCurlCmd,
    exportJsonCmd,
    exportOpenApiCmd,
    watcher,
    routeManager,
    treeDataProvider,
    logger,
  );

  // ── Initial scan ───────────────────────────────────────────────
  routeManager.fullScan();

  logger.info('APICompass extension activated successfully.');
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  // Cleanup handled by disposables registered in context.subscriptions
}
