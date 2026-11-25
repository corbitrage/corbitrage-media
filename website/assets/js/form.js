/* Lead form: validates in the browser and posts JSON to the same-origin
 * Cloudflare Pages Function at /api/lead. Server-side secrets stay in the Function.
 *
 * Visible states: idle, validating, submitting, confirmed, preview (nothing delivered),
 * unconfirmed, error. A visitor is told "received" ONLY when the API says dispatched: true.
 */
(function () {
  "use strict";
  var WA = "https://wa.me/918332904448?text=Hi%20Corbitrage%2C%20I%20would%20like%20to%20talk.";
  var TIMEOUT_MS = 20000;

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

  // Turns an API response into a UI outcome. Only dispatched === true counts as delivered.
  function interpret(httpOk, httpStatus, body) {
    body = body && typeof body === "object" && !Array.isArray(body) ? body : null;
    if (httpOk && body && (body.dryRun === true || body.dispatched === false)) return { kind: "preview" };
    if (httpOk && body && body.dispatched === true) return { kind: "confirmed" };
    if (httpOk) return { kind: "unconfirmed" };
    if (httpStatus === 422 && body && body.fields && typeof body.fields === "object") return { kind: "fields", fields: body.fields };
    return { kind: "error", status: httpStatus };
  }

  window.CorbForm = { validate: validate, interpret: interpret };
  if (typeof document === "undefined") return;

  document.addEventListener("DOMContentLoaded", function () {
    var f = document.getElementById("lead-form");
    if (!f) return;
    var status = document.getElementById("lead-status");
    var btn = f.querySelector("button[type=submit]");
    var submitLabel = btn ? btn.textContent : "Send";
    var FIELD_IDS = { name: "f-name", phone: "f-phone", email: "f-email", topic: "f-topic", consent: "f-consent" };
    var busy = false;
    var nextLabel = submitLabel;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (status) status.setAttribute("tabindex", "-1");

    function setErr(name, msg) {
      var el = f.querySelector('[data-err="' + name + '"]');
      var input = document.getElementById(FIELD_IDS[name]);
      if (el) {
        el.textContent = msg || "";
        if (!el.id) el.id = "err-" + name;
      }
      if (input && el) {
        if (msg) {
          input.setAttribute("aria-invalid", "true");
          input.setAttribute("aria-describedby", el.id);
        } else {
          input.removeAttribute("aria-invalid");
          input.removeAttribute("aria-describedby");
        }
      }
    }
    function clearErrors() {
      Object.keys(FIELD_IDS).forEach(function (k) { setErr(k, ""); });
    }
    function focusField(name) {
      var input = document.getElementById(FIELD_IDS[name]);
      if (input) input.focus();
    }

    // state: "busy" | "ok" | "bad" | "" (hidden). Text is set with textContent, never as HTML.
    function say(state, text, withWhatsApp, moveFocus) {
      status.className = "status" + (state ? " " + state : "");
      status.replaceChildren();
      status.appendChild(document.createTextNode(text));
      if (withWhatsApp) {
        status.appendChild(document.createTextNode(" "));
        var a = document.createElement("a");
        a.href = WA;
        a.textContent = /,\s*or$/.test(text) ? "message us on WhatsApp" : "Message us on WhatsApp";
        status.appendChild(a);
        status.appendChild(document.createTextNode("."));
      }
      if (moveFocus) {
        status.focus({ preventScroll: true });
        if (status.scrollIntoView) status.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      }
    }

    // Clear a field's error as soon as the visitor edits it.
    Object.keys(FIELD_IDS).forEach(function (k) {
      var input = document.getElementById(FIELD_IDS[k]);
      if (!input) return;
      var clear = function () { setErr(k, ""); };
      input.addEventListener("input", clear);
      input.addEventListener("change", clear);
    });

    function readValues() {
      var d = new FormData(f);
      return {
        name: (d.get("name") || "").trim(),
        phone: (d.get("phone") || "").trim(),
        email: (d.get("email") || "").trim(),
        topic: d.get("topic") || "",
        message: (d.get("message") || "").trim(),
        consent: d.get("consent") === "on",
        marketing_consent: d.get("marketing") === "on",
        website: d.get("website") || ""
      };
    }

    function outcome(o) {
      nextLabel = submitLabel;
      if (o.kind === "confirmed") {
        f.reset();
        clearErrors();
        say("ok", "Thank you. We have received your enquiry and will contact you.", false, true);
      } else if (o.kind === "preview") {
        say("bad", "Your enquiry has not been sent. Online enquiries are not switched on yet, so nothing was delivered.", true, true);
      } else if (o.kind === "unconfirmed") {
        nextLabel = "Try again";
        say("bad", "We could not confirm that your enquiry was delivered, so please do not assume it was. Please try again, or", true, true);
      } else if (o.kind === "fields") {
        Object.keys(o.fields).forEach(function (k) { if (FIELD_IDS[k]) setErr(k, String(o.fields[k])); });
        var first = Object.keys(o.fields).filter(function (k) { return FIELD_IDS[k]; })[0];
        say("bad", "Please fix the highlighted fields.", false, !first);
        if (first) focusField(first);
      } else if (o.kind === "network") {
        nextLabel = "Try again";
        say("bad", o.timeout
          ? "The request took too long. Please try again, or"
          : "We could not reach the server. Please check your connection and try again, or", true, true);
      } else {
        nextLabel = "Try again";
        say("bad", "Your enquiry could not be sent. Please try again, or", true, true);
      }
    }

    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (busy) return;

      // Validating
      var v = readValues();
      var errs = validate(v);
      Object.keys(FIELD_IDS).forEach(function (k) { setErr(k, errs[k]); });
      var keys = Object.keys(errs);
      if (keys.length) {
        say("bad", keys.length === 1 ? "Please fix the highlighted field." : "Please fix the " + keys.length + " highlighted fields.", false, false);
        focusField(keys[0]);
        return;
      }

      // Submitting
      busy = true;
      btn.disabled = true;
      btn.textContent = "Sending…";
      f.setAttribute("aria-busy", "true");
      say("busy", "Sending your enquiry…", false, true);

      var ctrl = typeof AbortController === "function" ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;

      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function (r) {
          return r.text().then(function (t) {
            var j = null;
            try { j = JSON.parse(t); } catch (e) { /* non-JSON reply is treated as an error */ }
            return { ok: r.ok, status: r.status, j: j };
          });
        })
        .then(function (res) { outcome(interpret(res.ok, res.status, res.j)); })
        .catch(function (e) { outcome({ kind: "network", timeout: !!(e && e.name === "AbortError") }); })
        .then(function () {
          if (timer) clearTimeout(timer);
          busy = false;
          btn.disabled = false;
          btn.textContent = nextLabel;
          f.removeAttribute("aria-busy");
        });
    });
  });
})();
