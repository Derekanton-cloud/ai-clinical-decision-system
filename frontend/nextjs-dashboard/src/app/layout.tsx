import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { PatientProvider } from "@/lib/patient-context";
import { AppShell } from "@/components/layout/AppShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Clinical Decision Support System",
  description: "AI-powered clinical decision support dashboard for healthcare professionals",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <PatientProvider>
            <AppShell>{children}</AppShell>
          </PatientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
