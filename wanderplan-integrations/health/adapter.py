"""
Health & Vaccination — WHO static dataset (weekly refresh) + CDC Traveler Health API.
Static dataset for country requirements · CDC for real-time advisories · 1hr cache on CDC
"""

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from core.base_adapter import BaseAdapter
from config import HEALTH_WHO, HEALTH_CDC

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"


@dataclass
class VaccinationRequirement:
    country_code: str
    country_name: str
    required_vaccines: List[str]
    recommended_vaccines: List[str]
    malaria_risk: bool
    yellow_fever_certificate: bool
    notes: str = ""


@dataclass
class TravelAdvisory:
    country_code: str
    level: int  # 1-4 (practice usual, enhanced, reconsider, do not travel)
    title: str
    description: str
    disease_alerts: List[str] = field(default_factory=list)
    last_updated: str = ""


class WHOHealthAdapter(BaseAdapter):
    """
    WHO Country Health Requirements — static JSON dataset refreshed weekly.
    No remote API calls; data is loaded from local filesystem.
    """

    def __init__(self):
        super().__init__(HEALTH_WHO)
        self._dataset: Dict[str, Any] = {}
        self._loaded_at: Optional[datetime] = None

    async def start(self) -> None:
        await super().start()
        await self._load_dataset()

    async def _load_dataset(self) -> None:
        data_file = DATA_DIR / "who_health_requirements.json"
        if data_file.exists():
            self._dataset = json.loads(data_file.read_text())
            self._loaded_at = datetime.utcnow()
            logger.info("WHO dataset loaded: %d countries", len(self._dataset))
        else:
            logger.warning("WHO dataset not found at %s — using empty dataset", data_file)
            self._dataset = {}

    async def refresh_dataset(self) -> None:
        """Called by weekly cron job to pull updated WHO data."""
        await self._load_dataset()

    async def get_requirements(self, country_code: str) -> Optional[VaccinationRequirement]:
        country_code = country_code.upper()
        cached = await self._cache.get("requirements", country_code)
        if cached:
            return VaccinationRequirement(**cached)

        entry = self._dataset.get(country_code)
        if not entry:
            return None

        req = VaccinationRequirement(
            country_code=country_code,
            country_name=entry.get("name", ""),
            required_vaccines=entry.get("required_vaccines", []),
            recommended_vaccines=entry.get("recommended_vaccines", []),
            malaria_risk=entry.get("malaria_risk", False),
            yellow_fever_certificate=entry.get("yellow_fever_certificate", False),
            notes=entry.get("notes", ""),
        )
        await self._cache.set(req.__dict__, "requirements", country_code)
        return req

    async def get_all_countries(self) -> List[str]:
        return list(self._dataset.keys())


class CDCTravelerAdapter(BaseAdapter):
    """CDC Traveler Health API — real-time disease advisories and alerts."""

    def __init__(self):
        super().__init__(HEALTH_CDC)
        self._api_key = os.getenv("CDC_API_KEY", "")

    def _api_key_header(self) -> Dict[str, str]:
        return {"X-Api-Key": self._api_key} if self._api_key else {}

    async def get_advisories(self, country_code: str) -> List[TravelAdvisory]:
        cache_key = ("advisories", country_code.upper())
        data = await self._request(
            "GET", f"/destinations/{country_code.upper()}",
            cache_key_parts=cache_key,
        )
        advisories = []
        for notice in data.get("notices", []):
            advisories.append(TravelAdvisory(
                country_code=country_code.upper(),
                level=notice.get("level", 1),
                title=notice.get("title", ""),
                description=notice.get("description", ""),
                disease_alerts=notice.get("diseases", []),
                last_updated=notice.get("date_published", ""),
            ))
        return advisories

    async def get_disease_outbreaks(self) -> List[Dict[str, Any]]:
        cache_key = ("outbreaks",)
        data = await self._request(
            "GET", "/outbreaks",
            cache_key_parts=cache_key,
        )
        return data.get("outbreaks", [])


def create_who_adapter() -> WHOHealthAdapter:
    return WHOHealthAdapter()

def create_cdc_adapter() -> CDCTravelerAdapter:
    return CDCTravelerAdapter()
