(function () {
  const config = window.JOES_80TH_CONFIG || {};

  document.querySelectorAll("[data-config]").forEach((element) => {
    const key = element.dataset.config;

    if (key === "date" && config.date) {
      element.textContent = config.date;
    }

    if (key === "time" && config.time) {
      element.textContent = config.time;
    }

    if (key === "phone") {
      if (config.phoneDisplay) {
        element.textContent = config.phoneDisplay;
      }
      if (config.phoneLink) {
        element.href = config.phoneLink;
      } else {
        element.removeAttribute("href");
      }
    }

    if (key === "rsvp" && config.rsvpUrl) {
      element.href = config.rsvpUrl;
      element.target = "_blank";
      element.rel = "noopener";
    }
  });
})();
