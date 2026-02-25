"""Shared test fixtures for the backend test suite."""

from __future__ import annotations

import base64
import struct

import boto3
import pytest
from moto import mock_aws


@pytest.fixture(autouse=True)
def _env_setup(monkeypatch):
    """Set required env vars for every test."""
    monkeypatch.setenv("PHOTOS_BUCKET", "test-photos")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("PRESIGNED_URL_EXPIRY_SECONDS", "3600")
    monkeypatch.setenv("ALLOWED_ORIGIN", "*")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")


@pytest.fixture()
def s3_bucket():
    """Create a mocked S3 bucket and yield the boto3 client."""
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket="test-photos")
        yield client


def make_jpeg_base64(size: int = 128) -> str:
    """Generate a minimal valid JPEG as a base64 string.

    Creates a tiny but structurally valid JFIF JPEG so the
    magic-byte check in upload.py passes.
    """
    # Minimal JPEG: SOI + APP0 (JFIF) + DQT + SOF0 + DHT + SOS + EOI
    # For testing we only need SOI (FFD8) … EOI (FFD9) with enough
    # padding to look realistic.  A real JPEG decoder would reject
    # this, but our code only checks the first two magic bytes.
    body = (
        b"\xff\xd8\xff\xe0"  # SOI + APP0 marker
        + struct.pack(">H", 16)  # APP0 length
        + b"JFIF\x00"  # identifier
        + b"\x01\x01"  # version
        + b"\x00"  # units
        + struct.pack(">HH", 1, 1)  # density
        + b"\x00\x00"  # thumbnail
        + b"\xff\xd9"  # EOI
    )
    # Pad to requested size if needed
    if len(body) < size:
        # Insert padding before EOI
        body = body[:-2] + b"\x00" * (size - len(body)) + b"\xff\xd9"
    return base64.b64encode(body).decode()
