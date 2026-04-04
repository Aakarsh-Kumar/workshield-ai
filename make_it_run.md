# WorkShield: Make It Run

## 1) Prerequisites

- Docker Desktop with Docker Compose support
- Git
- One free port: 80 (used by NGINX)

## 2) Start the full stack

From repo root:

```powershell
docker compose up --build
```

This brings up:

- mongo (MongoDB)
- backend (Express)
- ai-service (Flask)
- client (Next.js)
- nginx (public entrypoint)

## 3) Main links

- App entrypoint: http://localhost
- Login page: http://localhost/login
- Worker dashboard: http://localhost/dashboard
- Buy policy: http://localhost/policies/new
- File new claim: http://localhost/claims/new
- Team 2 admin ops: http://localhost/team2/ops

## 4) Health checks

- Backend health: http://localhost/api/health
- AI health: http://localhost/ai/health
- AI fraud model status: http://localhost/ai/fraud-model-status
- AI premium model status: http://localhost/ai/premium-model-status

## 5) Worker access flow

1. Open http://localhost/login
2. Create account (New user) or sign in
3. You will be redirected to http://localhost/dashboard
4. Create policy at http://localhost/policies/new
5. Raise claims at http://localhost/claims/new

## 6) Admin access flow (Team 2 Ops)

There is no public "create admin" endpoint. Promote an existing user to admin in MongoDB.

Example (replace email):

```powershell
docker exec workshield-mongo mongosh "mongodb://localhost:27017/workshield" --eval "db.users.updateOne({ email: 'admin@workshield.local' }, { $set: { role: 'admin' } })"
```

Then sign in with that account and open:

- http://localhost/team2/ops

## 7) Important routing notes

- Public traffic enters through NGINX at port 80.
- Frontend calls backend as /api/* and AI service as /ai/*.
- In Docker Compose mode, use http://localhost (not container ports) for browser access.

## 8) Stop the stack

```powershell
docker compose down
```

Use this to also remove volumes (resets local Mongo data):

```powershell
docker compose down -v
```