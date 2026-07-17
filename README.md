# hyperCare

Blood pressure tracking with safer daily guidance for people managing hypertension.

## Stack

- React + Vite + TypeScript PWA
- Tailwind CSS with shadcn-style UI primitives
- Node.js + Express + TypeScript
- Prisma with PostgreSQL

## Local Setup

```bash
npm install
npm install --prefix apps/web
npm install --prefix apps/api
copy apps\api\.env.example apps\api\.env
npm run prisma:generate
npm run dev
```

The web app runs on `http://localhost:5173`.
The API runs on `http://localhost:4000`.

The frontend requires authentication and reads/writes blood pressure records through the API.
