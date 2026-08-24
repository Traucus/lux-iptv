# Lux IPTV

Cinematic desktop IPTV player with licensing system.

## Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker** & **Docker Compose** (for PostgreSQL)
- **Git**

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL
npm run db:up

# 3. Wait for database to be ready, then run migrations
npm run db:migrate

# 4. Start development environment
npm run dev
```

This will start:
- **Electron** main process (desktop app)
- **Vite** dev server (renderer, http://localhost:5173)
- **Fastify** licensing API (http://localhost:3000)

## Available Scripts

### Development
- `npm run dev` — Start full dev environment (Electron + Vite + API)
- `npm run dev:renderer` — Start only Vite dev server
- `npm run dev:main` — Start only Electron main process (with watch)
- `npm run dev:api` — Start only licensing API (with tsx watch)

### Building
- `npm run build` — Build everything for production
- `npm run build:renderer` — Build React renderer with Vite
- `npm run build:main` — Build Electron main process
- `npm run build:api` — Build licensing API
- `npm start` — Run the built application

### Testing
- `npm test` — Run unit and integration tests (Vitest)
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Run tests with coverage report
- `npm run test:e2e` — Run E2E tests (Playwright)

### Code Quality
- `npm run typecheck` — Type check all TypeScript files
- `npm run lint` — Lint code with ESLint
- `npm run lint:fix` — Fix linting issues automatically
- `npm run format` — Format code with Prettier

### Database
- `npm run db:up` — Start PostgreSQL container
- `npm run db:down` — Stop PostgreSQL container
- `npm run db:migrate` — Run database migrations (Drizzle)
- `npm run db:studio` — Open Drizzle Studio (database GUI)

### License Management CLI
- `npm run api:license:create` — Create a new license key
- `npm run api:license:list` — List all licenses
- `npm run api:license:revoke` — Revoke a license

## Architecture

```
src/
├── main/              # Electron main process (Node.js target)
│   └── index.ts       # App entry point, window management
├── preload/           # Electron preload scripts (contextBridge)
│   └── index.ts       # Safe API exposure to renderer
├── renderer/          # React app (DOM target)
│   ├── main.tsx       # React entry point
│   ├── App.tsx        # Root component
│   ├── index.html     # HTML template
│   └── styles/        # Tailwind CSS + global styles
├── licensing-api/     # Fastify backend for license management
│   ├── server.ts      # API entry point
│   ├── db/            # Drizzle ORM setup & schema
│   ├── routes/        # Public API routes (/api/v1/*)
│   ├── admin/         # Admin routes (/admin/*) with Basic Auth
│   └── cli/           # CLI tools for license management
├── shared/            # Types shared across processes
│   └── types/         # TypeScript interfaces
└── workers/           # Web Workers (background processing)

tests/
├── unit/              # Unit tests (isolated components)
├── integration/       # Integration tests (multiple units)
├── e2e/               # End-to-end tests (Playwright)
└── fixtures/          # Test data & mocks

docker/                # Docker configuration
└── init.sql           # PostgreSQL initialization script
```

## Tech Stack

- **Desktop**: Electron 33
- **Frontend**: React 18, TypeScript 5.6, Tailwind CSS 3.4
- **Build**: Vite 6 (renderer), TypeScript (main/API)
- **Backend**: Fastify 5, Drizzle ORM, PostgreSQL 16
- **Testing**: Vitest (unit/integration), Playwright (E2E)
- **Design System**: Cinematic Glass (dark theme, glassmorphism)

## Design System: Cinematic Glass

The UI follows a "Cinematic Glass" design system:
- **Dark theme** with deep surface colors (#0a0a0f)
- **Primary color**: Blue (#3b82f6)
- **Font**: Inter
- **Glassmorphism**: Backdrop blur, semi-transparent backgrounds
- **Animations**: Smooth fade-in, slide-up, scale-in transitions
- **Utilities**: `.glass`, `.glow`, `.text-gradient`, `.btn-primary`, `.btn-glass`

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Database
DATABASE_URL=postgresql://lux_user:lux_password@localhost:5432/lux_iptv

# API
API_PORT=3000
API_HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173

# Admin (for /admin/* routes)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# Logging
LOG_LEVEL=info
```

## Project Status

🚧 **Early Development** — Initial project setup complete.

### Next Phases
1. **Spec** — Define detailed specifications for each feature
2. **Design** — Technical design and architecture decisions
3. **Tasks** — Break down implementation into concrete tasks
4. **Implementation** — Build features following TDD

## License

UNLICENSED — All rights reserved.
