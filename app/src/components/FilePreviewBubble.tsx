"use client";

import { Paperclip } from "lucide-react";

type FilePreviewBubbleProps = {
  fileName: string;
  fileType?: string;
  fileSize?: string;
  isUser: boolean;
};

export default function FilePreviewBubble({
  fileName,
  fileType,
  fileSize,
  isUser,
}: FilePreviewBubbleProps) {
  return (
    <div
      className={`flex items-center gap-3 mt-2 px-3 py-2 
    rounded-xl shadow-sm border animate-fileIn max-w-[85%] sm:max-w-[75%]
    ${isUser ? "bg-sky-100 ml-auto" : "bg-slate-100 mr-auto"}
  `}
    >
      <Paperclip className="w-4 h-4 text-slate-600" />

      <div className="flex flex-col">
        <span className="text-sm font-medium text-slate-800">{fileName}</span>

        {(fileType || fileSize) && (
          <span className="text-xs text-slate-500">
            {fileType} {fileSize ? `• ${fileSize}` : ""}
          </span>
        )}
      </div>

      <style>{`
        @keyframes fileIn {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fileIn {
          animation: fileIn 0.25s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
