/**
 * detection.js — face-api.js TinyFaceDetector wrapper.
 *
 * Uses globally-loaded face-api.js (see index.html scripts).
 * Emits a callback when face presence changes.
 */

import { CONFIG } from "../config.js";

/** @type {faceapi.TinyFaceDetectorOptions} */
let detectorOptions = null;
/** @type {boolean} */
let modelLoaded = false;

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

  /* global faceapi */
  if (!modelLoaded) {
    await faceapi.nets.tinyFaceDetector.loadFromUri(
      "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/",
    );
    modelLoaded = true;
  }

  detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: CONFIG.DETECTION_INPUT_SIZE || 320,
    scoreThreshold: CONFIG.DETECTION_CONFIDENCE,
  });
}

/**
 * Send a video frame to the detector.
 *
 * @param {HTMLVideoElement} videoEl
 */
export async function detectFrame(videoEl) {
  if (!modelLoaded) return;
  const detections = await faceapi.detectAllFaces(videoEl, detectorOptions);
  handleResults(detections || []);
}

/**
 * Handle results from MediaPipe.
 *
 * @param {Object} results
 */
function handleResults(detections) {
  const hasFace = detections.some((d) => d.score >= CONFIG.DETECTION_CONFIDENCE);

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
