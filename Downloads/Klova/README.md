# Klova

On-demand home cleaning for Lagos.

---

## Folder structure

```
klova/
├── web/          # Next.js frontend — deployed to Vercel
├── api/          # Express backend  — deployed to Railway
└── README.md
```

Everything lives in one git repo but the two apps are deployed independently:
- **`/web`** is a Next.js app. Vercel watches this folder and deploys it automatically on every push to `main`.
- **`/api`** is a Node.js + Express server. Railway watches this folder and deploys it the same way.

They talk to each other over HTTP: the frontend calls the backend's API URL, which is stored in an environment variable so it can differ between local dev and production.

---

## Running locally

You need two terminal windows open at the same time — one for each app.

**Frontend (Next.js):**
```bash
cd web
pnpm install
pnpm dev
# Runs on http://localhost:3000
```

**Backend (Express):**
```bash
cd api
pnpm install
pnpm dev
# Runs on http://localhost:4000
```

---

## Environment variables

Neither app will work without its `.env` file. Copy the examples and fill in your values:

```bash
cp web/.env.example web/.env.local
cp api/.env.example api/.env
```

Never commit `.env` files. The `.gitignore` already blocks them.

---

## Deploying

- **Frontend:** push to `main` → Vercel picks it up automatically (once the project is linked in the Vercel dashboard).
- **Backend:** push to `main` → Railway picks it up automatically (once the service is linked in the Railway dashboard).
