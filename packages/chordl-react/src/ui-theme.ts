import { createContext, useContext } from "react";
import type { UIThemeMode, UIThemeTokens } from "./config";
import { DEFAULT_UI_THEME, getUIThemeTokens } from "./config";

export interface UIThemeContext {
  mode: UIThemeMode;
  tokens: UIThemeTokens;
}

const ThemeCtx = createContext<UIThemeContext>({
  mode: DEFAULT_UI_THEME,
  tokens: getUIThemeTokens(DEFAULT_UI_THEME),
});

export const UIThemeProvider = ThemeCtx.Provider;

export function useUITheme(): UIThemeContext {
  return useContext(ThemeCtx);
}

export function resolveUITheme(uiTheme?: UIThemeMode): UIThemeContext {
  const mode = uiTheme ?? DEFAULT_UI_THEME;
  return { mode, tokens: getUIThemeTokens(mode) };
}
