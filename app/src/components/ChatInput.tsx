"use client";

import { useState, useRef } from "react";
import { Plus, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ChatInputProps = {
  onSend: (text: string, files: File[]) => void;
  onNewChat: () => void;
  disabled?: boolean;
};

export default function ChatInput({ onSend, disabled, onNewChat }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!value.trim() && files.length === 0) return;

    onSend(value, files);

    setValue("");
    setFiles([]);

    if (fileInputRef.current) fileInputRef.current.value = "";

    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const list = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...list]);
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  return (
    <div className="w-full flex flex-col gap-2">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-2">
          {files.map((file) => (
            <Badge
              key={file.name}
              variant="secondary"
              className="flex items-center gap-2 bg-white/60 border text-black"
            >
              {file.name}
              <button onClick={() => removeFile(file.name)}>
                <X className="w-4 h-4 hover:text-red-600" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="bg-white/70 rounded-3xl px-5 py-4 flex items-center gap-4">
        <button onClick={onNewChat}>
          <Plus className="w-5 h-5 text-slate-700" />
        </button>

        <button onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-5 h-5 text-slate-700" />
        </button>

        <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFiles} />

        <input
          className="flex-1 bg-transparent border-none outline-none"
          placeholder="Escribe un mensaje..."
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          ref={inputRef}
        />

        <button onClick={submit}>Enviar</button>
      </div>
    </div>
  );
}
