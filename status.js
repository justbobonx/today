/* Data-driven status report: fetch status.json + year-YYYY.json, paint accordion + cal footer. */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Keep **bold**; escape everything else. No inline markdown links in body text. */
  function inlineText(text) {
    var s = String(text == null ? "" : text);
    var parts = [];
    var re = /\*\*([^*]+)\*\*/g;
    var last = 0;
    var m;
    while ((m = re.exec(s))) {
      parts.push(esc(s.slice(last, m.index)));
      parts.push("<strong>" + esc(m[1]) + "</strong>");
      last = re.lastIndex;
    }
    parts.push(esc(s.slice(last)));
    return parts.join("");
  }

  function parasHtml(text) {
    var raw = String(text == null ? "" : text).trim();
    if (!raw) return "";
    return raw
      .split(/\n\s*\n/)
      .map(function (p) {
        return "<p>" + inlineText(p.replace(/\n/g, " ").trim()) + "</p>";
      })
      .filter(function (p) {
        return p !== "<p></p>";
      })
      .join("\n");
  }

  function linksHtml(links) {
    if (!links || !links.length) return "";
    var bits = links.map(function (l) {
      return (
        '<a href="' +
        esc(l.url || "") +
        '">' +
        esc(l.text || "") +
        "</a>"
      );
    });
    return '<p class="links">' + bits.join(" · ") + "</p>\n";
  }

  function renderNews(doc) {
    var date = doc.date || "";
    var title = date ? "Status report, " + date : "Status report";
    var out = [];
    out.push('<header class="masthead">\n');
    out.push("<h1>" + esc(title) + "</h1>\n");
    var intro = (doc.intro || "").trim();
    if (intro) {
      intro.split(/\n\s*\n/).forEach(function (g) {
        var t = g.replace(/\n/g, " ").trim();
        if (t) out.push('<p class="lede">' + inlineText(t) + "</p>\n");
      });
    }
    out.push("</header>\n");
    var items = doc.items || [];
    var i, it;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      out.push('<section class="edition">\n<details>\n');
      out.push(
        '<summary><span class="label">' +
          esc(it.title || "") +
          '</span><span class="chev" aria-hidden="true"></span></summary>\n'
      );
      out.push('<div class="section-body">\n');
      out.push(parasHtml(it.text));
      out.push("\n");
      out.push(linksHtml(it.links));
      out.push("</div>\n</details>\n</section>\n");
    }
    return out.join("");
  }

  function bindAccordion(root) {
    var sections = root.querySelectorAll("details");
    sections.forEach(function (section) {
      section.addEventListener("toggle", function () {
        if (!section.open) return;
        var header = section.querySelector("summary") || section;
        var before = header.getBoundingClientRect().top;
        sections.forEach(function (other) {
          if (other !== section) other.open = false;
        });
        var after = header.getBoundingClientRect().top;
        if (after !== before) window.scrollBy(0, after - before);
        var top = header.getBoundingClientRect().top;
        if (top < 0 || top > window.innerHeight) {
          header.scrollIntoView({ block: "nearest" });
        }
      });
    });
  }

  function renderFooter(byDay, todayStr) {
    var Cal = window.Cal;
    if (!Cal) {
      return '<p class="cal-loading">Calendar helpers missing.</p>';
    }
    var t = Cal.parseYMD(todayStr);
    var y = t.y;
    var m = t.m;
    var nextY = m === 12 ? y + 1 : y;
    var nextM = m === 12 ? 1 : m + 1;
    var title1 = Cal.MONTH_SHORT[m - 1] + " " + y;
    var title2 = Cal.MONTH_SHORT[nextM - 1] + " " + nextY;
    var minis =
      Cal.miniMonth(y, m, byDay, todayStr, title1) +
      Cal.miniMonth(nextY, nextM, byDay, todayStr, title2);
    var items = Cal.collectUpcoming(byDay, todayStr);
    var lis;
    if (!items.length) {
      lis = "<li>Nothing upcoming.</li>";
    } else {
      lis = items
        .map(function (it) {
          return (
            '<li><span class="td-date">' +
            esc(Cal.formatUpcomingDate(it.date)) +
            '</span> <span class="td-who">' +
            esc(it.who) +
            "</span> — " +
            esc(it.what) +
            "</li>"
          );
        })
        .join("\n");
    }
    return (
      '<div class="mini-row">' +
      minis +
      "</div>\n" +
      '<h2 class="cal-h">Upcoming</h2>\n' +
      '<ul class="todo-list">\n' +
      lis +
      "\n</ul>\n" +
      '<p class="cal-more"><a href="calendar.html">Full calendar</a></p>\n'
    );
  }

  function fetchJson(url) {
    if (window.Cal && window.Cal.fetchJson) return window.Cal.fetchJson(url);
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }

  function boot() {
    var root = document.getElementById("status-root");
    var foot = document.getElementById("cal-footer");
    if (!root) return;
    var todayStr =
      window.Cal && window.Cal.todayET
        ? window.Cal.todayET()
        : new Date().toISOString().slice(0, 10);
    var year = +todayStr.slice(0, 4);
    Promise.all([
      fetchJson("status.json"),
      fetchJson("year-" + year + ".json").catch(function () {
        return null;
      }),
      fetchJson("year-" + (year + 1) + ".json").catch(function () {
        return null;
      }),
    ])
      .then(function (parts) {
        var doc = parts[0];
        root.innerHTML = renderNews(doc);
        bindAccordion(root);
        if (foot) {
          var years = [parts[1], parts[2]].filter(Boolean);
          if (!years.length || !window.Cal) {
            foot.innerHTML =
              '<p class="cal-more"><a href="calendar.html">Full calendar</a></p>';
            return;
          }
          var byDay = window.Cal.mergeDays.apply(null, years);
          foot.innerHTML = renderFooter(byDay, todayStr);
        }
      })
      .catch(function (err) {
        root.innerHTML =
          '<p class="cal-loading">Status failed to load: ' +
          esc(err && err.message ? err.message : err) +
          "</p>";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
