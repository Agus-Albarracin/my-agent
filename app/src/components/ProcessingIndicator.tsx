"use client";

import { Badge } from "@/components/ui/badge";

export default function ProcessingIndicator() {
  return (
    <div className="flex justify-center w-full pt-2 animate-in fade-in slide-in-from-bottom-1">
      <Badge
        variant="secondary"
        className="
          flex items-center gap-2 px-2 py-1 
          rounded-lg 
          bg-transparent 
          border-none shadow-none 
          text-slate-700
        "
      >
        <span className="h-2 w-2 rounded-full bg-sky-500 animate-strong-pulse inline-block"></span>

        <span className="text-xs">El modelo está procesando la respuesta…</span>
      </Badge>

      <style jsx>{`
        @keyframes strongPulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.8);
            opacity: 0.4;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-strong-pulse {
          animation: strongPulse 0.8s ease-in-out infinite;
        }

        .animate-in {
          animation-duration: 0.35s;
          animation-fill-mode: both;
        }

        .slide-in-from-bottom-1 {
          transform: translateY(6px);
          animation-name: slideIn;
        }

        @keyframes slideIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
