import { RouteParser } from './parser';
import { HttpMethod, ParseResult, Route } from '../models/route';
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
      const afterRoute = content.slice(routeMatch.index + routeMatch[0].length, routeMatch.index + 400);
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
