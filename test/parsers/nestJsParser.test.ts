import { NestJsParser } from '../../src/parsers/nestJsParser';

describe('NestJsParser', () => {
  let parser: NestJsParser;

  beforeEach(() => {
    parser = new NestJsParser();
  });

  describe('canParse', () => {
    it('should return true for .ts files with @Controller', () => {
      const content = `@Controller('users')\nexport class UsersController {}`;
      expect(parser.canParse('users.controller.ts', content)).toBe(true);
    });

    it('should return true for .ts files with @Get decorator', () => {
      const content = `@Get()\nfindAll() {}`;
      expect(parser.canParse('controller.ts', content)).toBe(true);
    });

    it('should return true for .ts files with NestJS imports', () => {
      const content = `import { Controller } from '@nestjs/common';`;
      expect(parser.canParse('app.module.ts', content)).toBe(true);
    });

    it('should return false for .py files', () => {
      const content = `@Controller('users')`;
      expect(parser.canParse('routes.py', content)).toBe(false);
    });

    it('should return false for .ts files without NestJS patterns', () => {
      const content = `const x = 1;\nconsole.log(x);`;
      expect(parser.canParse('utils.ts', content)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse @Controller + @Get/@Post and combine paths', () => {
      const content = [
        `@Controller('users')`,
        `export class UsersController {`,
        `  @Get()`,
        `  findAll() {}`,
        ``,
        `  @Post()`,
        `  create() {}`,
        ``,
        `  @Get(':id')`,
        `  findOne() {}`,
        `}`,
      ].join('\n');

      const result = parser.parse('/project/users.controller.ts', content);

      expect(result.routes).toHaveLength(3);
      expect(result.routes[0]).toMatchObject({
        method: 'GET',
        path: '/users',
        filePath: '/project/users.controller.ts',
        lineNumber: 3,
        framework: 'nestjs',
      });
      expect(result.routes[1]).toMatchObject({ method: 'POST', path: '/users' });
      expect(result.routes[2]).toMatchObject({ method: 'GET', path: '/users/:id' });
    });

    it('should parse @Controller with no path as root', () => {
      const content = [
        `@Controller()`,
        `export class AppController {`,
        `  @Get()`,
        `  getHello() {}`,
        `}`,
      ].join('\n');

      const result = parser.parse('/project/app.controller.ts', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0]).toMatchObject({ method: 'GET', path: '/' });
    });

    it('should parse multiple controllers in one file', () => {
      const content = [
        `@Controller('users')`,
        `export class UsersController {`,
        `  @Get()`,
        `  findAll() {}`,
        `}`,
        ``,
        `@Controller('items')`,
        `export class ItemsController {`,
        `  @Get()`,
        `  findAll() {}`,
        `}`,
      ].join('\n');

      const result = parser.parse('/project/controllers.ts', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0]).toMatchObject({ method: 'GET', path: '/users' });
      expect(result.routes[1]).toMatchObject({ method: 'GET', path: '/items' });
    });

    it('should parse PUT, DELETE, PATCH methods', () => {
      const content = [
        `@Controller('users')`,
        `export class UsersController {`,
        `  @Put(':id')`,
        `  update() {}`,
        `  @Delete(':id')`,
        `  remove() {}`,
        `  @Patch(':id')`,
        `  patch() {}`,
        `}`,
      ].join('\n');

      const result = parser.parse('/project/users.controller.ts', content);

      expect(result.routes).toHaveLength(3);
      expect(result.routes[0]).toMatchObject({ method: 'PUT', path: '/users/:id' });
      expect(result.routes[1]).toMatchObject({ method: 'DELETE', path: '/users/:id' });
      expect(result.routes[2]).toMatchObject({ method: 'PATCH', path: '/users/:id' });
    });

    it('should parse nested paths in method decorators', () => {
      const content = [
        `@Controller('users')`,
        `export class UsersController {`,
        `  @Get('profile')`,
        `  getProfile() {}`,
        `  @Get(':id/posts')`,
        `  getPosts() {}`,
        `}`,
      ].join('\n');

      const result = parser.parse('/project/users.controller.ts', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0]).toMatchObject({ path: '/users/profile' });
      expect(result.routes[1]).toMatchObject({ path: '/users/:id/posts' });
    });

    it('should parse @Controller with api prefix', () => {
      const content = [
        `@Controller('api/v1/users')`,
        `export class UsersController {`,
        `  @Get()`,
        `  findAll() {}`,
        `}`,
      ].join('\n');

      const result = parser.parse('/project/users.controller.ts', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0]).toMatchObject({ path: '/api/v1/users' });
    });

    it('should return correct line numbers', () => {
      const content = [
        `import { Controller, Get } from '@nestjs/common';`,
        ``,
        `@Controller('users')`,
        `export class UsersController {`,
        `  @Get()`,
        `  findAll() {}`,
        `  @Get(':id')`,
        `  findOne() {}`,
        `}`,
      ].join('\n');

      const result = parser.parse('/project/users.controller.ts', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0].lineNumber).toBe(5);
      expect(result.routes[1].lineNumber).toBe(7);
    });

    it('should return empty routes for non-NestJS files', () => {
      const content = `const add = (a: number, b: number) => a + b;`;
      const result = parser.parse('/project/utils.ts', content);

      expect(result.routes).toHaveLength(0);
    });
  });
});
