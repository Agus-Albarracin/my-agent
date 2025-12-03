"use client";
import { useState, useRef, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";

type ChatInputProps = {
  onSend: (text: string) => void;
  onNewChat: () => void;
  disabled?: boolean;
};

export default function ChatInput({ onSend, disabled, onNewChat }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  });

  const submit = () => {
    if (!value.trim()) return;
    onSend(value);
    setValue("");

    // 👉 Después de enviar, focus nuevamente
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  return (
    <div
      className="
        w-full
        bg-white/70 backdrop-blur-xl
        border border-white/60 
        shadow-2xl 
        rounded-3xl
        px-5 py-4
        flex items-center gap-4
      "
    >
      {/* Botón Nuevo Chat */}
      <button
        onClick={onNewChat}
        className="
          p-3 rounded-2xl
          bg-white/80 border 
          hover:bg-white 
          transition
          shadow-sm
        "
      >
        <Plus className="w-5 h-5 text-slate-700" />
      </button>

      {/* Input */}
      <input
        className="
          flex-1 px-4 py-3 rounded-2xl 
          bg-white/70 border border-white/90
          text-black
          placeholder-slate-500
          focus:outline-none focus:ring-4 focus:ring-sky-300
        "
        placeholder="Escribe un mensaje..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        disabled={disabled}
      />

      {/* Enviar */}
      <button
        onClick={submit}
        className="
          px-6 py-3 rounded-2xl 
          bg-gradient-to-r from-sky-500 to-pink-500 
          text-white font-semibold shadow-lg 
          disabled:opacity-50
        "
      >
        Enviar
      </button>
    </div>
  );
}
