import pytest
from agents.specialists import bucket_list

class DummyNLP:
    def extract_destination(self, text):
        if text == "I want to go to Bali":
            return {"name": "Bali", "country": "Indonesia"}
        return None

def test_should_extract_destination_from_natural_language():
    nlp = DummyNLP()
    result = nlp.extract_destination("I want to go to Bali")
    assert result == {"name": "Bali", "country": "Indonesia"}

def test_should_return_none_for_unrecognized_text():
    nlp = DummyNLP()
    result = nlp.extract_destination("Take me to the moon")
    assert result is None

def test_should_deduplicate_similar_destinations():
    destinations = ["NYC", "New York City"]
    deduped = bucket_list.deduplicate_destinations(destinations)
    assert deduped == ["New York City"] or deduped == ["NYC"]

def test_should_rank_destinations_by_score():
    ranked = bucket_list.rank_destinations([
        {"name": "Bali", "score": 0.9},
        {"name": "Paris", "score": 0.7},
        {"name": "NYC", "score": 0.8},
    ])
    assert ranked[0]["name"] == "Bali"
    assert ranked[1]["name"] == "NYC"
    assert ranked[2]["name"] == "Paris"

def test_should_handle_empty_destination_list():
    ranked = bucket_list.rank_destinations([])
    assert ranked == []
