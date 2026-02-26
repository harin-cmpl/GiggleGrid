/**
 * app.js — Bootstrap and state machine entry point.
 *
 * States: IDLE → COUNTDOWN → CAPTURE → UPLOAD → QR → IDLE
 */

import { initCamera } from "./camera.js";
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
const flashEl = document.getElementById("flash");
const promptEl = document.getElementById("prompt");
const qrScreenEl = document.getElementById("qr-screen");
const qrContainer = document.getElementById("qr-container");
const errorToast = document.getElementById("error-toast");
const errorMessage = document.getElementById("error-message");

// ── Detection loop ───────────────────────────────────────────

let animFrameId = null;

function detectionLoop() {
  if (currentState === State.IDLE || currentState === State.COUNTDOWN) {
    detectFrame(videoEl);
  }
  animFrameId = requestAnimationFrame(detectionLoop);
}

// ── State transitions ────────────────────────────────────────

function onPersonPresenceChange(isPresent) {
  if (isPresent && currentState === State.IDLE) {
    transitionTo(State.COUNTDOWN);
  } else if (!isPresent && currentState === State.COUNTDOWN) {
    cancelCountdown(countdownEl);
    resetDetection();
    transitionTo(State.IDLE);
  }
}

async function transitionTo(newState) {
  currentState = newState;

  switch (newState) {
    case State.IDLE:
      showIdle();
      break;

    case State.COUNTDOWN:
      promptEl.classList.add("hidden");
      await startCountdown(countdownEl, countdownNumber);
      // If state changed during countdown (person left), bail
      if (currentState !== State.COUNTDOWN) return;
      transitionTo(State.CAPTURE);
      break;

    case State.CAPTURE: {
      const base64 = capturePhoto(videoEl);
      await triggerFlash(flashEl);
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
  hideQRScreen(qrScreenEl);
  resetDetection();
}

async function doUpload(base64Image) {
  try {
    const { url } = await uploadPhoto(base64Image);
    await renderQR(url, qrContainer);
    currentState = State.QR;
    showQRScreen(qrScreenEl, () => transitionTo(State.IDLE));
  } catch (err) {
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

// ── Initialisation ───────────────────────────────────────────

async function init() {
  try {
    // Preload the frame overlay
    await preloadFrame("assets/frame.svg");
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

  try {
    await initDetection(onPersonPresenceChange);
  } catch (err) {
    showError("Face detection failed to load.");
    console.error("Detection init failed:", err);
    return;
  }

  // Start the detection loop
  detectionLoop();
}

init();
