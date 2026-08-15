document.addEventListener("DOMContentLoaded", async () => {
  const el = document.getElementById("buildTag");
  if (!el) return;

  const LATEST_RELEASE_URL =
    "https://api.github.com/repos/wilkcraft/RaftWorld/releases/latest";
  const CACHE_KEY = "raftworld_latest_release";
  const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

  const valueEl = el.querySelector(".build-tag-value");

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
      return parsed.tag;
    } catch (_) {
      return null;
    }
  }

  function writeCache(tag) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ tag, timestamp: Date.now() }),
      );
    } catch (_) {}
  }

  function applyTag(tag) {
    if (!valueEl || !tag) return;
    valueEl.textContent = tag;
    el.classList.add("visible");
  }

  const cached = readCache();
  if (cached) {
    applyTag(cached);
    return;
  }

  try {
    const resp = await fetch(LATEST_RELEASE_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!resp.ok) throw new Error(`GitHub API respondió ${resp.status}`);
    const data = await resp.json();
    const tag = data.tag_name || data.name;
    if (tag) {
      writeCache(tag);
      applyTag(tag);
    }
  } catch (err) {
    console.warn("No se pudo obtener el último release:", err.message);
  }
});
