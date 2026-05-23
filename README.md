# StirlingPDF Mobile + Web Revamp

This repository now contains a new mobile/web-friendly architecture for StirlingPDF:

- `frontend/` — Ionic React + Capacitor app for mobile (Android) and browser/PWA access
- `backend/` — Node.js + Express API backend scaffold for hosting the service

## Goals

- Use the app on mobile devices via an Android package
- Host the same interface as a web app or PWA
- Separate frontend and backend for cloud deployment

## Quick start

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the frontend at `http://localhost:5173` and configure the backend URL in Settings.

## Android build

From `frontend`:

```bash
npm run build
npm run cap:init
npm run cap:sync
```

Then add the Android platform:

```bash
npx cap add android
```

Open the native project with:

```bash
npx cap open android
```

## Deployment

- Host `frontend` as a static web app (Vercel / Netlify / Azure Static Web Apps)
- Deploy `backend` to any Node.js host or container service

## Notes

The backend currently includes a health endpoint and a placeholder conversion route. Replace the placeholder with your PDF processing stack or cloud service as needed.
