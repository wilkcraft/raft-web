document.addEventListener("DOMContentLoaded", async () => {
  const crowdinEl = document.getElementById("crowdinCount");
  if (!crowdinEl) return;

  function getCurrentLang() {
    return localStorage.getItem("raftworld_lang") || "es";
  }
  function formatCount(n) {
    const locale = getCurrentLang() === "en" ? "en-US" : "es-ES";
    return new Intl.NumberFormat(locale).format(Math.round(n));
  }

  let finalValue = null;

  function renderLabel() {
    if (finalValue === null) return;
    const label = getCurrentLang() === "en" ? "languages" : "idiomas";
    crowdinEl.innerHTML = `<i class="fas fa-language"></i> ${formatCount(
      finalValue,
    )} <span class="count-label">${label}</span>`;
  }

  function animateCount(el, target) {
    const label = getCurrentLang() === "en" ? "languages" : "idiomas";
    const duration = 900;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.innerHTML = `<i class="fas fa-language"></i> ${formatCount(
        current,
      )} <span class="count-label">${label}</span>`;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        finalValue = target;
      }
    }
    requestAnimationFrame(step);
    requestAnimationFrame(() => el.classList.add("visible"));
  }

  try {
    const resp = await fetch("/api/languages");
    if (!resp.ok) throw new Error("Error al obtener idiomas");
    const data = await resp.json();
    if (typeof data.crowdin === "number") {
      animateCount(crowdinEl, data.crowdin);
    }
  } catch (err) {
    console.warn("No se pudieron cargar los idiomas:", err.message);
  }

  document.addEventListener("raftworld:langchange", renderLabel);
});
