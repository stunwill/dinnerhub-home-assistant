from __future__ import annotations


def test_ai_recipe_generation_requires_configured_api_key(client) -> None:  # type: ignore[no-untyped-def]
    from app import ai_import

    ai_import.SETTINGS_FILE.unlink(missing_ok=True)
    response = client.post("/api/ai/recipe/generate", json={"prompt": "I want a recipe for banana bread"})

    assert response.status_code == 409
    assert "API key is not configured" in response.json()["detail"]


def test_ai_recipe_refine_validates_existing_draft(client) -> None:  # type: ignore[no-untyped-def]
    response = client.post(
        "/api/ai/recipe/refine",
        json={"prompt": "Make it less sweet", "draft": {"name": "Banana bread", "servings": 0}},
    )

    assert response.status_code == 422
