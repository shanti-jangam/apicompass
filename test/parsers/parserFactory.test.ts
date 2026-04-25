import { ParserFactory } from '../../src/parsers/parserFactory';
import { ExpressParser } from '../../src/parsers/expressParser';
import { FlaskParser } from '../../src/parsers/flaskParser';
import { DjangoParser } from '../../src/parsers/djangoParser';
import { FastApiParser } from '../../src/parsers/fastApiParser';
import { GoParser } from '../../src/parsers/goParser';
import { NestJsParser } from '../../src/parsers/nestJsParser';

describe('ParserFactory', () => {
  describe('constructor', () => {
    it('should create all parsers by default', () => {
      const factory = new ParserFactory();
      expect(factory.getAllParsers()).toHaveLength(6);
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

    it('should create FastAPI and Go parsers when configured', () => {
      const factory = new ParserFactory(['fastapi', 'go']);
      expect(factory.getAllParsers()).toHaveLength(2);
      expect(factory.getParser('fastapi')).toBeInstanceOf(FastApiParser);
      expect(factory.getParser('go')).toBeInstanceOf(GoParser);
    });

    it('should create NestJS parser when configured', () => {
      const factory = new ParserFactory(['nestjs']);
      expect(factory.getAllParsers()).toHaveLength(1);
      expect(factory.getParser('nestjs')).toBeInstanceOf(NestJsParser);
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

    it('should return FastAPI parser for .py files with FastAPI content', () => {
      const factory = new ParserFactory();
      const content = `from fastapi import FastAPI\n@app.get("/users")`;
      const parsers = factory.getParsersForFile('main.py', content);

      expect(parsers).toHaveLength(1);
      expect(parsers[0]).toBeInstanceOf(FastApiParser);
    });

    it('should return Go parser for .go files with route content', () => {
      const factory = new ParserFactory();
      const content = `r := gin.Default()\nr.GET("/users", handler)`;
      const parsers = factory.getParsersForFile('main.go', content);

      expect(parsers).toHaveLength(1);
      expect(parsers[0]).toBeInstanceOf(GoParser);
    });

    it('should return NestJS parser for .ts files with NestJS controller content', () => {
      const factory = new ParserFactory();
      const content = `@Controller('users')\nexport class UsersController { @Get() findAll() {} }`;
      const parsers = factory.getParsersForFile('users.controller.ts', content);

      expect(parsers).toHaveLength(1);
      expect(parsers[0]).toBeInstanceOf(NestJsParser);
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
      expect(factory.getParser('fastapi')).toBeInstanceOf(FastApiParser);
      expect(factory.getParser('go')).toBeInstanceOf(GoParser);
      expect(factory.getParser('nestjs')).toBeInstanceOf(NestJsParser);
    });
  });
});
