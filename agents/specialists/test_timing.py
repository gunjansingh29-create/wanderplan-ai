import pytest
from agents.specialists import timing

class DummyWeather:
    def get_score(self, month):
        return {"Jan": 0.2, "Feb": 0.8, "Mar": 0.5}.get(month, 0)

class DummyCrowd:
    def get_score(self, month):
        return {"Jan": 0.7, "Feb": 0.6, "Mar": 0.3}.get(month, 0)

class DummyPrice:
    def get_score(self, month):
        return {"Jan": 0.9, "Feb": 0.4, "Mar": 0.2}.get(month, 0)

def test_should_score_months_with_mock_data():
    score = timing.score_month("Feb", DummyWeather(), DummyCrowd(), DummyPrice())
    assert 0 <= score <= 1
    assert score == pytest.approx((0.8 + 0.6 + 0.4) / 3, 0.01)

def test_should_compromise_for_multi_destination():
    months = ["Jan", "Feb", "Mar"]
    compromise = timing.compromise_months(months, [DummyWeather(), DummyCrowd(), DummyPrice()])
    assert isinstance(compromise, str)
    assert compromise in months

def test_should_return_none_if_all_months_below_threshold():
    class LowScore:
        def get_score(self, month):
            return 0.1
    result = timing.compromise_months(["Jan", "Feb"], [LowScore(), LowScore(), LowScore()], threshold=0.2)
    assert result is None

def test_should_handle_empty_month_list():
    result = timing.compromise_months([], [DummyWeather(), DummyCrowd(), DummyPrice()])
    assert result is None

def test_should_score_month_with_missing_data():
    score = timing.score_month("Apr", DummyWeather(), DummyCrowd(), DummyPrice())
    assert score == 0
