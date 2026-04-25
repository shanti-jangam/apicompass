import { RouteParser } from './parser';
import { HttpMethod, ParseResult, Route } from '../models/route';
import * as path from 'path';

/**
 * Parser for Golang HTTP route definitions.
 *
 * Supports common Go web frameworks:
 *   Gin:     r.GET("/path", handler), r.POST("/path", handler)
 *   Echo:    e.GET("/path", handler), e.POST("/path", handler)
 *   Chi:     r.Get("/path", handler), r.Post("/path", handler)
 *   Fiber:   app.Get("/path", handler), app.Post("/path", handler)
 *   net/http: http.HandleFunc("/path", handler)
 *
 * Supports multi-line route definitions. Normalizes Chi {param} to :param.
 *
 * Design pattern: Strategy (concrete strategy for Golang)
 */
export class GoParser extends RouteParser {
  readonly frameworkName = 'Go';
  readonly supportedExtensions = ['.go'];

  /**
   * Quick check: file must be a Go file with route-like patterns.
   */
  canParse(filePath: string, content: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.go') {
      return false;
    }

    return (
      /\.(GET|POST|PUT|DELETE|PATCH|Get|Post|Put|Delete|Patch)\s*\(\s*["']\//.test(content) ||
      /HandleFunc\s*\(\s*["']\//.test(content) ||
      /Handle\s*\(\s*["']\//.test(content) ||
      /\b(gin|echo|chi|fiber)\b/.test(content)
    );
  }

  /**
   * Parse Golang route definitions from file content.
   */
  parse(filePath: string, content: string): ParseResult {
    const routes: Route[] = [];
    const errors: string[] = [];

    try {
      // Gin, Echo, Fiber: .GET("/path", ...), .POST("/path", ...)
      this.parseMethodCalls(content, filePath, routes);

      // Chi: .Get("/path", ...), .Post("/path", ...) — different casing
      this.parseChiMethodCalls(content, filePath, routes);

      // net/http: http.HandleFunc("/path", handler)
      this.parseHandleFunc(content, filePath, routes);
    } catch (err) {
      errors.push(`Error parsing ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { filePath, routes, errors };
  }

  /**
   * Parses identifier.GET("/path", ...), identifier.POST("/path", ...) etc.
   * Used by Gin, Echo, Fiber.
   */
  private parseMethodCalls(content: string, filePath: string, routes: Route[]): void {
    const methodPattern =
      /\b\w+\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(\s*["'](\/[^"']*)["']/g;

    let match: RegExpExecArray | null;
    while ((match = methodPattern.exec(content)) !== null) {
      const method = match[1].toUpperCase() as HttpMethod;
      const routePath = this.normalizePath(match[2]);
      const lineNumber = this.getLineNumberAt(content, match.index);

      routes.push({
        method,
        path: routePath,
        filePath,
        lineNumber,
        framework: 'go',
      });
    }
  }

  /**
   * Parses identifier.Get("/path", ...), identifier.Post("/path", ...) etc.
   * Used by Chi (PascalCase method names).
   */
  private parseChiMethodCalls(content: string, filePath: string, routes: Route[]): void {
    const methodPattern =
      /\b\w+\.(Get|Post|Put|Delete|Patch|Head|Options|Connect|Trace)\s*\(\s*["'](\/[^"']*)["']/g;

    let match: RegExpExecArray | null;
    while ((match = methodPattern.exec(content)) !== null) {
      const method = match[1].toUpperCase() as HttpMethod;
      const routePath = this.normalizePath(match[2]);
      const lineNumber = this.getLineNumberAt(content, match.index);

      if (this.isValidHttpMethod(method)) {
        routes.push({
          method,
          path: routePath,
          filePath,
          lineNumber,
          framework: 'go',
        });
      }
    }
  }

  /**
   * Parses http.HandleFunc("/path", handler) and mux.HandleFunc("/path", handler).
   */
  private parseHandleFunc(content: string, filePath: string, routes: Route[]): void {
    const handleFuncPattern = /\b\w+\.HandleFunc\s*\(\s*["'](\/[^"']*)["']/g;

    let match: RegExpExecArray | null;
    while ((match = handleFuncPattern.exec(content)) !== null) {
      const routePath = this.normalizePath(match[1]);
      const lineNumber = this.getLineNumberAt(content, match.index);

      routes.push({
        method: 'ALL',
        path: routePath,
        filePath,
        lineNumber,
        framework: 'go',
      });
    }
  }

  private isValidHttpMethod(method: string): method is HttpMethod {
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'ALL'].includes(method);
  }

  /**
   * Normalizes path: Chi uses {param}, convert to :param
   */
  private normalizePath(pattern: string): string {
    let normalized = pattern;
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    normalized = normalized.replace(/\{(\w+)\}/g, ':$1');
    return normalized;
  }

  private getLineNumberAt(content: string, index: number): number {
    const before = content.slice(0, index);
    const newlineCount = (before.match(/\n/g) || []).length;
    return newlineCount + 1;
  }
}
