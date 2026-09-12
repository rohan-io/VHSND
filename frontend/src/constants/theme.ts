// Design tokens. Two full palettes (light / dark) sharing one semantic key set,
// so screens read `t.colors.<name>` and never branch on scheme themselves.
//
// Brand: deep brick-red / maroon + deep leaf green. Deliberately distinct from
// any political party palette. Separation from the amber "due" status and "HIGH"
// severity orange is carried by the brand being a dark, low-hue red against
// those vivid oranges — status colors themselves are left untouched.
// Dark mode surfaces are true-neutral near-black (NOT brand-tinted); the brand
// hue appears only on accents (icons, buttons, badges) and status colors.
// Status colors are unchanged from the pre-existing set:
//   teal  = neutral / informational
//   amber = due / upcoming
//   red   = overdue / high risk
//   green = done / healthy
//
// Ramps use 50/100/200/400/600/800/900 stops. 600 is the primary action stop,
// 800 is the text-on-tint stop, 900 is max-contrast (headings on the 50 tint).

type Ramp = Record<50 | 100 | 200 | 400 | 600 | 800 | 900, string>;

interface ThemeColors {
  orange: Ramp;
  green: Ramp;

  brand: string;
  brandPrimary: string;
  brandDark: string;
  brandLight: string;
  brandText: string;
  brandSecondary: string;
  brandSecondaryDark: string;
  brandSecondaryLight: string;
  brandSecondaryText: string;

  onBrand: string;
  onStatus: string;
  onWarning: string;

  surface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  surfaceInverse: string;
  inkBar: string;
  onInkBar: string;
  onInkBarMuted: string;
  // prominent "hero" strip on the dashboard — dark in both themes
  heroPanel: string;
  onHeroPanel: string;
  onHeroPanelMuted: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  success: string;
  successLight: string;
  successText: string; // status text/icon on the *Light tint
  successBorder: string;
  warning: string;
  warningLight: string;
  warningText: string;
  warningBorder: string;
  error: string;
  errorLight: string;
  errorText: string;
  errorBorder: string;
  info: string;
  infoLight: string;
  infoText: string;
  infoBorder: string;

  border: string;
  borderStrong: string;
  divider: string;

  // gender coding on child records (avatar tint + icon)
  femaleTint: string;
  onFemaleTint: string;
  maleTint: string;
  onMaleTint: string;
}

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export interface Theme {
  name: "light" | "dark";
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
}

// --- light ramps -----------------------------------------------------------
// "orange" keeps its key name but the values are a deep brick-red / maroon (hue ~9°),
// held clear of the amber "due" (~38°) and "HIGH" severity orange (~21°).
const orange: Ramp = {
  50: "#FBF0EC",
  100: "#F6D8CE",
  200: "#EAB0A0",
  400: "#D06E54",
  600: "#B23F2E", // primary — white text ≈ 5.7:1
  800: "#7E2C1E", // on tint — on brick-100 ≈ 7:1
  900: "#4F1B12",
};

const green: Ramp = {
  50: "#E9F5EE",
  100: "#C6E7D3",
  200: "#96CDAC",
  400: "#3FA46E",
  600: "#1B7A4A", // secondary — white text ≈ 5.4:1
  800: "#0F5233",
  900: "#0A3A24",
};

// --- dark ramps: hue held, chroma pulled back, lifted toward the mid-light
//     stops so brand reads as text/icons on charcoal (CDS dark convention).
const orangeDark: Ramp = {
  50: "#2A1712",
  100: "#331D17",
  200: "#5C332A",
  400: "#BC5C46",
  600: "#E8917B", // brand as coral-red text/icon on dark ≈ 7.8:1
  800: "#F0AD9B",
  900: "#F8CFC4",
};

const greenDark: Ramp = {
  50: "#12241A",
  100: "#15311F",
  200: "#1F5236",
  400: "#2E8B5B",
  600: "#4FB587", // secondary as text/icon on dark ≈ 6:1
  800: "#7FCDA6",
  900: "#B4E4CC",
};

