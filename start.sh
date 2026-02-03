#!/usr/bin/env sh
# Simple Railway start script for the Django backend
set -eu

cd "$(dirname "$0")/backend"

# Install deps (Railway caches the venv layer)
pip install --upgrade pip >/dev/null
pip install -r requirements.txt

# Run migrations (no-op if already applied)
python manage.py migrate --noinput

# Start Gunicorn
exec gunicorn config.wsgi --workers 4 --bind 0.0.0.0:"${PORT:-8000}"
