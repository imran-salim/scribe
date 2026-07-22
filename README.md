# Scribe

A secure, full-stack audio transcription application. Record audio in your browser and get high-quality transcripts powered by OpenAI.

**Live Application**: [https://scribe-eight-mauve.vercel.app/](https://scribe-eight-mauve.vercel.app/)

> **Note**: Account registration is currently disabled, but a demo account is available — the credentials are shown on the login page. The API runs on Render's free tier and goes offline after a period of inactivity, so the first sign-in may take up to a minute while the server spins back up. For anything else, contact the author at [narmilas@proton.me](mailto:narmilas@proton.me).

## Features
- **User Authentication**: Secure registration and login using JWT and Bcrypt, with silent token refresh so sessions stay alive without re-login.
- **Transcription History**: Automatically save and browse your past transcriptions.
- **Copy to Clipboard**: One-click copy on the current transcript and on every item in the history sidebar.
- **Privacy-First**: Transcriptions are private and associated with your unique user account.
- **Modern UI**: Clean, responsive interface with a recording dashboard and history sidebar. The Start Recording button provides immediate feedback while microphone permission is being requested.

## Project Structure
- **/client**: React (Vite) + TypeScript frontend.
- **/server**: Node.js (Express) + Drizzle ORM + PostgreSQL backend.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend**: Express, Drizzle ORM, Node-Postgres.
- **AI**: OpenAI Audio Transcriptions API.
- **Auth**: JSON Web Tokens (JWT), Bcrypt.js.
- **Database**: PostgreSQL (hosted on Neon in production).

## Quick Start

### 1. Database Setup
Ensure you have PostgreSQL running locally and create a database named `scribe`.

### 2. Backend
```bash
cd server
npm install
# Configure .env (see server/README.md)
npm run db:push  # Sync database schema
npm run dev
npm test         # Run unit tests (optional)
```

### 3. Frontend
```bash
cd client
npm install
# Configure .env (see client/README.md)
npm run dev
```

## Deployment
- **API**: Use the included `render.yaml` to deploy the Express server to **Render**. Note that on the free tier the service sleeps after a period of inactivity and takes up to a minute to wake.
- **Database**: Create a PostgreSQL database on **Neon** and set `DATABASE_URL` on the Render service to its connection string. Migrations run automatically on deploy (`npm run db:migrate`).
- **Frontend**: Deploy the `client/` directory to **Vercel**. Set `VITE_API_URL` to your Render service URL.
