/**
 * countdown.js — Countdown timer with on-screen display.
 */

import { CONFIG } from "../config.js";

/** @type {number|null} */
let timerId = null;

/**
 * Start a visual countdown on screen.
 *
 * @param {HTMLElement} countdownEl  — container element
 * @param {HTMLElement} numberEl     — element showing the number
 * @returns {Promise<void>} resolves when countdown reaches zero
 */
export function startCountdown(countdownEl, numberEl) {
  return new Promise((resolve) => {
    let remaining = CONFIG.COUNTDOWN_SECONDS;

    countdownEl.classList.remove("hidden");
    numberEl.textContent = remaining;

    timerId = setInterval(() => {
      remaining--;

      if (remaining <= 0) {
        clearInterval(timerId);
        timerId = null;
        countdownEl.classList.add("hidden");
        resolve();
        return;
      }

      numberEl.textContent = remaining;
      // Re-trigger CSS animation by forcing reflow
      numberEl.classList.remove("count-pop");
      void numberEl.offsetWidth;
      numberEl.classList.add("count-pop");
    }, 1000);
  });
}

/**
 * Cancel a running countdown (e.g. if person leaves frame).
 *
 * @param {HTMLElement} countdownEl
 */
export function cancelCountdown(countdownEl) {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
  countdownEl.classList.add("hidden");
}

/**
 * Whether a countdown is currently active.
 *
 * @returns {boolean}
 */
export function isCountdownActive() {
  return timerId !== null;
}
