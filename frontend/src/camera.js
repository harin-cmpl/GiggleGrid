/**
 * camera.js — Webcam acquisition and MediaStream utilities.
 */

import { CONFIG } from "../config.js";

/**
 * Request the user-facing camera and attach to the <video> element.
 *
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<MediaStream>}
 */
export async function initCamera(videoEl) {
  const constraints = {
    video: {
      facingMode: "user",
      width: { ideal: CONFIG.CAMERA_WIDTH },
      height: { ideal: CONFIG.CAMERA_HEIGHT },
    },
    audio: false,
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoEl.srcObject = stream;

  return new Promise((resolve) => {
    videoEl.onloadedmetadata = () => {
      videoEl.play();
      resolve(stream);
    };
  });
}

/**
 * Stop all tracks on a given MediaStream.
 *
 * @param {MediaStream} stream
 */
export function stopCamera(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
