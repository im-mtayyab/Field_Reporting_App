# Field Reporting App

Offline-first React Native app + Express API for field reports. Metadata lives in Supabase Postgres; photos upload to Supabase Storage via **TUS** (resumable).

```text
frontend/   React Native (Android / iOS)
backend/    Express + TypeScript API
```

## Quick start

**Backend**

```bash
cd backend
cp .env.example .env   # fill Supabase keys
npm install
npm run setup:supabase # bucket + policies + migrations
npm run dev            # http://localhost:4000
```

**Frontend**

```bash
cd frontend
cp .env.example .env   # set API_URL (e.g. http://<lan-ip>:4000)
npm install
npm start
npm run android        # or npm run ios
```

## Docs

- API, env, TUS, simulate failures → [backend/README.md](backend/README.md)
- App run notes → [frontend/README.md](frontend/README.md)
