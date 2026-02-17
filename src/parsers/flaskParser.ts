import { RouteParser } from './parser';
import { HttpMethod, ParseResult, Route } from '../models/route';
import * as path from 'path';

/**
 * Parser for Flask route definitions.
 *
 * Detects patterns such as:
 *   @app.route('/path')
 *   @app.route('/path', methods=['GET', 'POST'])
 *   @blueprint.route('/path')
 *
 * Design pattern: Strategy (concrete strategy for Flask)
 */
export class FlaskParser extends RouteParser {
  readonly frameworkName = 'Flask';
  readonly supportedExtensions = ['.py'];

  /**
   * Quick check: file must be a Python file and contain Flask-like decorators.
   */
  canParse(filePath: string, content: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.py') {
      return false;
    }

    // Look for Flask route decorators or Flask/Blueprint imports
    return /@\w+\.route\s*\(/.test(content) || /from\s+flask\s+import/.test(content);
  }

  /**
   * Parse Flask route definitions from file content.
   */
  parse(filePath: string, content: string): ParseResult {
    const routes: Route[] = [];
    const errors: string[] = [];
    const lines = content.split('\n');

    try {
      this.parseRouteDecorators(lines, filePath, routes);
    } catch (err) {
      errors.push(`Error parsing ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { filePath, routes, errors };
  }

  /**
   * Parses @app.route('/path') and @blueprint.route('/path') decorators.
   */
  private parseRouteDecorators(lines: string[], filePath: string, routes: Route[]): void {
    // Matches: @identifier.route('/path'  or  @identifier.route("/path"
    // Optionally followed by methods=['GET', 'POST']
    const routeDecoratorPattern = /@(\w+)\.route\s*\(\s*['"](\/[^'"]*)['"]/;
    const methodsPattern = /methods\s*=\s*\[([^\]]+)\]/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const routeMatch = routeDecoratorPattern.exec(line);

      if (routeMatch) {
        const routePath = routeMatch[2];

        // Extract HTTP methods if specified
        const methods = this.extractMethods(line, lines, i);

        for (const method of methods) {
          routes.push({
            method,
            path: routePath,
            filePath,
            lineNumber: i + 1,
            framework: 'flask',
          });
        }
      }
    }
  }

  /**
   * Extracts HTTP methods from a Flask route decorator.
   * If no methods are specified, defaults to ['GET'].
   */
  private extractMethods(line: string, lines: string[], lineIndex: number): HttpMethod[] {
    const methodsPattern = /methods\s*=\s*\[([^\]]+)\]/;

    // Check current line and next line (decorator may span multiple lines)
    const contextLines = [line];
    if (lineIndex + 1 < lines.length) {
      contextLines.push(lines[lineIndex + 1].trim());
    }

    const context = contextLines.join(' ');
    const methodsMatch = methodsPattern.exec(context);

    if (methodsMatch) {
      const methodsStr = methodsMatch[1];
      const methods: HttpMethod[] = [];

      // Extract individual method strings from ['GET', 'POST'] etc.
      const methodExtractor = /['"](\w+)['"]/g;
      let match: RegExpExecArray | null;

      while ((match = methodExtractor.exec(methodsStr)) !== null) {
        const method = match[1].toUpperCase() as HttpMethod;
        if (this.isValidHttpMethod(method)) {
          methods.push(method);
        }
      }

      return methods.length > 0 ? methods : ['GET'];
    }

    // Default to GET when no methods are specified
    return ['GET'];
  }

  /**
   * Validates whether a string is a recognised HTTP method.
   */
  private isValidHttpMethod(method: string): method is HttpMethod {
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'ALL'].includes(method);
  }
}
