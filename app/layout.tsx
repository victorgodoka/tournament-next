import type { Metadata } from "next";
import { Providers } from "./providers";
import '@assets/design.system.css'

export const metadata: Metadata = {
  title: "YGO Omega",
  description: "The competitive hub for tournaments, player rankings, and powerful tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
