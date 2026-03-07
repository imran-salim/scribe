# Scribe - Server

Secure Node.js + Express backend for high-quality audio transcription and transcription history.

## Features
- **OpenAI Audio API**: Powered by OpenAI's transcription models.
- **PostgreSQL Database**: Persistent storage for user accounts and transcriptions.
- **Drizzle ORM**: Type-safe database queries and schema management.
- **JWT Authentication**: Secure user-specific transcription data.

## Setup
1. `npm install`
2. Create `.env`:
   ```env
   PORT=8000
   OPENAI_API_KEY=your_openai_key
   APP_PASSWORD=your_admin_password
   DATABASE_URL=postgresql://imransalim@localhost:5432/scribe
   JWT_SECRET=your_secure_jwt_secret
   ALLOWED_ORIGINS=http://localhost:5173
   ```
3. `npm run db:push` (to sync your database schema)
4. `npm run dev`

## Source Structure
```
src/
├── config.ts              # Env vars, validation, startup guards
├── context.ts             # OpenAI client, Multer, rate limiters
├── server.ts              # Express app entry point
├── db/
│   ├── index.ts           # PostgreSQL connection (Drizzle)
│   └── schema.ts          # Table definitions
├── middleware/
│   └── auth.ts            # authMiddleware (app password), userAuthMiddleware (JWT)
├── routes/
│   ├── index.ts           # Mounts sub-routers
│   ├── auth.ts            # POST /auth/login, POST /auth/register, GET /, GET /verify
│   └── transcriptions.ts  # POST /transcribe, GET /transcriptions
└── services/
    ├── auth.ts            # login(), register() — bcrypt + JWT logic
    └── transcription.ts   # transcribe(), getUserTranscriptions() — OpenAI + DB logic
```

## Database Management
- `npm run db:push`: Synchronizes the local schema with the database.
- `npm run db:generate`: Generates migration files.
- `npm run db:migrate`: Applies generated migrations.
- `npm run db:studio`: Opens Drizzle's visual database manager.

## Testing
- `npm test`: Runs the full unit test suite (Vitest).

Tests cover the service layer, middleware, and route handlers. All external dependencies (database, OpenAI) are mocked so no live connections are required to run tests.

## API Documentation
- `POST /auth/register`: Create a new account. *(Currently disabled — returns 403.)*
- `POST /auth/login`: Authenticate and receive a JWT and a refresh token.
- `POST /auth/refresh`: Exchange a valid refresh token for a new access token and refresh token.
- `POST /auth/logout`: Invalidate the current session (requires JWT).
- `POST /transcribe`: Upload audio and receive a transcript (requires JWT).
- `GET /transcriptions`: Retrieve user transcription history (requires JWT).

## Tech Stack
- **Framework**: Express.js.
- **Database**: PostgreSQL + Drizzle ORM.
- **Security**: Bcrypt.js, JSON Web Tokens (JWT), Helmet.
- **Storage**: Multer (Memory Storage).
- **AI**: OpenAI SDK.
- **Testing**: Vitest, Supertest.
