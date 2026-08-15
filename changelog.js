document.addEventListener("DOMContentLoaded", async () => {
  const listEl = document.getElementById("changelogList");
  const statusEl = document.getElementById("changelogStatus");
  if (!listEl || !statusEl) return;
  const REPO_RELEASES_URL =
    "https://api.github.com/repos/wilkcraft/RaftWorld/releases";

  let loadedReleases = null;

  function getCurrentLang() {
    return localStorage.getItem("raftworld_lang") || "es";
  }
  function t(es, en) {
    return getCurrentLang() === "en" ? en : es;
  }
  function formatDate(iso) {
    if (!iso) return "";
    const locale = getCurrentLang() === "en" ? "en-US" : "es-ES";
    return new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }
  function formatFileSize(bytes) {
    if (!bytes) return "";
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(0)} KB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  function stripLeadingHeading(md) {
    return (md || "").replace(/^\s*#\s.*(\r?\n|$)/, "");
  }
  function renderMarkdown(md) {
    if (window.marked && typeof window.marked.parse === "function") {
      return window.marked.parse(stripLeadingHeading(md));
    }
    return `<p>${escapeHtml(md).replace(/\n/g, "<br>")}</p>`;
  }
  function toggleItem(header) {
    const item = header.closest(".changelog-item");
    const body = item.querySelector(".changelog-body");
    const isOpen = header.getAttribute("aria-expanded") === "true";
    listEl.querySelectorAll(".changelog-header").forEach((otherHeader) => {
      if (
        otherHeader !== header &&
        otherHeader.getAttribute("aria-expanded") === "true"
      ) {
        otherHeader.setAttribute("aria-expanded", "false");
        otherHeader
          .closest(".changelog-item")
          .querySelector(".changelog-body").style.display = "none";
      }
    });
    header.setAttribute("aria-expanded", String(!isOpen));
    body.style.display = isOpen ? "none" : "block";
  }
  function buildItem(release, isLatest) {
    const item = document.createElement("div");
    item.className = "changelog-item";
    const header = document.createElement("button");
    header.type = "button";
    header.className = "changelog-header";
    header.setAttribute("aria-expanded", isLatest ? "true" : "false");
    header.innerHTML = `
      <div class="changelog-header-main">
        <span class="changelog-version">${escapeHtml(
          release.name || release.tag_name,
        )}</span>
        ${
          isLatest
            ? `<span class="changelog-badge">${t("Última", "Latest")}</span>`
            : ""
        }
      </div>
      <div class="changelog-header-meta">
        <span class="changelog-date">${formatDate(release.published_at)}</span>
        <i class="fas fa-chevron-down changelog-chevron"></i>
      </div>
    `;
    header.addEventListener("click", () => toggleItem(header));
    const body = document.createElement("div");
    body.className = "changelog-body";
    body.style.display = isLatest ? "block" : "none";
    const markdown = document.createElement("div");
    markdown.className = "changelog-markdown";
    markdown.innerHTML = renderMarkdown(release.body);
    const jarAsset = (release.assets || []).find((a) =>
      a.name.toLowerCase().endsWith(".jar"),
    );
    const releaseLink = document.createElement("a");
    releaseLink.className = "changelog-github-link";
    releaseLink.href = release.html_url;
    releaseLink.target = "_blank";
    releaseLink.rel = "noopener noreferrer";
    releaseLink.innerHTML = `<i class="fab fa-github"></i> ${t(
      "Ver en GitHub",
      "View on GitHub",
    )}`;
    let downloadLink = null;
    if (jarAsset) {
      downloadLink = document.createElement("a");
      downloadLink.className = "changelog-download-link";
      downloadLink.href = jarAsset.browser_download_url;
      downloadLink.setAttribute("download", jarAsset.name);
      downloadLink.dataset.size = jarAsset.size || "";
      downloadLink.innerHTML = `<i class="fas fa-download"></i> ${t(
        "Descargar",
        "Download",
      )} ${escapeHtml(
        jarAsset.name,
      )} <span class="changelog-filesize">(${formatFileSize(
        jarAsset.size,
      )})</span>`;
    }
    body.appendChild(markdown);
    const actions = document.createElement("div");
    actions.className = "changelog-actions";
    actions.appendChild(releaseLink);
    if (downloadLink) actions.appendChild(downloadLink);
    body.appendChild(actions);
    item.appendChild(header);
    item.appendChild(body);
    return item;
  }

  function refreshDynamicTexts() {
    if (!loadedReleases) return;

    const items = listEl.querySelectorAll(".changelog-item");
    items.forEach((item, index) => {
      const release = loadedReleases[index];
      if (!release) return;

      const badge = item.querySelector(".changelog-badge");
      if (badge) badge.textContent = t("Última", "Latest");

      const dateEl = item.querySelector(".changelog-date");
      if (dateEl) dateEl.textContent = formatDate(release.published_at);

      const linkEl = item.querySelector(".changelog-github-link");
      if (linkEl) {
        linkEl.innerHTML = `<i class="fab fa-github"></i> ${t(
          "Ver en GitHub",
          "View on GitHub",
        )}`;
      }

      const downloadEl = item.querySelector(".changelog-download-link");
      if (downloadEl) {
        const jarName = downloadEl.getAttribute("download");
        const size = downloadEl.dataset.size;
        downloadEl.innerHTML = `<i class="fas fa-download"></i> ${t(
          "Descargar",
          "Download",
        )} ${escapeHtml(
          jarName,
        )} <span class="changelog-filesize">(${formatFileSize(
          Number(size),
        )})</span>`;
      }

      if (latestReleaseData) {
        const btn = document.getElementById("latestDownloadBtn");
        const textEl = btn?.querySelector(".latest-download-text");
        if (textEl) {
          textEl.textContent = `${t("Descargar", "Download")} ${
            latestReleaseData.jarAsset.name
          } (${formatFileSize(latestReleaseData.jarAsset.size)})`;
        }
      }
    });

    if (statusEl.isConnected && statusEl.classList.contains("error")) {
      statusEl.textContent = t(
        "No se pudo cargar el changelog. Inténtalo más tarde.",
        "Couldn't load the changelog. Please try again later.",
      );
    }
  }

  let latestReleaseData = null;

  function showLatestBanner(release, jarAsset) {
    latestReleaseData = { release, jarAsset };
    const banner = document.getElementById("latestDownloadBanner");
    const versionEl = banner.querySelector(".latest-download-version");
    const btn = document.getElementById("latestDownloadBtn");
    const textEl = btn.querySelector(".latest-download-text");

    versionEl.textContent = release.name || release.tag_name;
    btn.href = jarAsset.browser_download_url;
    btn.setAttribute("download", jarAsset.name);
    textEl.textContent = `${t("Descargar", "Download")} ${
      jarAsset.name
    } (${formatFileSize(jarAsset.size)})`;

    banner.style.display = "flex";
  }

  document.addEventListener("raftworld:langchange", refreshDynamicTexts);

  try {
    const resp = await fetch(REPO_RELEASES_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!resp.ok) throw new Error(`GitHub API respondió ${resp.status}`);
    const releases = (await resp.json()).filter((r) => !r.draft);
    loadedReleases = releases;

    if (releases.length === 0) {
      statusEl.textContent = t(
        "Todavía no hay releases publicadas.",
        "No releases published yet.",
      );
      return;
    }
    statusEl.remove();
    releases.forEach((release, index) => {
      listEl.appendChild(buildItem(release, index === 0));
    });
    const latestJar = (releases[0]?.assets || []).find(
      (a) =>
        a.name.toLowerCase().endsWith(".jar") &&
        !a.name.toLowerCase().includes("sources") &&
        !a.name.toLowerCase().includes("dev"),
    );
    if (latestJar) {
      showLatestBanner(releases[0], latestJar);
    }
  } catch (err) {
    console.warn("No se pudieron cargar los cambios:", err.message);
    statusEl.classList.add("error");
    statusEl.textContent = t(
      "No se pudo cargar el changelog. Inténtalo más tarde.",
      "Couldn't load the changelog. Please try again later.",
    );
  }
});
