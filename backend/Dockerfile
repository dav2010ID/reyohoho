FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY graphql_extracted/clean_graphql /app/graphql_extracted/clean_graphql
EXPOSE 8000

CMD ["sh", "-c", "python -m alembic -c backend/alembic.ini upgrade head && sanic backend.kinoserver:app --host=0.0.0.0 --port=8000 --workers=2"]
