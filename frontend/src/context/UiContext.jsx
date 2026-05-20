import { createContext, useContext, useEffect, useMemo, useState } from "react";

const UiContext = createContext(undefined);

export function UiProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("airsense_theme") || "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("airsense_theme", theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside UiProvider");
  return ctx;
}
