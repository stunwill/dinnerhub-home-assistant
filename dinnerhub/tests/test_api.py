from __future__ import annotations

from datetime import date


def sample_meal() -> dict:
    return {
        "name": "Tuna Pasta Bake",
        "description": "A family pasta bake.",
        "main_protein": "Tuna",
        "category": "Pasta",
        "prep_minutes": 15,
        "cook_minutes": 35,
        "servings": 4,
        "difficulty": "easy",
        "instructions": ["Combine ingredients", "Bake until golden"],
        "ingredients": [
            {"name": "Pasta", "quantity": 500, "unit": "g", "shopping_category": "Pantry"},
            {"name": "Tuna", "quantity": 425, "unit": "g", "shopping_category": "Seafood"},
        ],
    }


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["service"] == "DinnerHub"


def test_create_search_and_plan_meal(client):
    created = client.post("/api/meals", json=sample_meal())
    assert created.status_code == 201
    meal = created.json()
    assert meal["total_minutes"] == 50
    assert len(meal["ingredients"]) == 2

    search = client.get("/api/meals", params={"search": "pasta"})
    assert search.status_code == 200
    assert search.json()[0]["name"] == "Tuna Pasta Bake"

    planned = client.put(
        f"/api/meal-plan/{date.today().isoformat()}",
        json={"meal_id": meal["id"], "entry_type": "meal"},
    )
    assert planned.status_code == 200
    assert planned.json()["title"] == "Tuna Pasta Bake"

    dashboard = client.get("/api/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["today"]["title"] == "Tuna Pasta Bake"


def test_duplicate_meal_name_is_rejected(client):
    assert client.post("/api/meals", json=sample_meal()).status_code == 201
    assert client.post("/api/meals", json=sample_meal()).status_code == 409
