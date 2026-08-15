const langMap = {};

async function loadLanguage(lang) {
  try {
    const resp = await fetch(`lang/${lang}.json?v=${Date.now()}`, {
      cache: "no-store",
    });
    if (!resp.ok) throw new Error(`No se pudo cargar ${lang}.json`);
    const data = await resp.json();
    langMap[lang] = data;
    return data;
  } catch (e) {
    console.warn("Error cargando idioma:", e);
    return null;
  }
}

function applyLanguage(lang) {
  const data = langMap[lang];
  if (!data) return;
  document.querySelectorAll("[data-key]").forEach((el) => {
    const key = el.getAttribute("data-key");
    if (data[key] === undefined) return;
    if (el.tagName === "TITLE") {
      document.title = data[key];
      return;
    }
    if (el.children.length === 0) {
      el.textContent = data[key];
      return;
    }
    const textNode = Array.from(el.childNodes).find((n) => n.nodeType === 3);
    if (textNode) {
      textNode.textContent = data[key];
    }
  });
  document.querySelectorAll("[data-key-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-key-placeholder");
    if (data[key] !== undefined) {
      el.setAttribute("placeholder", data[key]);
    }
  });
  const selector = document.getElementById("langSelector");
  if (selector) selector.value = lang;
  try {
    localStorage.setItem("raftworld_lang", lang);
  } catch (_) {}

  document.dispatchEvent(
    new CustomEvent("raftworld:langchange", { detail: { lang } }),
  );
}

async function initLanguage() {
  const saved = localStorage.getItem("raftworld_lang");
  const preferred = saved || "es";

  await Promise.all([loadLanguage("es"), loadLanguage("en")]);

  applyLanguage(preferred);
}

function setupLangSelector() {
  const selector = document.getElementById("langSelector");
  if (!selector) return;
  selector.addEventListener("change", function(e) {
    const lang = e.target.value;
    if (langMap[lang]) {
      applyLanguage(lang);
    } else {
      loadLanguage(lang).then(() => applyLanguage(lang));
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupLangSelector();
  window.langReady = initLanguage();
});
