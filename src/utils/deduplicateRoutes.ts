import { Route } from '../models/route';

/**
 * Removes duplicate routes. Two routes are considered duplicates when they
 * share the same method, path, filePath, and lineNumber.
 */
export function deduplicateRoutes(routes: Route[]): Route[] {
  const seen = new Set<string>();
  const result: Route[] = [];
  for (const route of routes) {
    const key = `${route.method}|${route.path}|${route.filePath}|${route.lineNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(route);
    }
  }
  return result;
}
