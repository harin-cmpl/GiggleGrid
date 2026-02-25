"""AWS Lambda entry point — thin router with structured JSON responses."""

from __future__ import annotations

import json
import logging
import sys

from .config import get_settings
from .exceptions import PhotoboothError
from .upload import upload_image

# Configure structured logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(
    logging.Formatter(
        '{"level":"%(levelname)s","logger":"%(name)s",'
        '"message":"%(message)s","time":"%(asctime)s"}'
    )
)
logger.addHandler(handler)


def _cors_headers(origin: str = "*") -> dict:
    """Return CORS headers restricted to the allowed origin."""
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def _response(
    status_code: int,
    body: dict,
    origin: str = "*",
) -> dict:
    """Build an API Gateway-compatible response dict."""
    return {
        "statusCode": status_code,
        "headers": {
            **_cors_headers(origin),
            "Content-Type": "application/json",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event: dict, context: object) -> dict:
    """Lambda entry point for API Gateway HTTP API integration."""
    settings = get_settings()
    origin = settings.allowed_origin

    # Handle CORS preflight
    http_method = (
        event.get("requestContext", {})
        .get("http", {})
        .get("method", event.get("httpMethod", ""))
    )

    if http_method == "OPTIONS":
        return _response(204, {}, origin)

    # Only accept POST
    if http_method != "POST":
        return _response(
            405,
            {"error": "METHOD_NOT_ALLOWED", "message": "Use POST"},
            origin,
        )

    # Parse body
    try:
        body = json.loads(event.get("body", "{}") or "{}")
    except (json.JSONDecodeError, TypeError):
        return _response(
            400,
            {
                "error": "INVALID_JSON",
                "message": "Request body must be valid JSON",
            },
            origin,
        )

    image_data = body.get("image")
    if not image_data:
        return _response(
            400,
            {
                "error": "MISSING_IMAGE",
                "message": "Request must include 'image' field",
            },
            origin,
        )

    try:
        result = upload_image(image_data, settings)
    except PhotoboothError as exc:
        logger.warning(
            "Upload rejected: %s — %s",
            exc.error_code,
            exc.message,
        )
        return _response(exc.status_code, exc.to_dict(), origin)
    except Exception:
        logger.exception("Unhandled error during upload")
        return _response(
            500,
            {
                "error": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
            },
            origin,
        )

    return _response(200, result, origin)
