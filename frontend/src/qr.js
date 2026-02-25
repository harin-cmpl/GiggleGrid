/**
 * qr.js — QR code rendering and auto-reset timer.
 */

import { CONFIG } from "../config.js";

const QR_CODE_CDN = "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js";

/** @type {number|null} */
let resetTimerId = null;

/**
 * Render a QR code for the given URL into the container element.
 *
 * Uses the globally-loaded QRCode library from CDN.
 *
 * @param {string} url — the presigned S3 URL
 * @param {HTMLElement} containerEl — element to render QR into
 * @returns {Promise<void>}
 */
export async function renderQR(url, containerEl) {
  // Clear any previous QR
  containerEl.innerHTML = "";

  const canvas = document.createElement("canvas");
  containerEl.appendChild(canvas);

  await ensureQRCodeLoaded();

  /* global QRCode */
  await QRCode.toCanvas(canvas, url, {
    width: 280,
    margin: 2,
    color: {
      dark: "#1a1a2e",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}

/**
 * Show the QR screen and start the auto-reset timer.
 *
 * @param {HTMLElement} qrScreenEl
 * @param {Function} onReset — called when the timer expires or
 *   the user clicks "Take Another Photo"
 */
export function showQRScreen(qrScreenEl, onReset) {
  qrScreenEl.classList.remove("hidden");

  // Auto-reset after configured seconds
  resetTimerId = setTimeout(() => {
    hideQRScreen(qrScreenEl);
    onReset();
  }, CONFIG.QR_DISPLAY_SECONDS * 1000);
}

/**
 * Hide the QR screen and clear any pending reset timer.
 *
 * @param {HTMLElement} qrScreenEl
 */
export function hideQRScreen(qrScreenEl) {
  qrScreenEl.classList.add("hidden");
  if (resetTimerId !== null) {
    clearTimeout(resetTimerId);
    resetTimerId = null;
  }
}

async function ensureQRCodeLoaded() {
  if (typeof QRCode !== "undefined") {
    return;
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = QR_CODE_CDN;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (typeof QRCode !== "undefined") {
        resolve();
      } else {
        reject(new Error("QRCode library failed to initialize"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load QRCode library"));
    document.head.appendChild(script);
  });
}
