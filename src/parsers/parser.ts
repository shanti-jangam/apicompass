import { ParseResult } from '../models/route';

/**
 * Abstract base class for all route parsers.
 *
 * Follows the **Strategy Pattern**: each concrete parser (Express, Flask, Django)
 * implements its own parsing logic while conforming to a common interface.
 * The RouteManager and ParserFactory work with this abstraction, never with
 * concrete parser classes directly.
 *
 * Design pattern: Strategy
 * SOLID principle: Open/Closed - new frameworks can be added by creating a new
 * subclass without modifying existing code.
 */
export abstract class RouteParser {
  /**
   * Human-readable name of the framework this parser handles.
   */
  abstract readonly frameworkName: string;

  /**
   * File extensions this parser is interested in.
   * For example, Express parser handles ['.js', '.ts'],
   * Flask parser handles ['.py'].
   */
  abstract readonly supportedExtensions: string[];

  /**
   * Determines whether this parser can meaningfully parse the given file.
   * This is a quick check based on file extension and optionally a peek
   * at the file content (e.g. checking for imports).
   *
   * @param filePath - Absolute path to the file.
   * @param content  - Full text content of the file.
   * @returns true if this parser should attempt to parse the file.
   */
  abstract canParse(filePath: string, content: string): boolean;

  /**
   * Parses the given file content and extracts all API route definitions.
   *
   * @param filePath - Absolute path to the file (used for Route.filePath).
   * @param content  - Full text content of the file.
   * @returns A ParseResult containing discovered routes and any errors.
   */
  abstract parse(filePath: string, content: string): ParseResult;
}
