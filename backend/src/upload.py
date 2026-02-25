"""Upload logic — decode image, store in S3, return presigned URL."""

from __future__ import annotations

import base64
import logging
import uuid

import boto3
from botocore.exceptions import ClientError

from .config import Settings
from .exceptions import (
    ImageTooLargeError,
    InvalidImageError,
    UploadFailedError,
)

logger = logging.getLogger(__name__)


def _decode_image(base64_data: str, max_bytes: int) -> bytes:
    """Validate and decode a base64-encoded JPEG image."""
    if not base64_data:
        raise InvalidImageError("Empty image payload")

    # Strip optional data-URI prefix
    if "," in base64_data[:64]:
        base64_data = base64_data.split(",", 1)[1]

    try:
        raw = base64.b64decode(base64_data, validate=True)
    except Exception as exc:
        raise InvalidImageError("Image is not valid base64") from exc

    if len(raw) > max_bytes:
        raise ImageTooLargeError(
            f"Image size {len(raw)} bytes exceeds "
            f"limit of {max_bytes} bytes"
        )

    # Minimal JPEG magic-byte check (FFD8)
    if not raw[:2] == b"\xff\xd8":
        raise InvalidImageError("Image does not appear to be a valid JPEG")

    return raw


def _get_s3_client(region: str):
    """Create a regional S3 client."""
    return boto3.client("s3", region_name=region)


def upload_image(
    base64_data: str,
    settings: Settings,
    s3_client=None,
) -> dict:
    """Decode, upload to S3, and return a presigned download URL.

    Returns
    -------
    dict
        {"key": "<s3 key>", "url": "<presigned URL>"}
    """
    image_bytes = _decode_image(base64_data, settings.max_image_bytes)

    key = f"photos/{uuid.uuid4().hex}.jpg"
    client = s3_client or _get_s3_client(settings.aws_region)

    try:
        client.put_object(
            Bucket=settings.photos_bucket,
            Key=key,
            Body=image_bytes,
            ContentType="image/jpeg",
        )
    except ClientError as exc:
        logger.exception("S3 put_object failed for key=%s", key)
        raise UploadFailedError(f"S3 upload failed: {exc}") from exc

    try:
        presigned_url = client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.photos_bucket,
                "Key": key,
            },
            ExpiresIn=settings.presigned_url_expiry_seconds,
        )
    except ClientError as exc:
        logger.exception("Presigned URL generation failed")
        raise UploadFailedError(
            f"Could not generate download URL: {exc}"
        ) from exc

    logger.info("Uploaded %s (%d bytes)", key, len(image_bytes))

    return {"key": key, "url": presigned_url}
