/* Illustrative calculators. The user supplies the assumed return; nothing here is a forecast. */
(function (root) {
  "use strict";

  function monthlyRate(annualPct) {
    return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
  }

  // Future value of a monthly SIP (payment at start of each month).
  function sipFutureValue(monthly, annualPct, years) {
    var n = Math.round(years * 12);
    var r = monthlyRate(annualPct);
    if (r === 0) return monthly * n;
    return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  }

  function lumpsumFutureValue(amount, annualPct, years) {
    return amount * Math.pow(1 + annualPct / 100, years);
  }

  // Monthly SIP needed to reach a target amount.
  function sipForGoal(target, annualPct, years) {
    var fvOne = sipFutureValue(1, annualPct, years);
    return fvOne > 0 ? target / fvOne : 0;
  }

  function inr(x) {
    return "₹" + Math.round(x).toLocaleString("en-IN");
  }

  function num(v) {
    var x = parseFloat(String(v).replace(/,/g, ""));
    return isFinite(x) ? x : NaN;
  }

  function check(vals, rules) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i], v = vals[r.k];
      if (isNaN(v) || v < r.min || v > r.max) return r.msg;
    }
    return "";
  }

  var DISCLAIMER =
    " Illustration only, based on the return you typed in. Actual returns are not guaranteed and can be negative. Mutual fund investments are subject to market risks; read all scheme related documents carefully.";

  var API = {
    monthlyRate: monthlyRate,
    sipFutureValue: sipFutureValue,
    lumpsumFutureValue: lumpsumFutureValue,
    sipForGoal: sipForGoal,
    inr: inr,
    calcSip: function (monthly, rate, years) {
      var err = check({ m: monthly, r: rate, y: years }, [
        { k: "m", min: 100, max: 10000000, msg: "Monthly amount must be between ₹100 and ₹1,00,00,000." },
        { k: "r", min: 0, max: 30, msg: "Assumed return must be between 0% and 30%." },
        { k: "y", min: 1, max: 50, msg: "Years must be between 1 and 50." },
      ]);
      if (err) return { error: err };
      var fv = sipFutureValue(monthly, rate, years), inv = monthly * Math.round(years * 12);
      return { invested: inv, value: fv, gain: fv - inv };
    },
    calcLump: function (amount, rate, years) {
      var err = check({ a: amount, r: rate, y: years }, [
        { k: "a", min: 1000, max: 1000000000, msg: "Amount must be between ₹1,000 and ₹100 crore." },
        { k: "r", min: 0, max: 30, msg: "Assumed return must be between 0% and 30%." },
        { k: "y", min: 1, max: 50, msg: "Years must be between 1 and 50." },
      ]);
      if (err) return { error: err };
      var fv = lumpsumFutureValue(amount, rate, years);
      return { invested: amount, value: fv, gain: fv - amount };
    },
    calcGoal: function (target, rate, years) {
      var err = check({ t: target, r: rate, y: years }, [
        { k: "t", min: 10000, max: 10000000000, msg: "Target must be between ₹10,000 and ₹1,000 crore." },
        { k: "r", min: 0, max: 30, msg: "Assumed return must be between 0% and 30%." },
        { k: "y", min: 1, max: 50, msg: "Years must be between 1 and 50." },
      ]);
      if (err) return { error: err };
      return { monthly: sipForGoal(target, rate, years) };
    },
  };

  root.CorbCalc = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  // ---- DOM wiring ----
  if (typeof document === "undefined") return;
  document.addEventListener("DOMContentLoaded", function () {
    var tabs = document.querySelectorAll("[data-calc-tab]");
    var panels = document.querySelectorAll("[data-calc-panel]");
    function show(name) {
      tabs.forEach(function (t) { t.setAttribute("aria-selected", t.dataset.calcTab === name ? "true" : "false"); });
      panels.forEach(function (p) { p.hidden = p.dataset.calcPanel !== name; });
    }
    tabs.forEach(function (t) { t.addEventListener("click", function () { show(t.dataset.calcTab); }); });
    if (tabs.length) show("sip");

    function bind(formId, fn, render) {
      var f = document.getElementById(formId);
      if (!f) return;
      var out = f.querySelector(".result");
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var d = new FormData(f);
        var res = fn(num(d.get("a")), num(d.get("r")), num(d.get("y")));
        out.classList.add("show");
        out.innerHTML = res.error ? '<span class="err">' + res.error + "</span>" : render(res) + '<p class="small">' + DISCLAIMER + "</p>";
      });
    }
    bind("calc-sip", API.calcSip, function (r) {
      return "Invested: " + inr(r.invested) + "<br>Illustrative value: <strong>" + inr(r.value) + "</strong><br>Illustrative gain: " + inr(r.gain);
    });
    bind("calc-lump", API.calcLump, function (r) {
      return "Invested: " + inr(r.invested) + "<br>Illustrative value: <strong>" + inr(r.value) + "</strong><br>Illustrative gain: " + inr(r.gain);
    });
    bind("calc-goal", API.calcGoal, function (r) {
      return "Monthly SIP that this illustration would need: <strong>" + inr(r.monthly) + "</strong>";
    });
  });
})(typeof window !== "undefined" ? window : globalThis);
