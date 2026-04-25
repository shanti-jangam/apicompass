import { RouteParser } from './parser';
import { HttpMethod, MountPrefix, ParseResult, Route } from '../models/route';
import * as path from 'path';

/**
 * Parser for Express.js route definitions.
 *
 * Detects patterns such as:
 *   app.get('/path', handler)
 *   router.post('/path', handler)
 *   app.use('/prefix', router)
 *   app.route('/path').get(handler).post(handler)
 *
 * Design pattern: Strategy (concrete strategy for Express.js)
 */
export class ExpressParser extends RouteParser {
  readonly frameworkName = 'Express.js';
  readonly supportedExtensions = ['.js', '.ts', '.mjs', '.cjs'];

  /**
   * Quick check: file must have a supported extension and contain
   * Express-like keywords.
   */
  canParse(filePath: string, content: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.supportedExtensions.includes(ext)) {
      return false;
    }

    // Look for common Express patterns in the file
    return (
      /\b(express|router|app)\b/.test(content) &&
      /\.(get|post|put|delete|patch|head|options|all|use|route)\s*\(/.test(content)
    );
  }

  /**
   * Parse Express.js route definitions from file content.
   */
  parse(filePath: string, content: string): ParseResult {
    const routes: Route[] = [];
    const errors: string[] = [];

    try {
      // Pattern 1: app.METHOD('/path', ...) or router.METHOD('/path', ...)
      this.parseMethodCalls(content, filePath, routes);

      // Pattern 2: app.route('/path').get(...).post(...)
      this.parseChainedRoutes(content, filePath, routes);

      // Pattern 3: resolve app.use('/prefix', router) mount paths
      this.applyMountPrefixes(content, routes);
    } catch (err) {
      errors.push(`Error parsing ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { filePath, routes, errors };
  }

  /**
   * Parses standard method calls like app.get('/users', handler).
   * Supports multi-line definitions (e.g. path on the next line after router.get()).
   */
  private parseMethodCalls(content: string, filePath: string, routes: Route[]): void {
    // Matches: identifier.method('/path'  or  identifier.method("/path"
    // \s matches newlines, so multi-line router.get(\n "/path" is detected
    const methodPattern =
      /\b\w+\.(get|post|put|delete|patch|head|options|all)\s*\(\s*['"](\/[^'"]*)['"]/gi;

    let match: RegExpExecArray | null;
    while ((match = methodPattern.exec(content)) !== null) {
      const method = match[1].toUpperCase() as HttpMethod;
      const routePath = match[2];
      const lineNumber = this.getLineNumberAt(content, match.index);

      routes.push({
        method,
        path: routePath,
        filePath,
        lineNumber,
        framework: 'express',
      });
    }
  }

  /** Returns 1-based line number for the given character index in content. */
  private getLineNumberAt(content: string, index: number): number {
    const before = content.slice(0, index);
    const newlineCount = (before.match(/\n/g) || []).length;
    return newlineCount + 1;
  }

  /**
   * Detects app.use('/prefix', variableName) patterns and prepends the prefix
   * to routes whose identifier matches. Only applies to routes defined on the
   * same router variable, NOT to routes defined directly on app.
   */
  private applyMountPrefixes(content: string, routes: Route[]): void {
    const usePattern = /\b(\w+)\.use\s*\(\s*['"](\/[^'"]*)['"]\s*,\s*(\w+)/g;

    const mounts: { appVar: string; prefix: string; routerVar: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = usePattern.exec(content)) !== null) {
      mounts.push({ appVar: m[1], prefix: m[2], routerVar: m[3] });
    }

    if (mounts.length === 0) {
      return;
    }

    // Identify the app variable (the one calling .use)
    const appVars = new Set(mounts.map((mount) => mount.appVar));

    // Build a set of router variables that are mounted
    const mountedRouterVars = new Set(mounts.map((mount) => mount.routerVar));

    // Build variable -> prefix map
    const prefixMap = new Map<string, string>();
    for (const mount of mounts) {
      prefixMap.set(mount.routerVar, mount.prefix);
    }

    // Detect which variables define routes inline using express.Router()
    const routerDeclPattern = /\b(?:const|let|var)\s+(\w+)\s*=\s*express\.Router\s*\(/g;
    const declaredRouterVars = new Set<string>();
    let dr: RegExpExecArray | null;
    while ((dr = routerDeclPattern.exec(content)) !== null) {
      declaredRouterVars.add(dr[1]);
    }

    // Parse each route definition to find which variable it was called on
    // e.g. "router.get('/path'..." -> variable is "router"
    const routeDefPattern =
      /\b(\w+)\.(get|post|put|delete|patch|head|options|all)\s*\(\s*['"](\/[^'"]*)['"]/gi;
    const routeVarMap = new Map<string, string>(); // "method|path|line" -> variable
    let rv: RegExpExecArray | null;
    while ((rv = routeDefPattern.exec(content)) !== null) {
      const variable = rv[1];
      const method = rv[2].toUpperCase();
      const routePath = rv[3];
      const lineNumber = this.getLineNumberAt(content, rv.index);
      const key = `${method}|${routePath}|${lineNumber}`;
      routeVarMap.set(key, variable);
    }

    // Only apply prefix to routes whose defining variable is a mounted router,
    // not the app variable itself
    for (const route of routes) {
      const key = `${route.method}|${route.path}|${route.lineNumber}`;
      const variable = routeVarMap.get(key);

      if (!variable) {
        continue;
      }

      // Skip routes defined directly on the app variable
      if (appVars.has(variable)) {
        continue;
      }

      // Apply prefix if this variable matches a mounted router directly
      if (prefixMap.has(variable)) {
        route.path = this.joinPaths(prefixMap.get(variable)!, route.path);
        continue;
      }

      // For single-file routers: if this variable is a declared Router() and
      // there's exactly one mount for it, apply the prefix
      if (declaredRouterVars.has(variable) && mounts.length === 1) {
        route.path = this.joinPaths(mounts[0].prefix, route.path);
      }
    }
  }

  /**
   * Extracts cross-file mount prefix mappings from an entry file.
   * Matches patterns like:
   *   const usersRouter = require('./routes/users')
   *   app.use('/api/users', usersRouter)
   * Returns resolved file paths paired with their mount prefix.
   */
  extractMountPrefixes(filePath: string, content: string): MountPrefix[] {
    const results: MountPrefix[] = [];
    const dir = path.dirname(filePath);

    // Build variable -> require path map
    // Matches: const/let/var identifier = require('...')
    const requireMap = new Map<string, string>();
    const requirePattern =
      /\b(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let rm: RegExpExecArray | null;
    while ((rm = requirePattern.exec(content)) !== null) {
      requireMap.set(rm[1], rm[2]);
    }

    // Also match: import identifier from '...'
    const importPattern = /\bimport\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let im: RegExpExecArray | null;
    while ((im = importPattern.exec(content)) !== null) {
      requireMap.set(im[1], im[2]);
    }

    // Find app.use('/prefix', variableName) calls
    const usePattern = /\b\w+\.use\s*\(\s*['"](\/[^'"]*)['"]\s*,\s*(\w+)/g;
    let um: RegExpExecArray | null;
    while ((um = usePattern.exec(content)) !== null) {
      const prefix = um[1];
      const varName = um[2];
      const requirePath = requireMap.get(varName);

      if (requirePath && (requirePath.startsWith('./') || requirePath.startsWith('../'))) {
        const resolved = path.resolve(dir, requirePath);
        results.push({ prefix, resolvedFilePath: resolved });
      }
    }

    return results;
  }

  private joinPaths(prefix: string, routePath: string): string {
    const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    const normalizedRoute = routePath.startsWith('/') ? routePath : '/' + routePath;
    if (normalizedRoute === '/') {
      return normalizedPrefix || '/';
    }
    return normalizedPrefix + normalizedRoute;
  }

  /**
   * Parses chained route definitions like app.route('/users').get(handler).post(handler).
   * Supports multi-line .route('/path') and chained methods across lines.
   */
  private parseChainedRoutes(content: string, filePath: string, routes: Route[]): void {
    // Allow path and ) on following lines
    const routePattern = /\b\w+\.route\s*\(\s*['"](\/[^'"]*)['"]\s*\)/g;
    const chainedMethodPattern = /\.(get|post|put|delete|patch|head|options|all)\s*\(/gi;

    let routeMatch: RegExpExecArray | null;
    while ((routeMatch = routePattern.exec(content)) !== null) {
      const routePath = routeMatch[1];
      const lineNumber = this.getLineNumberAt(content, routeMatch.index);

      // Look for chained methods in the rest of the content (same statement usually within ~200 chars)
      const afterRoute = content.slice(
        routeMatch.index + routeMatch[0].length,
        routeMatch.index + 400,
      );
      let methodMatch: RegExpExecArray | null;
      chainedMethodPattern.lastIndex = 0;

      while ((methodMatch = chainedMethodPattern.exec(afterRoute)) !== null) {
        const method = methodMatch[1].toUpperCase() as HttpMethod;
        routes.push({
          method,
          path: routePath,
          filePath,
          lineNumber,
          framework: 'express',
        });
      }
    }
  }
}
