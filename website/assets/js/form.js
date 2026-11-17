/* Lead form: validates in the browser, posts JSON to the Cloudflare Worker.
 *
 * SETUP: after deploying the Worker (see worker/wrangler.toml), replace WORKER_URL
 * with your real Worker URL, e.g. https://corbitrage-lead-handler.<your-subdomain>.workers.dev
 * Until then the form shows a WhatsApp fallback and sends nothing.
 */
(function () {
  "use strict";
  var WORKER_URL = "REPLACE_WITH_WORKER_URL";
  var WA = "https://wa.me/918332904448?text=Hi%20Corbitrage%2C%20I%20would%20like%20to%20talk.";

  var NAME_RE = /^[\p{L}\p{M}.' -]{2,80}$/u;
  var PHONE_RE = /^(?:\+?91)?[6-9]\d{9}$/;
  var EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

  function validate(v) {
    var e = {};
    if (!NAME_RE.test(v.name)) e.name = "Please enter your name.";
    if (!PHONE_RE.test(v.phone.replace(/[\s-]/g, ""))) e.phone = "Please enter a valid 10-digit Indian mobile number.";
    if (v.email && !EMAIL_RE.test(v.email)) e.email = "Please enter a valid email or leave it blank.";
    if (!v.topic) e.topic = "Please choose a topic.";
    if (!v.consent) e.consent = "Please tick the consent box so we can contact you.";
    return e;
  }

  window.CorbForm = { validate: validate };
  if (typeof document === "undefined") return;

  document.addEventListener("DOMContentLoaded", function () {
    var f = document.getElementById("lead-form");
    if (!f) return;
    var status = document.getElementById("lead-status");
    var btn = f.querySelector("button[type=submit]");

    function setErr(name, msg) {
      var el = f.querySelector('[data-err="' + name + '"]');
      if (el) el.textContent = msg || "";
    }
    function say(cls, html) {
      status.className = "status " + cls;
      status.innerHTML = html;
    }

    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var d = new FormData(f);
      var v = {
        name: (d.get("name") || "").trim(),
        phone: (d.get("phone") || "").trim(),
        email: (d.get("email") || "").trim(),
        topic: d.get("topic") || "",
        message: (d.get("message") || "").trim(),
        consent: d.get("consent") === "on",
        marketing_consent: d.get("marketing") === "on",
        website: d.get("website") || "",
      };
      var errs = validate(v);
      ["name", "phone", "email", "topic", "consent"].forEach(function (k) { setErr(k, errs[k]); });
      if (Object.keys(errs).length) return;

      if (WORKER_URL.indexOf("REPLACE_") === 0) {
        say("bad", 'Online form is not switched on yet. Please <a href="' + WA + '">message us on WhatsApp</a>.');
        return;
      }
      btn.disabled = true;
      say("ok", "Sending…");
      fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) {
            f.reset();
            say("ok", "Thank you. We have received your request and will contact you.");
          } else if (res.j && res.j.fields) {
            Object.keys(res.j.fields).forEach(function (k) { setErr(k, res.j.fields[k]); });
            say("bad", "Please fix the highlighted fields.");
          } else {
            say("bad", 'Could not send. Please <a href="' + WA + '">message us on WhatsApp</a>.');
          }
        })
        .catch(function () { say("bad", 'Network problem. Please <a href="' + WA + '">message us on WhatsApp</a>.'); })
        .then(function () { btn.disabled = false; });
    });
  });
})();
