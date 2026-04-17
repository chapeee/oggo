const Theme = {
  current: localStorage.getItem("oggo.theme") || "dark",

  apply(theme) {
    this.current = theme;
    localStorage.setItem("oggo.theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    const icon = document.querySelector("#theme-icon");
    if (icon) {
      icon.setAttribute("data-lucide", theme === "dark" ? "sun" : "moon");
      if (window.lucide) window.lucide.createIcons();
    }
  },

  async toggle() {
    const next = this.current === "dark" ? "light" : "dark";
    this.apply(next);
    try {
      const settings = await window.OggoAPI.getSettings();
      settings.theme = next;
      await window.OggoAPI.saveSettings(settings);
    } catch (_error) {
      // Theme still updates instantly via localStorage even if API save fails.
    }
  },
};

window.OggoTheme = Theme;
