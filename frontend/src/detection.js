/**
 * detection.js — MediaPipe FaceDetection wrapper (full model).
 *
 * Uses globally-loaded MediaPipe FaceDetection from CDN.
 * Pre-downscales the video frame to 640×360 before sending to the
 * detector so that distant faces occupy a larger relative area,
 * dramatically improving detection at 2–4 m.
 */

import { CONFIG } from "../config.js";

/** @type {FaceDetection|null} */
let detector = null;

/** Off-screen canvas used to downscale video before detection */
let scaleCanvas = null;
let scaleCtx = null;

const SCALE_W = 640;
const SCALE_H = 360;

/** Number of consecutive frames with at least one face */
let consecutiveFrames = 0;

/** Whether we consider a person "present" */
let personPresent = false;

/** Timestamp when we first saw a face in the current streak */
let presenceStartMs = null;

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
    model: "full",
    minDetectionConfidence: CONFIG.DETECTION_CONFIDENCE,
  });

  detector.onResults(handleResults);

  scaleCanvas = document.createElement("canvas");
  scaleCanvas.width = SCALE_W;
  scaleCanvas.height = SCALE_H;
  scaleCtx = scaleCanvas.getContext("2d");

  await detector.initialize();
  return detector;
}

/**
 * Downscale a video frame and send it to the detector.
 * Smaller frame → distant face occupies a larger fraction → better detection.
 *
 * @param {HTMLVideoElement} videoEl
 */
export async function detectFrame(videoEl) {
  if (!detector || !scaleCtx) return;
  scaleCtx.drawImage(videoEl, 0, 0, SCALE_W, SCALE_H);
  await detector.send({ image: scaleCanvas });
}

/**
 * Handle results from MediaPipe.
 *
 * @param {Object} results
 */
function handleResults(results) {
  const hasFace = results.detections && results.detections.length > 0;

  if (hasFace) {
    if (consecutiveFrames === 0) {
      presenceStartMs = performance.now();
    }
    consecutiveFrames++;
  } else {
    consecutiveFrames = 0;
    presenceStartMs = null;
  }

  const elapsedMs = presenceStartMs ? performance.now() - presenceStartMs : 0;
  const shouldBePresent = elapsedMs >= (CONFIG.DETECTION_MIN_PRESENCE_MS || 0);

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
  presenceStartMs = null;
}
