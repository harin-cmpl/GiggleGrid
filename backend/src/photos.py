"""Photo wall logic — fetch one random photo and return a view URL."""

from __future__ import annotations

import random

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from .config import Settings
from .exceptions import NoPhotosAvailableError, PhotoFetchFailedError


def _get_s3_client(region: str):
    """Create a regional S3 client."""
    return boto3.client("s3", region_name=region)


def _list_photo_keys(
    client,
    bucket: str,
    prefix: str = "photos/",
) -> list[str]:
    """List all photo object keys under the configured prefix."""
    keys: list[str] = []
    paginator = client.get_paginator("list_objects_v2")

    try:
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for item in page.get("Contents", []):
                key = item.get("Key", "")
                if key and key.startswith(prefix) and not key.endswith("/"):
                    keys.append(key)
    except (BotoCoreError, ClientError) as exc:
        raise PhotoFetchFailedError(f"Could not list photos: {exc}") from exc

    return keys


def get_random_photo(settings: Settings, s3_client=None) -> dict:
    """Return a random photo key and a presigned inline-view URL."""
    client = s3_client or _get_s3_client(settings.aws_region)
    keys = _list_photo_keys(client, settings.photos_bucket)

    if not keys:
        raise NoPhotosAvailableError()

    key = random.choice(keys)
    filename = key.rsplit("/", 1)[-1] or "photo.jpg"

    try:
        presigned_url = client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.photos_bucket,
                "Key": key,
                "ResponseContentDisposition": (
                    f'inline; filename="{filename}"'
                ),
                "ResponseContentType": "image/jpeg",
            },
            ExpiresIn=settings.presigned_url_expiry_seconds,
        )
    except (BotoCoreError, ClientError) as exc:
        raise PhotoFetchFailedError(
            f"Could not generate photo URL: {exc}"
        ) from exc

    return {"key": key, "url": presigned_url}
