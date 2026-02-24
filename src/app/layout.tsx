import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FiniTax — Contabilidad Inteligente para El Salvador",
  description:
    "Sistema unificado de contabilidad, facturación electrónica DTE, nómina y declaración de impuestos para empresas salvadoreñas.",
  keywords: [
    "contabilidad",
    "El Salvador",
    "DTE",
    "factura electrónica",
    "impuestos",
    "F-07",
    "Hacienda",
    "nómina",
    "IVA",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
