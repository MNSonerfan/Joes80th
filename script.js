(function () {
  const config = window.JOES_80TH_CONFIG || {};
  const apiBase = "https://joes80th-rsvp.swim-times.workers.dev";

  if (window.location.search) {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.hash,
    );
  }

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
  const attendeeCountWrap = document.getElementById("attendee-count-wrap");
  const attendeeCountInput = document.getElementById("rsvp-attendee-count");
  const hostBackup = document.getElementById("host-backup");
  const backupButton = document.getElementById("download-rsvp-backup");
  const backupStatus = document.getElementById("backup-status");

  if (window.location.hash === "#host") {
    hostBackup.hidden = false;
  }

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

      if (rsvp.attending && Number(rsvp.attendee_count) > 1) {
        const count = document.createElement("span");
        count.className = "guest-comment";
        count.textContent = `${rsvp.attendee_count} attendees`;
        item.appendChild(count);
      }

      (rsvp.attending ? attendingList : notAttendingList).appendChild(item);
    }

    const attendingCount = rsvps
      .filter((rsvp) => rsvp.attending)
      .reduce((total, rsvp) => total + (Number(rsvp.attendee_count) || 1), 0);
    const attendingResponses = rsvps.filter((rsvp) => rsvp.attending).length;
    const notAttendingCount = rsvps.length - attendingResponses;
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

  backupButton.addEventListener("click", async () => {
    let token = window.prompt("Enter the host backup key configured for this site.");
    if (token === null) return;
    if (!token) {
      backupStatus.textContent = "Enter the host backup key to continue.";
      return;
    }

    backupButton.disabled = true;
    backupStatus.textContent = "Preparing the RSVP backup...";
    try {
      const response = await fetch(`${apiBase}/api/admin/rsvp-backup`, {
        headers: {
          Accept: "application/sql",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Backup request failed (${response.status}).`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `joes80th-rsvp-backup-${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      backupStatus.textContent =
        "Backup downloaded. Keep it private; restoring it replaces the RSVP list.";
    } catch (error) {
      backupStatus.textContent = error.message;
    } finally {
      token = "";
      backupButton.disabled = false;
    }
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  form.querySelectorAll('input[name="attending"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const isAttending = radio.value === "yes" && radio.checked;
      attendeeCountWrap.hidden = !isAttending;
      attendeeCountInput.required = isAttending;
    });
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
      attendeeCount: formData.get("attendeeCount"),
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
