"""Runtime configuration loaded from environment variables with validation."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env(
    key: str,
    default: str | None = None,
    *,
    required: bool = False,
) -> str:
    """Read an env var with optional default and required check."""
    value = os.environ.get(key, default)
    if required and not value:
        raise OSError(f"Missing required environment variable: {key}")
    return value  # type: ignore[return-value]


def _env_int(key: str, default: int) -> int:
    """Read an integer environment variable."""
    raw = os.environ.get(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise OSError(
            f"Environment variable {key} must be an integer, " f"got: {raw!r}"
        ) from exc


@dataclass(frozen=True)
class Settings:
    """Application settings — immutable after construction."""

    photos_bucket: str = field(
        default_factory=lambda: _env("PHOTOS_BUCKET", required=True),
    )
    aws_region: str = field(
        default_factory=lambda: _env("AWS_REGION", "us-east-1"),
    )
    presigned_url_expiry_seconds: int = field(
        default_factory=lambda: _env_int(
            "PRESIGNED_URL_EXPIRY_SECONDS", 86400
        ),
    )
    allowed_origin: str = field(
        default_factory=lambda: _env("ALLOWED_ORIGIN", "*"),
    )
    max_image_bytes: int = field(
        # 10 MB default
        default_factory=lambda: _env_int("MAX_IMAGE_BYTES", 10_485_760),
    )

    def __post_init__(self) -> None:
        if self.presigned_url_expiry_seconds <= 0:
            raise ValueError("PRESIGNED_URL_EXPIRY_SECONDS must be positive")
        if self.max_image_bytes <= 0:
            raise ValueError("MAX_IMAGE_BYTES must be positive")


def get_settings() -> Settings:
    """Factory that constructs validated settings from the current env."""
    return Settings()
