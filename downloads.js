document.addEventListener("DOMContentLoaded", async () => {
  const curseforgeEl = document.getElementById("curseforgeCount");
  const modrinthEl = document.getElementById("modrinthCount");
  if (!curseforgeEl && !modrinthEl) return;

  function getCurrentLang() {
    return localStorage.getItem("raftworld_lang") || "es";
  }
  function formatCount(n) {
    const locale = getCurrentLang() === "en" ? "en-US" : "es-ES";
    return new Intl.NumberFormat(locale).format(Math.round(n));
  }

  // Guardamos el estado final de cada contador para poder re-renderizar
  // el texto sin repetir la animación cuando cambie el idioma.
  const finalState = {}; // { el: { value, iconClass } }

  function renderLabel(el) {
    const state = finalState[el.id];
    if (!state) return;
    const label = getCurrentLang() === "en" ? "downloads" : "descargas";
    el.innerHTML = `<i class="${state.iconClass}"></i> ${formatCount(
      state.value,
    )} <span class="count-label">${label}</span>`;
  }

  function animateCount(el, target, iconClass) {
    const label = getCurrentLang() === "en" ? "downloads" : "descargas";
    const duration = 900;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.innerHTML = `<i class="${iconClass}"></i> ${formatCount(
        current,
      )} <span class="count-label">${label}</span>`;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        finalState[el.id] = { value: target, iconClass };
      }
    }
    requestAnimationFrame(step);
    requestAnimationFrame(() => el.classList.add("visible"));
  }

  try {
    const resp = await fetch(
      "https://raft-web-backend.onrender.com/api/downloads",
    );
    if (!resp.ok) throw new Error("Error al obtener descargas");
    const data = await resp.json();
    if (curseforgeEl && typeof data.curseforge === "number") {
      animateCount(curseforgeEl, data.curseforge, "fas fa-fire");
    }
    if (modrinthEl && typeof data.modrinth === "number") {
      animateCount(modrinthEl, data.modrinth, "fas fa-leaf");
    }
  } catch (err) {
    console.warn("No se pudieron cargar las descargas:", err.message);
  }

  // Re-pinta los labels cuando el usuario cambia de idioma
  document.addEventListener("raftworld:langchange", () => {
    [curseforgeEl, modrinthEl].forEach((el) => {
      if (el) renderLabel(el);
    });
  });
});
