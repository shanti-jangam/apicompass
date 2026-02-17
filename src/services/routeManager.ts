import * as vscode from 'vscode';
import { Route, ParseResult } from '../models/route';
import { ParserFactory } from '../parsers/parserFactory';
import { FileScanner } from './fileScanner';
import { Config } from '../utils/config';
import { Logger } from '../utils/logger';

/**
 * Central service that coordinates route discovery across the workspace.
 *
 * Responsibilities:
 * - Orchestrates file scanning and parsing.
 * - Maintains an in-memory cache of discovered routes.
 * - Supports incremental updates (re-parse only changed files).
 * - Emits events when routes change so the UI can refresh.
 *
 * Design pattern: Observer (emits change events)
 */
export class RouteManager {
  private routes: Map<string, Route[]> = new Map(); // filePath -> routes
  private parserFactory: ParserFactory;
  private fileScanner: FileScanner;
  private logger: Logger;

  private _onRoutesChanged = new vscode.EventEmitter<void>();
  readonly onRoutesChanged = this._onRoutesChanged.event;

  constructor() {
    const config = Config.getInstance();
    this.parserFactory = new ParserFactory(config.enabledFrameworks);
    this.fileScanner = new FileScanner();
    this.logger = Logger.getInstance();
  }

  /**
   * Performs a full scan of the workspace.
   * Clears existing routes and re-parses everything.
   */
  async fullScan(): Promise<void> {
    this.logger.info('RouteManager: Starting full workspace scan...');
    const startTime = Date.now();

    this.routes.clear();

    const filePaths = await this.fileScanner.scanWorkspace();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'APICompass: Scanning routes...',
        cancellable: false,
      },
      async (progress) => {
        for (let i = 0; i < filePaths.length; i++) {
          const filePath = filePaths[i];
          progress.report({
            message: `${i + 1}/${filePaths.length}`,
            increment: (1 / filePaths.length) * 100,
          });

          await this.parseFile(filePath);
        }
      },
    );

    const elapsed = Date.now() - startTime;
    const totalRoutes = this.getAllRoutes().length;
    this.logger.info(
      `RouteManager: Full scan complete. Found ${totalRoutes} routes in ${elapsed}ms.`,
    );

    this._onRoutesChanged.fire();
  }

  /**
   * Incrementally re-parses a single file.
   * Called when a file is saved or changed.
   */
  async updateFile(filePath: string): Promise<void> {
    this.logger.debug(`RouteManager: Updating file ${filePath}`);
    await this.parseFile(filePath);
    this._onRoutesChanged.fire();
  }

  /**
   * Removes routes for a deleted file.
   */
  removeFile(filePath: string): void {
    if (this.routes.has(filePath)) {
      this.routes.delete(filePath);
      this.logger.debug(`RouteManager: Removed routes for ${filePath}`);
      this._onRoutesChanged.fire();
    }
  }

  /**
   * Returns all discovered routes, sorted by file and line number.
   */
  getAllRoutes(): Route[] {
    const allRoutes: Route[] = [];
    for (const routes of this.routes.values()) {
      allRoutes.push(...routes);
    }
    return allRoutes.sort((a, b) => {
      const fileCompare = a.filePath.localeCompare(b.filePath);
      if (fileCompare !== 0) {
        return fileCompare;
      }
      return a.lineNumber - b.lineNumber;
    });
  }

  /**
   * Returns routes grouped by file path.
   */
  getRoutesByFile(): Map<string, Route[]> {
    return new Map(this.routes);
  }

  /**
   * Returns routes grouped by HTTP method.
   */
  getRoutesByMethod(): Map<string, Route[]> {
    const grouped = new Map<string, Route[]>();
    for (const route of this.getAllRoutes()) {
      const existing = grouped.get(route.method) ?? [];
      existing.push(route);
      grouped.set(route.method, existing);
    }
    return grouped;
  }

  /**
   * Returns routes grouped by framework.
   */
  getRoutesByFramework(): Map<string, Route[]> {
    const grouped = new Map<string, Route[]>();
    for (const route of this.getAllRoutes()) {
      const existing = grouped.get(route.framework) ?? [];
      existing.push(route);
      grouped.set(route.framework, existing);
    }
    return grouped;
  }

  /**
   * Searches routes by a query string (matches path or file).
   */
  searchRoutes(query: string): Route[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllRoutes().filter(
      (route) =>
        route.path.toLowerCase().includes(lowerQuery) ||
        route.filePath.toLowerCase().includes(lowerQuery) ||
        route.method.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * Parses a single file and stores the results.
   */
  private async parseFile(filePath: string): Promise<void> {
    try {
      const content = await this.fileScanner.readFile(filePath);
      const parsers = this.parserFactory.getParsersForFile(filePath, content);

      const fileRoutes: Route[] = [];
      for (const parser of parsers) {
        const result: ParseResult = parser.parse(filePath, content);
        fileRoutes.push(...result.routes);

        if (result.errors.length > 0) {
          for (const error of result.errors) {
            this.logger.warn(error);
          }
        }
      }

      if (fileRoutes.length > 0) {
        this.routes.set(filePath, fileRoutes);
      } else {
        this.routes.delete(filePath);
      }
    } catch (err) {
      this.logger.error(
        `Failed to parse ${filePath}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  dispose(): void {
    this._onRoutesChanged.dispose();
  }
}
