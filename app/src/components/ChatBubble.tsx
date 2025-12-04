"use client";

import FilePreviewBubble from "./FilePreviewBubble";

type ChatBubbleProps = {
  role: string | "user" | "agent";
  text: string;
  loading?: boolean;
  files?: {
    fileName: string;
    fileType?: string;
    fileSize?: string;
  }[];
};

export default function ChatBubble({ role, text, loading = false, files = [] }: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div className="flex flex-col w-full animate-fadeIn">
      {/* Burbuja */}
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`px-4 py-3 max-w-[80%] rounded-2xl text-sm shadow-md ${
            isUser
              ? "bg-sky-500 text-white rounded-br-none"
              : "bg-white/80 text-slate-800 border border-white/60 rounded-bl-none"
          }`}
        >
          {loading ? (
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce delay-150" />
              <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce delay-300" />
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{text}</div>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
          {files.map((f, i) => (
            <FilePreviewBubble
              key={i}
              fileName={f.fileName}
              fileType={f.fileType}
              fileSize={f.fileSize}
              isUser={isUser}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
