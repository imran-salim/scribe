# Scribe - Client

Modern React + TypeScript frontend for high-quality audio recording and transcription.

## Features
- **Recording Dashboard**: Real-time audio recording via `MediaRecorder` API.
- **Authentication**: User-friendly registration and login screens.
- **History Sidebar**: Browse and manage your past transcriptions.
- **Responsive UI**: Optimized for desktop and mobile layouts.

## Setup
1. `npm install`
2. Create `.env`:
   ```env
   VITE_API_URL=http://localhost:8000
   ```
3. `npm run dev`

## Tech Stack
- **Framework**: React 19 + Vite.
- **Languages**: TypeScript.
- **Styling**: Tailwind CSS.
- **State Management**: React Hooks (useState, useCallback, useRef).

## Deployment
Deploy to **Vercel** or **Netlify**. Ensure you set the `VITE_API_URL` environment variable to point to your backend.
