import { Anton, Figtree, Michroma, Space_Mono } from "next/font/google";

export const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

/** 400 prose, 500 captions, 700 body-strong and names, 800 titles. */
export const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
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

/** Only the "Omega Hub" wordmark beside the mark in the nav. */
export const michroma = Michroma({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-michroma",
  display: "swap",
});

export const FONTS_VARIABLES = [
  anton.variable,
  figtree.variable,
  spaceMono.variable,
  michroma.variable,
].join(" ");
