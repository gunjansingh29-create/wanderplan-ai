import pytest
import jwt
import time
from services import auth

def test_should_hash_and_verify_password():
    password = "secret123"
    hashed = auth.hash_password(password)
    assert auth.verify_password(password, hashed)
    assert not auth.verify_password("wrong", hashed)

def test_should_generate_and_validate_jwt():
    payload = {"user_id": 1}
    token = auth.generate_jwt(payload)
    decoded = auth.validate_jwt(token)
    assert decoded["user_id"] == 1

def test_should_rotate_refresh_token():
    user_id = 1
    old_token = auth.generate_refresh_token(user_id)
    new_token = auth.rotate_refresh_token(old_token)
    assert not auth.validate_refresh_token(old_token)
    assert auth.validate_refresh_token(new_token)

def test_should_verify_mfa_totp():
    secret = auth.generate_mfa_secret()
    code = auth.get_totp_code(secret)
    assert auth.verify_totp(secret, code)
    assert not auth.verify_totp(secret, "000000")

def test_should_expire_jwt_token():
    payload = {"user_id": 1, "exp": int(time.time()) - 10}
    token = jwt.encode(payload, auth.JWT_SECRET, algorithm="HS256")
    with pytest.raises(jwt.ExpiredSignatureError):
        auth.validate_jwt(token)
