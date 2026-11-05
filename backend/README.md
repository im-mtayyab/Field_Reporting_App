# Field Reports API

Express + TypeScript backend for field reports.  
Reports metadata live in **Supabase Postgres**. Image bytes go to **Supabase Storage** via **TUS** (client uploads directly; this server never stores files).

Base URL (local): `http://localhost:4000`  
Routes are mounted at both `/api/reports` and `/reports`.

---

## Setup

### 1. Prerequisites

- Node.js 20+
- A Supabase project (free tier is fine)

### 2. Install

```bash
cd backend
npm install
```

### 3. Environment

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Dashboard -> Connect (Button-Header) -> Build (Server APIs) |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard -> Connect (Button-Header) -> Build (Server APIs) |
| `SUPABASE_ANON_KEY` | Settings -> API -> View legacy API Keys (optional, preferred for TUS) |
| `SUPABASE_STORAGE_BUCKET` | Bucket name (default `field-report-images`) |
| `SUPABASE_DB_URL` | Dashboard -> Connect (Button-Header) -> Direct Connection Strings (Transaction pooler) |
| `SUPABASE_TUS_ENDPOINT` | Optional override (defaults from `SUPABASE_URL`) |
| `PORT` | Optional, default `4000` |

Pooler URI shape:

```text
postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-YOUR-REGION.pooler.supabase.com:6543/postgres
```

Same paths are documented in `.env.example`.

### 4. Create bucket + policies + tables

```bash
npm run setup:supabase
```

This will:

1. Create the storage bucket (if missing)
2. Apply storage RLS from `supabase/storage_policies.sql`
3. Run SQL migrations under `supabase/migrations/`

You can also run migrations alone anytime:

```bash
npm run migrate
```

### 5. Run

```bash
npm run dev
```

