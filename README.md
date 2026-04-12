# UniMarket Admin Web

Admin web UI for UniMarket with:
- Firebase email/password login
- Access guard by Firebase custom claims (`admin` or `moderator`)
- Dashboard screen (stats, reports table, pending payouts)

## 1) Setup env

Copy `.env.example` to `.env` and fill Firebase web config:

```bash
cp .env.example .env
```

Required keys:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ADMIN_API_BASE_URL` (example: `http://localhost:8080`)

## 2) Run

```bash
npm install
npm run dev
```

## 3) Build

```bash
npm run build
npm run preview
```

## Architecture (Clean Architecture + MVC)

```text
src/
  domain/
    entities/
    repositories/
  application/
    usecases/
  infrastructure/
    firebase/
    repositories/
    services/
  presentation/
    controllers/
    views/
    utils/
```

Responsibilities:
- `domain`: core model + repository contracts.
- `application`: use cases orchestrate business flows.
- `infrastructure`: Firebase/Auth/API implementation details.
- `presentation/controllers`: MVC Controller (state + handlers).
- `presentation/views`: MVC View (UI only, no direct Firebase calls).

## Important

User must have custom claim `admin: true` or `moderator: true`.
Without claim, login is rejected even if email/password is correct.

Flow cap quyen dung:
1. Tao user bang Firebase Auth (email/password).
2. Gan custom claim o server-side (Firebase Admin SDK), vi du trong `backend/`:
   `npm run grant:admin -- --email admin@uni.com --role admin`
3. User dang xuat/dang nhap lai de lay token moi co claim.
