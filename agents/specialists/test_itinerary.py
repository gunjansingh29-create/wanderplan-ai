import pytest
from agents.specialists import itinerary

def test_should_cluster_items_geographically():
    items = [
        {"name": "A", "lat": 1, "lng": 1},
        {"name": "B", "lat": 1.01, "lng": 1.01},
        {"name": "C", "lat": 10, "lng": 10},
    ]
    clusters = itinerary.geographical_clustering(items, radius_km=2)
    assert any(len(cluster) > 1 for cluster in clusters)

def test_should_not_group_distant_items():
    items = [
        {"name": "A", "lat": 1, "lng": 1},
        {"name": "B", "lat": 100, "lng": 100},
    ]
    clusters = itinerary.geographical_clustering(items, radius_km=2)
    assert all(len(cluster) == 1 for cluster in clusters)

def test_should_schedule_energy_curve():
    activities = [
        {"name": "Hike", "intensity": "high"},
        {"name": "Museum", "intensity": "low"},
        {"name": "Run", "intensity": "high"},
    ]
    schedule = itinerary.energy_curve_schedule(activities)
    for i in range(len(schedule) - 1):
        assert not (schedule[i]["intensity"] == schedule[i+1]["intensity"] == "high")

def test_should_insert_rest_days():
    days = [[{"intensity": "high"}], [{"intensity": "high"}]]
    result = itinerary.insert_rest_days(days)
    assert any(day == [] for day in result)

def test_should_handle_empty_itinerary():
    clusters = itinerary.geographical_clustering([], radius_km=2)
    assert clusters == []
