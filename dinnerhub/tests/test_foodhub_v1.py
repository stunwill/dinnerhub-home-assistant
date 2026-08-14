from __future__ import annotations

from datetime import date


def _create_meal(client, name: str = "Nutrition Test Meal") -> int:
    response = client.post(
        "/api/meals",
        json={
            "name": name,
            "description": "Test recipe",
            "main_protein": None,
            "category": "Test",
            "cuisine": None,
            "prep_minutes": 5,
            "cook_minutes": 10,
            "servings": 4,
            "difficulty": "easy",
            "instructions": [],
            "dietary_tags": [],
            "allergens": [],
            "substitutions": [],
            "notes": None,
            "image_url": None,
            "source_url": None,
            "favourite": False,
            "household_rating": None,
            "ingredients": [],
            "active": True,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_capabilities_advertise_recipe_nutrition(client) -> None:
    response = client.get("/api/v1/capabilities")
    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "FoodHub"
    assert payload["technical_slug"] == "dinnerhub"
    assert payload["capabilities"]["recipe_nutrition"] is True
    assert payload["nutrition"]["missing_values_are_null"] is True


def test_recipe_nutrition_is_null_until_entered(client) -> None:
    meal_id = _create_meal(client)
    response = client.get(f"/api/v1/recipes/{meal_id}/nutrition")
    assert response.status_code == 200
    nutrition = response.json()["nutrition"]
    assert nutrition["available"] is False
    assert nutrition["completeness"] == "unavailable"
    assert nutrition["values"]["calories_kcal"] is None


def test_recipe_nutrition_can_be_saved_per_serving(client) -> None:
    meal_id = _create_meal(client)
    response = client.put(
        f"/api/v1/recipes/{meal_id}/nutrition",
        json={
            "calories_kcal": 525,
            "protein_g": 38,
            "carbohydrate_g": 47,
            "fat_g": 19,
            "saturated_fat_g": 6,
            "sugar_g": 8,
            "fibre_g": 5,
            "sodium_mg": 640,
            "source": "manual",
            "authoritative": True,
        },
    )
    assert response.status_code == 200
    nutrition = response.json()["nutrition"]
    assert nutrition["basis"] == "per_serving"
    assert nutrition["completeness"] == "complete"
    assert nutrition["authoritative"] is True
    assert nutrition["values"]["calories_kcal"] == 525

    summary = client.get(f"/api/v1/recipes/{meal_id}/summary").json()
    assert summary["nutrition"]["values"]["protein_g"] == 38


def test_scheduled_dinners_include_recipe_nutrition(client) -> None:
    meal_id = _create_meal(client, "Scheduled Nutrition Meal")
    client.put(
        f"/api/v1/recipes/{meal_id}/nutrition",
        json={"calories_kcal": 410, "protein_g": 31, "source": "manual", "authoritative": True},
    )
    today = date.today().isoformat()
    planned = client.put(f"/api/meal-plan/{today}", json={"meal_id": meal_id, "entry_type": "meal"})
    assert planned.status_code == 200

    response = client.get(f"/api/v1/scheduled-dinners?start={today}&days=1")
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["recipe"]["id"] == str(meal_id)
    assert items[0]["recipe"]["nutrition"]["values"]["calories_kcal"] == 410
