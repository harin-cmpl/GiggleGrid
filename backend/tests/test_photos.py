"""Tests for random photo retrieval used by the wall slideshow."""

from __future__ import annotations

import urllib.parse

import pytest
from moto import mock_aws

from backend.src.config import get_settings
from backend.src.exceptions import NoPhotosAvailableError
from backend.src.photos import get_random_photo


@mock_aws
class TestGetRandomPhoto:
    """Unit tests for get_random_photo()."""

    def _put_photo(self, s3_bucket, key: str) -> None:
        s3_bucket.put_object(
            Bucket="test-photos",
            Key=key,
            Body=b"\xff\xd8" + b"\x00" * 32 + b"\xff\xd9",
            ContentType="image/jpeg",
        )

    def test_empty_bucket_raises_not_found(self, s3_bucket):
        settings = get_settings()

        with pytest.raises(NoPhotosAvailableError):
            get_random_photo(settings, s3_client=s3_bucket)

    def test_returns_random_photo_with_presigned_url(self, s3_bucket):
        settings = get_settings()
        photo_keys = {
            "photos/alpha.jpg",
            "photos/bravo.jpg",
            "photos/charlie.jpg",
        }
        for key in photo_keys:
            self._put_photo(s3_bucket, key)

        result = get_random_photo(settings, s3_client=s3_bucket)

        assert result["key"] in photo_keys
        assert "url" in result
        assert "test-photos" in result["url"]

        parsed = urllib.parse.urlparse(result["url"])
        query = urllib.parse.parse_qs(parsed.query)
        assert "response-content-disposition" in query
        assert "inline" in query["response-content-disposition"][0]

    def test_ignores_non_photo_prefix(self, s3_bucket):
        settings = get_settings()
        s3_bucket.put_object(
            Bucket="test-photos",
            Key="misc/not-a-photo.jpg",
            Body=b"\xff\xd8\xff\xd9",
            ContentType="image/jpeg",
        )

        with pytest.raises(NoPhotosAvailableError):
            get_random_photo(settings, s3_client=s3_bucket)
