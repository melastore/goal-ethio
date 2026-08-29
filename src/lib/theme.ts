export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "goalethio-theme";

// Inlined in <head> and run before paint, so a dark-mode visitor never sees a
// white flash. It has to be a string: it runs before React exists.
export const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_KEY}");
    var dark = stored === "dark" ||
      ((!stored || stored === "system") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", dark);
}
