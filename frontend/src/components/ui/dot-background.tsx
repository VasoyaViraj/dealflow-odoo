import { cn } from "@/lib/utils";
import React from "react";
import { FileSignature, BadgeDollarSign, GitMerge, PackageOpen, ArrowRightLeft, FileCheck } from "lucide-react";

export default function DotBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      {/* Fixed Background */}
      <div className="fixed inset-0 z-0 bg-canvas">
        <div
          className={cn(
            "absolute inset-0 opacity-40",
            "[background-size:20px_20px]",
            "[background-image:radial-gradient(var(--color-line-strong)_1px,transparent_1px)]"
          )}
        />
        
        {/* Floating Background Icons (DealFlow Theme) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.08]">
           {/* Top section */}
           <FileSignature size={48} className="absolute top-[12%] left-[10%] animate-[df-float_12s_ease-in-out_infinite] rotate-12 text-ink" strokeWidth={1.5} />
           <GitMerge size={54} className="absolute top-[25%] right-[15%] animate-[df-float_15s_ease-in-out_infinite_2s] -rotate-12 text-ink" strokeWidth={1.5} />
           
           {/* Middle section */}
           <BadgeDollarSign size={64} className="absolute top-[45%] left-[20%] animate-[df-float_14s_ease-in-out_infinite_4s] rotate-6 text-ink" strokeWidth={1.5} />
           <PackageOpen size={48} className="absolute top-[55%] right-[25%] animate-[df-float_11s_ease-in-out_infinite_1s] -rotate-6 text-ink" strokeWidth={1.5} />
           
           {/* Bottom section */}
           <ArrowRightLeft size={52} className="absolute bottom-[30%] left-[15%] animate-[df-float_16s_ease-in-out_infinite_3s] rotate-[15deg] text-ink" strokeWidth={1.5} />
           <FileCheck size={60} className="absolute bottom-[15%] right-[18%] animate-[df-float_13s_ease-in-out_infinite_5s] -rotate-6 text-ink" strokeWidth={1.5} />
        </div>

        <div className="pointer-events-none absolute inset-0 bg-canvas [mask-image:radial-gradient(ellipse_at_top,transparent_60%,black)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}
