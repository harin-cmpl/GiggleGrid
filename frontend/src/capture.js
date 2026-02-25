/**
 * capture.js — Canvas frame compositing and JPEG export.
 *
 * Captures the current video frame, composites the photobooth
 * frame overlay on top, and exports as a base64 JPEG string.
 */

/** @type {HTMLImageElement|null} */
let frameImage = null;

/**
 * Preload the frame overlay image so it's ready at snap time.
 *
 * @param {string} frameSrc — path to the frame PNG
 * @returns {Promise<HTMLImageElement>}
 */
export function preloadFrame(frameSrc) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      frameImage = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = frameSrc;
  });
}

/**
 * Capture the current video frame with frame overlay.
 *
 * @param {HTMLVideoElement} videoEl
 * @returns {string} base64-encoded JPEG (no data-URI prefix)
 */
export function capturePhoto(videoEl) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const width = videoEl.videoWidth;
  const height = videoEl.videoHeight;
  canvas.width = width;
  canvas.height = height;

  // Mirror the video (selfie mode) then draw
  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, width, height);
  ctx.restore();

  // Composite the frame overlay on top
  if (frameImage) {
    ctx.drawImage(frameImage, 0, 0, width, height);
  }

  // Export as JPEG base64 (strip the data:image/jpeg;base64, prefix)
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return dataUrl.split(",")[1];
}

/**
 * Trigger the camera flash animation.
 *
 * @param {HTMLElement} flashEl
 * @returns {Promise<void>}
 */
export function triggerFlash(flashEl) {
  return new Promise((resolve) => {
    flashEl.classList.remove("hidden", "animate");
    // Force reflow to restart animation
    void flashEl.offsetWidth;
    flashEl.classList.add("animate");

    flashEl.addEventListener(
      "animationend",
      () => {
        flashEl.classList.add("hidden");
        flashEl.classList.remove("animate");
        resolve();
      },
      { once: true }
    );
  });
}
