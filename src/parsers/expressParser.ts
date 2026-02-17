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
    const lines = content.split('\n');

    try {
      // Pattern 1: app.METHOD('/path', ...) or router.METHOD('/path', ...)
      this.parseMethodCalls(lines, filePath, routes);

      // Pattern 2: app.route('/path').get(...).post(...)
      this.parseChainedRoutes(lines, filePath, routes);
    } catch (err) {
      errors.push(`Error parsing ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { filePath, routes, errors };
  }

  /**
   * Parses standard method calls like app.get('/users', handler).
   */
  private parseMethodCalls(lines: string[], filePath: string, routes: Route[]): void {
    // Matches: identifier.method('/path'  or  identifier.method("/path"
    // Where identifier is app, router, or any word (variable name)
    // Where method is get, post, put, delete, patch, head, options, all
    const methodPattern =
      /\b\w+\.(get|post|put|delete|patch|head|options|all)\s*\(\s*['"](\/[^'"]*)['"]/gi;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpExecArray | null;

      // Reset lastIndex for each line
      methodPattern.lastIndex = 0;

      while ((match = methodPattern.exec(line)) !== null) {
        const method = match[1].toUpperCase() as HttpMethod;
        const routePath = match[2];

        routes.push({
          method,
          path: routePath,
          filePath,
          lineNumber: i + 1, // 1-based
          framework: 'express',
        });
      }
    }
  }

  /**
   * Parses chained route definitions like app.route('/users').get(handler).post(handler).
   */
  private parseChainedRoutes(lines: string[], filePath: string, routes: Route[]): void {
    const routePattern = /\b\w+\.route\s*\(\s*['"](\/[^'"]*)['"]\s*\)/g;
    const chainedMethodPattern = /\.(get|post|put|delete|patch|head|options|all)\s*\(/gi;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      routePattern.lastIndex = 0;

      const routeMatch = routePattern.exec(line);
      if (routeMatch) {
        const routePath = routeMatch[1];

        // Find chained methods on the same line (or nearby lines)
        // For simplicity, check the current line and the next few lines
        const contextLines = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');
        let methodMatch: RegExpExecArray | null;
        chainedMethodPattern.lastIndex = 0;

        while ((methodMatch = chainedMethodPattern.exec(contextLines)) !== null) {
          const method = methodMatch[1].toUpperCase() as HttpMethod;

          routes.push({
            method,
            path: routePath,
            filePath,
            lineNumber: i + 1,
            framework: 'express',
          });
        }
      }
    }
  }
}
