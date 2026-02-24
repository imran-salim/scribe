# Scribe - Server

Node.js + Express backend for audio transcription via OpenAI.

## Setup
1. `npm install`
2. Create `.env`:
   ```
   OPENAI_API_KEY=your_key
   APP_PASSWORD=your_password
   PORT=8000
   ```
3. `npm run dev`

## API
- `GET /verify`: Checks password (via Bearer token).
- `POST /transcribe`: Processes audio files (requires Bearer token).

## Tech Stack
- Express
- OpenAI SDK
- TypeScript
