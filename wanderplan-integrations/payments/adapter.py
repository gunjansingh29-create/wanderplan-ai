"""
Payments — Stripe API.
API key · 100 req/s · No caching (financial data) · Strict circuit breaker (threshold 3)
Booking payments, currency conversion, split payments among group members.
"""

import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from core.base_adapter import BaseAdapter
from config import PAYMENTS_STRIPE


@dataclass
class PaymentIntent:
    id: str
    status: str
    amount: int  # in smallest currency unit (cents)
    currency: str
    client_secret: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SplitPayment:
    group_id: str
    total_amount: int
    currency: str
    shares: List[Dict[str, Any]]  # [{user_id, amount, payment_intent_id, status}]


class StripeAdapter(BaseAdapter):
    """Stripe API — payments, currency conversion, group splits."""

    def __init__(self):
        super().__init__(PAYMENTS_STRIPE)
        self._secret_key = os.getenv("STRIPE_SECRET_KEY", "")

    def _api_key_header(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self._secret_key}"}

    async def create_payment_intent(
        self,
        amount: int,
        currency: str = "usd",
        customer_id: Optional[str] = None,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
    ) -> PaymentIntent:
        body = {
            "amount": amount,
            "currency": currency.lower(),
            "automatic_payment_methods": {"enabled": True},
        }
        if customer_id:
            body["customer"] = customer_id
        if description:
            body["description"] = description
        if metadata:
            body["metadata"] = metadata

        data = await self._request(
            "POST", "/payment_intents",
            json_body=body,
            skip_cache=True,
        )
        return PaymentIntent(
            id=data["id"],
            status=data["status"],
            amount=data["amount"],
            currency=data["currency"],
            client_secret=data["client_secret"],
            metadata=data.get("metadata", {}),
        )

    async def create_split_payment(
        self,
        group_id: str,
        total_amount: int,
        currency: str,
        members: List[Dict[str, Any]],  # [{user_id, share_amount, customer_id}]
    ) -> SplitPayment:
        """Create individual payment intents for each group member's share."""
        shares = []
        for member in members:
            pi = await self.create_payment_intent(
                amount=member["share_amount"],
                currency=currency,
                customer_id=member.get("customer_id"),
                description=f"WanderPlan group trip — {group_id}",
                metadata={"group_id": group_id, "user_id": member["user_id"]},
            )
            shares.append({
                "user_id": member["user_id"],
                "amount": member["share_amount"],
                "payment_intent_id": pi.id,
                "status": pi.status,
                "client_secret": pi.client_secret,
            })
        return SplitPayment(
            group_id=group_id,
            total_amount=total_amount,
            currency=currency,
            shares=shares,
        )

    async def convert_currency(
        self, amount: int, from_currency: str, to_currency: str
    ) -> Dict[str, Any]:
        """
        Use Stripe's exchange rates for currency conversion.
        Stripe exposes rates through Balance Transactions.
        For explicit conversion, we create a test PaymentIntent.
        """
        # In production, use a dedicated FX API or Stripe's built-in multi-currency
        # This is a simplified approach using Stripe's pricing
        cache_key = ("fx", from_currency, to_currency)
        cached = await self._cache.get(*cache_key)
        if cached:
            rate = cached["rate"]
        else:
            # Fallback: use a known exchange rate endpoint
            rate = 1.0  # placeholder — production would call Stripe or external FX API
            await self._cache.set({"rate": rate}, *cache_key)

        converted = int(amount * rate)
        return {
            "original_amount": amount,
            "original_currency": from_currency,
            "converted_amount": converted,
            "target_currency": to_currency,
            "rate": rate,
        }

    async def get_payment_status(self, payment_intent_id: str) -> Dict[str, Any]:
        data = await self._request(
            "GET", f"/payment_intents/{payment_intent_id}",
            skip_cache=True,
        )
        return {
            "id": data["id"],
            "status": data["status"],
            "amount": data["amount"],
            "currency": data["currency"],
        }

    async def refund_payment(
        self, payment_intent_id: str, amount: Optional[int] = None
    ) -> Dict[str, Any]:
        body = {"payment_intent": payment_intent_id}
        if amount:
            body["amount"] = amount
        return await self._request("POST", "/refunds", json_body=body, skip_cache=True)

    async def create_customer(self, email: str, name: str, metadata: Optional[Dict] = None) -> str:
        body = {"email": email, "name": name}
        if metadata:
            body["metadata"] = metadata
        data = await self._request("POST", "/customers", json_body=body, skip_cache=True)
        return data["id"]


def create_payments_adapter() -> StripeAdapter:
    return StripeAdapter()
