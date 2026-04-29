# APICompass

**Automated API Route Visualizer for VS Code**

APICompass is a Visual Studio Code extension that scans your backend codebase and gives you an organized, clickable tree of every REST API endpoint - right inside the editor sidebar. It supports **Express.js**, **NestJS**, **Flask**, **Django**, **FastAPI**, and **Go** (Gin, Echo, Chi, Fiber, net/http) out of the box, and updates automatically as you edit your code.

---

## The Problem

In any non-trivial backend project, API routes end up spread across dozens of files:

```
routes/user.routes.js
routes/auth.routes.js
controllers/api/v1/orders.js
app/blueprints/auth.py
project/urls.py
```

When someone asks _"Where is the handler for `GET /api/v1/users/profile`?"_, the answer usually involves Ctrl+F, guessing file names, or asking a teammate. This wastes time, especially during onboarding, code reviews, and refactoring.

## The Solution

APICompass scans the workspace using static analysis, extracts every route definition it can find, and presents them in a structured sidebar panel. One click takes you straight to the source file and line where the route is defined.

---

## Features

| Feature                   | Description                                                                      |
| ------------------------- | -------------------------------------------------------------------------------- |
| **Multi-framework**       | Express.js, NestJS, Flask, Django, FastAPI, and Go detected automatically        |
| **Interactive tree view** | Routes shown in a collapsible sidebar grouped by file, HTTP method, or framework |
| **Click-to-navigate**     | Click any route to jump to the exact file and line                               |
| **Real-time updates**     | File watcher detects saves and re-parses only the changed file                   |
| **Search**                | Quick-pick search across all discovered routes by path, method, or file name     |
| **Colour-coded icons**    | GET (green), POST (blue), PUT (orange), DELETE (red), PATCH (yellow)             |
| **Configurable**          | Include/exclude folders, choose frameworks, pick grouping style                  |
| **Prefix resolution**     | Cross-file mount prefix resolution for Express, Flask, and FastAPI               |
| **Route deduplication**   | Duplicate routes from multiple parsers are automatically removed                 |
| **Export**                | Export all routes to JSON or OpenAPI 3.0 (YAML/JSON)                             |
| **Keyboard shortcuts**    | `Ctrl+Shift+A R` to refresh, `Ctrl+Shift+A S` to search                          |
| **Context menus**         | Right-click a route to copy its path or a cURL command                           |
| **Lightweight**           | ~35 KB bundled; async scanning keeps the editor responsive                       |

---

## Supported Frameworks & Patterns

### Express.js (JavaScript / TypeScript)

```javascript
app.get('/users', handler);
app.post('/users', handler);
router.put('/users/:id', handler);
app.delete('/users/:id', handler);
app.route('/items').get(listItems).post(createItem);
app.use('/api', router); // same-file mount prefix auto-resolved

// Cross-file: prefix applied to routes in imported router files
const usersRouter = require('./routes/users');
app.use('/api/users', usersRouter); // routes in users.js get /api/users prefix
```

### NestJS (TypeScript / JavaScript)

```typescript
@Controller('users')
export class UsersController {
  @Get()           // GET /users
  findAll() {}

  @Get(':id')      // GET /users/:id
  findOne() {}

  @Post()          // POST /users
  create() {}

  @Put(':id')      // PUT /users/:id
  @Delete(':id')   // DELETE /users/:id
  @Patch(':id')    // PATCH /users/:id
}
```

### Flask (Python)

```python
@app.route('/users')
def get_users(): ...

@app.route('/users', methods=['POST'])
def create_user(): ...

bp = Blueprint('api', __name__, url_prefix='/api')
@bp.route('/items')          # resolves to /api/items
def get_items(): ...

# Cross-file: prefix applied to routes in imported blueprint files
from .users import users_bp
app.register_blueprint(users_bp, url_prefix='/api/users')
```

### Django (Python)

```python
urlpatterns = [
    path('users/', views.user_list),
    path('users/<int:pk>/', views.user_detail),
    re_path(r'^articles/(?P<year>[0-9]{4})/$', views.year_archive),
]
```

### FastAPI (Python)

```python
@app.get("/users")
async def get_users(): ...

@router.post("/items")
async def create_item(): ...

@app.get("/users/{user_id}")
async def get_user(user_id: int): ...

@app.api_route("/custom", methods=["GET", "POST"])
async def custom(): ...

# Cross-file: prefix applied to routes in imported router files
from .routers.users import router as users_router
app.include_router(users_router, prefix="/api/users")
```

### Go (Gin, Echo, Chi, Fiber, net/http)

```go
// Gin, Echo, Fiber
r.GET("/users", handler)
r.POST("/users", handler)

// Chi (PascalCase methods)
r.Get("/items", handler)
r.Post("/items", handler)

// net/http
http.HandleFunc("/health", handler)
```

---

## Quick Start

### Prerequisites

