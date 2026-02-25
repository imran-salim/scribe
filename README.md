# Scribe

A secure, full-stack audio transcription application. Record audio in your browser and get high-quality transcripts powered by OpenAI.

**Live Application**: [https://scribe-eight-mauve.vercel.app/](https://scribe-eight-mauve.vercel.app/)

> **Note**: Account registration is currently disabled. Please contact the author at [narmilas@proton.me](mailto:narmilas@proton.me) to request access.

## Features
- **User Authentication**: Secure registration and login using JWT and Bcrypt.
- **Transcription History**: Automatically save and browse your past transcriptions.
- **Privacy-First**: Transcriptions are private and associated with your unique user account.
- **Modern UI**: Clean, responsive interface with a recording dashboard and history sidebar.

## Project Structure
- **/client**: React (Vite) + TypeScript frontend.
- **/server**: Node.js (Express) + Drizzle ORM + PostgreSQL backend.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend**: Express, Drizzle ORM, Node-Postgres.
- **AI**: OpenAI Audio Transcriptions API.
- **Auth**: JSON Web Tokens (JWT), Bcrypt.js.
- **Database**: PostgreSQL.

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
```

### 3. Frontend
```bash
cd client
npm install
# Configure .env (see client/README.md)
npm run dev
```

## Deployment
- **API & Database**: Use the included `render.yaml` to deploy to **Render**. It handles the Web Service and PostgreSQL setup automatically.
- **Frontend**: Deploy the `client/` directory to **Vercel**. Set `VITE_API_URL` to your Render service URL.
