/**
 * app.js — Bootstrap and state machine entry point.
 *
 * States: IDLE → COUNTDOWN → CAPTURE → UPLOAD → QR → IDLE
 */

import { initCamera } from "./camera.js";
// import detection utilities (kept for potential re-enable, but unused now)
import {
  initDetection,
  detectFrame,
  resetDetection,
} from "./detection.js";
import {
  startCountdown,
  cancelCountdown,
  isCountdownActive,
} from "./countdown.js";
import { preloadFrame, capturePhoto, triggerFlash } from "./capture.js";
import { uploadPhoto } from "./uploader.js";
import { renderQR, showQRScreen, hideQRScreen } from "./qr.js";

// ── State ────────────────────────────────────────────────────

const State = Object.freeze({
  IDLE: "IDLE",
  COUNTDOWN: "COUNTDOWN",
  CAPTURE: "CAPTURE",
  UPLOAD: "UPLOAD",
  QR: "QR",
});

let currentState = State.IDLE;

// ── DOM refs ─────────────────────────────────────────────────

const videoEl = document.getElementById("video");
const countdownEl = document.getElementById("countdown");
const countdownNumber = document.getElementById("countdown-number");
const countdownTagline = document.getElementById("countdown-tagline");
const flashEl = document.getElementById("flash");
const promptEl = document.getElementById("prompt");
const shootBtn = document.getElementById("btn-shoot");
const qrScreenEl = document.getElementById("qr-screen");
const qrContainer = document.getElementById("qr-container");
const processingOverlay = document.getElementById("processing-overlay");
const processingImage = document.getElementById("processing-image");
const errorToast = document.getElementById("error-toast");
const errorMessage = document.getElementById("error-message");

// ── Detection loop (bypassed) ────────────────────────────────

// let animFrameId = null;
// function detectionLoop() {
//   if (currentState === State.IDLE || currentState === State.COUNTDOWN) {
//     detectFrame(videoEl);
//   }
//   animFrameId = requestAnimationFrame(detectionLoop);
// }

// ── State transitions ────────────────────────────────────────

// Detection-driven transitions bypassed
function onPersonPresenceChange() {}

async function transitionTo(newState) {
  currentState = newState;

  switch (newState) {
    case State.IDLE:
      showIdle();
      break;

    case State.COUNTDOWN:
      promptEl.classList.add("hidden");
      await startCountdown(countdownEl, countdownNumber, countdownTagline);
      // If state changed during countdown, bail
      if (currentState !== State.COUNTDOWN) return;
      transitionTo(State.CAPTURE);
      break;

    case State.CAPTURE: {
      const base64 = capturePhoto(videoEl);
      await triggerFlash(flashEl);
      showProcessing(base64);
      transitionTo(State.UPLOAD);
      doUpload(base64);
      break;
    }

    case State.UPLOAD:
      // Upload is handled by doUpload()
      break;

    case State.QR:
      // QR display is handled by doUpload() on success
      break;
  }
}

function showIdle() {
  promptEl.classList.remove("hidden");
  hideProcessing();
  hideQRScreen(qrScreenEl);
  resetDetection();
}

async function doUpload(base64Image) {
  try {
    const { url } = await uploadPhoto(base64Image);
    await renderQR(url, qrContainer);
    currentState = State.QR;
    hideProcessing();
    showQRScreen(qrScreenEl, () => transitionTo(State.IDLE));
  } catch (err) {
    hideProcessing();
    showError(err.message);
    transitionTo(State.IDLE);
  }
}

// ── Error handling ───────────────────────────────────────────

function showError(msg) {
  errorMessage.textContent = msg;
  errorToast.classList.remove("hidden");
  setTimeout(() => errorToast.classList.add("hidden"), 5000);
}

// ── Processing overlay helpers ───────────────────────────────

function showProcessing(base64Image) {
  if (!processingOverlay || !processingImage) return;
  processingOverlay.classList.remove("hidden");
  processingImage.src = `data:image/jpeg;base64,${base64Image}`;
}

function hideProcessing() {
  if (!processingOverlay || !processingImage) return;
  processingOverlay.classList.add("hidden");
  processingImage.removeAttribute("src");
}

// ── Initialisation ───────────────────────────────────────────

async function init() {
  try {
    // Preload the frame overlay
    await preloadFrame("assets/frame.png");
  } catch {
    console.warn("Frame overlay not found — photos will have no border");
  }

  try {
    await initCamera(videoEl);
  } catch (err) {
    showError("Camera access denied. Please allow camera permissions.");
    console.error("Camera init failed:", err);
    return;
  }

  // Bypass detection: manual trigger via button
  shootBtn.addEventListener("click", () => {
    if (currentState !== State.IDLE) return;
    transitionTo(State.COUNTDOWN);
  });
}

init();
