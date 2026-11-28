/* Corbitrage NAV Explorer — read-only search against the AMFI NAV feed. */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("nav-search-form");
    var input = document.getElementById("nav-search");
    var output = document.getElementById("nav-results");
    var status = document.getElementById("nav-status");
    if (!form || !input || !output || !status) return;

    function node(tag, className, text) {
      var el = document.createElement(tag);
      if (className) el.className = className;
      if (text != null) el.textContent = text;
      return el;
    }
    function render(rows) {
      output.replaceChildren();
      if (!rows.length) return;
      var list = node("div", "nav-result-list");
      rows.forEach(function (row) {
        var card = node("article", "nav-result-card");
        var title = node("h3", "", row.schemeName);
        var meta = [row.plan, row.option, "Scheme code " + row.schemeCode].filter(Boolean).join(" · ");
        var detail = node("p", "small", meta);
        var value = node("strong", "nav-value", "₹" + Number(row.nav).toLocaleString("en-IN", {minimumFractionDigits:4,maximumFractionDigits:4}));
        var date = node("p", "small", "NAV date: " + row.navDate);
        card.append(title, detail, value, date);
        list.appendChild(card);
      });
      output.appendChild(list);
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var query = input.value.trim();
      output.replaceChildren();
      if (query.length < 3) {
        status.textContent = "Enter at least 3 characters to search.";
        status.className = "status bad";
        input.focus();
        return;
      }
      var button = form.querySelector("button[type=submit]");
      button.disabled = true;
      status.textContent = "Searching the latest available AMFI NAV data…";
      status.className = "status ok";
      try {
        var response = await fetch("/api/nav?q=" + encodeURIComponent(query), {
          method: "GET",
          headers: { "Accept": "application/json" },
          credentials: "same-origin"
        });
        var data = await response.json();
        if (!response.ok) throw new Error(data.error || "NAV search is temporarily unavailable.");
        render(data.results || []);
        if (data.count) {
          status.textContent = data.count + " matching scheme(s). Source: AMFI. Retrieved " + new Date(data.fetchedAt).toLocaleString("en-IN") + ". Check each NAV date before relying on the figure.";
          status.className = "status ok";
        } else {
          status.textContent = data.message || "No matching schemes found.";
          status.className = "status bad";
        }
      } catch (error) {
        status.textContent = error.message || "NAV search is temporarily unavailable. Please try again.";
        status.className = "status bad";
      } finally {
        button.disabled = false;
      }
    });
  });
})();
