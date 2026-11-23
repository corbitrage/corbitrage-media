/* Interactive illustrative calculators for Corbitrage.
   All outputs are hypothetical, based only on the assumptions entered by the visitor. */
(function (root) {
  "use strict";

  function monthlyRate(annualPct) {
    return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
  }

  // Future value of a monthly SIP (payment at the beginning of each month).
  function sipFutureValue(monthly, annualPct, years) {
    var n = Math.round(years * 12), r = monthlyRate(annualPct);
    if (r === 0) return monthly * n;
    return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  }

  function lumpsumFutureValue(amount, annualPct, years) {
    return amount * Math.pow(1 + annualPct / 100, years);
  }

  function sipForGoal(target, annualPct, years) {
    var fvOne = sipFutureValue(1, annualPct, years);
    return fvOne > 0 ? target / fvOne : 0;
  }

  function inr(x) {
    return "₹" + Math.round(x).toLocaleString("en-IN");
  }

  function num(v) {
    var x = parseFloat(String(v == null ? "" : v).replace(/,/g, ""));
    return isFinite(x) ? x : NaN;
  }

  function check(vals, rules) {
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i], value = vals[rule.k];
      if (isNaN(value) || value < rule.min || value > rule.max) return rule.msg;
    }
    return "";
  }

  var DISCLAIMER = "Illustration only, based on the assumptions entered. Actual returns are not guaranteed and can be negative. Mutual fund investments are subject to market risks; read all scheme related documents carefully.";

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
        { k: "y", min: 1, max: 50, msg: "Years must be between 1 and 50." }
      ]);
      if (err) return { error: err };
      var invested = monthly * Math.round(years * 12), value = sipFutureValue(monthly, rate, years);
      return { invested: invested, value: value, gain: value - invested };
    },
    calcLump: function (amount, rate, years) {
      var err = check({ a: amount, r: rate, y: years }, [
        { k: "a", min: 1000, max: 1000000000, msg: "Amount must be between ₹1,000 and ₹100 crore." },
        { k: "r", min: 0, max: 30, msg: "Assumed return must be between 0% and 30%." },
        { k: "y", min: 1, max: 50, msg: "Years must be between 1 and 50." }
      ]);
      if (err) return { error: err };
      var value = lumpsumFutureValue(amount, rate, years);
      return { invested: amount, value: value, gain: value - amount };
    },
    calcGoal: function (target, rate, years) {
      var err = check({ t: target, r: rate, y: years }, [
        { k: "t", min: 10000, max: 10000000000, msg: "Target must be between ₹10,000 and ₹1,000 crore." },
        { k: "r", min: 0, max: 30, msg: "Assumed return must be between 0% and 30%." },
        { k: "y", min: 1, max: 50, msg: "Years must be between 1 and 50." }
      ]);
      if (err) return { error: err };
      return { monthly: sipForGoal(target, rate, years) };
    }
  };

  root.CorbCalc = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof document === "undefined") return;

  document.addEventListener("DOMContentLoaded", function () {
    var tabs = document.querySelectorAll("[data-calc-tab]");
    var panels = document.querySelectorAll("[data-calc-panel]");

    function show(name) {
      tabs.forEach(function (tab) {
        var active = tab.dataset.calcTab === name;
        tab.setAttribute("aria-selected", active ? "true" : "false");
        tab.setAttribute("tabindex", active ? "0" : "-1");
      });
      panels.forEach(function (panel) { panel.hidden = panel.dataset.calcPanel !== name; });
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () { show(tab.dataset.calcTab); });
      tab.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        var next = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].focus();
        show(tabs[next].dataset.calcTab);
      });
    });
    if (tabs.length) show("sip");

    function node(tag, className, text) {
      var el = document.createElement(tag);
      if (className) el.className = className;
      if (text != null) el.textContent = text;
      return el;
    }

    function addBarChart(container, invested, gain) {
      var chart = node("div", "calc-visual");
      var heading = node("p", "calc-visual-title", "Illustrative value breakdown");
      var track = node("div", "calc-bar", "");
      track.setAttribute("role", "img");
      track.setAttribute("aria-label", "Illustrative value: " + inr(invested) + " invested and " + inr(Math.max(0, gain)) + " hypothetical growth");
      var total = Math.max(invested + Math.max(0, gain), 1);
      var principal = node("span", "calc-bar-principal");
      var growth = node("span", "calc-bar-growth");
      principal.style.width = Math.max(0, Math.min(100, invested / total * 100)) + "%";
      growth.style.width = Math.max(0, Math.min(100, Math.max(0, gain) / total * 100)) + "%";
      track.appendChild(principal);
      track.appendChild(growth);
      var legend = node("div", "calc-legend");
      var a = node("span", "", "Invested: " + inr(invested));
      var b = node("span", "", "Illustrative growth: " + inr(gain));
      legend.appendChild(a);
      legend.appendChild(b);
      chart.appendChild(heading);
      chart.appendChild(track);
      chart.appendChild(legend);
      container.appendChild(chart);
    }

    function renderResult(form, result, type) {
      var out = form.querySelector(".result");
      out.replaceChildren();
      out.classList.add("show");
      if (result.error) {
        out.appendChild(node("p", "err", result.error));
        return;
      }
      if (type === "goal") {
        var title = node("p", "", "Estimated monthly SIP required");
        var amount = node("strong", "", inr(result.monthly));
        title.appendChild(document.createElement("br"));
        title.appendChild(amount);
        out.appendChild(title);
      } else {
        var summary = node("div", "calc-summary");
        summary.appendChild(node("div", "calc-metric", "Invested amount"));
        summary.appendChild(node("strong", "", inr(result.invested)));
        var total = node("div", "calc-metric", "Illustrative future value");
        total.appendChild(node("strong", "", inr(result.value)));
        var gain = node("div", "calc-metric", "Hypothetical gain / loss");
        gain.appendChild(node("strong", "", inr(result.gain)));
        out.appendChild(summary);
        out.appendChild(total);
        out.appendChild(gain);
        addBarChart(out, result.invested, result.gain);
      }
      out.appendChild(node("p", "small calc-disclaimer", DISCLAIMER));
    }

    function bind(formId, calculate, type) {
      var form = document.getElementById(formId);
      if (!form) return;
      var fields = form.querySelectorAll("input");
      var out = form.querySelector(".result");

      function update() {
        var data = new FormData(form);
        var result = calculate(num(data.get("a")), num(data.get("r")), num(data.get("y")));
        renderResult(form, result, type);
      }

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        update();
      });
      fields.forEach(function (field) {
        field.addEventListener("input", update);
        field.addEventListener("change", update);
      });
      // Show a useful default illustration immediately when the tab is opened.
      update();
    }

    bind("calc-sip", API.calcSip, "sip");
    bind("calc-lump", API.calcLump, "lump");
    bind("calc-goal", API.calcGoal, "goal");
  });
})(typeof window !== "undefined" ? window : globalThis);
