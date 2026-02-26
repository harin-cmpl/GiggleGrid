/**
 * qr.js — QR code rendering and auto-reset timer.
 */

import { CONFIG } from "../config.js";

const QR_SOURCES = [
  "/assets/qrcode.min.js", // local bundled minified copy
  "/assets/qrcode.js", // local unminified copy
  "https://cdn.jsdelivr.net/npm/qrcode@1.4.4/build/qrcode.min.js", // CDN fallback (1.4.4 ships build)
];

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

  const expiryNumberEl = document.getElementById("qr-expiry-number");
  if (expiryNumberEl) {
    expiryNumberEl.textContent = String(CONFIG.QR_DISPLAY_SECONDS);
    runExpiryCounter(expiryNumberEl, CONFIG.QR_DISPLAY_SECONDS);
  }

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
  const expiryNumberEl = document.getElementById("qr-expiry-number");
  if (expiryNumberEl) {
    expiryNumberEl.textContent = "";
  }
}

async function ensureQRCodeLoaded() {
  if (typeof QRCode !== "undefined") {
    return;
  }

  let lastError;

  for (const src of QR_SOURCES) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.crossOrigin = "anonymous";
      script.onload = () => {
        if (typeof QRCode !== "undefined") {
          resolve();
        } else {
          reject(new Error(`QRCode library failed to initialize from ${src}`));
        }
      };
      script.onerror = () => reject(new Error(`Failed to load QRCode library from ${src}`));
      document.head.appendChild(script);
    }).then(
      () => {
        lastError = undefined;
      },
      (err) => {
        lastError = err;
      },
    );

    if (typeof QRCode !== "undefined") {
      return;
    }
  }

  throw lastError ?? new Error("QRCode library not available");
}

function runExpiryCounter(el, seconds) {
  let remaining = seconds;
  const tick = () => {
    remaining -= 1;
    if (remaining < 0) return;
    el.textContent = String(remaining);
    if (remaining > 0) {
      setTimeout(tick, 1000);
    }
  };
  setTimeout(tick, 1000);
}
