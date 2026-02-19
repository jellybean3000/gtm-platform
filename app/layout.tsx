import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "GTM Platform",
  description: "Multi-Agent Go-To-Market Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#10B981",
          colorBackground: "#09090B",
          colorInputBackground: "#18181B",
          colorInputText: "#FAFAFA",
        },
      }}
    >
      <html lang="en">
        <body className="font-display antialiased">
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#18181B",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#FAFAFA",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
