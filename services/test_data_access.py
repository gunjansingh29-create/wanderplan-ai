import pytest
from services import data_access

def test_should_create_booking_transactionally():
    try:
        data_access.create_booking_transactional(user_id=1, fail=True)
    except Exception:
        pass
    bookings = data_access.get_bookings(user_id=1)
    assert len(bookings) == 0  # Should rollback on failure

def test_should_soft_delete_record():
    record_id = data_access.create_record({"foo": "bar"})
    data_access.soft_delete(record_id)
    record = data_access.get_record(record_id)
    assert record["deleted"] is True
    assert record["foo"] == "bar"

def test_should_not_remove_soft_deleted_record():
    record_id = data_access.create_record({"foo": "bar"})
    data_access.soft_delete(record_id)
    all_records = data_access.get_all_records()
    assert record_id in [r["id"] for r in all_records]

def test_should_paginate_with_cursor():
    for i in range(10):
        data_access.create_record({"foo": f"bar{i}"})
    page1, cursor = data_access.paginate(cursor=None, limit=5)
    page2, _ = data_access.paginate(cursor=cursor, limit=5)
    assert len(page1) == 5
    assert len(page2) == 5
    assert page1 != page2

def test_should_return_empty_on_invalid_cursor():
    page, cursor = data_access.paginate(cursor="invalid", limit=5)
    assert page == []
