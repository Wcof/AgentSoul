import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  createDesktopCompanionController,
  loadCompanionRuntimeSnapshot,
  defaultCompanionSnapshot,
} from "./main";

export function App() {
  const { i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<any>(null);
  const snapshotRef = useRef<any>(defaultCompanionSnapshot);

  useEffect(() => {
    let active = true;

    async function initController() {
      if (!containerRef.current) return;
      const initialSnapshot = await loadCompanionRuntimeSnapshot();
      if (!active) return;

      snapshotRef.current = initialSnapshot;

      controllerRef.current = createDesktopCompanionController({
        target: containerRef.current,
        initialSnapshot,
        async performInteraction(kind) {
          const energy = snapshotRef.current.companion.vitals.companionEnergy;
          const outcome = (kind === "play" && energy < 20) ? "blocked-low-energy" : "applied";
          
          let nextState = { ...snapshotRef.current };
          if (outcome === "applied") {
            const currentXp = snapshotRef.current.companion.vitals.xp;
            const currentEnergy = snapshotRef.current.companion.vitals.companionEnergy;
            const currentHunger = snapshotRef.current.companion.vitals.hunger;
            
            let xpDelta = 10;
            let energyDelta = -10;
            let hungerDelta = 10;

            if (kind === "sleep") {
              xpDelta = 0;
              energyDelta = 40;
              hungerDelta = 5;
            }

            nextState = {
              ...snapshotRef.current,
              companion: {
                ...snapshotRef.current.companion,
                vitals: {
                  ...snapshotRef.current.companion.vitals,
                  xp: currentXp + xpDelta,
                  companionEnergy: Math.min(100, Math.max(0, currentEnergy + energyDelta)),
                  hunger: Math.min(100, Math.max(0, currentHunger + hungerDelta)),
                }
              }
            };
          }

          snapshotRef.current = nextState;
          return { outcome, state: nextState };
        },
      });
    }

    void initController();

    return () => {
      active = false;
    };
  }, []);

  // When i18n language changes, force the controller to re-render the view
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.render(snapshotRef.current);
    }
  }, [i18n.language]);

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
