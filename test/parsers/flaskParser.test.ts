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

    it('should parse Blueprint routes', () => {
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
        path: '/items',
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
});
