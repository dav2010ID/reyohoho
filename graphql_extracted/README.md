# Kinopoisk GraphQL Research

Очищенная GraphQL-схема и операции, восстановленные из Android- и веб-клиентов Кинопоиска.

## Основное

- [`clean_graphql/schema.graphql`](clean_graphql/schema.graphql) — объединённая client-visible схема.
- [`clean_graphql/queries`](clean_graphql/queries) — queries, mutations и fragments без числовых префиксов.
- [`backend.py`](backend.py) — мини-API, собирающий карточку фильма в формате `rh.json`.
- [`Example.py`](Example.py) — проверочный запрос для фильма с ID 301.
- [`loader.js`](loader.js) — исходный Next.js build manifest для повторного извлечения веб-чанков.

## Запуск backend

```powershell
python -m pip install -r requirements-backend.txt
python -m uvicorn backend:app --port 8000
```

После запуска:

- `GET http://127.0.0.1:8000/films/301`
- Swagger UI: `http://127.0.0.1:8000/docs`

Схема является реконструкцией клиентской поверхности API и не содержит неиспользуемые клиентами серверные поля.
