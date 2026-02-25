/**
 * uploader.js — API call to Lambda with error handling and retry.
 */

import { CONFIG } from "../config.js";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Upload a base64-encoded JPEG to the backend.
 *
 * @param {string} base64Image — raw base64 (no data-URI prefix)
 * @returns {Promise<{key: string, url: string}>}
 * @throws {Error} on upload failure after retries
 */
export async function uploadPhoto(base64Image) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${CONFIG.API_ENDPOINT}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Server error ${response.status}`);
      }

      return data;
    } catch (err) {
      lastError = err;
      console.warn(
        `Upload attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`,
        err.message
      );

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw new Error(
    `Upload failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
  );
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
