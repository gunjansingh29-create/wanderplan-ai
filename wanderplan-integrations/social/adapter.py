"""
Social Media — Instagram Graph API, Twitter/X API v2, TikTok Content Publishing.
All require explicit OAuth2 user consent. No caching (user content).
Powers the Storyboard Agent for auto-posting travel content.
"""

import os
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from core.base_adapter import BaseAdapter
from config import SOCIAL_INSTAGRAM, SOCIAL_TWITTER, SOCIAL_TIKTOK


@dataclass
class SocialPost:
    platform: str
    post_id: str
    url: Optional[str] = None
    status: str = "published"


@dataclass
class MediaUpload:
    media_id: str
    platform: str
    url: Optional[str] = None


# ─── Instagram ────────────────────────────────────────────────────────

class InstagramAdapter(BaseAdapter):
    """Instagram Graph API — photo/carousel publishing for Storyboard Agent."""

    def __init__(self):
        super().__init__(SOCIAL_INSTAGRAM)

    async def publish_photo(
        self,
        user_token: str,
        ig_user_id: str,
        image_url: str,
        caption: str,
    ) -> SocialPost:
        """Two-step: create media container → publish."""
        # Step 1: Create container
        container = await self._request(
            "POST", f"/{ig_user_id}/media",
            json_body={"image_url": image_url, "caption": caption},
            headers={"Authorization": f"Bearer {user_token}"},
            skip_cache=True,
        )
        container_id = container.get("id")

        # Step 2: Publish
        result = await self._request(
            "POST", f"/{ig_user_id}/media_publish",
            json_body={"creation_id": container_id},
            headers={"Authorization": f"Bearer {user_token}"},
            skip_cache=True,
        )
        return SocialPost(
            platform="instagram",
            post_id=result.get("id", ""),
            url=f"https://www.instagram.com/p/{result.get('id', '')}/",
        )

    async def publish_carousel(
        self,
        user_token: str,
        ig_user_id: str,
        media_urls: List[str],
        caption: str,
    ) -> SocialPost:
        # Create child containers
        children = []
        for url in media_urls:
            child = await self._request(
                "POST", f"/{ig_user_id}/media",
                json_body={"image_url": url, "is_carousel_item": True},
                headers={"Authorization": f"Bearer {user_token}"},
                skip_cache=True,
            )
            children.append(child["id"])

        # Create carousel container
        container = await self._request(
            "POST", f"/{ig_user_id}/media",
            json_body={"media_type": "CAROUSEL", "children": children, "caption": caption},
            headers={"Authorization": f"Bearer {user_token}"},
            skip_cache=True,
        )
        result = await self._request(
            "POST", f"/{ig_user_id}/media_publish",
            json_body={"creation_id": container["id"]},
            headers={"Authorization": f"Bearer {user_token}"},
            skip_cache=True,
        )
        return SocialPost(platform="instagram", post_id=result.get("id", ""))


# ─── Twitter / X ──────────────────────────────────────────────────────

class TwitterAdapter(BaseAdapter):
    """Twitter/X API v2 — tweet publishing with optional media."""

    def __init__(self):
        super().__init__(SOCIAL_TWITTER)

    async def post_tweet(
        self,
        user_token: str,
        text: str,
        media_ids: Optional[List[str]] = None,
    ) -> SocialPost:
        body: Dict[str, Any] = {"text": text}
        if media_ids:
            body["media"] = {"media_ids": media_ids}

        data = await self._request(
            "POST", "/tweets",
            json_body=body,
            headers={"Authorization": f"Bearer {user_token}"},
            skip_cache=True,
        )
        tweet_data = data.get("data", {})
        return SocialPost(
            platform="twitter",
            post_id=tweet_data.get("id", ""),
            url=f"https://twitter.com/i/web/status/{tweet_data.get('id', '')}",
        )

    async def upload_media(self, user_token: str, media_url: str) -> MediaUpload:
        """Upload media via v1.1 media endpoint (still required for v2 tweets)."""
        data = await self._request(
            "POST", "/media/upload",
            json_body={"media_url": media_url},
            headers={"Authorization": f"Bearer {user_token}"},
            skip_cache=True,
        )
        return MediaUpload(
            media_id=data.get("media_id_string", ""),
            platform="twitter",
        )

    async def create_thread(
        self, user_token: str, tweets: List[str]
    ) -> List[SocialPost]:
        results = []
        reply_to = None
        for text in tweets:
            body: Dict[str, Any] = {"text": text}
            if reply_to:
                body["reply"] = {"in_reply_to_tweet_id": reply_to}
            data = await self._request(
                "POST", "/tweets",
                json_body=body,
                headers={"Authorization": f"Bearer {user_token}"},
                skip_cache=True,
            )
            tweet_id = data.get("data", {}).get("id", "")
            reply_to = tweet_id
            results.append(SocialPost(platform="twitter", post_id=tweet_id))
        return results


# ─── TikTok ───────────────────────────────────────────────────────────

class TikTokAdapter(BaseAdapter):
    """TikTok Content Publishing API — video posting for Storyboard Agent."""

    def __init__(self):
        super().__init__(SOCIAL_TIKTOK)

    async def publish_video(
        self,
        user_token: str,
        video_url: str,
        title: str,
        privacy_level: str = "PUBLIC_TO_EVERYONE",
    ) -> SocialPost:
        body = {
            "post_info": {
                "title": title,
                "privacy_level": privacy_level,
                "disable_comment": False,
                "disable_duet": False,
                "disable_stitch": False,
            },
            "source_info": {
                "source": "PULL_FROM_URL",
                "video_url": video_url,
            },
        }
        data = await self._request(
            "POST", "/post/publish/video/init/",
            json_body=body,
            headers={"Authorization": f"Bearer {user_token}"},
            skip_cache=True,
        )
        publish_id = data.get("data", {}).get("publish_id", "")
        return SocialPost(
            platform="tiktok",
            post_id=publish_id,
            status="processing",  # TikTok processes async
        )

    async def check_publish_status(self, user_token: str, publish_id: str) -> Dict[str, Any]:
        data = await self._request(
            "POST", "/post/publish/status/fetch/",
            json_body={"publish_id": publish_id},
            headers={"Authorization": f"Bearer {user_token}"},
            skip_cache=True,
        )
        return data.get("data", {})


def create_instagram_adapter() -> InstagramAdapter:
    return InstagramAdapter()

def create_twitter_adapter() -> TwitterAdapter:
    return TwitterAdapter()

def create_tiktok_adapter() -> TikTokAdapter:
    return TikTokAdapter()
