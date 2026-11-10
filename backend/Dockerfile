FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY backend/requirements.lock /app/backend/requirements.lock
RUN pip install --no-cache-dir -r /app/backend/requirements.lock

COPY backend /app/backend
EXPOSE 8000

CMD ["sh", "-c", "python -m alembic -c backend/alembic.ini upgrade head && sanic backend.kinoserver:app --host=0.0.0.0 --port=8000 --workers=1"]
