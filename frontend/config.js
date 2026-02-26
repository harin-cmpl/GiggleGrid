/**
 * GiggleGrid — Runtime Configuration
 *
 * Change values here and re-upload this single file to update
 * behaviour without a full redeploy. CI/CD injects API_ENDPOINT
 * automatically via sed during the deploy-frontend workflow.
 */

export const CONFIG = Object.freeze({
  /** Seconds to count down after face detection before snap */
  COUNTDOWN_SECONDS: 5,

  /** Seconds to display the QR code before auto-resetting */
  QR_DISPLAY_SECONDS: 15,

  /** Backend API endpoint (replaced by CI/CD) */
  API_ENDPOINT: "__API_URL__",

  /** MediaPipe face detection confidence threshold (0–1) */
  DETECTION_CONFIDENCE: 0.45,

  /** Minimum number of consecutive frames with a face before starting countdown */
  DETECTION_FRAME_THRESHOLD: 3,

  /** Target camera resolution */
  CAMERA_WIDTH: 1920,
  CAMERA_HEIGHT: 1080,
});
