import { RouteParser } from './parser';
import { HttpMethod, MountPrefix, ParseResult, Route } from '../models/route';
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
      const blueprintPrefixes = this.parseBlueprintPrefixes(content);
      this.parseRouteDecorators(lines, filePath, routes, blueprintPrefixes);
    } catch (err) {
      errors.push(`Error parsing ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { filePath, routes, errors };
  }

  /**
   * Extracts Blueprint variable -> url_prefix mappings from the file.
   * e.g. bp = Blueprint('api', __name__, url_prefix='/api') -> { bp: '/api' }
   */
  private parseBlueprintPrefixes(content: string): Map<string, string> {
    const prefixMap = new Map<string, string>();
    const blueprintPattern =
      /(\w+)\s*=\s*Blueprint\s*\([^)]*url_prefix\s*=\s*['"]([^'"]*)['"]/g;

    let match: RegExpExecArray | null;
    while ((match = blueprintPattern.exec(content)) !== null) {
      prefixMap.set(match[1], match[2]);
    }
    return prefixMap;
  }

  /**
   * Parses @app.route('/path') and @blueprint.route('/path') decorators.
   * Prepends Blueprint url_prefix when the decorator identifier matches.
   */
  private parseRouteDecorators(
    lines: string[],
    filePath: string,
    routes: Route[],
    blueprintPrefixes: Map<string, string>,
  ): void {
    const routeDecoratorPattern = /@(\w+)\.route\s*\(\s*['"](\/[^'"]*)['"]/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const routeMatch = routeDecoratorPattern.exec(line);

      if (routeMatch) {
        const identifier = routeMatch[1];
        let routePath = routeMatch[2];

        // Prepend Blueprint url_prefix if this identifier has one
        const prefix = blueprintPrefixes.get(identifier);
        if (prefix) {
          routePath = this.joinPaths(prefix, routePath);
        }

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

  private joinPaths(prefix: string, routePath: string): string {
    const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    const normalizedRoute = routePath.startsWith('/') ? routePath : '/' + routePath;
    if (normalizedRoute === '/') {
      return normalizedPrefix || '/';
    }
    return normalizedPrefix + normalizedRoute;
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

  /**
   * Extracts cross-file mount prefix mappings from an entry file.
   * Uses variable-name matching: the variable passed to register_blueprint()
   * is matched against the decorator identifier in route files.
   *
   * e.g. app.register_blueprint(users_bp, url_prefix='/api/users')
   *      -> routes with @users_bp.route(...) get /api/users prefix
   */
  extractMountPrefixes(_filePath: string, content: string): MountPrefix[] {
    const results: MountPrefix[] = [];

    // Find app.register_blueprint(var, url_prefix='/prefix')
    // or   app.register_blueprint(module.attr, url_prefix='/prefix')
    const registerPattern =
      /\b\w+\.register_blueprint\s*\(\s*([\w.]+)[^)]*\)/g;
    let rm: RegExpExecArray | null;
    while ((rm = registerPattern.exec(content)) !== null) {
      const bpRef = rm[1];
      const callBody = rm[0];

      const prefixMatch = /url_prefix\s*=\s*['"]([^'"]*)['"]/. exec(callBody);
      if (!prefixMatch) {
        continue;
      }
      const prefix = prefixMatch[1];

      // Use the full reference as the variable name to match
      // e.g. "users_bp" or "users.bp" (we'll match the first part too)
      results.push({ prefix, variableName: bpRef });
    }

    return results;
  }
}
