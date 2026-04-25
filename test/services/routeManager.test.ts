import { Route } from '../../src/models/route';
import { deduplicateRoutes } from '../../src/utils/deduplicateRoutes';

describe('deduplicateRoutes', () => {
  const makeRoute = (overrides: Partial<Route> = {}): Route => ({
    method: 'GET',
    path: '/users',
    filePath: '/project/routes.js',
    lineNumber: 1,
    framework: 'express',
    ...overrides,
  });

  it('should remove exact duplicate routes', () => {
    const routes = [makeRoute(), makeRoute(), makeRoute()];
    const result = deduplicateRoutes(routes);
    expect(result).toHaveLength(1);
  });

  it('should keep routes with different methods', () => {
    const routes = [makeRoute({ method: 'GET' }), makeRoute({ method: 'POST' })];
    const result = deduplicateRoutes(routes);
    expect(result).toHaveLength(2);
  });

  it('should keep routes with different paths', () => {
    const routes = [makeRoute({ path: '/users' }), makeRoute({ path: '/items' })];
    const result = deduplicateRoutes(routes);
    expect(result).toHaveLength(2);
  });

  it('should keep routes with different line numbers', () => {
    const routes = [makeRoute({ lineNumber: 1 }), makeRoute({ lineNumber: 5 })];
    const result = deduplicateRoutes(routes);
    expect(result).toHaveLength(2);
  });

  it('should keep routes from different files', () => {
    const routes = [
      makeRoute({ filePath: '/project/a.js' }),
      makeRoute({ filePath: '/project/b.js' }),
    ];
    const result = deduplicateRoutes(routes);
    expect(result).toHaveLength(2);
  });

  it('should return empty array for empty input', () => {
    expect(deduplicateRoutes([])).toHaveLength(0);
  });

  it('should preserve order and keep first occurrence', () => {
    const first = makeRoute({ path: '/first' });
    const dup = makeRoute({ path: '/first' });
    const second = makeRoute({ path: '/second' });

    const result = deduplicateRoutes([first, dup, second]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(first);
    expect(result[1]).toBe(second);
  });
});
