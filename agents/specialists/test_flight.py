import pytest
from agents.specialists import flight

def test_should_parse_amadeus_api_response():
    response = {"data": [{"price": {"total": "500"}, "itineraries": [{"segments": [{"departure": {"iataCode": "JFK"}, "arrival": {"iataCode": "LHR"}}]}]}]}
    parsed = flight.parse_amadeus_response(response)
    assert isinstance(parsed, list)
    assert parsed[0]["price"] == 500
    assert parsed[0]["from"] == "JFK"
    assert parsed[0]["to"] == "LHR"

def test_should_sort_by_price():
    flights = [{"price": 300}, {"price": 200}, {"price": 400}]
    sorted_flights = flight.sort_flights(flights, by="price")
    assert [f["price"] for f in sorted_flights] == [200, 300, 400]

def test_should_sort_by_schedule():
    flights = [{"departure": "10:00"}, {"departure": "08:00"}, {"departure": "12:00"}]
    sorted_flights = flight.sort_flights(flights, by="schedule")
    assert [f["departure"] for f in sorted_flights] == ["08:00", "10:00", "12:00"]

def test_should_sort_by_stops():
    flights = [{"stops": 2}, {"stops": 0}, {"stops": 1}]
    sorted_flights = flight.sort_flights(flights, by="stops")
    assert [f["stops"] for f in sorted_flights] == [0, 1, 2]

def test_should_fallback_when_no_preferred_airline():
    flights = [{"airline": "A"}, {"airline": "B"}]
    result = flight.filter_by_airline(flights, preferred="C")
    assert result == flights
