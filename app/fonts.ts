import { Bebas_Neue, Halant, Nunito_Sans, Telex } from "next/font/google";

export const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-logo",
  display: "swap",
});

export const halant = Halant({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

export const telex = Telex({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-ui",
  display: "swap",
});

export const fontVariables = [
  bebasNeue.variable,
  halant.variable,
  nunitoSans.variable,
  telex.variable,
].join(" ");
