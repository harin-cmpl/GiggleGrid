"""Typed domain exceptions for structured error handling."""

from __future__ import annotations


class PhotoboothError(Exception):
    """Base exception for all photobooth errors."""

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

    def __init__(self, message: str = "An unexpected error occurred"):
        self.message = message
        super().__init__(self.message)

    def to_dict(self) -> dict:
        return {
            "error": self.error_code,
            "message": self.message,
        }


class InvalidImageError(PhotoboothError):
    """Raised when the uploaded image payload is invalid."""

    status_code = 400
    error_code = "INVALID_IMAGE"

    def __init__(self, message: str = "Invalid image data"):
        super().__init__(message)


class ImageTooLargeError(PhotoboothError):
    """Raised when the image exceeds the maximum allowed size."""

    status_code = 413
    error_code = "IMAGE_TOO_LARGE"

    def __init__(self, message: str = "Image exceeds maximum size"):
        super().__init__(message)


class UploadFailedError(PhotoboothError):
    """Raised when the S3 upload fails."""

    status_code = 502
    error_code = "UPLOAD_FAILED"

    def __init__(self, message: str = "Failed to upload image"):
        super().__init__(message)
