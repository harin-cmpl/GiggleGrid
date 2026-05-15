/**
 * GiggleGrid Wall — Runtime Configuration
 */

export const CONFIG = Object.freeze({
  /** Backend API endpoint (replaced by CI/CD) */
  API_ENDPOINT: "__API_URL__",

  /** Seconds each photo is visible in slideshow */
  SLIDE_DURATION_SECONDS: 10,

  /** Milliseconds to wait after an API failure before retry */
  FETCH_RETRY_MS: 3000,
});
