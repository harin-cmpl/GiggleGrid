/**
 * detection.js — Blazeface (TF.js) face presence wrapper.
 *
 * Uses globally-loaded TensorFlow.js + Blazeface (see index.html scripts).
 * Emits a callback when face presence changes.
 */

import { CONFIG } from "../config.js";

/** @type {blazeface.BlazeFaceModel|null} */
let detector = null;

/** Number of consecutive frames with at least one face */
let consecutiveFrames = 0;

/** Whether we consider a person "present" */
let personPresent = false;

/** Callback: (isPresent: boolean) => void */
let onPresenceChange = null;

/**
 * Initialise the MediaPipe face detector.
 *
 * @param {Function} callback — called with `true` when a person
 *   is reliably detected, `false` when they leave.
 * @returns {Promise<FaceDetection>}
 */
export async function initDetection(callback) {
  onPresenceChange = callback;

  /* global blazeface */
  detector = await blazeface.load();
  return detector;
}

/**
 * Send a video frame to the detector.
 *
 * @param {HTMLVideoElement} videoEl
 */
export async function detectFrame(videoEl) {
  if (!detector) return;
  const predictions = await detector.estimateFaces(videoEl, false);
  handleResults(predictions || []);
}

/**
 * Handle results from MediaPipe.
 *
 * @param {Object} results
 */
function handleResults(predictions) {
  // Blazeface returns an array of predictions with probability
  const hasFace = predictions.some((p) => p.probability?.[0] >= CONFIG.DETECTION_CONFIDENCE);

  if (hasFace) {
    consecutiveFrames++;
  } else {
    consecutiveFrames = 0;
  }

  const shouldBePresent = consecutiveFrames >= CONFIG.DETECTION_FRAME_THRESHOLD;

  if (shouldBePresent !== personPresent) {
    personPresent = shouldBePresent;
    if (onPresenceChange) {
      onPresenceChange(personPresent);
    }
  }
}

/**
 * Reset internal detection state (e.g. after a photo is taken).
 */
export function resetDetection() {
  consecutiveFrames = 0;
  personPresent = false;
}
