import { RouteParser } from './parser';
import { HttpMethod, ParseResult, Route } from '../models/route';
import * as path from 'path';

/**
 * Parser for NestJS controller route definitions.
 *
 * Detects patterns such as:
 *   @Controller('users')
 *   export class UsersController {
 *     @Get()           -> GET /users
 *     @Get(':id')      -> GET /users/:id
 *     @Post()          -> POST /users
 *     @Put(':id')      -> PUT /users/:id
 *     @Delete(':id')   -> DELETE /users/:id
 *     @Patch(':id')    -> PATCH /users/:id
 *   }
 *
 * Combines @Controller base path with @Get/@Post/etc. method paths.
 *
 * Design pattern: Strategy (concrete strategy for NestJS)
 */
export class NestJsParser extends RouteParser {
  readonly frameworkName = 'NestJS';
  readonly supportedExtensions = ['.ts', '.js'];

  /**
   * Quick check: file must be TS/JS with NestJS controller patterns.
   */
  canParse(filePath: string, content: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.ts', '.js'].includes(ext)) {
      return false;
    }

    return (
      /@Controller\s*\(/.test(content) ||
      /from\s+['"]@nestjs\/core['"]/.test(content) ||
      /from\s+['"]@nestjs\/common['"]/.test(content) ||
      /@(Get|Post|Put|Delete|Patch|All)\s*\(/.test(content)
    );
  }

  /**
   * Parse NestJS controller route definitions from file content.
   */
  parse(filePath: string, content: string): ParseResult {
    const routes: Route[] = [];
    const errors: string[] = [];

    try {
      this.parseControllerRoutes(content, filePath, routes);
    } catch (err) {
      errors.push(`Error parsing ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { filePath, routes, errors };
  }

  /**
   * Parses @Controller + @Get/@Post/etc. and combines paths.
   */
  private parseControllerRoutes(content: string, filePath: string, routes: Route[]): void {
    const controllerPattern = /@Controller\s*\(\s*['"`]?([^'"`)]*)['"`]?\s*\)/g;
    const methodPattern =
      /@(Get|Post|Put|Delete|Patch|All|Head|Options)\s*\(\s*['"`]?([^'"`)]*)['"`]?\s*\)/g;

    // Collect all matches with indices to process in order
    interface MatchInfo {
      index: number;
      type: 'controller' | 'method';
      path: string;
      method?: HttpMethod;
    }

    const matches: MatchInfo[] = [];

    let m: RegExpExecArray | null;
    while ((m = controllerPattern.exec(content)) !== null) {
      matches.push({ index: m.index, type: 'controller', path: m[1].trim() });
    }

    controllerPattern.lastIndex = 0;
    while ((m = methodPattern.exec(content)) !== null) {
      const methodName = m[1].toUpperCase();
      const methodPath = m[2].trim();
      const method: HttpMethod = methodName === 'ALL' ? 'ALL' : (methodName as HttpMethod);
      if (this.isValidHttpMethod(method)) {
        matches.push({ index: m.index, type: 'method', path: methodPath, method });
      }
    }

    matches.sort((a, b) => a.index - b.index);

    let currentControllerPath = '';

    for (const match of matches) {
      if (match.type === 'controller') {
        currentControllerPath = this.normalizeControllerPath(match.path);
      } else if (match.type === 'method' && match.method) {
        const fullPath = this.buildFullPath(currentControllerPath, match.path);
        const lineNumber = this.getLineNumberAt(content, match.index);

        routes.push({
          method: match.method,
          path: fullPath,
          filePath,
          lineNumber,
          framework: 'nestjs',
        });
      }
    }
  }

  private isValidHttpMethod(method: string): method is HttpMethod {
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'ALL'].includes(method);
  }

  private normalizeControllerPath(path: string): string {
    if (!path) return '/';
    let normalized = path.trim();
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    return normalized.replace(/\/+/g, '/');
  }

  private buildFullPath(controllerPath: string, methodPath: string): string {
    const base = controllerPath || '/';
    if (!methodPath) {
      return base;
    }
    const method = methodPath.startsWith('/') ? methodPath.slice(1) : methodPath;
    return base.endsWith('/') ? base + method : base + '/' + method;
  }

  private getLineNumberAt(content: string, index: number): number {
    const before = content.slice(0, index);
    const newlineCount = (before.match(/\n/g) || []).length;
    return newlineCount + 1;
  }
}
