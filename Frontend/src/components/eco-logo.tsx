/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { cn } from "@/lib/utils";

export function EcoLogo({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <img
      src="/Logo.png"
      alt="Ecolens Logo"
      className={cn("object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
