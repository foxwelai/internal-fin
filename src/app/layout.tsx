import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/** Reserved for figures: tabular, unambiguous, and it makes columns line up. */
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-figures",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Foxwel Finance",
    template: "%s · Foxwel Finance",
  },
  description:
    "Internal financial command centre for foxwel.ai — collections, client projects, payment schedules and monthly expenses.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        {/* Inside <body>, as Clerk requires. The shadcn theme reads this app's
            own design tokens, so Clerk's screens share the dark palette. */}
        <ClerkProvider
          appearance={{ theme: shadcn }}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/overview"
          signUpFallbackRedirectUrl="/overview"
          afterSignOutUrl="/sign-in"
        >
          {children}
        <Toaster
          position="bottom-right"
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "!bg-[var(--elevated)] !border-[var(--border-strong)] !text-[var(--foreground)] !rounded-lg !font-sans",
              description: "!text-[var(--muted-foreground)]",
              actionButton: "!bg-[var(--brand)] !text-white",
              error: "!border-[var(--negative)]/40",
              success: "!border-[var(--positive)]/40",
            },
          }}
        />
        </ClerkProvider>
      </body>
    </html>
  );
}
