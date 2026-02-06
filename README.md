# TripMate (Group FYP-25-S4-28)
CSIT-25-S4-23: TripMate - A multimedia trip planning and visualization application.

Contributors:
Vania Graciella Kwee
Tan Chua Mingyu
Wong Poh Yee
Tan Kok Kiong
Su Myat Thwe

## Overview
TripMate is a full-stack web app for planning trips, visualizing routes, collaborating with friends, tracking budgets and checklists, and exporting itineraries. The backend provides a REST API with Supabase-based authentication and data services, while the frontend delivers an interactive React UI with maps and planning tools.

## Tech Stack
Backend:
- Django + Django REST Framework
- Supabase Postgres (with local SQLite fallback)
- JWT auth via Supabase

Frontend:
- React + TypeScript (Vite)
- MapLibre / Leaflet
- Supabase JS client

## Repository Structure
- `backend/` Django project and REST API
- `frontend/` React app (Vite)
- `netlify.toml` Frontend deployment config
- `backend/railway.json` Backend deployment config

## Prerequisites
- Python 3.11+ (3.12 recommended)
- Node.js LTS
- Git

## Setup (Local Development)
Notes:
- This repository includes `.env` files for the class demo. Do not publish these values in public repos.
- Commands below assume PowerShell on Windows, but work similarly on macOS/Linux.

### Backend
1. Open a terminal and go to `backend/`:
   ```powershell
   cd backend
   ```
1. Create and activate a virtual environment:
   ```powershell
   python -m venv venv
   venv\Scripts\activate
   ```
1. Install dependencies:
   ```powershell
   python -m pip install --upgrade pip
   python -m pip install -r requirements.txt
   ```
1. Apply migrations:
   ```powershell
   python manage.py migrate
   ```
1. Start the backend:
   ```powershell
   python manage.py runserver
   ```
Backend runs at `http://127.0.0.1:8000/`.

### Frontend
1. Open a new terminal and go to `frontend/`:
   ```powershell
   cd frontend
   ```
1. Install dependencies:
   ```powershell
   npm install
   ```
1. Start the frontend dev server:
   ```powershell
   npm run dev
   ```
Frontend runs at `http://localhost:5173/`.

## Important Links
- TripMate Website: `https://group-fyp-25-s4-28-tripmate.netlify.app/`
- Marketing Website: `https://pohyeewpy4.wixsite.com/tripmate`

## Common Scripts
Frontend:
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

Backend:
- `python manage.py runserver`
- `python manage.py migrate`
- `pytest`

## Deployment Notes
Frontend:
- Netlify config is in `netlify.toml`.
- Build command: `npm run build`
- Output directory: `frontend/dist`

Backend:
- Railway config is in `backend/railway.json`.
- Procfile included for Gunicorn.

## Team Workflow (Branches)
Each team member works on their own branch and merges from `main` before starting new work.

## Troubleshooting
- `python` not found: reinstall Python and check "Add to PATH".
- `npm` not found: reinstall Node.js and restart your terminal.
- Frontend module errors: run `npm install` in `frontend/`.
- Backend API failing: confirm `backend/.env` exists and the backend server is running.

