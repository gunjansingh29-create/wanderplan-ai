"""
════════════════════════════════════════════════════════════════════════════
WANDERPLAN AI — Pytest Backend Test Suite
════════════════════════════════════════════════════════════════════════════

Coverage:
  (6) Auth Module — password hashing, JWT generation/validation,
      refresh token rotation, MFA TOTP verification
  (7) Data Access Layer — transactional booking, soft delete,
      cursor-based pagination

Run: pytest wanderplan_backend_test.py -v --tb=short
"""

import pytest
import hashlib
import hmac
import time
import struct
import base64
import json
import uuid
import re
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch, AsyncMock
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum


# ════════════════════════════════════════════════════════════════════════════
# MODULE IMPLEMENTATIONS
# In production these would be imported from their respective packages
# ════════════════════════════════════════════════════════════════════════════


# ── (6) AUTH MODULE ────────────────────────────────────────────────────────

class PasswordHasher:
    """bcrypt-style password hashing with configurable cost factor."""

    COST_FACTOR = 12  # 2^12 iterations

    @staticmethod
    def hash_password(plain: str) -> str:
        """Hash password with salt. Returns 'cost$salt$hash' format."""
        if not plain or len(plain) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(plain) > 72:
            raise ValueError("Password must not exceed 72 characters")

        salt = uuid.uuid4().hex[:16]
        iterations = 2 ** PasswordHasher.COST_FACTOR
        key = hashlib.pbkdf2_hmac(
            "sha256", plain.encode(), salt.encode(), iterations
        )
        return f"{PasswordHasher.COST_FACTOR}${salt}${key.hex()}"

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        """Timing-safe password verification."""
        if not plain or not hashed:
            return False
        try:
            cost_str, salt, stored_hash = hashed.split("$")
            cost = int(cost_str)
            iterations = 2 ** cost
            key = hashlib.pbkdf2_hmac(
                "sha256", plain.encode(), salt.encode(), iterations
            )
            return hmac.compare_digest(key.hex(), stored_hash)
        except (ValueError, AttributeError):
            return False


class JWTManager:
    """JWT generation and validation with RS256 simulation."""

    SECRET = "test-secret-key-for-unit-tests"
    ACCESS_TTL_MINUTES = 15
    REFRESH_TTL_DAYS = 7

    @staticmethod
    def generate_tokens(user_id: str, session_id: str) -> dict:
        """Generate access + refresh token pair."""
        if not user_id or not session_id:
            raise ValueError("user_id and session_id required")

        now = datetime.now(timezone.utc)
        access_payload = {
            "sub": user_id,
            "sid": session_id,
            "type": "access",
            "iat": now.isoformat(),
            "exp": (now + timedelta(minutes=JWTManager.ACCESS_TTL_MINUTES)).isoformat(),
        }
        refresh_payload = {
            "sub": user_id,
            "sid": session_id,
            "type": "refresh",
            "iat": now.isoformat(),
            "exp": (now + timedelta(days=JWTManager.REFRESH_TTL_DAYS)).isoformat(),
        }
        return {
            "access_token": JWTManager._sign(access_payload),
            "refresh_token": JWTManager._sign(refresh_payload),
        }

    @staticmethod
    def validate_token(token: str, token_type: str = "access") -> dict:
        """Validate and decode a JWT. Returns payload or raises."""
        if not token:
            raise ValueError("Token is required")

        try:
            payload_b64, signature = token.rsplit(".", 1)
            expected_sig = hmac.new(
                JWTManager.SECRET.encode(), payload_b64.encode(), hashlib.sha256
            ).hexdigest()[:32]

            if not hmac.compare_digest(signature, expected_sig):
                raise ValueError("Invalid token signature")

            payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))

            if payload.get("type") != token_type:
                raise ValueError(f"Expected {token_type} token, got {payload.get('type')}")

            exp = datetime.fromisoformat(payload["exp"])
            if datetime.now(timezone.utc) > exp:
                raise ValueError("Token has expired")

            return payload

        except (json.JSONDecodeError, KeyError) as e:
            raise ValueError(f"Malformed token: {e}")

    @staticmethod
    def _sign(payload: dict) -> str:
        payload_bytes = base64.urlsafe_b64encode(
            json.dumps(payload).encode()
        ).rstrip(b"=").decode()
        signature = hmac.new(
            JWTManager.SECRET.encode(), payload_bytes.encode(), hashlib.sha256
        ).hexdigest()[:32]
        return f"{payload_bytes}.{signature}"


