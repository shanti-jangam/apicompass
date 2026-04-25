import { FlaskParser } from '../../src/parsers/flaskParser';

describe('FlaskParser', () => {
  let parser: FlaskParser;

  beforeEach(() => {
    parser = new FlaskParser();
  });

  describe('canParse', () => {
    it('should return true for .py files with Flask route decorators', () => {
      const content = `from flask import Flask\n@app.route('/users')`;
      expect(parser.canParse('routes.py', content)).toBe(true);
    });

    it('should return false for .js files', () => {
      const content = `@app.route('/users')`;
      expect(parser.canParse('routes.js', content)).toBe(false);
    });

    it('should return false for .py files without Flask patterns', () => {
      const content = `def hello():\n    print("hello")`;
      expect(parser.canParse('utils.py', content)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse basic @app.route() decorator', () => {
      const content = [
        `from flask import Flask`,
        `app = Flask(__name__)`,
        ``,
        `@app.route('/users')`,
        `def get_users():`,
        `    return []`,
      ].join('\n');

      const result = parser.parse('/project/app.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0]).toMatchObject({
        method: 'GET',
        path: '/users',
        filePath: '/project/app.py',
        lineNumber: 4,
        framework: 'flask',
      });
    });

    it('should parse routes with explicit methods', () => {
      const content = `@app.route('/users', methods=['GET', 'POST'])`;
      const result = parser.parse('/project/app.py', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0].method).toBe('GET');
      expect(result.routes[1].method).toBe('POST');
    });

    it('should parse routes with single method', () => {
      const content = `@app.route('/users', methods=['POST'])`;
      const result = parser.parse('/project/app.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].method).toBe('POST');
    });

    it('should parse Blueprint routes and prepend url_prefix', () => {
      const content = [
        `from flask import Blueprint`,
        `bp = Blueprint('api', __name__, url_prefix='/api')`,
        ``,
        `@bp.route('/items')`,
        `def get_items():`,
        `    return []`,
      ].join('\n');

      const result = parser.parse('/project/api.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0]).toMatchObject({
        method: 'GET',
        path: '/api/items',
        lineNumber: 4,
      });
    });

    it('should handle routes with parameters', () => {
      const content = `@app.route('/users/<int:id>', methods=['GET', 'PUT', 'DELETE'])`;
      const result = parser.parse('/project/app.py', content);

      expect(result.routes).toHaveLength(3);
      expect(result.routes[0].path).toBe('/users/<int:id>');
    });

    it('should default to GET when no methods specified', () => {
      const content = `@app.route('/health')`;
      const result = parser.parse('/project/app.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].method).toBe('GET');
    });

    it('should return correct line numbers', () => {
      const content = [
        `# Flask app`,
        `from flask import Flask`,
        `app = Flask(__name__)`,
        ``,
        `@app.route('/first')`,
        `def first():`,
        `    pass`,
        ``,
        `@app.route('/second')`,
        `def second():`,
        `    pass`,
      ].join('\n');

      const result = parser.parse('/project/app.py', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0].lineNumber).toBe(5);
      expect(result.routes[1].lineNumber).toBe(9);
    });

    it('should return empty routes for non-Flask files', () => {
      const content = `def add(a, b):\n    return a + b`;
      const result = parser.parse('/project/utils.py', content);

      expect(result.routes).toHaveLength(0);
    });
  });

  describe('Blueprint url_prefix resolution', () => {
    it('should not modify routes for Blueprints without url_prefix', () => {
      const content = [
        `from flask import Blueprint`,
        `bp = Blueprint('main', __name__)`,
        ``,
        `@bp.route('/health')`,
        `def health(): pass`,
      ].join('\n');

      const result = parser.parse('/project/main.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe('/health');
    });

    it('should handle multiple Blueprints in one file', () => {
      const content = [
        `from flask import Blueprint`,
        `users_bp = Blueprint('users', __name__, url_prefix='/users')`,
        `items_bp = Blueprint('items', __name__, url_prefix='/items')`,
        ``,
        `@users_bp.route('/list')`,
        `def list_users(): pass`,
        ``,
        `@items_bp.route('/list')`,
        `def list_items(): pass`,
      ].join('\n');

      const result = parser.parse('/project/app.py', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0].path).toBe('/users/list');
      expect(result.routes[1].path).toBe('/items/list');
    });

    it('should handle Blueprint root route with prefix', () => {
      const content = [
        `from flask import Blueprint`,
        `api = Blueprint('api', __name__, url_prefix='/api/v1')`,
        ``,
        `@api.route('/')`,
        `def index(): pass`,
      ].join('\n');

      const result = parser.parse('/project/api.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe('/api/v1');
    });
  });

  describe('extractMountPrefixes (cross-file)', () => {
    it('should extract variable names and prefixes from register_blueprint', () => {
      const content = [
        `from flask import Flask`,
        `from .users import users_bp`,
        `from .products import products_bp`,
        ``,
        `app = Flask(__name__)`,
        `app.register_blueprint(users_bp, url_prefix='/api/users')`,
        `app.register_blueprint(products_bp, url_prefix='/api/products')`,
      ].join('\n');

      const mounts = parser.extractMountPrefixes('/project/app.py', content);

      expect(mounts).toHaveLength(2);
      expect(mounts[0]).toMatchObject({ prefix: '/api/users', variableName: 'users_bp' });
      expect(mounts[1]).toMatchObject({ prefix: '/api/products', variableName: 'products_bp' });
    });

    it('should ignore register_blueprint without url_prefix', () => {
      const content = [
        `from .main import main_bp`,
        `app.register_blueprint(main_bp)`,
      ].join('\n');

      const mounts = parser.extractMountPrefixes('/project/app.py', content);

      expect(mounts).toHaveLength(0);
    });

    it('should return empty when no register_blueprint calls', () => {
      const content = [
        `from flask import Flask`,
        `app = Flask(__name__)`,
        `@app.route('/health')`,
        `def health(): pass`,
      ].join('\n');

      const mounts = parser.extractMountPrefixes('/project/app.py', content);

      expect(mounts).toHaveLength(0);
    });

    it('should handle module-level dotted access (users.bp)', () => {
      const content = [
        `from flask import Flask`,
        `from blueprints import users, products`,
        ``,
        `app = Flask(__name__)`,
        `app.register_blueprint(users.bp, url_prefix='/api/users')`,
        `app.register_blueprint(products.bp, url_prefix='/api/products')`,
      ].join('\n');

      const mounts = parser.extractMountPrefixes('/project/app.py', content);

      expect(mounts).toHaveLength(2);
      expect(mounts[0]).toMatchObject({ prefix: '/api/users', variableName: 'users.bp' });
      expect(mounts[1]).toMatchObject({ prefix: '/api/products', variableName: 'products.bp' });
    });

    it('should handle url_prefix in any kwarg position', () => {
      const content = [
        `from .auth import auth_bp`,
        `app.register_blueprint(auth_bp, subdomain='auth', url_prefix='/auth')`,
      ].join('\n');

      const mounts = parser.extractMountPrefixes('/project/app.py', content);

      expect(mounts).toHaveLength(1);
      expect(mounts[0]).toMatchObject({ prefix: '/auth', variableName: 'auth_bp' });
    });
  });
});
