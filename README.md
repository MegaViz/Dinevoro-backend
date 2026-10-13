# Dinevoro Backend

Express + MongoDB API for Dinevoro.

## Setup

```bash
cp .env.example .env.local
# fill MONGODB_URI, JWT_SECRET, FRONTEND_URL
npm install
npm run dev
```

## Production

```bash
npm run build
npm start
```

Deploy on Render. Set `MONGODB_URI`, `JWT_SECRET`, and `FRONTEND_URL` in the service env.

Health: `GET /api/health`  
DB health: `GET /api/health/db`

## Related

- Frontend: https://github.com/venkatesh-megaviz/Dinevoro-frontend
