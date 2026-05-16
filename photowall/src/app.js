import { CONFIG } from "../config.js";

const stageEl = document.getElementById("stage");
const statusEl = document.getElementById("status");
const cardEls = Array.from(stageEl.querySelectorAll(".photo-card"));

const slideDurationMs = Math.max(
  1000,
  Number(CONFIG.SLIDE_DURATION_SECONDS || 10) * 1000
);
const retryMs = Math.max(1000, Number(CONFIG.FETCH_RETRY_MS || 3000));

let activeIndex = 0;
let hasShownFirstPhoto = false;
let lastPhotoKey = "";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomTilt() {
  const min = -5;
  const max = 5;
  const value = Math.random() * (max - min) + min;
  return `${value.toFixed(2)}deg`;
}

async function fetchRandomPhoto() {
  const endpoint = `${CONFIG.API_ENDPOINT}/photos/random`;

  const resp = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    let payload = {};
    try {
      payload = await resp.json();
    } catch {
      payload = {};
    }

    const message = payload.message || `Request failed with ${resp.status}`;
    const error = new Error(message);
    error.code = payload.error || "UNKNOWN_ERROR";
    throw error;
  }

  return resp.json();
}

async function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ src: img.src, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

function showStatus(message) {
  statusEl.textContent = message;
}

function swapToPhoto(photoData, photoKey) {
  // Always update card 2 (index 2) which is the topmost
  const topCard = cardEls[2];
  const topImage = topCard.querySelector(".photo-img");

  topImage.src = photoData.src;

  // Randomize the tilt angle for the top card
  topCard.style.setProperty("--tilt", randomTilt());

  // Set stage size based on image dimensions + padding
  const stageWidth = photoData.width + 50;  // 25px left + 25px right
  const stageHeight = photoData.height + 100;  // 50px top + 50px bottom
  stageEl.style.width = `${stageWidth}px`;
  stageEl.style.height = `${stageHeight}px`;

  // Make all cards visible for stacked effect
  cardEls.forEach(card => card.classList.add("is-visible"));

  if (!hasShownFirstPhoto) {
    hasShownFirstPhoto = true;
    showStatus("Live slideshow is running");
  }

  lastPhotoKey = photoKey;
}

function isLikelyDuplicate(key) {
  return key && lastPhotoKey && key === lastPhotoKey;
}

async function runSlideshow() {
  while (true) {
    try {
      const photo = await fetchRandomPhoto();

      if (photo.error === "NO_PHOTOS_AVAILABLE") {
        showStatus("No photos yet. Waiting for first capture...");
        await sleep(retryMs);
        continue;
      }

      if (!photo.url || !photo.key) {
        throw new Error("Malformed photo response");
      }

      if (isLikelyDuplicate(photo.key)) {
        await sleep(1200);
        continue;
      }

      const photoData = await preloadImage(photo.url);
      swapToPhoto(photoData, photo.key);
      await sleep(slideDurationMs);
    } catch (err) {
      if (err.code === "NO_PHOTOS_AVAILABLE") {
        showStatus("No photos yet. Waiting for first capture...");
      } else {
        showStatus(`Wall reconnecting: ${err.message}`);
      }
      await sleep(retryMs);
    }
  }
}

runSlideshow();
