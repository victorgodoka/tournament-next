import { Anton, Open_Sans, Space_Mono } from "next/font/google";

export const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const openSans = Open_Sans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-body",
  display: "swap",
});

export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mono",
  display: "swap",
});

export const FONTS_VARIABLES = [
  anton.variable,
  openSans.variable,
  spaceMono.variable,
].join(" ");
