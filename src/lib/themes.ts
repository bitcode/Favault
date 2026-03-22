export type ThemeMode = 'light' | 'dark';

export type ThemeId =
  | 'ayu-dark-mode'
  | 'ayu-light-mode'
  | 'gruvbox-dark'
  | 'gruvbox-light'
  | 'jm-dark'
  | 'jm-light';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  mode: ThemeMode;
  colors: {
    bgStart: string;
    bgEnd: string;
    bgAccent: string;
    bgAccentSoft: string;
    panel: string;
    panelSolid: string;
    panelMuted: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    borderStrong: string;
    accent: string;
    accentHover: string;
    accentContrast: string;
    success: string;
    danger: string;
    inputBg: string;
    inputText: string;
    inputPlaceholder: string;
    overlay: string;
    shadow: string;
  };
}

export const themes: ThemeDefinition[] = [
  {
    id: 'ayu-dark-mode',
    name: 'ayu dark mode',
    mode: 'dark',
    colors: {
      bgStart: '#0F1419',
      bgEnd: '#14191F',
      bgAccent: '#36A3D9',
      bgAccentSoft: '#FF7733',
      panel: 'rgba(20, 25, 31, 0.88)',
      panelSolid: '#14191F',
      panelMuted: 'rgba(37, 51, 64, 0.72)',
      textPrimary: '#E6E1CF',
      textSecondary: '#B8CC52',
      textMuted: '#5C6773',
      border: 'rgba(92, 103, 115, 0.45)',
      borderStrong: 'rgba(242, 151, 24, 0.75)',
      accent: '#F29718',
      accentHover: '#FFB454',
      accentContrast: '#0F1419',
      success: '#95E6CB',
      danger: '#FF3333',
      inputBg: 'rgba(37, 51, 64, 0.8)',
      inputText: '#E6E1CF',
      inputPlaceholder: '#5C6773',
      overlay: 'rgba(7, 10, 13, 0.62)',
      shadow: 'rgba(0, 0, 0, 0.35)',
    },
  },
  {
    id: 'ayu-light-mode',
    name: 'ayu light mode',
    mode: 'light',
    colors: {
      bgStart: '#FAFAFA',
      bgEnd: '#F0EEE4',
      bgAccent: '#36A3D9',
      bgAccentSoft: '#FF6A00',
      panel: 'rgba(255, 255, 255, 0.9)',
      panelSolid: '#FFFFFF',
      panelMuted: 'rgba(240, 238, 228, 0.88)',
      textPrimary: '#5C6773',
      textSecondary: '#86B300',
      textMuted: '#828C99',
      border: 'rgba(171, 176, 182, 0.45)',
      borderStrong: 'rgba(255, 106, 0, 0.65)',
      accent: '#FF6A00',
      accentHover: '#F29718',
      accentContrast: '#FFFFFF',
      success: '#4CBF99',
      danger: '#FF3333',
      inputBg: 'rgba(255, 255, 255, 0.94)',
      inputText: '#5C6773',
      inputPlaceholder: '#ABB0B6',
      overlay: 'rgba(92, 103, 115, 0.24)',
      shadow: 'rgba(92, 103, 115, 0.16)',
    },
  },
  {
    id: 'gruvbox-dark',
    name: 'gruvbox dark',
    mode: 'dark',
    colors: {
      bgStart: '#1d2021',
      bgEnd: '#282828',
      bgAccent: '#458588',
      bgAccentSoft: '#d3869b',
      panel: 'rgba(50, 48, 47, 0.9)',
      panelSolid: '#32302f',
      panelMuted: 'rgba(60, 56, 54, 0.86)',
      textPrimary: '#fbf1c7',
      textSecondary: '#ebdbb2',
      textMuted: '#a89984',
      border: 'rgba(124, 111, 100, 0.55)',
      borderStrong: 'rgba(250, 189, 47, 0.78)',
      accent: '#fabd2f',
      accentHover: '#fe8019',
      accentContrast: '#1d2021',
      success: '#8ec07c',
      danger: '#fb4934',
      inputBg: 'rgba(60, 56, 54, 0.86)',
      inputText: '#fbf1c7',
      inputPlaceholder: '#928374',
      overlay: 'rgba(0, 0, 0, 0.55)',
      shadow: 'rgba(0, 0, 0, 0.32)',
    },
  },
  {
    id: 'gruvbox-light',
    name: 'gruvbox light',
    mode: 'light',
    colors: {
      bgStart: '#f9f5d7',
      bgEnd: '#fbf1c7',
      bgAccent: '#458588',
      bgAccentSoft: '#d65d0e',
      panel: 'rgba(253, 244, 193, 0.9)',
      panelSolid: '#fbf1c7',
      panelMuted: 'rgba(242, 229, 188, 0.88)',
      textPrimary: '#282828',
      textSecondary: '#3c3836',
      textMuted: '#7c6f64',
      border: 'rgba(168, 153, 132, 0.6)',
      borderStrong: 'rgba(215, 153, 33, 0.7)',
      accent: '#d79921',
      accentHover: '#d65d0e',
      accentContrast: '#fbf1c7',
      success: '#689d6a',
      danger: '#cc241d',
      inputBg: 'rgba(249, 245, 215, 0.95)',
      inputText: '#282828',
      inputPlaceholder: '#928374',
      overlay: 'rgba(40, 40, 40, 0.14)',
      shadow: 'rgba(124, 111, 100, 0.18)',
    },
  },
  {
    id: 'jm-dark',
    name: 'JM Dark',
    mode: 'dark',
    colors: {
      bgStart: '#05254E',   // Navy — JM primary
      bgEnd: '#020D1C',     // Deep navy for gradient depth
      bgAccent: '#468FCD',  // Blue — JM secondary
      bgAccentSoft: '#D22C7C', // Cranberry — JM secondary
      panel: 'rgba(5, 37, 78, 0.9)',
      panelSolid: '#0A2D56',
      panelMuted: 'rgba(70, 143, 205, 0.15)',
      textPrimary: '#FFFFFF',
      textSecondary: '#F1F5F9',  // Grey 20
      textMuted: '#CBD5E1',       // Steel
      border: 'rgba(226, 232, 240, 0.22)',   // Grey 30 base
      borderStrong: 'rgba(70, 143, 205, 0.62)',
      accent: '#468FCD',     // Blue
      accentHover: '#D22C7C', // Cranberry
      accentContrast: '#FFFFFF',
      success: '#468FCD',
      danger: '#D22C7C',
      inputBg: 'rgba(10, 45, 86, 0.82)',
      inputText: '#FFFFFF',
      inputPlaceholder: '#94A3B8',  // Grey 50
      overlay: 'rgba(2, 9, 18, 0.68)',
      shadow: 'rgba(1, 7, 16, 0.38)',
    },
  },
  {
    id: 'jm-light',
    name: 'JM Light',
    mode: 'light',
    colors: {
      bgStart: '#F8FAFC',  // Grey 10
      bgEnd: '#F1F5F9',    // Grey 20
      bgAccent: '#468FCD', // Blue — JM secondary
      bgAccentSoft: '#D22C7C', // Cranberry — JM secondary
      panel: 'rgba(255, 255, 255, 0.92)',
      panelSolid: '#FFFFFF',
      panelMuted: 'rgba(241, 245, 249, 0.96)',  // Grey 20 base
      textPrimary: '#05254E',   // Navy — JM primary
      textSecondary: '#468FCD', // Blue — JM secondary
      textMuted: '#94A3B8',     // Grey 50
      border: 'rgba(226, 232, 240, 0.95)',      // Grey 30
      borderStrong: 'rgba(5, 37, 78, 0.25)',    // Navy
      accent: '#05254E',     // Navy
      accentHover: '#468FCD', // Blue
      accentContrast: '#FFFFFF',
      success: '#468FCD',
      danger: '#D22C7C',     // Cranberry
      inputBg: 'rgba(248, 250, 252, 0.96)',  // Grey 10 base
      inputText: '#05254E',
      inputPlaceholder: '#94A3B8',  // Grey 50
      overlay: 'rgba(5, 37, 78, 0.1)',
      shadow: 'rgba(5, 37, 78, 0.1)',
    },
  },
];

