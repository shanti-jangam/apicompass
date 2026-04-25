import { FastApiParser } from '../../src/parsers/fastApiParser';

describe('FastApiParser', () => {
  let parser: FastApiParser;

  beforeEach(() => {
    parser = new FastApiParser();
  });

  describe('canParse', () => {
    it('should return true for .py files with FastAPI imports', () => {
      const content = `from fastapi import FastAPI\napp = FastAPI()`;
      expect(parser.canParse('main.py', content)).toBe(true);
    });

    it('should return true for .py files with @app.get decorator', () => {
      const content = `@app.get("/users")\nasync def get_users(): pass`;
      expect(parser.canParse('routes.py', content)).toBe(true);
    });

    it('should return true for .py files with APIRouter', () => {
      const content = `from fastapi import APIRouter\nrouter = APIRouter()`;
      expect(parser.canParse('routers.py', content)).toBe(true);
    });

    it('should return false for .js files', () => {
      const content = `@app.get("/users")`;
      expect(parser.canParse('routes.js', content)).toBe(false);
    });

    it('should return false for .py files without FastAPI patterns', () => {
      const content = `def hello():\n    print("hello")`;
      expect(parser.canParse('utils.py', content)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse basic @app.get() decorator', () => {
      const content = [
        `from fastapi import FastAPI`,
        `app = FastAPI()`,
        ``,
        `@app.get("/users")`,
        `async def get_users():`,
        `    return []`,
      ].join('\n');

      const result = parser.parse('/project/main.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0]).toMatchObject({
        method: 'GET',
        path: '/users',
        filePath: '/project/main.py',
        lineNumber: 4,
        framework: 'fastapi',
      });
    });

    it('should parse @router.get() and @router.post()', () => {
      const content = [
        `from fastapi import APIRouter`,
        `router = APIRouter()`,
        ``,
        `@router.get("/items")`,
        `async def list_items(): pass`,
        ``,
        `@router.post("/items")`,
        `async def create_item(): pass`,
      ].join('\n');

      const result = parser.parse('/project/routes.py', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0]).toMatchObject({ method: 'GET', path: '/items' });
      expect(result.routes[1]).toMatchObject({ method: 'POST', path: '/items' });
    });

    it('should parse path parameters and normalize {id} to :id', () => {
      const content = `@app.get("/users/{user_id}")\nasync def get_user(): pass`;
      const result = parser.parse('/project/main.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe('/users/:user_id');
    });

    it('should parse multi-line decorators', () => {
      const content = [
        `@app.get(`,
        `    "/statistics",`,
        `)`,
        `async def get_stats():`,
        `    return {}`,
      ].join('\n');

      const result = parser.parse('/project/main.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0]).toMatchObject({
        method: 'GET',
        path: '/statistics',
        lineNumber: 1,
      });
    });

    it('should parse @app.api_route with methods', () => {
      const content = `@app.api_route("/custom", methods=["GET", "POST"])\nasync def custom(): pass`;
      const result = parser.parse('/project/main.py', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0]).toMatchObject({ method: 'GET', path: '/custom' });
      expect(result.routes[1]).toMatchObject({ method: 'POST', path: '/custom' });
    });

    it('should parse PUT, DELETE, PATCH methods', () => {
      const content = [
        `@app.put("/users/{id}")`,
        `@app.delete("/users/{id}")`,
        `@app.patch("/users/{id}")`,
      ].join('\n');

      const result = parser.parse('/project/main.py', content);

      expect(result.routes).toHaveLength(3);
      expect(result.routes[0].method).toBe('PUT');
      expect(result.routes[1].method).toBe('DELETE');
      expect(result.routes[2].method).toBe('PATCH');
    });

    it('should return correct line numbers', () => {
      const content = [
        `# FastAPI app`,
        `from fastapi import FastAPI`,
        `app = FastAPI()`,
        ``,
        `@app.get("/first")`,
        `async def first(): pass`,
        ``,
        `@app.get("/second")`,
        `async def second(): pass`,
      ].join('\n');

      const result = parser.parse('/project/main.py', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0].lineNumber).toBe(5);
      expect(result.routes[1].lineNumber).toBe(8);
    });

    it('should return empty routes for non-FastAPI files', () => {
      const content = `def add(a, b):\n    return a + b`;
      const result = parser.parse('/project/utils.py', content);

      expect(result.routes).toHaveLength(0);
    });
  });

  describe('extractMountPrefixes (cross-file)', () => {
    it('should extract variable names and prefixes from include_router', () => {
      const content = [
        `from fastapi import FastAPI`,
        `from .routers.users import router as users_router`,
        `from .routers.products import router as products_router`,
        ``,
        `app = FastAPI()`,
        `app.include_router(users_router, prefix='/api/users')`,
        `app.include_router(products_router, prefix='/api/products')`,
      ].join('\n');

      const mounts = parser.extractMountPrefixes('/project/main.py', content);

      expect(mounts).toHaveLength(2);
      expect(mounts[0]).toMatchObject({ prefix: '/api/users', variableName: 'users_router' });
      expect(mounts[1]).toMatchObject({ prefix: '/api/products', variableName: 'products_router' });
    });

    it('should ignore include_router without prefix', () => {
      const content = [`from .routers import main_router`, `app.include_router(main_router)`].join(
        '\n',
      );

      const mounts = parser.extractMountPrefixes('/project/main.py', content);

      expect(mounts).toHaveLength(0);
    });

    it('should return empty when no include_router calls', () => {
      const content = [
        `from fastapi import FastAPI`,
        `app = FastAPI()`,
        `@app.get("/health")`,
        `async def health(): pass`,
      ].join('\n');

      const mounts = parser.extractMountPrefixes('/project/main.py', content);

      expect(mounts).toHaveLength(0);
    });

    it('should handle module-level dotted access (users.router)', () => {
      const content = [
        `from fastapi import FastAPI`,
        `from routers import users, products, orders`,
        ``,
        `app = FastAPI()`,
        `app.include_router(users.router, prefix='/api/users', tags=['users'])`,
        `app.include_router(products.router, prefix='/api/products', tags=['products'])`,
        `app.include_router(orders.router, prefix='/api/orders', tags=['orders'])`,
      ].join('\n');

      const mounts = parser.extractMountPrefixes('/project/main.py', content);

      expect(mounts).toHaveLength(3);
      expect(mounts[0]).toMatchObject({ prefix: '/api/users', variableName: 'users.router' });
      expect(mounts[1]).toMatchObject({ prefix: '/api/products', variableName: 'products.router' });
      expect(mounts[2]).toMatchObject({ prefix: '/api/orders', variableName: 'orders.router' });
    });

    it('should handle prefix in any kwarg position (e.g. after tags)', () => {
      const content = [
        `from routers.items import router as items_router`,
        `app.include_router(items_router, tags=['items'], prefix='/api/items')`,
      ].join('\n');

      const mounts = parser.extractMountPrefixes('/project/main.py', content);

      expect(mounts).toHaveLength(1);
      expect(mounts[0]).toMatchObject({ prefix: '/api/items', variableName: 'items_router' });
    });
  });
});
