import { RouteParser } from './parser';
import { ExpressParser } from './expressParser';
import { FlaskParser } from './flaskParser';
import { DjangoParser } from './djangoParser';
import { Framework } from '../models/route';

/**
 * Factory that creates and manages RouteParser instances.
 *
 * Design pattern: Factory
 * - Encapsulates parser creation logic.
 * - Returns the correct parser(s) based on file extension or framework config.
 * - Caches parser instances (each parser is stateless, so one instance suffices).
 */
export class ParserFactory {
  private parsers: Map<Framework, RouteParser> = new Map();

  constructor(enabledFrameworks?: Framework[]) {
    const frameworks = enabledFrameworks ?? ['express', 'flask', 'django'];

    if (frameworks.includes('express')) {
      this.parsers.set('express', new ExpressParser());
    }
    if (frameworks.includes('flask')) {
      this.parsers.set('flask', new FlaskParser());
    }
    if (frameworks.includes('django')) {
      this.parsers.set('django', new DjangoParser());
    }
  }

  /**
   * Returns all registered parsers.
   */
  getAllParsers(): RouteParser[] {
    return Array.from(this.parsers.values());
  }

  /**
   * Returns parsers that are capable of parsing the given file.
   *
   * @param filePath - Absolute path of the file.
   * @param content  - Full text content of the file.
   */
  getParsersForFile(filePath: string, content: string): RouteParser[] {
    return this.getAllParsers().filter((parser) => parser.canParse(filePath, content));
  }

  /**
   * Returns a specific parser by framework name.
   */
  getParser(framework: Framework): RouteParser | undefined {
    return this.parsers.get(framework);
  }
}
