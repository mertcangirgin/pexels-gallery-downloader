/*
Run this in the browser console or DevTools Snippets while viewing a Pexels
profile page such as https://www.pexels.com/@silverkblack/
*/

(async () => {
  const PHOTO_PAGE_RE = /(?:https:\/\/www\.pexels\.com)?(\/photo\/[^"' ]*?-(\d+)\/)/g;
  const VIDEO_PAGE_RE = /(?:https:\/\/www\.pexels\.com)?(\/video\/[^"' ]*?-(\d+)\/)/g;
  const PHOTO_FILE_RE = /https:\/\/images\.pexels\.com\/photos\/\d+\/[^"'<> ]+/g;
  const VIDEO_FILE_RE = /https:\/\/videos\.pexels\.com\/video-files\/[^"'<> ]+\.mp4[^"'<> ]*/g;
  const MAX_SCAN_ROUNDS = 120;
  const PAUSE_MS = 1500;
  const LOAD_MORE_PATTERNS = [/load more/i, /show more/i, /more/i];

  function normalizeProfileUrl(url) {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith("/@")) {
      throw new Error("Open a Pexels profile URL first.");
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}/`;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function extractMatches(regex, text, kind, profileUrl) {
    const items = new Map();
    for (const match of text.matchAll(regex)) {
      const pageUrl = new URL(match[1], profileUrl).toString();
      const mediaId = match[2];
      items.set(`${kind}:${mediaId}`, { id: mediaId, kind, page_url: pageUrl });
    }
    return items;
  }

  function extractMediaItems(html, profileUrl) {
    const items = new Map([
      ...extractMatches(PHOTO_PAGE_RE, html, "photo", profileUrl),
      ...extractMatches(VIDEO_PAGE_RE, html, "video", profileUrl),
    ]);
    return [...items.values()];
  }

  function collectFromDocument(profileUrl) {
    return extractMediaItems(document.documentElement.outerHTML, profileUrl);
  }

  function findLoadMoreButton() {
    const elements = [
      ...document.querySelectorAll("button"),
      ...document.querySelectorAll("a"),
    ];

    for (const element of elements) {
      const text = (element.innerText || element.textContent || "").trim();
      if (!text) {
        continue;
      }
      if (!LOAD_MORE_PATTERNS.some((pattern) => pattern.test(text))) {
        continue;
      }
      const disabled =
        element.disabled ||
        element.getAttribute("aria-disabled") === "true" ||
        element.classList.contains("disabled");
      if (!disabled) {
        return element;
      }
    }
    return null;
  }

  async function scanProfile(profileUrl) {
    const seen = new Map();
    let stableRounds = 0;
    let previousCount = 0;

    for (let round = 1; round <= MAX_SCAN_ROUNDS; round += 1) {
      const items = collectFromDocument(profileUrl);
      for (const item of items) {
        seen.set(`${item.kind}:${item.id}`, item);
      }

      console.log(`[scan] round ${round}: found ${seen.size} unique items`);

      const previousHeight = document.documentElement.scrollHeight;
      window.scrollTo(0, previousHeight);
      await sleep(PAUSE_MS);

      const loadMoreButton = findLoadMoreButton();
      if (loadMoreButton) {
        const label = (loadMoreButton.innerText || loadMoreButton.textContent || "").trim();
        console.log(`[scan] clicking "${label}"`);
        loadMoreButton.click();
        await sleep(PAUSE_MS);
      }

      const currentHeight = document.documentElement.scrollHeight;
      if (seen.size === previousCount && currentHeight === previousHeight) {
        stableRounds += 1;
      } else {
        stableRounds = 0;
      }

      previousCount = seen.size;
      if (stableRounds >= 3) {
        break;
      }
    }

    window.scrollTo(0, 0);
    return [...seen.values()];
  }

  function extractMeta(doc, selector) {
    const node = doc.querySelector(selector);
    return node ? node.getAttribute("content") : "";
  }

  function scorePhoto(url) {
    const parsed = new URL(url);
    const width = Number(parsed.searchParams.get("w") || 0);
    const height = Number(parsed.searchParams.get("h") || 0);
    const noTransformBonus = parsed.search ? 0 : 1;
    return [noTransformBonus, width, height];
  }

  function scoreVideo(url) {
    const match = url.match(/(\d{3,4})p/);
    return [match ? Number(match[1]) : 0, url.length];
  }

  function compareScores(left, right) {
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      const a = left[index] || 0;
      const b = right[index] || 0;
      if (a !== b) {
        return a - b;
      }
    }
    return 0;
  }

  function pickBest(candidates, kind) {
    let best = "";
    let bestScore = [];
    for (const candidate of candidates) {
      const score = kind === "photo" ? scorePhoto(candidate) : scoreVideo(candidate);
      if (!best || compareScores(score, bestScore) > 0) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  async function fetchHtml(url) {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return response.text();
  }

  async function resolveDownload(item) {
    const html = await fetchHtml(item.page_url);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const candidates = new Set();
    const regex = item.kind === "photo" ? PHOTO_FILE_RE : VIDEO_FILE_RE;

    for (const match of html.matchAll(regex)) {
      candidates.add(match[0]);
    }

    const metaSelector =
      item.kind === "photo"
        ? 'meta[property="og:image"]'
        : 'meta[property="og:video"]';
    const metaValue = extractMeta(doc, metaSelector);
    if (metaValue) {
      candidates.add(metaValue);
    }

    for (const node of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(node.textContent);
        const values = Array.isArray(parsed) ? parsed : [parsed];
        for (const value of values) {
          if (value && typeof value.contentUrl === "string") {
            candidates.add(value.contentUrl);
          }
        }
      } catch (error) {
        // Ignore malformed blocks.
      }
    }

    const filtered = [...candidates].filter((url) =>
      item.kind === "photo"
        ? url.includes("images.pexels.com/")
        : url.endsWith(".mp4") || url.includes(".mp4?")
    );
    if (!filtered.length) {
      throw new Error(`No download URL found for ${item.page_url}`);
    }

    return {
      ...item,
      download_url: pickBest(filtered, item.kind),
    };
  }

  const profileUrl = normalizeProfileUrl(window.location.href);
  const discovered = await scanProfile(profileUrl);
  const resolved = [];

  for (const [index, item] of discovered.entries()) {
    console.log(`[resolve] ${index + 1}/${discovered.length} ${item.kind} ${item.id}`);
    resolved.push(await resolveDownload(item));
  }

  resolved.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }
    return Number(left.id) - Number(right.id);
  });

  const payload = {
    profile_url: profileUrl,
    generated_at: new Date().toISOString(),
    count: resolved.length,
    items: resolved,
  };

  const output = JSON.stringify(payload, null, 2);
  window.pexelsPayload = payload;
  console.log(payload);

  try {
    await navigator.clipboard.writeText(output);
    console.log("Copied JSON manifest to clipboard.");
  } catch (error) {
    console.log("Clipboard write failed. Run copy(JSON.stringify(window.pexelsPayload, null, 2)) in the console.");
  }
})();
