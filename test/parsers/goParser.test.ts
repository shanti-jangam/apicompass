import { GoParser } from '../../src/parsers/goParser';

describe('GoParser', () => {
  let parser: GoParser;

  beforeEach(() => {
    parser = new GoParser();
  });

  describe('canParse', () => {
    it('should return true for .go files with Gin patterns', () => {
      const content = `router := gin.Default()\nrouter.GET("/users", handler)`;
      expect(parser.canParse('main.go', content)).toBe(true);
    });

    it('should return true for .go files with Chi patterns', () => {
      const content = `r.Get("/users", handler)`;
      expect(parser.canParse('routes.go', content)).toBe(true);
    });

    it('should return true for .go files with HandleFunc', () => {
      const content = `http.HandleFunc("/health", handler)`;
      expect(parser.canParse('main.go', content)).toBe(true);
    });

    it('should return false for .py files', () => {
      const content = `router.GET("/users", handler)`;
      expect(parser.canParse('routes.py', content)).toBe(false);
    });

    it('should return false for .go files without route patterns', () => {
      const content = `package main\nfunc main() { println("hello") }`;
      expect(parser.canParse('main.go', content)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse Gin GET and POST routes', () => {
      const content = [
        `package main`,
        `import "github.com/gin-gonic/gin"`,
        `func main() {`,
        `    r := gin.Default()`,
        `    r.GET("/users", getUsers)`,
        `    r.POST("/users", createUser)`,
        `}`,
      ].join('\n');

      const result = parser.parse('/project/main.go', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0]).toMatchObject({
        method: 'GET',
        path: '/users',
        filePath: '/project/main.go',
        lineNumber: 5,
        framework: 'go',
      });
      expect(result.routes[1]).toMatchObject({ method: 'POST', path: '/users' });
    });

    it('should parse Chi Get and Post (PascalCase)', () => {
      const content = [
        `r.Get("/items", listItems)`,
        `r.Post("/items", createItem)`,
        `r.Put("/items/{id}", updateItem)`,
        `r.Delete("/items/{id}", deleteItem)`,
      ].join('\n');

      const result = parser.parse('/project/routes.go', content);

      expect(result.routes).toHaveLength(4);
      expect(result.routes[0]).toMatchObject({ method: 'GET', path: '/items' });
      expect(result.routes[1]).toMatchObject({ method: 'POST', path: '/items' });
      expect(result.routes[2]).toMatchObject({ method: 'PUT', path: '/items/:id' });
      expect(result.routes[3]).toMatchObject({ method: 'DELETE', path: '/items/:id' });
    });

    it('should normalize Chi {param} to :param', () => {
      const content = `r.Get("/users/{userID}", handler)`;
      const result = parser.parse('/project/routes.go', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe('/users/:userID');
    });

    it('should parse http.HandleFunc', () => {
      const content = [
        `package main`,
        `import "net/http"`,
        `func main() {`,
        `    http.HandleFunc("/health", healthHandler)`,
        `}`,
      ].join('\n');

      const result = parser.parse('/project/main.go', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0]).toMatchObject({
        method: 'ALL',
        path: '/health',
        framework: 'go',
      });
    });

    it('should parse multi-line route definitions', () => {
      const content = [`router.GET(`, `    "/statistics",`, `    getStatistics,`, `)`].join('\n');

      const result = parser.parse('/project/main.go', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0]).toMatchObject({
        method: 'GET',
        path: '/statistics',
        lineNumber: 1,
      });
    });

    it('should parse Echo and Fiber style routes', () => {
      const content = [
        `e := echo.New()`,
        `e.GET("/api/users", getUsers)`,
        `e.POST("/api/users", createUser)`,
      ].join('\n');

      const result = parser.parse('/project/main.go', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0]).toMatchObject({ method: 'GET', path: '/api/users' });
      expect(result.routes[1]).toMatchObject({ method: 'POST', path: '/api/users' });
    });

    it('should handle route parameters', () => {
      const content = `r.GET("/users/:id/posts/:postId", handler)`;
      const result = parser.parse('/project/routes.go', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe('/users/:id/posts/:postId');
    });

    it('should return correct line numbers', () => {
      const content = [
        `package main`,
        ``,
        `func setupRoutes(r *gin.Engine) {`,
        `    r.GET("/first", handler1)`,
        `    r.GET("/second", handler2)`,
        `}`,
      ].join('\n');

      const result = parser.parse('/project/main.go', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0].lineNumber).toBe(4);
      expect(result.routes[1].lineNumber).toBe(5);
    });

    it('should return empty routes for non-Go route files', () => {
      const content = `package main\nfunc add(a, b int) int { return a + b }`;
      const result = parser.parse('/project/utils.go', content);

      expect(result.routes).toHaveLength(0);
    });
  });
});
