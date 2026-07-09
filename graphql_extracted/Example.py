from __future__ import annotations

import json
from pathlib import Path

import requests


BASE_DIR = Path(__file__).resolve().parent
FILM_ID = 301
OPERATION_NAME = "FilmBaseInfo"

variables = {
    "filmId": FILM_ID,
    "isAuthorized": False,
    "clientContext": {},
    "checkSilentInvoiceAvailability": False,
    "withPurchaseOptions": False,
    "actorsLimit": 30,
    "voiceOverActorsLimit": 30,
    "relatedMoviesLimit": 20,
    "watchabilityLimit": 20,
    "includeSocialArgumentTypes": [],
    "socialArgumentLimit": 20,
}

payload = {
    "operationName": OPERATION_NAME,
    "variables": variables,
    "query": (
        BASE_DIR
        / "clean_graphql"
        / "queries"
        / "query"
        / f"{OPERATION_NAME}.graphql"
    ).read_text(encoding="utf-8"),
}

response = requests.post(
    "https://graphql.kinopoisk.ru/graphql/",
    params={"operationName": OPERATION_NAME},
    headers={"service-id": "25"},
    json=payload,
    timeout=30,
)
body = response.json()
film = (body.get("data") or {}).get("film") or {}

print("Status:", response.status_code)
print("GraphQL errors:", body.get("errors"))
print("Film ID:", film.get("id"))
print("tagline -> slogan:", film.get("tagline"))
print("synopsis -> description:", film.get("synopsis"))

output_path = BASE_DIR / f"{FILM_ID}-{OPERATION_NAME}.json"
output_path.write_text(
    json.dumps(body, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print("Saved:", output_path)

# Build the final rh.json-compatible response using FilmBaseInfo plus the
# additional allowed operations used for extended ratings, trailers and staff.
from backend import fetch_film

rh_output = fetch_film(FILM_ID).model_dump()
rh_output_path = BASE_DIR / f"{FILM_ID}-rh-from-graphql.json"
rh_output_path.write_text(
    json.dumps(rh_output, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print("Mapped rh.json response:", rh_output_path)
