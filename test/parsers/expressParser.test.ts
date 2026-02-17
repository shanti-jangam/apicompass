import { ExpressParser } from '../../src/parsers/expressParser';

describe('ExpressParser', () => {
  let parser: ExpressParser;

  beforeEach(() => {
    parser = new ExpressParser();
  });

  describe('canParse', () => {
    it('should return true for .js files with Express patterns', () => {
      const content = `const app = express();\napp.get('/users', handler);`;
      expect(parser.canParse('routes.js', content)).toBe(true);
    });

    it('should return true for .ts files with Express patterns', () => {
      const content = `const router = express.Router();\nrouter.post('/items', handler);`;
      expect(parser.canParse('routes.ts', content)).toBe(true);
    });

    it('should return false for .py files', () => {
      const content = `app.get('/users')`;
      expect(parser.canParse('routes.py', content)).toBe(false);
    });

    it('should return false for .js files without Express patterns', () => {
      const content = `const x = 1;\nconsole.log(x);`;
      expect(parser.canParse('utils.js', content)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse basic app.get() route', () => {
      const content = `app.get('/users', getUsers);`;
      const result = parser.parse('/project/routes.js', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0]).toMatchObject({
        method: 'GET',
        path: '/users',
        filePath: '/project/routes.js',
        lineNumber: 1,
        framework: 'express',
      });
    });

    it('should parse multiple routes', () => {
      const content = [
        `app.get('/users', getUsers);`,
        `app.post('/users', createUser);`,
        `app.put('/users/:id', updateUser);`,
        `app.delete('/users/:id', deleteUser);`,
      ].join('\n');

      const result = parser.parse('/project/routes.js', content);

      expect(result.routes).toHaveLength(4);
      expect(result.routes[0].method).toBe('GET');
      expect(result.routes[1].method).toBe('POST');
      expect(result.routes[2].method).toBe('PUT');
      expect(result.routes[3].method).toBe('DELETE');
    });

    it('should parse router.METHOD() patterns', () => {
      const content = [
        `const router = express.Router();`,
        `router.get('/', listItems);`,
        `router.post('/', createItem);`,
        `router.get('/:id', getItem);`,
      ].join('\n');

      const result = parser.parse('/project/itemRoutes.js', content);

      expect(result.routes).toHaveLength(3);
      expect(result.routes[0]).toMatchObject({ method: 'GET', path: '/' });
      expect(result.routes[1]).toMatchObject({ method: 'POST', path: '/' });
      expect(result.routes[2]).toMatchObject({ method: 'GET', path: '/:id' });
    });

    it('should parse routes with double quotes', () => {
      const content = `app.get("/users", handler);`;
      const result = parser.parse('/project/routes.js', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe('/users');
    });

    it('should parse chained route definitions', () => {
      const content = `app.route('/users').get(listUsers).post(createUser);`;
      const result = parser.parse('/project/routes.js', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0]).toMatchObject({ method: 'GET', path: '/users' });
      expect(result.routes[1]).toMatchObject({ method: 'POST', path: '/users' });
    });

    it('should handle route parameters', () => {
      const content = `app.get('/users/:id/posts/:postId', handler);`;
      const result = parser.parse('/project/routes.js', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe('/users/:id/posts/:postId');
    });

    it('should return correct line numbers', () => {
      const content = [
        `// comment`,
        `const app = express();`,
        ``,
        `app.get('/first', handler);`,
        ``,
        `app.post('/second', handler);`,
      ].join('\n');

      const result = parser.parse('/project/routes.js', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0].lineNumber).toBe(4);
      expect(result.routes[1].lineNumber).toBe(6);
    });

    it('should return empty routes for non-Express files', () => {
      const content = `console.log('hello world');`;
      const result = parser.parse('/project/index.js', content);

      expect(result.routes).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle PATCH method', () => {
      const content = `app.patch('/users/:id', patchUser);`;
      const result = parser.parse('/project/routes.js', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].method).toBe('PATCH');
    });
  });
});
