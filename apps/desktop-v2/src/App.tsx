import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { renderAgentSoulShell } from "./main";

export function App() {
  const { i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      renderAgentSoulShell(containerRef.current);
    }
  }, []);

  const toggleLocale = () => {
    const newLocale = i18n.language === "zh" ? "en" : "zh";
    i18n.changeLanguage(newLocale);
  };

  return (
    <div className="app">
      <div className="locale-switcher">
        <button onClick={toggleLocale}>
          {i18n.language === "zh" ? "English" : "中文"}
        </button>
      </div>
      <div ref={containerRef} className="control-center-root" />
    </div>
  );
}
