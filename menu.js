document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const nav = document.querySelector("header nav");
  if (!menuToggle || !nav) return;

  const closeMenu = () => {
    nav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
  };

  const openMenu = () => {
    nav.classList.add("open");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.innerHTML = '<i class="fas fa-times"></i>';
  };

  menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (nav.classList.contains("open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Cierra el menú al pulsar un enlace
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Cierra el menú si se hace click fuera de él
  document.addEventListener("click", (e) => {
    if (!nav.contains(e.target) && !menuToggle.contains(e.target)) {
      closeMenu();
    }
  });

  // Cierra el menú si la ventana vuelve a tamaño de escritorio
  window.addEventListener("resize", () => {
    if (window.innerWidth > 680) {
      closeMenu();
    }
  });

  // Bloquea el scroll de la página mientras el menú móvil está abierto
  (function() {
    const nav = document.querySelector("header nav");
    if (!nav) return;

    const syncBodyScrollLock = () => {
      const isOpen = nav.classList.contains("open");
      document.documentElement.classList.toggle("menu-open", isOpen);
      document.body.classList.toggle("menu-open", isOpen);
    };

    const observer = new MutationObserver(syncBodyScrollLock);
    observer.observe(nav, { attributes: true, attributeFilter: ["class"] });

    syncBodyScrollLock();
  })();
});
