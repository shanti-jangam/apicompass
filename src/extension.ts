import * as vscode from 'vscode';
import { Route } from './models/route';
import { RouteManager } from './services/routeManager';
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
