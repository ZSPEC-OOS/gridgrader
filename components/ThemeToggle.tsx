"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("gridgrader-theme", theme);
  } catch {
    // localStorage unavailable (private mode, etc.) — theme just won't persist.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as Theme | null) ??
      "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing initial state from the DOM attribute the no-flash inline script already set
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 hover:text-brand-crimson dark:border-border dark:text-foreground dark:hover:text-brand-crimson"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm9-6a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1ZM4 12a1 1 0 0 1-1 1H2a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm14.657 6.657a1 1 0 0 1-1.414 0l-.707-.707a1 1 0 0 1 1.414-1.414l.707.707a1 1 0 0 1 0 1.414ZM7.464 7.464a1 1 0 0 1-1.414 0l-.707-.707A1 1 0 0 1 6.757 5.34l.707.707a1 1 0 0 1 0 1.414ZM18.657 5.343a1 1 0 0 1 0 1.414l-.707.707A1 1 0 1 1 16.536 6.05l.707-.707a1 1 0 0 1 1.414 0ZM7.464 16.536a1 1 0 0 1 0 1.414l-.707.707a1 1 0 1 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 0ZM12 20a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M20.354 15.354A9 9 0 0 1 8.646 3.646a9.003 9.003 0 1 0 11.708 11.708Z" />
        </svg>
      )}
    </button>
  );
}

export function ThemeInitScript() {
  const script = `(function(){try{var t=localStorage.getItem('gridgrader-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