- [Visual Studio Code](https://code.visualstudio.com/) 1.85 or later
- [Node.js](https://nodejs.org/) 16 or later (for building from source)

### Install from Source

```bash
# Clone the repository
git clone <repo-url> apicompass
cd apicompass

# Install dependencies
npm install

# Build the extension
npm run compile

# Run tests
npm test
```

### Launch in Development Mode

1. Open the `apicompass` folder in VS Code.
2. Press **F5** (or choose _Run > Start Debugging_).
3. A new _Extension Development Host_ window opens.
4. Open any project that contains Express, NestJS, Flask, Django, FastAPI, or Go routes.
5. Click the **APICompass** icon in the activity bar (left sidebar).
6. Routes are listed automatically. Click any route to jump to its definition.

### Package as .vsix

```bash
npm run package        # produces apicompass-0.1.0.vsix
```

Install the `.vsix` file via _Extensions > ··· > Install from VSIX…_ in VS Code.

---

## Configuration

Open **Settings** (`Ctrl+,`) and search for `apicompass`.

| Setting                        | Default                                                     | Description                                        |
| ------------------------------ | ----------------------------------------------------------- | -------------------------------------------------- |
| `apicompass.enabled`           | `true`                                                      | Enable or disable APICompass for current workspace |
| `apicompass.includePaths`      | `[]` (scan everything)                                      | Glob patterns for folders to include               |
| `apicompass.excludePaths`      | `node_modules, .git, venv, __pycache__, dist, build`        | Glob patterns for folders to skip                  |
| `apicompass.enabledFrameworks` | `["express", "flask", "django", "fastapi", "go", "nestjs"]` | Which frameworks to scan for                       |
| `apicompass.groupBy`           | `"file"`                                                    | Group routes by `file`, `method`, or `framework`   |

Notes:

- Changing `apicompass.enabled` is applied immediately (no reload needed). Turning it on triggers a fresh full scan and starts file watching; turning it off clears routes and stops file watching.
- When disabled, the sidebar shows a disabled-state message instead of the generic "No API routes found" message.

---

## Commands

| Command                                | Shortcut         | Description                                                           |
| -------------------------------------- | ---------------- | --------------------------------------------------------------------- |
| `APICompass: Refresh Routes`           | `Ctrl+Shift+A R` | Re-scan the entire workspace                                          |
| `APICompass: Search Routes`            | `Ctrl+Shift+A S` | Open a quick-pick search box to find routes                           |
| `APICompass: Navigate to Route`        |                  | Jump to a route's definition (also triggered by clicking a tree item) |
| `APICompass: Copy Route Path`          | Right-click menu | Copy `METHOD /path` to clipboard                                      |
| `APICompass: Copy as cURL`             | Right-click menu | Copy a cURL command to clipboard                                      |
| `APICompass: Export Routes as JSON`    | Tree view header | Export all routes to a JSON file                                      |
| `APICompass: Export Routes as OpenAPI` | Tree view header | Export all routes as an OpenAPI 3.0 spec (YAML or JSON)               |

---

## Architecture

```
src/
├── models/route.ts             Core data types (Route, HttpMethod, ParseResult)
├── parsers/
│   ├── parser.ts               Abstract RouteParser (Strategy pattern)
│   ├── parserFactory.ts        Creates parsers by framework (Factory pattern)
│   ├── expressParser.ts        Express.js route extraction
│   ├── flaskParser.ts          Flask route extraction
│   ├── djangoParser.ts         Django URL pattern extraction
│   ├── fastApiParser.ts        FastAPI route extraction
│   ├── goParser.ts             Go (Gin, Echo, Chi, Fiber, net/http) route extraction
│   └── nestJsParser.ts         NestJS controller route extraction
├── services/
│   ├── routeManager.ts         Orchestrates scanning, caching, and events
│   ├── routeExporter.ts        Export to JSON and OpenAPI 3.0
│   └── fileScanner.ts          Workspace file discovery
├── views/
│   ├── treeDataProvider.ts     VS Code TreeDataProvider (grouped views)
│   └── treeItem.ts             Individual tree items with icons
├── utils/
│   ├── logger.ts               OutputChannel-based logger (Singleton)
│   ├── config.ts               Reads VS Code settings (Singleton)
│   └── deduplicateRoutes.ts    Route deduplication utility
└── extension.ts                Entry point - wires everything together
```

### Design Patterns Used

| Pattern       | Where                                                                 |
| ------------- | --------------------------------------------------------------------- |
| **Strategy**  | Each parser is a concrete strategy behind the `RouteParser` interface |
| **Factory**   | `ParserFactory` creates the right parser(s) for a given file          |
| **Observer**  | File watcher and `RouteManager.onRoutesChanged` event                 |
| **Singleton** | `Logger` and `Config` instances                                       |

---

## Testing

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

Current coverage:

| Metric      | Value |
| ----------- | ----- |
| Statements  | 97%+  |
| Functions   | 100%  |
| Lines       | 97%+  |
| Test suites | 9     |
| Tests       | 127   |

Test fixtures for Express, NestJS, Flask, Django, FastAPI, and Go are in `test/fixtures/`.

---

## Roadmap

- [x] Cross-file mount prefix resolution (Express, Flask, FastAPI) - done
- [x] Same-file `app.use()` / `url_prefix` / `include_router` prefix resolution - done
- [x] NestJS decorator support (`@Get()`, `@Post()`, `@Controller()`) - done
- [x] FastAPI support (`@app.get()`, `@app.post()`) - done
- [x] Go support (Gin, Echo, Chi, Fiber, net/http) - done
- [x] Route deduplication - done
- [x] Keyboard shortcuts and context menus - done
- [x] Export routes to JSON / OpenAPI stub - done
- [x] CI/CD pipeline (GitHub Actions) - done
- [x] Production packaging (.vscodeignore, CHANGELOG, LICENSE) - done
- [ ] Publish to VS Code Marketplace

---

## Contributing

```bash
# Install dependencies
npm install

# Lint source and test files
npm run lint

# Check formatting
npm run format:check

# Auto-fix formatting
npm run format

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run compile

# Package as .vsix
npm run package
```

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Author

**Shanti Jangam**
**shanti.jangam@gmail.com**
