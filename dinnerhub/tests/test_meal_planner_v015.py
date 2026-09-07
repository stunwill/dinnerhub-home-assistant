from __future__ import annotations

from datetime import date, timedelta


def create_recipe(client, name="Planner Pasta"):
    response = client.post(
        "/api/meals",
        json={
            "name": name,
            "description": "Test recipe",
            "prep_minutes": 10,
            "cook_minutes": 20,
            "servings": 4,
            "difficulty": "easy",
            "instructions": ["Boil pasta", "Serve"],
            "ingredients": [{"name": "Pasta", "quantity": 400, "unit": "g", "shopping_category": "Pantry"}],
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_recipe_and_custom_meals(client):
    recipe = create_recipe(client)
    target = date.today() + timedelta(days=2)

    recipe_plan = client.post(
        "/api/meal-planner",
        json={"meal_date": target.isoformat(), "meal_type": "dinner", "meal_id": recipe["id"], "servings": 2},
    )
    assert recipe_plan.status_code == 201
    assert recipe_plan.json()["title"] == "Planner Pasta"
    assert recipe_plan.json()["meal_type"] == "dinner"

    custom_plan = client.post(
        "/api/meal-planner",
        json={"meal_date": target.isoformat(), "meal_type": "lunch", "custom_title": "Takeaway"},
    )
    assert custom_plan.status_code == 201
    assert custom_plan.json()["title"] == "Takeaway"


def test_update_move_duplicate_and_delete(client):
    recipe = create_recipe(client, "Move Me")
    first = date.today() + timedelta(days=3)
    second = first + timedelta(days=1)
    created = client.post(
        "/api/meal-planner",
        json={"meal_date": first.isoformat(), "meal_type": "breakfast", "meal_id": recipe["id"]},
    ).json()

    moved = client.patch(
        f"/api/meal-planner/{created['id']}",
        json={"meal_date": second.isoformat(), "meal_type": "lunch", "notes": "Moved"},
    )
    assert moved.status_code == 200
    assert moved.json()["meal_date"] == second.isoformat()
    assert moved.json()["meal_type"] == "lunch"

    duplicated = client.post(
        f"/api/meal-planner/{created['id']}/duplicate",
        json={"meal_date": first.isoformat(), "meal_type": "dinner"},
    )
    assert duplicated.status_code == 201

    deleted = client.delete(f"/api/meal-planner/{created['id']}")
    assert deleted.status_code == 204


def test_validation_and_week_boundaries(client):
    target = date.today()
    bad_type = client.post(
        "/api/meal-planner",
        json={"meal_date": target.isoformat(), "meal_type": "snack", "custom_title": "Fruit"},
    )
    assert bad_type.status_code == 422

    missing_choice = client.post(
        "/api/meal-planner",
        json={"meal_date": target.isoformat(), "meal_type": "dinner"},
    )
    assert missing_choice.status_code == 422

    invalid_recipe = client.post(
        "/api/meal-planner",
        json={"meal_date": target.isoformat(), "meal_type": "dinner", "meal_id": 999999},
    )
    assert invalid_recipe.status_code == 404

    end = target + timedelta(days=6)
    client.post(
        "/api/meal-planner",
        json={"meal_date": end.isoformat(), "meal_type": "dinner", "custom_title": "Sunday meal"},
    )
    response = client.get(f"/api/meal-planner?start={target.isoformat()}&days=7")
    assert response.status_code == 200
    assert any(item["meal_date"] == end.isoformat() for item in response.json())
