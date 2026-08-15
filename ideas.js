document.addEventListener("DOMContentLoaded", async () => {
  await window.langReady;
  const form = document.getElementById("ideaForm");
  const textArea = document.getElementById("ideaText");
  const charCount = document.getElementById("charCount");
  const statusEl = document.getElementById("ideaStatus");

  function getCurrentLang() {
    return (
      localStorage.getItem("raftworld_lang") ||
      document.getElementById("langSelector")?.value ||
      "es"
    );
  }

  function t(key) {
    const lang = getCurrentLang();
    const dict = langMap?.[lang];
    return dict?.[key] ?? key;
  }

  textArea.addEventListener("input", () => {
    charCount.textContent = textArea.value.length;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const author = document.getElementById("ideaAuthor").value.trim();
    const contact = document.getElementById("ideaContact").value.trim();
    const text = textArea.value.trim();
    const honeypot = document.getElementById("website").value;
    const btn = form.querySelector("button[type=submit]");

    statusEl.className = "idea-status";
    statusEl.textContent = "";

    if (!text) return;
    if (honeypot) return; // bot detectado

    btn.disabled = true;
    statusEl.textContent = t("ideas_sending");

    try {
      const resp = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, contact, text }),
      });

      if (!resp.ok) throw new Error("Error en el envío");

      statusEl.textContent = t("ideas_success");
      statusEl.classList.add("success");
      form.reset();
      charCount.textContent = "0";
    } catch (err) {
      statusEl.textContent = t("ideas_error");
      statusEl.classList.add("error");
    } finally {
      btn.disabled = false;
    }
  });
});
