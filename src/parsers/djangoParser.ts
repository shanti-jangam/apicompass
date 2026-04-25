import { RouteParser } from './parser';
import { ParseResult, Route } from '../models/route';
import * as path from 'path';

/**
 * Parser for Django URL pattern definitions.
 *
 * Detects patterns such as:
 *   path('users/', views.user_list)
 *   path('users/<int:pk>/', views.user_detail)
 *   re_path(r'^articles/(?P<year>[0-9]{4})/$', views.year_archive)
 *
 * Design pattern: Strategy (concrete strategy for Django)
 */
export class DjangoParser extends RouteParser {
  readonly frameworkName = 'Django';
  readonly supportedExtensions = ['.py'];

  /**
   * Quick check: file must be a Python file named urls.py or containing
   * Django URL patterns.
   */
  canParse(filePath: string, content: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.py') {
      return false;
    }

    const fileName = path.basename(filePath).toLowerCase();

    // Django URL patterns are typically in urls.py files
    // or files that import from django.urls
    return (
      fileName === 'urls.py' ||
      /from\s+django\.urls\s+import/.test(content) ||
      /from\s+django\.conf\.urls\s+import/.test(content) ||
      /urlpatterns\s*=/.test(content)
    );
  }

  /**
   * Parse Django URL pattern definitions from file content.
   */
  parse(filePath: string, content: string): ParseResult {
    const routes: Route[] = [];
    const errors: string[] = [];
    const lines = content.split('\n');

    try {
      // Parse path() calls
      this.parsePathCalls(lines, filePath, routes);

      // Parse re_path() calls
      this.parseRePathCalls(lines, filePath, routes);
    } catch (err) {
      errors.push(`Error parsing ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { filePath, routes, errors };
  }

  /**
   * Parses path('pattern', view) calls.
   */
  private parsePathCalls(lines: string[], filePath: string, routes: Route[]): void {
    // Matches: path('pattern',  or  path("pattern",
    const pathPattern = /\bpath\s*\(\s*['"]((?:[^'"\\]|\\.)*)['"]/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = pathPattern.exec(line);

      if (match) {
        const urlPattern = match[1];

        // Skip include() patterns — they are namespace references, not endpoints
        if (/include\s*\(/.test(line)) {
          continue;
        }

        const routePath = this.normalizeUrlPattern(urlPattern);

        routes.push({
          method: 'ALL', // Django URL patterns don't specify methods at URL level
          path: routePath,
          filePath,
          lineNumber: i + 1,
          framework: 'django',
        });
      }
    }
  }

  /**
   * Parses re_path(r'regex', view) calls.
   */
  private parseRePathCalls(lines: string[], filePath: string, routes: Route[]): void {
    // Matches: re_path(r'pattern',  or  re_path(r"pattern",
    const rePathPattern = /\bre_path\s*\(\s*r?['"]((?:[^'"\\]|\\.)*)['"]/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = rePathPattern.exec(line);

      if (match) {
        const urlPattern = match[1];

        // Skip include() patterns
        if (/include\s*\(/.test(line)) {
          continue;
        }

        const routePath = this.normalizeRegexPattern(urlPattern);

        routes.push({
          method: 'ALL',
          path: routePath,
          filePath,
          lineNumber: i + 1,
          framework: 'django',
        });
      }
    }
  }

  /**
   * Normalizes a Django URL pattern to a readable path.
   * Converts '<int:pk>' to ':pk', etc.
   */
  private normalizeUrlPattern(pattern: string): string {
    let normalized = pattern;

    // Ensure leading slash
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    // Convert Django angle-bracket parameters to colon notation
    // <int:pk>  ->  :pk
    // <str:slug>  ->  :slug
    // <pk>  ->  :pk
    normalized = normalized.replace(/<(?:\w+:)?(\w+)>/g, ':$1');

    return normalized;
  }

  /**
   * Normalizes a Django regex URL pattern to a readable path.
   * Strips regex anchors and named groups.
   */
  private normalizeRegexPattern(pattern: string): string {
    let normalized = pattern;

    // Remove regex anchors
    normalized = normalized.replace(/^\^/, '').replace(/\$$/, '');

    // Convert named groups (?P<name>pattern) to :name
    normalized = normalized.replace(/\(\?P<(\w+)>[^)]+\)/g, ':$1');

    // Ensure leading slash
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    return normalized;
  }
}
