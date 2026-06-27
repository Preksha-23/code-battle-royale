# ⚔️ Code Battle Royale

<div align="center">

![Code Battle Royale Banner](https://img.shields.io/badge/Code%20Battle%20Royale-⚔️%20Competitive%20Coding-blueviolet?style=for-the-badge)

**A real-time multiplayer competitive coding platform where developers duel head-to-head to solve coding puzzles.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis)](https://redis.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

</div>

---

## 🎮 What is Code Battle Royale?

Code Battle Royale is a **real-time multiplayer coding arena** where two players go head-to-head solving programming puzzles. It features an intelligent matchmaking system, live WebSocket-based duels, XP/leveling mechanics, a friends system, leaderboards, and a bot simulator for solo practice.

---

## ✨ Features

- 🔐 **User Authentication** — Register, log in, and maintain persistent sessions
- 🎯 **Real-time Matchmaking** — Queue up and get matched with an opponent of similar skill
- ⚡ **Live Coding Duels** — WebSocket-powered arena with real-time opponent status
- 🤖 **Bot Simulator** — Practice solo against an AI bot that simulates a real opponent
- 🏆 **XP & Leveling System** — Earn XP for wins, track your rank and win streaks
- 📊 **Leaderboards** — See the top players globally
- 👥 **Friends System** — Add friends, send/accept friend requests, track their online status
- 🧩 **Puzzle Library** — Curated puzzles across Easy, Intermediate, and Difficult tiers
- 🎨 **Cyberpunk UI** — Dark-mode, glassmorphism-styled, animated interface
- 🎵 **Audio Feedback** — Sound effects for events like match start, win, and lose

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** | REST API & WebSocket server |
| **PostgreSQL** | Persistent user data, stats, friendships |
| **Redis** | Matchmaking queue, real-time game state |
| **SQLAlchemy (Async)** | ORM for database access |
| **Uvicorn** | ASGI server |

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | Component-based UI |
| **TypeScript** | Type safety |
| **Vite** | Build tooling & dev server |
| **CSS (Vanilla)** | Glassmorphism / Cyberpunk dark styling |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Docker Compose** | Local dev environment (DB + Redis) |
| **Render** | Backend deployment (via Dockerfile) |
| **Neon** | Managed PostgreSQL (production, free forever) |
| **Upstash** | Managed serverless Redis (production) |
| **Vercel** | Frontend deployment |

---

## 📁 Project Structure

```
code-battle-royale/
├── backend/
│   ├── main.py              # FastAPI app, all API routes & WebSocket handlers
│   ├── matchmaking.py       # Matchmaking queue logic (Redis-backed)
│   ├── puzzles.py           # Full puzzle library (Easy / Intermediate / Difficult)
│   ├── evaluator.py         # Code evaluation logic
│   ├── bot_simulator.py     # AI bot that simulates a real opponent
│   ├── models.py            # SQLAlchemy ORM models (User, Friendship)
│   ├── database.py          # Async DB engine & session factory
│   ├── redis_client.py      # Redis connection factory
│   ├── socket_manager.py    # WebSocket connection manager
│   ├── migrate.py           # DB migration helper
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile           # Docker build for backend
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main app shell, lobby, stats, friends, leaderboard
│   │   ├── App.css          # Cyberpunk/glassmorphism styles for lobby
│   │   ├── components/
│   │   │   ├── BattleArena.tsx   # In-match coding arena component
│   │   │   ├── BattleArena.css   # Arena-specific styles
│   │   │   └── Login.tsx         # Login / Register UI
│   │   ├── hooks/
│   │   │   ├── useMatchmaker.ts  # Matchmaking WebSocket hook
│   │   │   └── useArena.ts       # In-game arena WebSocket hook
│   │   └── utils/
│   │       └── audio.ts          # Audio manager for SFX
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── docker-compose.yml       # PostgreSQL + Redis for local dev
├── railway.json             # Railway backend deployment config
├── vercel.json              # Vercel frontend deployment config
└── .gitignore
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.10+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 1. Clone the Repository

```bash
git clone https://github.com/Preksha-23/code-battle-royale.git
cd code-battle-royale
```

### 2. Start the Database & Redis

```bash
docker compose up -d
```

This spins up:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

### 3. Set Up the Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Create a .env file (see below)
# Then run migrations
python migrate.py

# Start the backend server
uvicorn main:app --reload --port 8000
```

**Backend `.env` example:**
```env
DATABASE_URL=postgresql+asyncpg://cbr_user:cbr_password@localhost:5432/cbr_db
REDIS_URL=redis://localhost:6379
```

### 4. Set Up the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create a .env.local file
# VITE_API_URL=http://localhost:8000
# VITE_WS_URL=ws://localhost:8000

# Start the dev server
npm run dev
```

The app will be available at **http://localhost:5173**

---

## 🌐 Deployment

This project uses a **100% free, no-expiry** deployment stack:

| Service | Purpose | Link |
|---|---|---|
| **Neon** | Managed PostgreSQL (free forever) | [neon.tech](https://neon.tech) |
| **Upstash** | Managed serverless Redis | [upstash.com](https://upstash.com) |
| **Render** | Backend (FastAPI) hosting | [render.com](https://render.com) |
| **Vercel** | Frontend (React) hosting | [vercel.com](https://vercel.com) |

### Step 1 — Neon (PostgreSQL)
1. Create a free account at [neon.tech](https://neon.tech) — sign up with GitHub
2. Click **"New Project"** → choose **US East** region (best latency with Render)
3. After creation, go to **"Connection Details"**
4. Copy the connection string — it looks like:
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. This is your `DATABASE_URL`

> ✅ Neon is free forever with no expiry — no credit card required

### Step 2 — Upstash (Redis)
1. Create a free database at [upstash.com](https://upstash.com)
2. Open your database → **Connect → TCP** tab
3. Copy the `REDIS_URL` value (starts with `rediss://`)

### Step 3 — Render (Backend)
1. Create an account at [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repo: `Preksha-23/code-battle-royale`
3. Set build config:
   - **Runtime:** Docker
   - **Dockerfile Path:** `./backend/Dockerfile`
   - **Docker Context:** `.` (repo root)
   - **Plan:** Free
4. Add environment variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Connection string from Neon |
| `REDIS_URL` | Redis URL from Upstash (TCP tab) |

### Step 4 — Vercel (Frontend)
1. Deploy frontend at [vercel.com](https://vercel.com)
2. Set environment variables:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Your Render backend URL (e.g. `https://your-app.onrender.com`) |
| `VITE_WS_URL` | Your Render WebSocket URL (e.g. `wss://your-app.onrender.com`) |

> ⚠️ **Note:** On Render's free plan, the backend sleeps after 15 minutes of inactivity and takes ~30 seconds to wake up on the first request.

---

## 🎮 How to Play

1. **Register / Login** with a username and password
2. **Choose a difficulty** — Easy, Intermediate, or Difficult
3. **Click "Find Match"** to enter the matchmaking queue
4. When a match is found, the **Battle Arena** opens with a real-time coding editor
5. **Solve the puzzle** before your opponent does!
6. Earn **XP** for wins and climb the **leaderboard**

Want to practice first? Use **Training Mode** to go solo against the bot.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

Made with ❤️ by [Preksha-23](https://github.com/Preksha-23)

</div>
