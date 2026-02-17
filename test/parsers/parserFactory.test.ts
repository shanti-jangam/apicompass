import { ParserFactory } from '../../src/parsers/parserFactory';
import { ExpressParser } from '../../src/parsers/expressParser';
import { FlaskParser } from '../../src/parsers/flaskParser';
import { DjangoParser } from '../../src/parsers/djangoParser';

describe('ParserFactory', () => {
  describe('constructor', () => {
    it('should create all parsers by default', () => {
      const factory = new ParserFactory();
      expect(factory.getAllParsers()).toHaveLength(3);
    });

    it('should only create enabled parsers', () => {
      const factory = new ParserFactory(['express']);
      expect(factory.getAllParsers()).toHaveLength(1);
      expect(factory.getParser('express')).toBeInstanceOf(ExpressParser);
      expect(factory.getParser('flask')).toBeUndefined();
    });

    it('should create Flask and Django parsers when configured', () => {
      const factory = new ParserFactory(['flask', 'django']);
      expect(factory.getAllParsers()).toHaveLength(2);
      expect(factory.getParser('flask')).toBeInstanceOf(FlaskParser);
      expect(factory.getParser('django')).toBeInstanceOf(DjangoParser);
    });
  });

  describe('getParsersForFile', () => {
    it('should return Express parser for .js files with Express content', () => {
      const factory = new ParserFactory();
      const content = `const app = express();\napp.get('/users', handler);`;
      const parsers = factory.getParsersForFile('routes.js', content);

      expect(parsers).toHaveLength(1);
      expect(parsers[0]).toBeInstanceOf(ExpressParser);
    });

    it('should return Flask parser for .py files with Flask content', () => {
      const factory = new ParserFactory();
      const content = `@app.route('/users')`;
      const parsers = factory.getParsersForFile('app.py', content);

      expect(parsers).toHaveLength(1);
      expect(parsers[0]).toBeInstanceOf(FlaskParser);
    });

    it('should return Django parser for urls.py', () => {
      const factory = new ParserFactory();
      const content = `from django.urls import path\nurlpatterns = []`;
      const parsers = factory.getParsersForFile('urls.py', content);

      expect(parsers).toHaveLength(1);
      expect(parsers[0]).toBeInstanceOf(DjangoParser);
    });

    it('should return empty array for files no parser can handle', () => {
      const factory = new ParserFactory();
      const content = `console.log("hello")`;
      const parsers = factory.getParsersForFile('readme.md', content);

      expect(parsers).toHaveLength(0);
    });
  });

  describe('getParser', () => {
    it('should return the correct parser by framework name', () => {
      const factory = new ParserFactory();
      expect(factory.getParser('express')).toBeInstanceOf(ExpressParser);
      expect(factory.getParser('flask')).toBeInstanceOf(FlaskParser);
      expect(factory.getParser('django')).toBeInstanceOf(DjangoParser);
    });
  });
});
