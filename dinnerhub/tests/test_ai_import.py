def test_ai_settings_are_saved_and_masked(client):
    initial = client.get("/api/ai/settings")
    assert initial.status_code == 200
    assert initial.json()["configured"] is False

    saved = client.put(
        "/api/ai/settings",
        json={
            "api_key": "sk-test-dinnerhub-1234",
            "api_base_url": "https://api.openai.com/v1/",
            "analysis_model": "gpt-test-analysis",
            "transcription_model": "gpt-test-transcription",
        },
    )
    assert saved.status_code == 200
    body = saved.json()
    assert body["configured"] is True
    assert body["api_key_masked"].endswith("1234")
    assert "sk-test" not in str(body)
    assert body["api_base_url"] == "https://api.openai.com/v1"

    fetched = client.get("/api/ai/settings")
    assert fetched.status_code == 200
    assert fetched.json()["analysis_model"] == "gpt-test-analysis"
    assert "sk-test-dinnerhub" not in fetched.text


def test_blank_api_key_keeps_existing_secret(client):
    client.put(
        "/api/ai/settings",
        json={
            "api_key": "sk-preserve-9876",
            "api_base_url": "https://api.openai.com/v1",
            "analysis_model": "model-a",
            "transcription_model": "model-b",
        },
    )
    updated = client.put(
        "/api/ai/settings",
        json={
            "api_key": None,
            "api_base_url": "https://api.openai.com/v1",
            "analysis_model": "model-c",
            "transcription_model": "model-b",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["api_key_masked"].endswith("9876")
    assert updated.json()["analysis_model"] == "model-c"