class RefreshTokenStore:
    """In-memory refresh token store for testing rotation logic."""

    def __init__(self):
        self._tokens: Dict[str, dict] = {}  # token -> {user_id, session_id, used}

    def store(self, token: str, user_id: str, session_id: str):
        self._tokens[token] = {
            "user_id": user_id,
            "session_id": session_id,
            "used": False,
            "created_at": datetime.now(timezone.utc),
        }

    def use_token(self, token: str) -> dict:
        """Use a refresh token (one-time). Returns user info or raises."""
        if token not in self._tokens:
            raise ValueError("Refresh token not found")
        entry = self._tokens[token]
        if entry["used"]:
            # Token reuse detected — potential theft, invalidate all tokens for user
            self.invalidate_user_tokens(entry["user_id"])
            raise ValueError("Refresh token already used — all tokens invalidated")
        entry["used"] = True
        return {"user_id": entry["user_id"], "session_id": entry["session_id"]}

    def invalidate_user_tokens(self, user_id: str):
        """Invalidate all refresh tokens for a user (security measure)."""
        for token, entry in self._tokens.items():
            if entry["user_id"] == user_id:
                entry["used"] = True

    def is_valid(self, token: str) -> bool:
        return token in self._tokens and not self._tokens[token]["used"]


class TOTPVerifier:
    """TOTP (Time-based One-Time Password) verification."""

    WINDOW = 1  # Allow ±1 time step (±30 seconds)
    STEP_SECONDS = 30

    @staticmethod
    def generate_code(secret: str, timestamp: Optional[float] = None) -> str:
        """Generate TOTP code for given secret and time."""
        if timestamp is None:
            timestamp = time.time()
        counter = int(timestamp // TOTPVerifier.STEP_SECONDS)
        counter_bytes = struct.pack(">Q", counter)

        hmac_hash = hmac.new(secret.encode(), counter_bytes, hashlib.sha1).digest()
        offset = hmac_hash[-1] & 0x0F
        code = (struct.unpack(">I", hmac_hash[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000
        return str(code).zfill(6)

    @staticmethod
    def verify(secret: str, token: str, timestamp: Optional[float] = None) -> bool:
        """Verify TOTP token with ±1 window."""
        if not token or len(token) != 6 or not token.isdigit():
            return False
        if timestamp is None:
            timestamp = time.time()
        for offset in range(-TOTPVerifier.WINDOW, TOTPVerifier.WINDOW + 1):
            check_time = timestamp + (offset * TOTPVerifier.STEP_SECONDS)
            if TOTPVerifier.generate_code(secret, check_time) == token:
                return True
        return False


# ── (7) DATA ACCESS LAYER ──────────────────────────────────────────────────

class SoftDeleteMixin:
    """Mixin that implements soft delete pattern."""

    def __init__(self):
        self.deleted_at: Optional[datetime] = None
        self.is_deleted: bool = False

    def soft_delete(self):
        self.deleted_at = datetime.now(timezone.utc)
        self.is_deleted = True

    def restore(self):
        self.deleted_at = None
        self.is_deleted = False


@dataclass
class Trip(SoftDeleteMixin):
    id: str = ""
    name: str = ""
    owner_id: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        SoftDeleteMixin.__init__(self)
        if not self.id:
            self.id = str(uuid.uuid4())


@dataclass
class Booking:
    id: str = ""
    trip_id: str = ""
    user_id: str = ""
    type: str = ""  # "flight" | "stay"
    amount: float = 0.0
    status: str = "pending"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid.uuid4())


class MockDatabase:
    """In-memory database mock for testing data access patterns."""

    def __init__(self):
        self.trips: Dict[str, Trip] = {}
        self.bookings: Dict[str, Booking] = {}
        self._transaction_active = False
        self._rollback_snapshots: list = []

    def begin_transaction(self):
        self._transaction_active = True
        self._rollback_snapshots.append({
            "trips": dict(self.trips),
            "bookings": dict(self.bookings),
        })

    def commit(self):
        if not self._transaction_active:
            raise RuntimeError("No active transaction")
        self._transaction_active = False
        self._rollback_snapshots.pop()

    def rollback(self):
        if not self._transaction_active:
            raise RuntimeError("No active transaction")
        snapshot = self._rollback_snapshots.pop()
        self.trips = snapshot["trips"]
        self.bookings = snapshot["bookings"]
        self._transaction_active = False

    def create_booking(self, booking: Booking, fail_at_step: Optional[str] = None):
        """Create a booking with transactional integrity."""
        self.begin_transaction()
        try:
            # Step 1: Validate trip exists
            if booking.trip_id not in self.trips:
                raise ValueError("Trip not found")
            trip = self.trips[booking.trip_id]
            if trip.is_deleted:
                raise ValueError("Trip has been deleted")

            if fail_at_step == "validation":
                raise RuntimeError("Simulated validation failure")

            # Step 2: Create booking record
            self.bookings[booking.id] = booking

            if fail_at_step == "after_insert":
                raise RuntimeError("Simulated post-insert failure")

            # Step 3: Update booking status
            booking.status = "confirmed"

            if fail_at_step == "after_confirm":
                raise RuntimeError("Simulated post-confirm failure")

            self.commit()
            return booking

        except Exception as e:
            self.rollback()
            raise

    def get_trips_paginated(
        self, cursor: Optional[str] = None, limit: int = 10,
        include_deleted: bool = False
    ) -> dict:
        """Cursor-based pagination over trips."""
        if limit <= 0 or limit > 100:
            raise ValueError("Limit must be between 1 and 100")

        all_trips = sorted(self.trips.values(), key=lambda t: t.created_at)

        if not include_deleted:
            all_trips = [t for t in all_trips if not t.is_deleted]

        # Find cursor position
        start_idx = 0
        if cursor:
            for i, trip in enumerate(all_trips):
                if trip.id == cursor:
                    start_idx = i + 1
                    break
            else:
                raise ValueError("Invalid cursor: trip not found")

        page = all_trips[start_idx:start_idx + limit]
        next_cursor = page[-1].id if len(page) == limit else None

        return {
            "data": page,
            "next_cursor": next_cursor,
            "has_more": next_cursor is not None,
            "total": len(all_trips),
        }


# ════════════════════════════════════════════════════════════════════════════
# (6) AUTH MODULE TESTS
# ════════════════════════════════════════════════════════════════════════════


class TestPasswordHashing:
    """Password hashing and verification tests."""

    def test_should_hash_password_and_verify_successfully(self):
        hashed = PasswordHasher.hash_password("SecureP@ss123")
        assert PasswordHasher.verify_password("SecureP@ss123", hashed) is True

    def test_should_reject_wrong_password(self):
        hashed = PasswordHasher.hash_password("SecureP@ss123")
        assert PasswordHasher.verify_password("WrongPassword", hashed) is False

    def test_should_generate_different_hashes_for_same_password(self):
        hash1 = PasswordHasher.hash_password("SamePassword1!")
        hash2 = PasswordHasher.hash_password("SamePassword1!")
        assert hash1 != hash2  # Different salts

    def test_should_include_cost_factor_in_hash_string(self):
        hashed = PasswordHasher.hash_password("TestPass123!")
        cost = int(hashed.split("$")[0])
        assert cost == 12

    def test_should_reject_password_shorter_than_8_characters(self):
        with pytest.raises(ValueError, match="at least 8 characters"):
            PasswordHasher.hash_password("short")

    def test_should_reject_password_longer_than_72_characters(self):
        with pytest.raises(ValueError, match="not exceed 72"):
            PasswordHasher.hash_password("x" * 73)

    def test_should_reject_empty_password(self):
        with pytest.raises(ValueError):
            PasswordHasher.hash_password("")

    def test_should_return_false_for_empty_verification_inputs(self):
        assert PasswordHasher.verify_password("", "some_hash") is False
        assert PasswordHasher.verify_password("password", "") is False
        assert PasswordHasher.verify_password(None, "some_hash") is False

    def test_should_return_false_for_malformed_hash_string(self):
        assert PasswordHasher.verify_password("password", "not-a-valid-hash") is False
        assert PasswordHasher.verify_password("password", "$$$") is False

    def test_should_handle_unicode_passwords(self):
        hashed = PasswordHasher.hash_password("Pässwörd123!")
        assert PasswordHasher.verify_password("Pässwörd123!", hashed) is True


class TestJWTGeneration:
    """JWT generation and validation tests."""

    def test_should_generate_access_and_refresh_tokens(self):
        tokens = JWTManager.generate_tokens("user-123", "session-456")
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert tokens["access_token"] != tokens["refresh_token"]

    def test_should_validate_access_token_successfully(self):
        tokens = JWTManager.generate_tokens("user-123", "session-456")
        payload = JWTManager.validate_token(tokens["access_token"], "access")
        assert payload["sub"] == "user-123"
        assert payload["sid"] == "session-456"
        assert payload["type"] == "access"

    def test_should_validate_refresh_token_successfully(self):
        tokens = JWTManager.generate_tokens("user-123", "session-456")
        payload = JWTManager.validate_token(tokens["refresh_token"], "refresh")
        assert payload["type"] == "refresh"

    def test_should_reject_access_token_when_refresh_expected(self):
        tokens = JWTManager.generate_tokens("user-123", "session-456")
        with pytest.raises(ValueError, match="Expected refresh"):
            JWTManager.validate_token(tokens["access_token"], "refresh")

    def test_should_reject_token_with_tampered_signature(self):
        tokens = JWTManager.generate_tokens("user-123", "session-456")
        tampered = tokens["access_token"][:-5] + "XXXXX"
        with pytest.raises(ValueError, match="Invalid token signature"):
            JWTManager.validate_token(tampered, "access")

    def test_should_reject_expired_token(self):
        """Simulate an expired token by creating one with past expiry."""
        now = datetime.now(timezone.utc)
        expired_payload = {
            "sub": "user-123", "sid": "session-456", "type": "access",
            "iat": (now - timedelta(hours=1)).isoformat(),
            "exp": (now - timedelta(minutes=1)).isoformat(),
        }
        expired_token = JWTManager._sign(expired_payload)
        with pytest.raises(ValueError, match="expired"):
            JWTManager.validate_token(expired_token, "access")

    def test_should_reject_empty_token(self):
        with pytest.raises(ValueError, match="required"):
            JWTManager.validate_token("", "access")

    def test_should_require_user_id_and_session_id(self):
        with pytest.raises(ValueError):
            JWTManager.generate_tokens("", "session-456")
        with pytest.raises(ValueError):
            JWTManager.generate_tokens("user-123", "")

    def test_should_include_issued_at_timestamp(self):
        tokens = JWTManager.generate_tokens("user-123", "session-456")
        payload = JWTManager.validate_token(tokens["access_token"], "access")
        assert "iat" in payload
        iat = datetime.fromisoformat(payload["iat"])
        assert (datetime.now(timezone.utc) - iat).total_seconds() < 5


class TestRefreshTokenRotation:
    """Refresh token rotation and invalidation tests."""

    def test_should_issue_new_tokens_on_refresh(self):
        store = RefreshTokenStore()
        tokens = JWTManager.generate_tokens("user-1", "sess-1")
        store.store(tokens["refresh_token"], "user-1", "sess-1")

        info = store.use_token(tokens["refresh_token"])
        assert info["user_id"] == "user-1"

    def test_should_invalidate_old_token_after_use(self):
        store = RefreshTokenStore()
        tokens = JWTManager.generate_tokens("user-1", "sess-1")
        store.store(tokens["refresh_token"], "user-1", "sess-1")

        store.use_token(tokens["refresh_token"])
        assert store.is_valid(tokens["refresh_token"]) is False

    def test_should_detect_token_reuse_and_invalidate_all_user_tokens(self):
        store = RefreshTokenStore()
        tokens1 = JWTManager.generate_tokens("user-1", "sess-1")
        tokens2 = JWTManager.generate_tokens("user-1", "sess-2")
        store.store(tokens1["refresh_token"], "user-1", "sess-1")
        store.store(tokens2["refresh_token"], "user-1", "sess-2")

        # First use: succeeds
        store.use_token(tokens1["refresh_token"])

        # Second use of same token: detected as potential theft
        with pytest.raises(ValueError, match="already used"):
            store.use_token(tokens1["refresh_token"])

        # All user tokens should now be invalidated
        assert store.is_valid(tokens2["refresh_token"]) is False

    def test_should_reject_unknown_refresh_token(self):
        store = RefreshTokenStore()
        with pytest.raises(ValueError, match="not found"):
            store.use_token("nonexistent-token")

    def test_should_not_affect_other_users_tokens_on_invalidation(self):
        store = RefreshTokenStore()
        tokens_user1 = JWTManager.generate_tokens("user-1", "sess-1")
        tokens_user2 = JWTManager.generate_tokens("user-2", "sess-2")
        store.store(tokens_user1["refresh_token"], "user-1", "sess-1")
        store.store(tokens_user2["refresh_token"], "user-2", "sess-2")

        store.invalidate_user_tokens("user-1")

        assert store.is_valid(tokens_user1["refresh_token"]) is False
        assert store.is_valid(tokens_user2["refresh_token"]) is True


class TestMFATOTP:
    """MFA TOTP verification tests."""

    SECRET = "JBSWY3DPEHPK3PXP"

    def test_should_generate_6_digit_code(self):
        code = TOTPVerifier.generate_code(self.SECRET)
        assert len(code) == 6
        assert code.isdigit()

    def test_should_verify_correct_current_code(self):
        now = time.time()
        code = TOTPVerifier.generate_code(self.SECRET, now)
        assert TOTPVerifier.verify(self.SECRET, code, now) is True

    def test_should_accept_code_within_window_of_plus_minus_30_seconds(self):
        now = time.time()
        # Generate code for 25 seconds ago (within ±30s window)
        past_code = TOTPVerifier.generate_code(self.SECRET, now - 25)
        assert TOTPVerifier.verify(self.SECRET, past_code, now) is True

    def test_should_reject_code_outside_time_window(self):
        now = time.time()
        # Generate code for 2 minutes ago (well outside window)
        old_code = TOTPVerifier.generate_code(self.SECRET, now - 120)
        assert TOTPVerifier.verify(self.SECRET, old_code, now) is False

    def test_should_reject_wrong_code(self):
        assert TOTPVerifier.verify(self.SECRET, "000000", time.time()) is False

    def test_should_reject_non_numeric_code(self):
        assert TOTPVerifier.verify(self.SECRET, "abcdef") is False

    def test_should_reject_code_with_wrong_length(self):
        assert TOTPVerifier.verify(self.SECRET, "12345") is False
        assert TOTPVerifier.verify(self.SECRET, "1234567") is False

    def test_should_reject_empty_or_none_code(self):
        assert TOTPVerifier.verify(self.SECRET, "") is False
        assert TOTPVerifier.verify(self.SECRET, None) is False

    def test_should_generate_different_codes_at_different_times(self):
        code1 = TOTPVerifier.generate_code(self.SECRET, 1000000)
        code2 = TOTPVerifier.generate_code(self.SECRET, 2000000)
        assert code1 != code2

    def test_should_generate_same_code_within_same_30_second_window(self):
        base_time = 1700000000.0  # Fixed timestamp
        code1 = TOTPVerifier.generate_code(self.SECRET, base_time)
        code2 = TOTPVerifier.generate_code(self.SECRET, base_time + 10)
        assert code1 == code2  # Within same 30-second step


# ════════════════════════════════════════════════════════════════════════════
# (7) DATA ACCESS LAYER TESTS
# ════════════════════════════════════════════════════════════════════════════


class TestTransactionalBooking:
    """Transactional booking creation with atomicity tests."""

    def setup_method(self):
        self.db = MockDatabase()
        self.trip = Trip(name="Bali Trip", owner_id="user-1")
        self.db.trips[self.trip.id] = self.trip

    def test_should_create_booking_successfully_in_transaction(self):
        booking = Booking(trip_id=self.trip.id, user_id="user-1",
                          type="flight", amount=1247.00)
        result = self.db.create_booking(booking)
        assert result.status == "confirmed"
        assert booking.id in self.db.bookings

    def test_should_rollback_on_validation_failure(self):
        booking = Booking(trip_id=self.trip.id, user_id="user-1",
                          type="flight", amount=1000)
        with pytest.raises(RuntimeError, match="validation failure"):
            self.db.create_booking(booking, fail_at_step="validation")
        # Booking should NOT exist after rollback
        assert booking.id not in self.db.bookings

    def test_should_rollback_completely_on_post_insert_failure(self):
        booking = Booking(trip_id=self.trip.id, user_id="user-1",
                          type="stay", amount=2800)
        with pytest.raises(RuntimeError, match="post-insert"):
            self.db.create_booking(booking, fail_at_step="after_insert")
        assert booking.id not in self.db.bookings

    def test_should_rollback_on_failure_after_confirmation(self):
        booking = Booking(trip_id=self.trip.id, user_id="user-1",
                          type="flight", amount=500)
        with pytest.raises(RuntimeError):
            self.db.create_booking(booking, fail_at_step="after_confirm")
        assert booking.id not in self.db.bookings

    def test_should_reject_booking_for_nonexistent_trip(self):
        booking = Booking(trip_id="nonexistent-trip", user_id="user-1",
                          type="flight", amount=100)
        with pytest.raises(ValueError, match="Trip not found"):
            self.db.create_booking(booking)

    def test_should_reject_booking_for_deleted_trip(self):
        self.trip.soft_delete()
        booking = Booking(trip_id=self.trip.id, user_id="user-1",
                          type="flight", amount=100)
        with pytest.raises(ValueError, match="deleted"):
            self.db.create_booking(booking)

    def test_should_not_leave_transaction_open_after_failure(self):
        booking = Booking(trip_id=self.trip.id, user_id="user-1",
                          type="flight", amount=100)
        with pytest.raises(RuntimeError):
            self.db.create_booking(booking, fail_at_step="after_insert")
        assert self.db._transaction_active is False


class TestSoftDelete:
    """Soft delete pattern tests."""

    def test_should_mark_record_as_deleted_without_removing_it(self):
        trip = Trip(name="Test Trip", owner_id="user-1")
        trip.soft_delete()
        assert trip.is_deleted is True
        assert trip.deleted_at is not None
        assert trip.name == "Test Trip"  # Data still exists

    def test_should_set_deleted_at_timestamp(self):
        trip = Trip(name="Test", owner_id="user-1")
        before = datetime.now(timezone.utc)
        trip.soft_delete()
        assert trip.deleted_at >= before

    def test_should_restore_soft_deleted_record(self):
        trip = Trip(name="Test", owner_id="user-1")
        trip.soft_delete()
        trip.restore()
        assert trip.is_deleted is False
        assert trip.deleted_at is None

    def test_should_exclude_deleted_records_from_default_queries(self):
        db = MockDatabase()
        trip1 = Trip(name="Active", owner_id="u1")
        trip2 = Trip(name="Deleted", owner_id="u1")
        db.trips[trip1.id] = trip1
        db.trips[trip2.id] = trip2
        trip2.soft_delete()

        result = db.get_trips_paginated(include_deleted=False)
        assert len(result["data"]) == 1
        assert result["data"][0].name == "Active"

    def test_should_include_deleted_records_when_explicitly_requested(self):
        db = MockDatabase()
        trip1 = Trip(name="Active", owner_id="u1")
        trip2 = Trip(name="Deleted", owner_id="u1")
        db.trips[trip1.id] = trip1
        db.trips[trip2.id] = trip2
        trip2.soft_delete()

        result = db.get_trips_paginated(include_deleted=True)
        assert len(result["data"]) == 2

    def test_should_allow_multiple_soft_deletes_idempotently(self):
        trip = Trip(name="Test", owner_id="u1")
        trip.soft_delete()
        first_deleted_at = trip.deleted_at
        trip.soft_delete()
        assert trip.is_deleted is True
        # Second delete updates timestamp
        assert trip.deleted_at >= first_deleted_at


class TestCursorPagination:
    """Cursor-based pagination tests."""

    def setup_method(self):
        self.db = MockDatabase()
        self.trips = []
        for i in range(25):
            trip = Trip(
                name=f"Trip {i:02d}",
                owner_id="user-1",
                created_at=datetime(2025, 1, 1, tzinfo=timezone.utc) + timedelta(hours=i),
            )
            self.db.trips[trip.id] = trip
            self.trips.append(trip)

    def test_should_return_first_page_with_correct_limit(self):
        result = self.db.get_trips_paginated(limit=10)
        assert len(result["data"]) == 10
        assert result["has_more"] is True
        assert result["next_cursor"] is not None

    def test_should_return_second_page_using_cursor(self):
        page1 = self.db.get_trips_paginated(limit=10)
        page2 = self.db.get_trips_paginated(cursor=page1["next_cursor"], limit=10)
        assert len(page2["data"]) == 10
        assert page2["data"][0].id != page1["data"][0].id

    def test_should_return_last_page_with_no_next_cursor(self):
        page1 = self.db.get_trips_paginated(limit=10)
        page2 = self.db.get_trips_paginated(cursor=page1["next_cursor"], limit=10)
        page3 = self.db.get_trips_paginated(cursor=page2["next_cursor"], limit=10)
        assert len(page3["data"]) == 5
        assert page3["has_more"] is False
        assert page3["next_cursor"] is None

    def test_should_paginate_through_all_records_without_duplicates(self):
        all_ids = set()
        cursor = None
        while True:
            result = self.db.get_trips_paginated(cursor=cursor, limit=7)
            for trip in result["data"]:
                assert trip.id not in all_ids, "Duplicate record found in pagination"
                all_ids.add(trip.id)
            if not result["has_more"]:
                break
            cursor = result["next_cursor"]
        assert len(all_ids) == 25

    def test_should_reject_invalid_cursor(self):
        with pytest.raises(ValueError, match="Invalid cursor"):
            self.db.get_trips_paginated(cursor="nonexistent-id")

    def test_should_reject_limit_of_zero(self):
        with pytest.raises(ValueError, match="between 1 and 100"):
            self.db.get_trips_paginated(limit=0)

    def test_should_reject_limit_over_100(self):
        with pytest.raises(ValueError, match="between 1 and 100"):
            self.db.get_trips_paginated(limit=101)

    def test_should_return_total_count(self):
        result = self.db.get_trips_paginated(limit=5)
        assert result["total"] == 25

    def test_should_return_correct_total_excluding_deleted(self):
        self.trips[0].soft_delete()
        self.trips[1].soft_delete()
        result = self.db.get_trips_paginated(include_deleted=False)
        assert result["total"] == 23

    def test_should_handle_empty_database(self):
        empty_db = MockDatabase()
        result = empty_db.get_trips_paginated()
        assert len(result["data"]) == 0
        assert result["has_more"] is False
        assert result["next_cursor"] is None
        assert result["total"] == 0

    def test_should_maintain_order_across_pages(self):
        all_names = []
        cursor = None
        while True:
            result = self.db.get_trips_paginated(cursor=cursor, limit=5)
            all_names.extend([t.name for t in result["data"]])
            if not result["has_more"]:
                break
            cursor = result["next_cursor"]
        # Should be in creation order
        assert all_names == sorted(all_names)