Health check: [http://localhost:4000/health](http://localhost:4000/health)

---

## Folder structure

```text
backend/
├── api/
│   └── index.ts             # serverless entry (exports Express app)
├── supabase/
│   ├── migrations/          # Postgres schema
│   └── storage_policies.sql
├── src/
│   ├── server.ts            # local boot + listen
│   ├── app.ts               # create Express app
│   ├── loaders/             # express bootstrap
│   ├── config/              # env, db pool
│   ├── common/
│   │   ├── errors/          # AppError hierarchy
│   │   ├── middleware/      # errorHandler, simulate
│   │   ├── constants/
│   │   └── utils/
│   ├── modules/
│   │   ├── health/
│   │   └── reports/         # routes → controller → service → repository
│   └── scripts/             # migrations + supabase setup
├── vercel.json
├── .env.example
└── package.json
```

Layer flow: **routes → controller → service → repository → Postgres**.

Local runs use `src/server.ts` (`npm run dev`). Hosted Node serverless uses `api/index.ts` + `vercel.json`.

---

## Typical client flow

1. `POST /api/reports` — create report metadata (idempotent by `reportId`)
2. For each image: `POST .../upload-session` → upload bytes to Supabase TUS → `POST .../complete`
3. `GET /api/reports` — Review list (only **delivered** reports)
4. On hard failure: `POST .../fail`, then retry with a new upload-session

Store TUS URL / tokens / offsets in **device SQLite**, not in this API’s database.

---

## Endpoints

### `GET /health`

**Response**

```json
{
  "ok": true,
  "databaseConfigured": true,
  "storageConfigured": true,
  "bucket": "field-report-images"
}
```

---

### `GET /api/reports`

Lists **delivered** reports only (Review screen).

**Response**

```json
{
  "reports": [
    {
      "id": "report_abc12345",
      "description": "Cracked panel on north wall",
      "status": "delivered",
      "attachments": [
        {
          "id": "att_00123456",
          "reportId": "report_abc12345",
          "fileName": "north.jpg",
          "contentType": "image/jpeg",
          "sizeBytes": 1200000,
          "objectPath": "reports/report_abc12345/att_00123456.jpg",
          "status": "uploaded",
          "uploadedAt": "2026-11-04T08:00:00.000Z",
          "createdAt": "2026-11-04T07:55:00.000Z",
          "updatedAt": "2026-11-04T08:00:00.000Z"
        }
      ],
      "createdAt": "2026-11-04T07:55:00.000Z",
      "updatedAt": "2026-11-04T08:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/reports/:reportId`

**Response**

```json
{
  "report": { "...same shape as above..." }
}
```

**404**

```json
{
  "code": "NOT_FOUND",
  "message": "Report not found",
  "retryable": false
}
```

---

### `POST /api/reports`

Create report metadata. Same `reportId` + same payload → deduped `200`. Different payload → `409`.

**Request**

```json
{
  "reportId": "report_abc12345",
  "description": "Cracked panel on north wall",
  "attachments": [
    {
      "attachmentId": "att_00123456",
      "fileName": "north.jpg",
      "contentType": "image/jpeg",
      "sizeBytes": 1200000,
      "sha256": "optional-hex-digest-at-least-16-chars"
    }
  ]
}
```

Rules:

- `description` required (non-blank)
- `attachments` length **1–5**
- each `sizeBytes` must be **&lt; 5 MB** (`5242880`)
- `contentType`: `image/jpeg` | `image/jpg` | `image/png` | `image/webp` | `image/heic` | `image/heif`
- ids: 8–80 chars, `[0-9a-zA-Z_-]`

**Response `201` (created) / `200` (deduped)**

```json
{
  "report": { "...": "..." },
  "deduped": false
}
```

**400 validation**

```json
{
  "code": "VALIDATION",
  "message": "At least 1 image is required",
  "retryable": false,
  "details": []
}
```

---

### `POST /api/reports/:reportId/attachments/:attachmentId/upload-session`

Returns ephemeral Supabase TUS credentials. Marks attachment `uploading`.  
Works from `pending` / `uploading` / `failed` (retry). Already `uploaded` → `409`.

**Response `201`**

```json
{
  "bucket": "field-report-images",
  "objectPath": "reports/report_abc12345/att_00123456.jpg",
  "uploadEndpoint": "https://PROJECT.storage.supabase.co/storage/v1/upload/resumable",
  "contentType": "image/jpeg",
  "sizeBytes": 1200000,
  "accessToken": "<jwt>",
  "apikey": "<jwt>",
  "resumable": true
}
```

Client: TUS upload to `uploadEndpoint` with `Authorization: Bearer <accessToken>` and `apikey` header.  
If you still have a TUS upload URL locally → `HEAD` and resume from offset; else start over with a new session.

---

### `POST /api/reports/:reportId/attachments/:attachmentId/complete`

Mark one attachment uploaded after TUS finishes. Idempotent if already uploaded.

**Response**

```json
{
  "report": { "...": "..." },
  "attachment": { "...": "..." }
}
```

---

### `POST /api/reports/:reportId/attachments/:attachmentId/fail`

Record a failed attempt (e.g. after simulate `reject`). User can still retry via upload-session.

**Request (optional body)**

```json
{
  "reason": "Simulated upload refusal"
}
```

**Response**

```json
{
  "report": { "status": "failed", "...": "..." },
  "attachment": { "status": "failed", "failureReason": "Simulated upload refusal" }
}
```

---

### `GET /api/reports/:reportId/attachments/:attachmentId/status`

Reconcile after timeout / force-quit / lost response.

**Response**

```json
{
  "reportId": "report_abc12345",
  "attachment": { "...": "..." },
  "reportStatus": "uploading",
  "retryable": true,
  "resumable": true
}
```

---

### `DELETE /api/reports`

Start over — wipe all reports/attachments rows.

**Response**

```json
{
  "ok": true,
  "removedReports": 3
}
```

---

### `DELETE /api/reports/:reportId`

Delete one report (attachments cascade).

**Response**

```json
{
  "ok": true,
  "reportId": "report_abc12345"
}
```

---

## Statuses

| Report | Meaning |
|---|---|
| `pending` | Created, uploads not started |
| `uploading` | Work in flight (some images may already be done) |
| `delivered` | Every image uploaded — only these appear in `GET /reports` |
| `failed` | At least one image failed — show Retry |

| Attachment | Meaning |
|---|---|
| `pending` | Waiting |
| `uploading` | Session issued / bytes in flight |
| `uploaded` | Complete |
| `failed` | Last attempt failed — retry with upload-session |

---

## Failure simulation

Send header **`X-Simulate`** or query **`?simulate=`**:

| Value | Behavior | `retryable` |
|---|---|---|
| `latency` | 1.5–4s delay, then continues | — |
| `drop` | Connection destroyed | (no response) |
| `hang` | Never answers | (no response) |
| `timeout` | 504 after ~35s | `true` |
| `500` | Internal error | `true` |
| `reject` | 422 refused | `false` |

Example:

```bash
curl -X POST http://localhost:4000/api/reports \
  -H "Content-Type: application/json" \
  -H "X-Simulate: 500" \
  -d "{...}"
```

---

## Error shape

All errors from the API look like:

```json
{
  "code": "CONFLICT",
  "message": "Attachment is already uploaded",
  "retryable": false
}
```

Common codes: `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `REJECTED`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with reload |
| `npm start` | Run once |
| `npm run build` | Compile TypeScript |
| `npm run migrate` | Apply `supabase/migrations` |
| `npm run migrate:create -- name` | Scaffold a new SQL migration |
| `npm run setup:supabase` | Bucket + storage policies + migrations |

---

## Deploy notes

- **Local / long-running host** (your machine, Render, Railway, Fly, a VPS): `npm run dev` or `npm start` is enough. You do **not** need `api/` or `vercel.json`.
- **Vercel**: Vercel does **not** auto-generate an Express adapter. Keep and push `api/index.ts` + `vercel.json`, set Root Directory to `backend`, and configure the same env vars as `.env.example`. Run `npm run setup:supabase` once against your Supabase project (locally or as a one-off), not on every request.
