import * as vscode from 'vscode';
import * as import_path from 'path';
import { Route, ParseResult, MountPrefix } from '../models/route';
import { ParserFactory } from '../parsers/parserFactory';
import { FileScanner } from './fileScanner';
import { Config } from '../utils/config';
import { Logger } from '../utils/logger';
import { deduplicateRoutes } from '../utils/deduplicateRoutes';

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

    // Second pass: apply cross-file mount prefixes (Express, Flask, FastAPI)
    await this.applyCrossFileMountPrefixes(filePaths);

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
   * Scans all files for cross-file mount prefix patterns and prepends
   * mount prefixes to routes from the referenced router/blueprint files.
   *
   * Supports:
   *   Express:  app.use('/prefix', require('./router'))
   *   Flask:    app.register_blueprint(bp, url_prefix='/prefix')
   *   FastAPI:  app.include_router(router, prefix='/prefix')
   */
  private async applyCrossFileMountPrefixes(filePaths: string[]): Promise<void> {
    type Extractor = { extractMountPrefixes(filePath: string, content: string): MountPrefix[] };
    const extractors: Extractor[] = [];

    for (const fw of ['express', 'flask', 'fastapi'] as const) {
      const parser = this.parserFactory.getParser(fw);
      if (parser && 'extractMountPrefixes' in parser) {
        extractors.push(parser as unknown as Extractor);
      }
    }

    if (extractors.length === 0) {
      return;
    }

    // Build a comprehensive set of files to scan for mount registrations.
    // The scanner filePaths may miss entry-point files (e.g. main.py, app.py)
    // that contain include_router/register_blueprint/app.use() but no routes.
    const allFilesToScan = new Set(filePaths);
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        const pattern = new vscode.RelativePattern(folder, '**/*.{js,ts,mjs,cjs,py,go}');
        const uris = await vscode.workspace.findFiles(pattern, undefined, 500);
        for (const uri of uris) {
          allFilesToScan.add(uri.fsPath);
        }
      }
    }

    const allMountPrefixes: MountPrefix[] = [];
    const fileContents = new Map<string, string>();

    for (const filePath of allFilesToScan) {
      try {
        const content = await this.fileScanner.readFile(filePath);
        fileContents.set(filePath, content);
        for (const extractor of extractors) {
          const mounts = extractor.extractMountPrefixes(filePath, content);
          allMountPrefixes.push(...mounts);
        }
      } catch {
        // skip unreadable files
      }
    }

    this.logger.info(`Cross-file: found ${allMountPrefixes.length} mount prefixes from ${allFilesToScan.size} files`);

    if (allMountPrefixes.length === 0) {
      return;
    }

    // Strategy 1: File-path matching (Express require/import resolution)
    const filePathPrefixMap = new Map<string, string>();
    for (const mount of allMountPrefixes) {
      if (mount.resolvedFilePath) {
        const base = mount.resolvedFilePath;
        const candidates = [
          base, base + '.js', base + '.ts', base + '.mjs', base + '.cjs',
          base + '.py', base + '/index.js', base + '/index.ts', base + '/__init__.py',
        ];
        for (const candidate of candidates) {
          const normalized = candidate.replace(/\\/g, '/').toLowerCase();
          filePathPrefixMap.set(normalized, mount.prefix);
        }
      }
    }

    // Strategy 2: Variable-name matching (Flask/FastAPI)
    const varNameMounts = allMountPrefixes.filter(m => m.variableName);

    const varFilePrefixMap = new Map<string, string>();
    if (varNameMounts.length > 0) {
      for (const [filePath, content] of fileContents.entries()) {
        // Skip entry files that contain mount registration calls
        const isMountFile = /\.(?:register_blueprint|include_router)\s*\(/.test(content);
        if (isMountFile) {
          continue;
        }

        const fileBaseName = import_path.basename(filePath).replace(/\.\w+$/, '').toLowerCase();

        for (const mount of varNameMounts) {
          const varName = mount.variableName!;
          const dotIdx = varName.indexOf('.');

          if (dotIdx > 0) {
            // Dotted reference like "users.router" -- all router files use
            // the same generic identifier (e.g. "router"), so we match by
            // the module name ("users") against the file's basename
            const moduleName = varName.substring(0, dotIdx).toLowerCase();
            if (fileBaseName === moduleName) {
              varFilePrefixMap.set(filePath, mount.prefix);
            }
          } else {
            // Direct variable like "users_bp" -- match against the decorator
            // identifier used in route definitions within this file
            const pattern = new RegExp(
              `(?:@${this.escapeRegex(varName)}\\.|\\b${this.escapeRegex(varName)}\\.)` +
              `(?:route|get|post|put|delete|patch|head|options|all|api_route)\\s*\\(`,
            );
            if (pattern.test(content)) {
              varFilePrefixMap.set(filePath, mount.prefix);
            }
          }
        }
      }
    }

    // Apply file-path-based prefixes (Express)
    for (const [filePath, routes] of this.routes.entries()) {
      const normalizedFilePath = filePath.replace(/\\/g, '/').toLowerCase();
      const prefix = filePathPrefixMap.get(normalizedFilePath);
      if (prefix) {
        this.applyPrefixToRoutes(routes, prefix);
      }
    }

    // Apply variable-name-based prefixes (Flask/FastAPI)
    for (const [filePath, routes] of this.routes.entries()) {
      const prefix = varFilePrefixMap.get(filePath);
      if (prefix) {
        this.applyPrefixToRoutes(routes, prefix);
      }
    }
  }

  private applyPrefixToRoutes(routes: Route[], prefix: string): void {
    for (const route of routes) {
      if (!route.path.startsWith(prefix)) {
        const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
        const normalizedRoute = route.path.startsWith('/') ? route.path : '/' + route.path;
        route.path = normalizedRoute === '/'
          ? (normalizedPrefix || '/')
          : normalizedPrefix + normalizedRoute;
      }
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

      const dedupedRoutes = deduplicateRoutes(fileRoutes);

      if (dedupedRoutes.length > 0) {
        this.routes.set(filePath, dedupedRoutes);
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