export const themeMap = new Map<ThemeId, ThemeDefinition>(
  themes.map((theme) => [theme.id, theme]),
);

export function resolveThemeId(themeId: string | null | undefined): ThemeId {
  if (themeId && themeMap.has(themeId as ThemeId)) {
    return themeId as ThemeId;
  }

  if (themeId === 'dark') {
    return 'ayu-dark-mode';
  }

  return 'ayu-light-mode';
}

export function getTheme(themeId: string | null | undefined): ThemeDefinition {
  return themeMap.get(resolveThemeId(themeId)) ?? themes[0];
}

export function getThemeStyle(theme: ThemeDefinition): string {
  const vars = [
    ['--theme-bg-start', theme.colors.bgStart],
    ['--theme-bg-end', theme.colors.bgEnd],
    ['--theme-bg-accent', theme.colors.bgAccent],
    ['--theme-bg-accent-soft', theme.colors.bgAccentSoft],
    ['--theme-panel', theme.colors.panel],
    ['--theme-panel-solid', theme.colors.panelSolid],
    ['--theme-panel-muted', theme.colors.panelMuted],
    ['--theme-text-primary', theme.colors.textPrimary],
    ['--theme-text-secondary', theme.colors.textSecondary],
    ['--theme-text-muted', theme.colors.textMuted],
    ['--theme-border', theme.colors.border],
    ['--theme-border-strong', theme.colors.borderStrong],
    ['--theme-accent', theme.colors.accent],
    ['--theme-accent-hover', theme.colors.accentHover],
    ['--theme-accent-contrast', theme.colors.accentContrast],
    ['--theme-success', theme.colors.success],
    ['--theme-danger', theme.colors.danger],
    ['--theme-input-bg', theme.colors.inputBg],
    ['--theme-input-text', theme.colors.inputText],
    ['--theme-input-placeholder', theme.colors.inputPlaceholder],
    ['--theme-overlay', theme.colors.overlay],
    ['--theme-shadow', theme.colors.shadow],
  ];

  return vars.map(([name, value]) => `${name}: ${value}`).join('; ');
}
