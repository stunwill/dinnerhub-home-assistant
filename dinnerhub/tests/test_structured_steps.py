def meal_payload():
    return {
        "name": "Structured Curry",
        "description": "Test recipe",
        "main_protein": None,
        "category": "Curry",
        "cuisine": None,
        "prep_minutes": 10,
        "cook_minutes": 20,
        "servings": 4,
        "difficulty": "easy",
        "instructions": ["Brown chicken thigh", "Add tomato paste"],
        "dietary_tags": [],
        "allergens": [],
        "substitutions": [],
        "notes": None,
        "image_url": None,
        "source_url": None,
        "favourite": False,
        "household_rating": None,
        "ingredients": [
            {"name": "Chicken thigh", "quantity": 400, "unit": "g", "shopping_category": "Meat", "notes": None, "optional": False},
            {"name": "Tomato paste", "quantity": 2, "unit": "tbsp", "shopping_category": "Pantry", "notes": None, "optional": False},
        ],
    }


def test_structured_steps_render_scaled_amounts(client):
    created = client.post("/api/meals", json=meal_payload())
    assert created.status_code == 201
    meal_id = created.json()["id"]

    saved = client.put(
        f"/api/meals/{meal_id}/steps",
        json=[
            {"instruction": "Brown chicken thigh until golden", "ingredient_names": ["Chicken thigh"], "timer_minutes": None, "note": None},
            {"instruction": "Add tomato paste and cook briefly", "ingredient_names": ["Tomato paste"], "timer_minutes": 1, "note": None},
        ],
    )
    assert saved.status_code == 200
    assert saved.json()[0]["rendered_instruction"] == "Brown 400 g Chicken thigh until golden"
    assert saved.json()[1]["rendered_instruction"] == "Add 2 tbsp Tomato paste and cook briefly"

    scaled = client.get(f"/api/meals/{meal_id}/steps?servings=6")
    assert scaled.status_code == 200
    assert "600 g Chicken thigh" in scaled.json()[0]["rendered_instruction"]
    assert "3 tbsp Tomato paste" in scaled.json()[1]["rendered_instruction"]


def test_legacy_instructions_are_returned_when_no_structured_steps_exist(client):
    created = client.post("/api/meals", json=meal_payload())
    assert created.status_code == 201
    meal_id = created.json()["id"]

    response = client.get(f"/api/meals/{meal_id}/steps")
    assert response.status_code == 200
    assert len(response.json()) == 2
    assert response.json()[0]["id"] is None
