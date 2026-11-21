(function () {
  const config = window.JOES_80TH_CONFIG || {};
  const apiBase = "https://joes80th-rsvp.swim-times.workers.dev";

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
      element.removeAttribute("target");
      element.removeAttribute("rel");
    }
  });

  const dialog = document.getElementById("rsvp-dialog");
  const form = document.getElementById("rsvp-form");
  const status = document.getElementById("rsvp-status");
  const listStatus = document.getElementById("guest-list-status");
  const attendingList = document.getElementById("attending-list");
  const notAttendingList = document.getElementById("not-attending-list");

  function renderRsvps(rsvps) {
    attendingList.innerHTML = "";
    notAttendingList.innerHTML = "";

    for (const rsvp of rsvps) {
      const item = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = rsvp.name;
      item.appendChild(name);

      if (rsvp.comment) {
        const comment = document.createElement("span");
        comment.className = "guest-comment";
        comment.textContent = rsvp.comment;
        item.appendChild(comment);
      }

      (rsvp.attending ? attendingList : notAttendingList).appendChild(item);
    }

    const attendingCount = rsvps.filter((rsvp) => rsvp.attending).length;
    const notAttendingCount = rsvps.length - attendingCount;
    listStatus.textContent =
      `${attendingCount} attending · ${notAttendingCount} not attending`;
  }

  async function loadRsvps() {
    try {
      const response = await fetch(`${apiBase}/api/rsvps`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Could not load RSVP responses.");
      const data = await response.json();
      renderRsvps(data.rsvps || []);
    } catch (error) {
      listStatus.textContent =
        "RSVP responses are temporarily unavailable.";
    }
  }

  document.querySelectorAll("[data-config='rsvp']").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    });
  });

  document.getElementById("close-rsvp").addEventListener("click", () => {
    dialog.close();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";

    if (!form.reportValidity()) return;

    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      attending: formData.get("attending") === "yes",
      comment: formData.get("comment"),
      website: formData.get("website"),
    };

    try {
      const response = await fetch(`${apiBase}/api/rsvps`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your RSVP.");

      renderRsvps(data.rsvps || []);
      status.style.color = "#173a32";
      status.textContent = "Thank you—your RSVP was saved.";
      form.reset();
      window.setTimeout(() => dialog.close(), 900);
    } catch (error) {
      status.style.color = "#963f3a";
      status.textContent = error.message;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Save RSVP";
    }
  });

  loadRsvps();
})();
