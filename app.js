(function () {
  var sections = document.querySelectorAll("details");
  sections.forEach(function (section) {
    section.addEventListener("toggle", function () {
      if (!section.open) return;
      sections.forEach(function (other) {
        if (other !== section) other.open = false;
      });
    });
  });
})();
