# Backend Кинопоиска

`backend.py` выполняет восстановленные GraphQL-операции и собирает карточку
фильма в формате `rh.json`. `kinoserver.py` использует этот адаптер для
маршрутов `/kp_info/<id>` и `/kp_info2/<id>`.

## Установка

```powershell
python -m pip install -r graphql_extracted\requirements-backend.txt
```

## Основной сервер Sanic

```powershell
python graphql_extracted\kinoserver.py
```

Проверка:

```text
GET http://127.0.0.1:8000/health
GET http://127.0.0.1:8000/kp_info2/301
GET http://127.0.0.1:8000/kp_info2/301?include_players=1
GET http://127.0.0.1:8000/players/301
GET http://127.0.0.1:8000/docs
GET http://127.0.0.1:8000/openapi.json
```

`/docs` открывает Swagger UI, построенный из схемы `/openapi.json`.

`kp_info2` без параметров возвращает только карточку и остаётся быстрым.
Параметр `include_players=1` добавляет объект `players`. Тот же объект отдельно
доступен через `GET /players/<id>` и совместимый `POST /cache`.

GraphQL-операции и проверка плееров выполняются асинхронно через общий HTTP
connection pool. Карточка и плееры при `include_players=1` также загружаются
параллельно.

По умолчанию агрегатор проверяет Alloha, Collaps, зеркала с маршрутом
`/embed/kp/<id>` и Obrut. Зеркала проверяются параллельно, но в ответ попадает
только первое успешно ответившее. Недоступные iframe автоматически исключаются
и результат кешируется на время `PLAYER_CACHE_TTL_SECONDS`. Последнее рабочее
зеркало запоминается и на следующих запросах проверяется первым.

Если задан `KINOPOISK_TECH_API_TOKEN`, установите
`KINOPOISK_PROVIDER=graphql`, чтобы принудительно использовать GraphQL.

## Отдельный FastAPI-адаптер

Его можно запускать независимо:

```powershell
python -m uvicorn graphql_extracted.backend:app --host 127.0.0.1 --port 8000
```

Маршруты: `/films/301`, `/health`, `/docs`.

`tagline` преобразуется в `slogan`, а `synopsis` — в `description`.
Дополнительные запросы рейтингов, рекомендаций, трейлеров и съёмочной группы
выполняются параллельно. Если один из них недоступен, основная карточка всё
равно возвращается.

Настройки источников находятся в [`.env.example`](.env.example). Секретные
токены задаются через локальный `.env`, который исключён из Git; Vibix не
включается в список плееров,
пока его API возвращает пустой `iframe_url`.
