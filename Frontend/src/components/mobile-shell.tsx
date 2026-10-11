/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { DesktopHeader } from "./desktop-header";

export function MobileShell({
  children,
  hideNav = false,
}: {
  children: ReactNode;
  hideNav?: boolean;
}) {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background text-foreground antialiased selection:bg-primary/25 selection:text-primary">
      {/* Sleek Desktop Navigation Header */}
      {!hideNav && <DesktopHeader />}

      {/* Main Content Viewport */}
      <main className={hideNav ? "flex-1 flex flex-col min-h-0" : "flex-1 flex flex-col min-h-0 pb-20 md:pb-0"}>
        {children}
      </main>

      {/* Floating Mobile Dock */}
      {!hideNav && <BottomNav />}
    </div>
  );
}
