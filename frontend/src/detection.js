/**
 * detection.js — MediaPipe Face Detection wrapper.
 *
 * Uses the globally-loaded MediaPipe FaceDetection from CDN.
 * Emits a callback when face presence changes.
 */

import { CONFIG } from "../config.js";

/** @type {FaceDetection|null} */
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

  /* global FaceDetection */
  detector = new FaceDetection({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
  });

  detector.setOptions({
    // "full" model handles farther faces better (slightly heavier)
    model: "full",
    minDetectionConfidence: CONFIG.DETECTION_CONFIDENCE,
  });

  detector.onResults(handleResults);

  await detector.initialize();
  return detector;
}

/**
 * Send a video frame to the detector.
 *
 * @param {HTMLVideoElement} videoEl
 */
export async function detectFrame(videoEl) {
  if (!detector) return;
  await detector.send({ image: videoEl });
}

/**
 * Handle results from MediaPipe.
 *
 * @param {Object} results
 */
function handleResults(results) {
  const hasFace =
    results.detections && results.detections.length > 0;

  if (hasFace) {
    consecutiveFrames++;
  } else {
    consecutiveFrames = 0;
  }

  const shouldBePresent =
    consecutiveFrames >= CONFIG.DETECTION_FRAME_THRESHOLD;

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
