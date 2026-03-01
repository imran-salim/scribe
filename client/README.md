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

## Source Structure
```
src/
├── api.ts                  # Typed API client (fetch wrapper, ApiError class)
├── types.ts                # Shared domain types (User, HistoryItem, etc.)
├── hooks/
│   ├── useAuth.ts          # Auth state: token, user, login, logout, toggleMode
│   ├── useHistory.ts       # Transcription history: fetch, refresh, reset
│   ├── useInactivityTimer.ts # 2-minute inactivity timeout + cleanup
│   └── useRecorder.ts      # MediaRecorder lifecycle, audioUrl, transcript, error
├── components/
│   ├── AuthForm.tsx         # Login / register card
│   ├── RecorderPanel.tsx    # Header, record controls, audio player, transcript
│   └── HistorySidebar.tsx   # Scrollable past transcriptions list
├── App.tsx                 # Wires hooks → components; no UI of its own
├── main.tsx
└── index.css
```

## Tech Stack
- **Framework**: React 19 + Vite.
- **Languages**: TypeScript.
- **Styling**: Tailwind CSS.
- **State Management**: Custom React hooks (`useAuth`, `useHistory`, `useRecorder`, `useInactivityTimer`).
- **Testing**: Vitest + Testing Library.

## Testing
- `npm test`: Runs the full unit test suite (Vitest).
- `npm run test:watch`: Runs tests in watch mode.

Tests cover the API client, all four custom hooks, and all three components. All network calls are mocked via `vi.stubGlobal` / `vi.mock` so no live server is required.

## Deployment
Deploy to **Vercel** or **Netlify**. Ensure you set the `VITE_API_URL` environment variable to point to your backend.
