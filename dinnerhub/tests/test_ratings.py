from __future__ import annotations


def _create_meal(client) -> int:
    response = client.post(
        "/api/meals",
        json={
            "name": "Ratings Test Meal",
            "description": "Test",
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


def test_household_ratings_average(client) -> None:
    meal_id = _create_meal(client)

    for member, score in (("Stu", 8), ("Kristy", 7.5), ("Sienna", 9)):
        response = client.put(
            f"/api/meals/{meal_id}/ratings",
            json={"member_name": member, "score": score},
        )
        assert response.status_code == 200

    response = client.get(f"/api/meals/{meal_id}/ratings")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ratings"] == {"Stu": 8.0, "Kristy": 7.5, "Sienna": 9.0}
    assert payload["average"] == 8.2
    assert payload["count"] == 3


def test_rating_can_be_removed_and_unknown_member_rejected(client) -> None:
    meal_id = _create_meal(client)
    assert client.put(
        f"/api/meals/{meal_id}/ratings",
        json={"member_name": "Stu", "score": 6},
    ).status_code == 200

    removed = client.put(
        f"/api/meals/{meal_id}/ratings",
        json={"member_name": "Stu", "score": None},
    )
    assert removed.status_code == 200
    assert removed.json()["average"] is None

    invalid = client.put(
        f"/api/meals/{meal_id}/ratings",
        json={"member_name": "Someone Else", "score": 8},
    )
    assert invalid.status_code == 422
