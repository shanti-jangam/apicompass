import { Route } from '../../src/models/route';
import { RouteExporter } from '../../src/services/routeExporter';

describe('RouteExporter', () => {
  const sampleRoutes: Route[] = [
    { method: 'GET', path: '/users', filePath: '/project/routes.js', lineNumber: 5, framework: 'express' },
    { method: 'POST', path: '/users', filePath: '/project/routes.js', lineNumber: 10, framework: 'express' },
    { method: 'GET', path: '/users/:id', filePath: '/project/routes.js', lineNumber: 15, framework: 'express' },
    { method: 'DELETE', path: '/users/:id', filePath: '/project/routes.js', lineNumber: 20, framework: 'express' },
  ];

  describe('toJson', () => {
    it('should produce valid JSON with correct structure', () => {
      const json = RouteExporter.toJson(sampleRoutes);
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(4);
      expect(parsed[0]).toEqual({
        method: 'GET',
        path: '/users',
        filePath: '/project/routes.js',
        lineNumber: 5,
        framework: 'express',
      });
    });

    it('should not include extra properties like handlerName', () => {
      const routes: Route[] = [
        { method: 'GET', path: '/test', filePath: '/test.js', lineNumber: 1, framework: 'express', handlerName: 'handler' },
      ];
      const json = RouteExporter.toJson(routes);
      const parsed = JSON.parse(json);

      expect(parsed[0].handlerName).toBeUndefined();
    });

    it('should return empty array for no routes', () => {
      const json = RouteExporter.toJson([]);
      expect(JSON.parse(json)).toEqual([]);
    });
  });

  describe('toOpenApi', () => {
    it('should produce valid OpenAPI 3.0 JSON structure', () => {
      const output = RouteExporter.toOpenApi(sampleRoutes, true);
      const spec = JSON.parse(output);

      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info.title).toContain('APICompass');
      expect(spec.paths['/users']).toBeDefined();
      expect(spec.paths['/users'].get).toBeDefined();
      expect(spec.paths['/users'].post).toBeDefined();
    });

    it('should convert :param to {param} in OpenAPI paths', () => {
      const output = RouteExporter.toOpenApi(sampleRoutes, true);
      const spec = JSON.parse(output);

      expect(spec.paths['/users/{id}']).toBeDefined();
      expect(spec.paths['/users/:id']).toBeUndefined();
    });

    it('should include 200 response for each method', () => {
      const output = RouteExporter.toOpenApi(sampleRoutes, true);
      const spec = JSON.parse(output);

      expect(spec.paths['/users'].get.responses['200']).toBeDefined();
      expect(spec.paths['/users'].get.responses['200'].description).toBe('Successful response');
    });

    it('should expand ALL method to multiple HTTP methods', () => {
      const routes: Route[] = [
        { method: 'ALL', path: '/health', filePath: '/test.py', lineNumber: 1, framework: 'django' },
      ];
      const output = RouteExporter.toOpenApi(routes, true);
      const spec = JSON.parse(output);

      expect(spec.paths['/health'].get).toBeDefined();
      expect(spec.paths['/health'].post).toBeDefined();
      expect(spec.paths['/health'].put).toBeDefined();
      expect(spec.paths['/health'].delete).toBeDefined();
      expect(spec.paths['/health'].patch).toBeDefined();
    });

    it('should produce YAML output by default', () => {
      const output = RouteExporter.toOpenApi(sampleRoutes);

      expect(output).toContain('openapi:');
      expect(output).toContain('paths:');
      expect(output).toContain('/users:');
    });

    it('should return empty paths for no routes', () => {
      const output = RouteExporter.toOpenApi([], true);
      const spec = JSON.parse(output);

      expect(spec.paths).toEqual({});
    });
  });
});
