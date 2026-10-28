(function () {
  var sections = document.querySelectorAll("details");
  sections.forEach(function (section) {
    section.addEventListener("toggle", function () {
      if (!section.open) return;
      var header = section.querySelector("summary") || section;
      var before = header.getBoundingClientRect().top;
      sections.forEach(function (other) {
        if (other !== section) other.open = false;
      });
      // Closing a section above shifts this header; restore its screen position.
      var after = header.getBoundingClientRect().top;
      if (after !== before) window.scrollBy(0, after - before);
      // Fallback: if the header still ended up off-screen, bring it into view.
      var top = header.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight) {
        header.scrollIntoView({ block: "nearest" });
      }
    });
  });
})();