const lightTheme: Theme = {
  name: "light",
  colors: {
    orange,
    green,

    brand: orange[600],
    brandPrimary: orange[600],
    brandDark: orange[800],
    brandLight: orange[100],
    brandText: orange[600], // brand used as a text/icon color
    brandSecondary: green[600],
    brandSecondaryDark: green[800],
    brandSecondaryLight: green[100],
    brandSecondaryText: green[600],

    onBrand: "#FFFFFF", // text/icon on a filled brand swatch
    onStatus: "#FFFFFF", // text/icon on red / green / teal fills
    onWarning: "#7A3E00", // amber fill needs dark text — white on amber fails AA

    surface: "#F8FAFC",
    surfaceSecondary: "#FFFFFF",
    surfaceTertiary: "#F1F5F9",
    surfaceInverse: "#0F172A",
    inkBar: "#0F172A", // always-dark government chrome strip
    onInkBar: "#E2E8F0",
    onInkBarMuted: "#94A3B8",
    heroPanel: "#0F172A",
    onHeroPanel: "#FFFFFF",
    onHeroPanelMuted: "#CBD5E1",

    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
    textInverse: "#F8FAFC",

    success: "#10B981",
    successLight: "#D1FAE5",
    successText: "#065F46",
    successBorder: "#A7F3D0",
    warning: "#F59E0B",
    warningLight: "#FEF3C7",
    warningText: "#92400E",
    warningBorder: "#FDE68A",
    error: "#EF4444",
    errorLight: "#FEE2E2",
    errorText: "#991B1B",
    errorBorder: "#FECACA",
    info: "#0D9488", // neutral / informational — teal, held apart from "done" green
    infoLight: "#CCFBF1",
    infoText: "#115E59",
    infoBorder: "#99F6E4",

    border: "#E2E8F0",
    borderStrong: "#CBD5E1",
    divider: "#F1F5F9",

    femaleTint: "#FCE7F3",
    onFemaleTint: "#BE185D",
    maleTint: "#DBEAFE",
    onMaleTint: "#1D4ED8",
  },
  spacing,
  radius,
};

const darkTheme: Theme = {
  name: "dark",
  colors: {
    orange: orangeDark,
    green: greenDark,

    brand: orangeDark[600],
    brandPrimary: orangeDark[600],
    brandDark: orangeDark[800],
    brandLight: orangeDark[100],
    brandText: orangeDark[600],
    brandSecondary: greenDark[600],
    brandSecondaryDark: greenDark[800],
    brandSecondaryLight: greenDark[100],
    brandSecondaryText: greenDark[600],

    onBrand: "#1A1A1A", // dark label for text on the lifted brand fill
    onStatus: "#121212",
    onWarning: "#1A1A1A",

    surface: "#0F0F0F", // true-neutral near-black — no brand tint
    surfaceSecondary: "#1A1A1A", // raised card — reads clearly lighter than surface
    surfaceTertiary: "#262626", // inputs / icon buttons
    surfaceInverse: "#F8FAFC",
    inkBar: "#000000",
    onInkBar: "#C7C7C7",
    onInkBarMuted: "#8A8A8A",
    heroPanel: "#1F1F1F", // raised neutral panel — distinct from surface + cards
    onHeroPanel: "#F5F5F5",
    onHeroPanelMuted: "#B3B3B3",

    textPrimary: "#F5F5F5",
    textSecondary: "#C2C2C2", // ≈ 12:1 on surface
    textMuted: "#8C8C8C", // ≈ 6:1 on surface
    textInverse: "#0F0F0F",

    success: "#3FD98C", // ≈ 8:1 on surface; brighter/yellower than brandSecondary
    successLight: "#10321F",
    successText: "#7EE8B0",
    successBorder: "#1E5B3B",
    warning: "#F2B84A", // held yellow, apart from the brick-red brand
    warningLight: "#3A2A12",
    warningText: "#F4C77A",
    warningBorder: "#6B4E1E",
    error: "#F98A8A",
    errorLight: "#3A1E1E",
    errorText: "#F4A6A6",
    errorBorder: "#6E3232",
    info: "#2DD4BF", // teal
    infoLight: "#0C3A37",
    infoText: "#5EEAD4",
    infoBorder: "#215F59",

    border: "#333333",
    borderStrong: "#474747",
    divider: "#222222",

    femaleTint: "#3A2230",
    onFemaleTint: "#F9A8D4",
    maleTint: "#1E2A44",
    onMaleTint: "#93C5FD",
  },
  spacing,
  radius,
};

export { lightTheme, darkTheme };
