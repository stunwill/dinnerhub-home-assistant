from __future__ import annotations

from pathlib import Path

from app import filter_settings


def test_default_filter_settings_include_favourites_and_common_filters(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(filter_settings, "DATA_DIR", tmp_path)
    monkeypatch.setattr(filter_settings, "SETTINGS_FILE", tmp_path / "filter-settings.json")

    settings = filter_settings.load_filter_settings()

    assert settings.favourites_first is True
    assert settings.show_favourites_filter is True
    assert settings.maximum_active_filters == 2
    assert any(item.label == "Chicken" for item in settings.filters)


def test_filter_settings_round_trip_and_remove_duplicates(tmp_path: Path, monkeypatch) -> None:
    settings_file = tmp_path / "filter-settings.json"
    monkeypatch.setattr(filter_settings, "DATA_DIR", tmp_path)
    monkeypatch.setattr(filter_settings, "SETTINGS_FILE", settings_file)

    payload = filter_settings.FilterSettings(
        favourites_first=False,
        show_favourites_filter=True,
        maximum_active_filters=3,
        filters=[
            filter_settings.RecipeFilter(label="Chicken", kind="ingredient", value="chicken"),
            filter_settings.RecipeFilter(label="Chicken again", kind="ingredient", value="Chicken"),
            filter_settings.RecipeFilter(label="Italian", kind="cuisine", value="Italian"),
        ],
    )

    saved = filter_settings.update_filter_settings(payload)
    loaded = filter_settings.load_filter_settings()

    assert settings_file.exists()
    assert saved.favourites_first is False
    assert loaded.maximum_active_filters == 3
    assert len(loaded.filters) == 2
    assert loaded.filters[1].kind == "cuisine"
