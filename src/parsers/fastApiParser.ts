import { RouteParser } from './parser';
import { HttpMethod, ParseResult, Route } from '../models/route';
import * as path from 'path';

/**
 * Parser for FastAPI route definitions.
 *
 * Detects patterns such as:
 *   @app.get('/path')
 *   @router.post('/path')
 *   @app.api_route('/path', methods=['GET', 'POST'])
 *
 * Supports multi-line decorators. Normalizes FastAPI path params {id} to :id.
 *
 * Design pattern: Strategy (concrete strategy for FastAPI)
 */
export class FastApiParser extends RouteParser {
  readonly frameworkName = 'FastAPI';
  readonly supportedExtensions = ['.py'];

  /**
   * Quick check: file must be a Python file with FastAPI patterns.
   */
  canParse(filePath: string, content: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.py') {
      return false;
    }

    return (
      /from\s+fastapi\s+import/.test(content) ||
      /\bFastAPI\s*\(/.test(content) ||
      /\bAPIRouter\s*\(/.test(content) ||
      /@\w+\.(get|post|put|delete|patch|head|options)\s*\(/.test(content) ||
      /@\w+\.api_route\s*\(/.test(content)
    );
  }

  /**
   * Parse FastAPI route definitions from file content.
   */
  parse(filePath: string, content: string): ParseResult {
    const routes: Route[] = [];
    const errors: string[] = [];

    try {
      this.parseMethodDecorators(content, filePath, routes);
      this.parseApiRouteDecorators(content, filePath, routes);
    } catch (err) {
      errors.push(`Error parsing ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { filePath, routes, errors };
  }

  /**
   * Parses @app.get('/path'), @router.post('/path') etc.
   * \s matches newlines for multi-line decorators.
   */
  private parseMethodDecorators(content: string, filePath: string, routes: Route[]): void {
    const methodPattern =
      /@\w+\.(get|post|put|delete|patch|head|options)\s*\(\s*['"]((?:[^'"\\]|\\.)*)['"]/gi;

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
        framework: 'fastapi',
      });
    }
  }

  /**
   * Parses @app.api_route('/path', methods=['GET', 'POST']) decorators.
   */
  private parseApiRouteDecorators(content: string, filePath: string, routes: Route[]): void {
    const apiRoutePattern =
      /@\w+\.api_route\s*\(\s*['"]((?:[^'"\\]|\\.)*)['"]\s*[,)]/gi;

    let match: RegExpExecArray | null;
    while ((match = apiRoutePattern.exec(content)) !== null) {
      const routePath = this.normalizePath(match[1]);
      const lineNumber = this.getLineNumberAt(content, match.index);

      // Extract methods from the decorator (may be on following lines)
      const afterMatch = content.slice(match.index, match.index + 300);
      const methods = this.extractMethodsFromApiRoute(afterMatch);

      for (const method of methods) {
        routes.push({
          method,
          path: routePath,
          filePath,
          lineNumber,
          framework: 'fastapi',
        });
      }
    }
  }

  /**
   * Extracts HTTP methods from api_route(..., methods=[...]).
   */
  private extractMethodsFromApiRoute(context: string): HttpMethod[] {
    const methodsMatch = /methods\s*=\s*\[([^\]]+)\]/.exec(context);
    if (!methodsMatch) {
      return ['GET'];
    }

    const methods: HttpMethod[] = [];
    const methodExtractor = /['"](\w+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = methodExtractor.exec(methodsMatch[1])) !== null) {
      const method = m[1].toUpperCase() as HttpMethod;
      if (this.isValidHttpMethod(method)) {
        methods.push(method);
      }
    }
    return methods.length > 0 ? methods : ['GET'];
  }

  private isValidHttpMethod(method: string): method is HttpMethod {
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method);
  }

  /**
   * Normalizes FastAPI path: {id} -> :id, {user_id} -> :user_id
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
