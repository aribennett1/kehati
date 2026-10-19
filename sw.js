// Bump this only when the service worker's cache format or behavior changes.
const CACHE_NAME = "kehati-library-v2";
const MASECHTOT_COUNT = 63;

const CORE_ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "assets/logo_k.png",
  "assets/Alef-Regular.ttf",
  "assets/Alef-Bold.ttf",
  "assets/NRKIS.ttf",
  "assets/KeterYG-Medium.ttf",
  "assets/GuttmanDrogolin.ttf",
  "assets/STAM.TTF",
  "assets/AdobeHebrew.ttf",
  "assets/frankruehlclm-medium-webfont.ttf",
  "assets/oprFrank-Normal.otf",
  "assets/oprFrank-Bold.otf",
  "assets/pics/Kehati-Bais-HaMikdash.jpg",
];

function urlFor(path) {
  return new URL(path, self.registration.scope).toString();
}

async function cachePath(cache, path) {
  const request = new Request(urlFor(path), { cache: "reload" });
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function precacheLibrary() {
  const cache = await caches.open(CACHE_NAME);
  const dataPaths = [
    "data/index.json",
    ...Array.from({ length: MASECHTOT_COUNT }, (_, index) => `data/masechtot/${index + 1}.json`),
  ];

  await Promise.all(CORE_ASSETS.map((path) => cachePath(cache, path)));
  const dataResponses = await Promise.all(dataPaths.map((path) => cachePath(cache, path)));
  const dataText = await Promise.all(dataResponses.map((response) => response.text()));
  const picturePaths = new Set();

  for (const text of dataText) {
    for (const match of text.matchAll(/assets\/pics\/[A-Za-z0-9._-]+/g)) {
      picturePaths.add(match[0]);
    }
  }

  await Promise.all([...picturePaths].map((path) => cachePath(cache, path)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheLibrary().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(fallbackUrl || request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(fallbackUrl || request);
    return cached || new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, urlFor("index.html")));
    return;
  }

  event.respondWith(networkFirst(event.request));
});
