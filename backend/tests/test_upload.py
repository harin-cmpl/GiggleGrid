"""Tests for the upload module and Lambda handler."""

from __future__ import annotations

import json

import pytest
from moto import mock_aws

from backend.src.config import get_settings
from backend.src.handler import lambda_handler
from backend.src.upload import upload_image
from backend.tests.conftest import make_jpeg_base64

# ── upload_image unit tests ──────────────────────────────────


@mock_aws
class TestUploadImage:
    """Tests for upload_image()."""

    def _setup_bucket(self, s3_client):
        s3_client.create_bucket(Bucket="test-photos")

    def test_successful_upload(self, s3_bucket):
        settings = get_settings()
        result = upload_image(
            make_jpeg_base64(), settings, s3_client=s3_bucket
        )
        assert "key" in result
        assert result["key"].startswith("photos/")
        assert result["key"].endswith(".jpg")
        assert "url" in result
        assert "test-photos" in result["url"]

    def test_empty_payload_raises(self, s3_bucket):
        settings = get_settings()
        with pytest.raises(Exception, match="Empty image"):
            upload_image("", settings, s3_client=s3_bucket)

    def test_invalid_base64_raises(self, s3_bucket):
        settings = get_settings()
        with pytest.raises(Exception, match="not valid base64"):
            upload_image("!!!invalid!!!", settings, s3_client=s3_bucket)

    def test_non_jpeg_raises(self, s3_bucket):
        settings = get_settings()
        import base64

        png_b64 = base64.b64encode(b"\x89PNG" + b"\x00" * 100).decode()
        with pytest.raises(Exception, match="valid JPEG"):
            upload_image(png_b64, settings, s3_client=s3_bucket)

    def test_oversized_image_raises(self, s3_bucket, monkeypatch):
        monkeypatch.setenv("MAX_IMAGE_BYTES", "10")
        settings = get_settings()
        with pytest.raises(Exception, match="exceeds"):
            upload_image(
                make_jpeg_base64(size=256),
                settings,
                s3_client=s3_bucket,
            )


# ── lambda_handler integration tests ────────────────────────


@mock_aws
class TestLambdaHandler:
    """Tests for the Lambda entry point."""

    def _make_event(
        self,
        method="POST",
        path="/upload",
        body=None,
        headers=None,
    ):
        return {
            "requestContext": {
                "http": {
                    "method": method,
                    "path": path,
                },
            },
            "headers": headers or {},
            "body": json.dumps(body) if body is not None else None,
        }

    def _setup_bucket(self):
        import boto3

        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket="test-photos")
        return client

    def _put_photo(self, key="photos/example.jpg"):
        client = self._setup_bucket()
        client.put_object(
            Bucket="test-photos",
            Key=key,
            Body=b"\xff\xd8" + b"\x00" * 24 + b"\xff\xd9",
            ContentType="image/jpeg",
        )

    def test_options_returns_204(self):
        self._setup_bucket()
        resp = lambda_handler(self._make_event("OPTIONS"), None)
        assert resp["statusCode"] == 204

    def test_get_returns_405(self):
        self._setup_bucket()
        resp = lambda_handler(self._make_event("GET"), None)
        assert resp["statusCode"] == 405

    def test_get_random_photo_empty_returns_404(self):
        self._setup_bucket()
        resp = lambda_handler(
            self._make_event("GET", path="/photos/random"),
            None,
        )
        assert resp["statusCode"] == 404
        body = json.loads(resp["body"])
        assert body["error"] == "NO_PHOTOS_AVAILABLE"

    def test_get_random_photo_returns_200(self):
        self._put_photo(key="photos/random-1.jpg")
        resp = lambda_handler(
            self._make_event("GET", path="/photos/random"),
            None,
        )
        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        assert body["key"] == "photos/random-1.jpg"
        assert "url" in body

    def test_missing_image_returns_400(self):
        self._setup_bucket()
        resp = lambda_handler(
            self._make_event("POST", body={"foo": "bar"}),
            None,
        )
        assert resp["statusCode"] == 400
        body = json.loads(resp["body"])
        assert body["error"] == "MISSING_IMAGE"

    def test_invalid_json_returns_400(self):
        self._setup_bucket()
        event = self._make_event("POST")
        event["body"] = "not json{{"
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 400

    def test_successful_upload_returns_200(self):
        self._setup_bucket()
        resp = lambda_handler(
            self._make_event("POST", body={"image": make_jpeg_base64()}),
            None,
        )
        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        assert "url" in body
        assert "key" in body

    def test_cors_headers_present(self):
        self._setup_bucket()
        resp = lambda_handler(
            self._make_event("POST", body={"image": make_jpeg_base64()}),
            None,
        )
        headers = resp["headers"]
        assert "Access-Control-Allow-Origin" in headers
        assert "Access-Control-Allow-Methods" in headers

    def test_wall_origin_is_reflected_for_random_photo(self, monkeypatch):
        monkeypatch.setenv(
            "ALLOWED_ORIGIN", "https://gigglegrin.zeusserver.in"
        )
        monkeypatch.setenv("WALL_ALLOWED_ORIGIN", "https://wall.zeusserver.in")
        self._put_photo(key="photos/random-2.jpg")

        resp = lambda_handler(
            self._make_event(
                "GET",
                path="/photos/random",
                headers={"Origin": "https://wall.zeusserver.in"},
            ),
            None,
        )

        assert resp["statusCode"] == 200
        assert (
            resp["headers"]["Access-Control-Allow-Origin"]
            == "https://wall.zeusserver.in"
        )
