# TraceMind 🧠

> **AI Innovation Challenge Project**

TraceMind is a full-stack AI-driven web application featuring an Express.js backend and a modern React (Vite) frontend.

---

## 📁 Repository Structure

```text
TraceMind/
├── .gitignore                    # Consolidated repository-wide git ignore rules
├── README.md                     # Main project guide
├── package.json                  # Root monorepo scripts & workspaces
├── ai_usage/                     # Challenge audit trail & AI interaction logs
│   └── antigravity/
│       └── 01-project-setup.txt
├── configuration-example/        # Sample environment templates
│   └── .env.example
├── docs/                         # Architecture, API specs, and design documentation
│   └── README.md
└── src/
    ├── backend/                  # Express.js API Service (ES Modules)
    │   ├── index.js              # Server entry point & health check endpoints
    │   ├── package.json          # Backend dependencies & scripts
    │   └── .env.example          # Backend environment template
    └── frontend/                 # React SPA (Vite + React 19)
        ├── index.html            # SPA entry HTML
        ├── vite.config.js        # Vite & React Compiler configuration
        ├── package.json          # Frontend dependencies & scripts
        ├── .env.example          # Frontend environment template
        └── src/                  # React components and styling
```

---

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [Vite 8](https://vite.dev/), Modern CSS, ESLint
- **Backend**: [Node.js](https://nodejs.org/) (ESM), [Express 5](https://expressjs.com/), CORS, Dotenv
- **Architecture**: Monorepo with isolated `src/frontend` and `src/backend` workspaces

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later

### 2. Installation
Install dependencies for both frontend and backend from the root directory:
```bash
npm run install:all
```

*(Alternatively, run `npm install` inside each of `src/backend` and `src/frontend`)*

### 3. Environment Configuration
Copy the `.env.example` templates to `.env`:
```bash
# Backend
cp src/backend/.env.example src/backend/.env

# Frontend
cp src/frontend/.env.example src/frontend/.env
```

### 4. Running the Development Servers

You can start the backend and frontend independently:

```bash
# Run Backend (Runs on http://localhost:5000 with --watch auto-reload)
npm run dev:backend

# Run Frontend (Runs on http://localhost:5173 with Vite HMR)
npm run dev:frontend
```

---

## 🔌 API Endpoints (Backend)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api` | Service info and API metadata |
| `GET` | `/api/health` | Health check & uptime monitor |

---

## 📜 Scripts Reference

| Command | Description |
| :--- | :--- |
| `npm run dev:backend` | Starts backend development server with auto-reload (`node --watch`) |
| `npm run dev:frontend` | Starts Vite frontend development server |
| `npm run start:backend` | Runs the production backend entrypoint |
| `npm run build:frontend` | Compiles the production frontend bundle into `src/frontend/dist` |
| `npm run lint:frontend` | Lints the frontend source code |
| `npm run install:all` | Installs dependencies across all workspaces |
