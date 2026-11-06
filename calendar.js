/* Data-driven calendar: fetch year-YYYY.json (+ events.json if needed), paint grids.
 *
 * Kinds (locked): holiday (orange), event (red, all-day personal), plan (blue).
 * Stacking: holiday → event → plan. Upcoming: 2 months ahead; date labels Mon D, colored by kind.
 */
(function () {
  "use strict";

  var LABEL_MAX = 40;
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DOW_MINI = "SMTWTFS";
  var MONTH_LONG = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  var MONTH_SHORT = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];
  // space between a marked day and its popup
  var TIP_GAP_PX = 6;
  // leading week rows of a month that put the popup below the day instead of above
  var TIP_FLIP_ROWS = 2;
  // columns at each side of a full month whose popup lines up with that edge
  var TIP_EDGE_COLS = 2;
  // leftover room kept between the popup and the window edges
  var TIP_VIEW_PAD_PX = 8;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function truncLabel(what) {
    var t = String(what || "");
    if (t.length <= LABEL_MAX) return t;
    return t.slice(0, LABEL_MAX) + "...";
  }

  function todayET() {
    try {
      return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function parseYMD(s) {
    var p = String(s).split("-");
    return { y: +p[0], m: +p[1], d: +p[2] };
  }

  function daysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
  }

  /** Normalize legacy short codes + current names → holiday | event | plan. */
  function normKind(k) {
    k = String(k || "");
    if (k === "holiday" || k === "hol") return "holiday";
    if (k === "event" || k === "mine") return "event";
    if (k === "plan" || k === "ev") return "plan";
    return "plan";
  }

  /** Sunday-first month matrix; 0 = empty. */
  function monthMatrix(y, m) {
    var first = new Date(y, m - 1, 1);
    var start = first.getDay();
    var dim = daysInMonth(y, m);
    var weeks = [];
    var week = [];
    var i;
    for (i = 0; i < start; i++) week.push(0);
    for (i = 1; i <= dim; i++) {
      week.push(i);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(0);
      weeks.push(week);
    }
    return weeks;
  }

  function mergeDays() {
    var out = {};
    var i, k, maps = arguments;
    for (i = 0; i < maps.length; i++) {
      if (!maps[i] || !maps[i].days) continue;
      for (k in maps[i].days) {
        if (!Object.prototype.hasOwnProperty.call(maps[i].days, k)) continue;
        out[k] = maps[i].days[k];
      }
    }
    return out;
  }

  function tipHtml(key, events) {
    var bits = ['<div class="tip-date">' + esc(key) + "</div>"];
    var i, ev, kind, who, what;
    for (i = 0; i < events.length; i++) {
      ev = events[i];
      kind = normKind(ev.kind);
      who = ev.who || "";
      what = ev.what || "";
      if (kind === "holiday") {
        bits.push(
          '<div class="tip-entry tip-holiday"><strong>' + esc(what) + "</strong></div>"
        );
      } else if (kind === "event") {
        bits.push(
          '<div class="tip-entry tip-event"><strong>' + esc(what) + "</strong></div>"
        );
      } else {
        bits.push(
          '<div class="tip-entry tip-plan"><strong>' +
            esc(who) +
            "</strong> " +
            esc(what) +
            "</div>"
        );
      }
    }
    return '<div class="tip" role="tooltip">' + bits.join("") + "</div>";
  }

  function bigMonth(y, m, byDay, todayStr) {
    var weeks = monthMatrix(y, m);
    var heads = DOW.map(function (d) { return "<th>" + d + "</th>"; }).join("");
    var rows = weeks.map(function (week) {
      var cells = week.map(function (day) {
        if (!day) return '<td class="empty"></td>';
        var key =
          y + "-" + String(m).padStart(2, "0") + "-" + String(day).padStart(2, "0");
        var events = byDay[key] || [];
        var cls = ["day"];
        if (key === todayStr) cls.push("today");
        var bits = ['<div class="num">' + day + "</div>"];
        var kinds = {};
        var i, ev, kind, label;
        for (i = 0; i < events.length; i++) {
          ev = events[i];
          kind = normKind(ev.kind);
          kinds[kind] = true;
          label = esc(truncLabel(ev.what || ""));
          if (kind === "holiday") bits.push('<div class="entry holiday">' + label + "</div>");
          else if (kind === "event") bits.push('<div class="entry event">' + label + "</div>");
          else bits.push('<div class="entry plan">' + label + "</div>");
        }
        var attrs = "";
        if (events.length) {
          cls.push("has");
          if (kinds.holiday) cls.push("has-holiday");
          if (kinds.event) cls.push("has-event");
          if (kinds.plan) cls.push("has-plan");
          bits.push(tipHtml(key, events));
          attrs = ' tabindex="0"';
        }
        return (
          '<td class="' + cls.join(" ") + '"' + attrs + ">" + bits.join("") + "</td>"
        );
      });
      return "<tr>" + cells.join("") + "</tr>";
    });
    return (
      '<section class="edition cal-block">\n' +
      '<h2 class="cal-h">' +
      esc(MONTH_LONG[m - 1] + " " + y) +
      "</h2>\n" +
      '<table class="cal-grid">\n' +
      "<thead><tr>" +
      heads +
      "</tr></thead>\n" +
      "<tbody>\n" +
      rows.join("\n") +
      "\n</tbody>\n</table>\n</section>\n"
    );
  }

  function miniMonth(y, m, byDay, todayStr, title) {
    var weeks = monthMatrix(y, m);
    var heads = "";
    var i;
    for (i = 0; i < 7; i++) heads += "<th>" + DOW_MINI.charAt(i) + "</th>";
    var rows = weeks.map(function (week) {
      var cells = week.map(function (day) {
        if (!day) return '<td class="empty"></td>';
        var key =
          y + "-" + String(m).padStart(2, "0") + "-" + String(day).padStart(2, "0");
        var events = byDay[key] || [];
        var cls = ["d"];
        if (key === todayStr) cls.push("today");
        var holidays = [], evts = [], plans = [];
        var j, ev, kind;
        for (j = 0; j < events.length; j++) {
          ev = events[j];
          kind = normKind(ev.kind);
          if (kind === "holiday") holidays.push(ev);
          else if (kind === "event") evts.push(ev);
          else plans.push(ev);
        }
        var dots = [];
        var tipBits = [];
        if (holidays.length || evts.length || plans.length) {
          cls.push("has");
          if (holidays.length) {
            cls.push("has-holiday");
            dots.push('<span class="dot holiday" aria-hidden="true"></span>');
            for (j = 0; j < holidays.length; j++) {
              tipBits.push(
                '<div class="tip-entry tip-holiday"><strong>' +
                  esc(holidays[j].what || "") +
                  "</strong></div>"
              );
            }
          }
          if (evts.length) {
            cls.push("has-event");
            dots.push('<span class="dot event" aria-hidden="true"></span>');
            for (j = 0; j < evts.length; j++) {
              tipBits.push(
                '<div class="tip-entry tip-event"><strong>' +
                  esc(evts[j].what || "") +
                  "</strong></div>"
              );
            }
          }
          if (plans.length) {
            cls.push("has-plan");
            dots.push('<span class="dot plan" aria-hidden="true"></span>');
            for (j = 0; j < plans.length; j++) {
              tipBits.push(
                '<div class="tip-entry tip-plan"><strong>' +
                  esc(plans[j].who || "") +
                  "</strong> " +
                  esc(plans[j].what || "") +
                  "</div>"
              );
            }
          }
        }
        var dotsHtml =
          '<span class="dots">' + (dots.length ? dots.join("") : "") + "</span>";
        var pop = tipBits.length
          ? '<div class="tip" role="tooltip"><div class="tip-date">' +
            esc(key) +
            "</div>" +
            tipBits.join("") +
            "</div>"
          : "";
        var attrs = tipBits.length ? ' tabindex="0"' : "";
        return (
          '<td class="' +
          cls.join(" ") +
          '"' +
          attrs +
          '><span class="n">' +
          day +
          "</span>" +
          dotsHtml +
          pop +
          "</td>"
        );
      });
      return "<tr>" + cells.join("") + "</tr>";
    });
    return (
      '<div class="mini-cal">\n' +
      '<div class="mini-title">' +
      esc(title || MONTH_SHORT[m - 1]) +
      "</div>\n" +
      '<table class="mini-grid">\n<thead><tr>' +
      heads +
      "</tr></thead>\n" +
      "<tbody>" +
      rows.join("") +
      "</tbody>\n</table>\n</div>"
    );
  }

  function yearStrip(year, byDay, todayStr) {
    var cells = "";
    var m;
    for (m = 1; m <= 12; m++) {
      cells += miniMonth(year, m, byDay, todayStr, MONTH_SHORT[m - 1]);
    }
    return (
      '<section class="edition cal-block year-block">\n' +
      '<h2 class="cal-h">' +
      year +
      "</h2>\n" +
      '<div class="year-strip">' +
      cells +
      "</div>\n</section>\n"
    );
  }

  function addDays(ymd, n) {
    var p = parseYMD(ymd);
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  /** End date ~2 calendar months ahead of today (ET YMD). */
  function addMonths(ymd, n) {
    var p = parseYMD(ymd);
    var dt = new Date(Date.UTC(p.y, p.m - 1 + n, p.d));
    return dt.toISOString().slice(0, 10);
  }

  /** "Oct 28" — no year. */
  function formatUpcomingDate(ymd) {
    var p = parseYMD(ymd);
    return MONTH_SHORT[p.m - 1] + " " + p.d;
  }

  /** Collect upcoming items within 2 months ahead (all kinds). Stack: holiday → event → plan. */
  function collectUpcoming(byDay, todayStr) {
    var end = addMonths(todayStr, 2);
    var items = [];
    var key, list, i, ev, kind;
    for (key in byDay) {
      if (!Object.prototype.hasOwnProperty.call(byDay, key)) continue;
      if (key < todayStr || key > end) continue;
      list = byDay[key];
      for (i = 0; i < list.length; i++) {
        ev = list[i];
        kind = normKind(ev.kind);
        items.push({
          repeat: !!ev.repeat,
          date: key,
          who: ev.who || "",
          what: ev.what || "",
          kind: kind,
        });
      }
    }
    var rank = { holiday: 0, event: 1, plan: 2 };
    items.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (rank[a.kind] || 9) - (rank[b.kind] || 9);
    });
    // a repeating plan shows only its next occurrence
    var seenRepeat = {};
    return items.filter(function (it) {
      if (!it.repeat) return true;
      var tag = it.who + "|" + it.what;
      if (seenRepeat[tag]) return false;
      seenRepeat[tag] = true;
      return true;
    });
  }

  /** One-line list like status footer: colored date + who — what. */
  function upcomingListHtml(byDay, todayStr) {
    var items = collectUpcoming(byDay, todayStr);
    if (!items.length) {
      return "<li>Nothing upcoming.</li>";
    }
    return items
      .map(function (it) {
        var k = it.kind || "plan";
        return (
          '<li class="up ' +
          k +
          '"><span class="td-date ' +
          k +
          '">' +
          esc(formatUpcomingDate(it.date)) +
          '</span> <span class="td-who">' +
          esc(it.who) +
          "</span> — " +
          esc(it.what) +
          "</li>"
        );
      })
      .join("\n");
  }

  function render(byDay, year, todayStr) {
    var t = parseYMD(todayStr);
    var y = t.y;
    var m = t.m;
    var nextY = m === 12 ? y + 1 : y;
    var nextM = m === 12 ? 1 : m + 1;
    var grids =
      bigMonth(y, m, byDay, todayStr) + bigMonth(nextY, nextM, byDay, todayStr);
    var up =
      '<section class="edition cal-block">\n' +
      '<h2 class="cal-h">Upcoming</h2>\n' +
      '<ul class="todo-list">\n' +
      upcomingListHtml(byDay, todayStr) +
      "\n</ul>\n</section>\n";
    var yearHtml = yearStrip(year, byDay, todayStr);
    var stamped = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
    var foot =
      '<footer class="cal-foot"><p>Updated ' +
      esc(stamped) +
      " — data from events.json / year-" +
      year +
      ".json</p></footer>";
    return (
      grids +
      up +
      yearHtml +
      foot
    );
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }

  function boot() {
    var root = document.getElementById("cal-root");
    if (!root) return;
    var todayStr = todayET();
    var t = parseYMD(todayStr);
    var year = t.y;
    // This year + next (Dec edge / Upcoming may cross year within 2 months).
    var urls = ["year-" + year + ".json", "year-" + (year + 1) + ".json"];
    Promise.all(
      urls
        .map(function (u) {
          return fetchJson(u).catch(function () {
            return null;
          });
        })
        .concat([
          fetchJson("events.json").catch(function () {
            return null;
          }),
        ])
    )
      .then(function (parts) {
        var years = parts.slice(0, urls.length).filter(Boolean);
        var eventsDoc = parts[parts.length - 1];
        if (!years.length) {
          root.innerHTML =
            '<p class="cal-loading">Could not load year JSON.</p>';
          return;
        }
        if (eventsDoc && eventsDoc.meta && eventsDoc.meta.label_max) {
          LABEL_MAX = +eventsDoc.meta.label_max || LABEL_MAX;
        } else if (years[0].label_max) {
          LABEL_MAX = +years[0].label_max || LABEL_MAX;
        }
        var byDay = mergeDays.apply(null, years);
        root.innerHTML = render(byDay, year, todayStr);
      })
      .catch(function (err) {
        root.innerHTML =
          '<p class="cal-loading">Calendar failed to load: ' +
          esc(err && err.message ? err.message : err) +
          "</p>";
      });
  }

  // popups leave their day cells and sit on the page itself, so a month row
  // that scrolls sideways cannot clip them or grow a vertical bar
  function bindDayTips() {
    var openCell = null;
    var openTip = null;

    function cellFrom(node) {
      if (!node || !node.closest) return null;
      return node.closest("td.has");
    }

    function hide() {
      if (!openTip) return;
      openTip.classList.remove("is-open", "tip-below", "tip-above", "tip-full");
      openTip.style.left = "";
      openTip.style.top = "";
      if (openCell && openCell.isConnected) {
        openCell.appendChild(openTip);
      } else if (openTip.parentNode) {
        openTip.parentNode.removeChild(openTip);
      }
      openTip = null;
      openCell = null;
    }

    function wanted(cell) {
      if (!cell || !cell.isConnected) return false;
      if (document.activeElement === cell || cell.contains(document.activeElement)) {
        return true;
      }
      return cell.matches(":hover");
    }

    function place() {
      if (!openCell || !openTip) return;
      var cell = openCell;
      var tip = openTip;
      var box = cell.getBoundingClientRect();
      var row = cell.parentNode;
      var rowIndex = row && typeof row.sectionRowIndex === "number" ? row.sectionRowIndex : -1;
      var colIndex = typeof cell.cellIndex === "number" ? cell.cellIndex : -1;
      var table = cell.closest ? cell.closest("table") : null;
      var full = !!(table && table.classList.contains("cal-grid"));
      var width = tip.offsetWidth;
      var height = tip.offsetHeight;
      var pad = TIP_VIEW_PAD_PX;
      var below = box.bottom + TIP_GAP_PX;
      var above = box.top - height - TIP_GAP_PX;
      var flipDown = rowIndex >= 0 && rowIndex < TIP_FLIP_ROWS;
      // if the preferred side would cross a window edge, use the other side when it fits
      if (flipDown) {
        if (below + height > window.innerHeight - pad && above >= pad) flipDown = false;
      } else if (above < pad && below + height <= window.innerHeight - pad) {
        flipDown = true;
      }
      tip.classList.toggle("tip-below", flipDown);
      tip.classList.toggle("tip-above", !flipDown);
      var align = "center";
      if (full) {
        if (colIndex >= 0 && colIndex < TIP_EDGE_COLS) align = "left";
        else if (colIndex >= 7 - TIP_EDGE_COLS) align = "right";
      }
      var left;
      if (align === "left") left = box.left;
      else if (align === "right") left = box.right - width;
      else left = box.left + box.width / 2 - width / 2;
      var top = flipDown ? below : above;
      var maxLeft = Math.max(pad, window.innerWidth - width - pad);
      var maxTop = Math.max(pad, window.innerHeight - height - pad);
      if (left < pad) left = pad;
      else if (left > maxLeft) left = maxLeft;
      if (top < pad) top = pad;
      else if (top > maxTop) top = maxTop;
      tip.style.left = Math.round(left) + "px";
      tip.style.top = Math.round(top) + "px";
    }

    function show(cell) {
      if (!cell) return;
      if (openCell === cell) {
        place();
        return;
      }
      hide();
      var tip = cell.querySelector(".tip");
      if (!tip) return;
      openCell = cell;
      openTip = tip;
      var table = cell.closest ? cell.closest("table") : null;
      if (table && table.classList.contains("cal-grid")) tip.classList.add("tip-full");
      document.body.appendChild(tip);
      tip.classList.add("is-open");
      place();
    }

    document.addEventListener("pointerover", function (e) {
      var cell = cellFrom(e.target);
      if (cell) show(cell);
    });
    document.addEventListener("pointerout", function (e) {
      if (!openCell) return;
      var cell = cellFrom(e.target);
      if (cell !== openCell) return;
      var next = e.relatedTarget;
      if (next && openCell.contains(next)) return;
      if (next && openTip && openTip.contains(next)) return;
      if (!wanted(openCell)) hide();
    });
    document.addEventListener("focusin", function (e) {
      var cell = cellFrom(e.target);
      if (cell) show(cell);
    });
    document.addEventListener("focusout", function (e) {
      if (!openCell) return;
      var next = e.relatedTarget;
      if (next && openCell.contains(next)) return;
      if (next && openTip && openTip.contains(next)) return;
      if (!wanted(openCell)) hide();
    });
    document.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
  }

  window.Cal = {
    esc: esc,
    miniMonth: miniMonth,
    mergeDays: mergeDays,
    todayET: todayET,
    parseYMD: parseYMD,
    formatUpcomingDate: formatUpcomingDate,
    collectUpcoming: collectUpcoming,
    upcomingListHtml: upcomingListHtml,
    normKind: normKind,
    fetchJson: fetchJson,
    MONTH_SHORT: MONTH_SHORT,
    MONTH_LONG: MONTH_LONG,
  };

  bindDayTips();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
