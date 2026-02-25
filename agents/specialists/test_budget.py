import pytest
from agents.specialists import budget

def test_should_allocate_percentages_per_destination_type():
    allocations = budget.allocate_budget(1000, ["city", "beach", "mountain"])
    assert sum(allocations.values()) == 1000
    assert all(x >= 0 for x in allocations.values())

def test_should_trigger_over_budget_at_boundary():
    assert budget.is_over_budget(1000, 1000) is False
    assert budget.is_over_budget(1001, 1000) is True

def test_should_convert_currency_accurately():
    amount = budget.convert_currency(100, "USD", "EUR", rates={"USD":1, "EUR":0.9})
    assert amount == 90

def test_should_handle_unknown_currency():
    with pytest.raises(KeyError):
        budget.convert_currency(100, "USD", "ABC", rates={"USD":1, "EUR":0.9})

def test_should_handle_zero_budget():
    allocations = budget.allocate_budget(0, ["city", "beach"])
    assert all(v == 0 for v in allocations.values())
