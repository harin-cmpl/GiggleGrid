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
 * @param {HTMLElement} [taglineEl]  — optional element for "Cheese" tagline
 * @returns {Promise<void>} resolves when countdown reaches zero
 */
export function startCountdown(countdownEl, numberEl, taglineEl) {
  return new Promise((resolve) => {
    let remaining = CONFIG.COUNTDOWN_SECONDS;

    countdownEl.classList.remove("hidden");
    numberEl.textContent = remaining;
    if (taglineEl) taglineEl.classList.add("hidden");

    timerId = setInterval(() => {
      remaining--;

      if (remaining <= 0) {
        clearInterval(timerId);
        timerId = null;
        countdownEl.classList.add("hidden");
        if (taglineEl) taglineEl.classList.add("hidden");
        resolve();
        return;
      }

      numberEl.textContent = remaining;
      if (taglineEl) {
        if (remaining <= 2) {
          taglineEl.classList.remove("hidden");
        } else {
          taglineEl.classList.add("hidden");
        }
      }
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
