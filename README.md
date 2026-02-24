# Scribe

A full-stack audio transcription app with a password-locked UI, powered by OpenAI.

## Project Structure
- **/client**: React (Vite) frontend.
- **/server**: Node.js (Express) backend.

## Quick Start

### 1. Server
```bash
cd server
npm install
# Configure .env with OPENAI_API_KEY and APP_PASSWORD
npm run dev
```

### 2. Client
```bash
cd client
npm install
# Configure .env with VITE_API_URL
npm run dev
```

## Deployment
- **Frontend**: Deploy `client/` to Vercel. Set `VITE_API_URL` to your backend.
- **Backend**: Deploy `server/` to Render. Set `OPENAI_API_KEY` and `APP_PASSWORD`.
