import { Anton, Figtree, Space_Mono } from "next/font/google";

export const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

/** 400 prose, 700 body-strong and roster names. */
export const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-figtree",
  display: "swap",
});

/** 400 signal and data, 700 chips, tabs and counts. */
export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const FONTS_VARIABLES = [
  anton.variable,
  figtree.variable,
  spaceMono.variable,
].join(" ");
