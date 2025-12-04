"use client";

import { useState, useEffect, useRef } from "react";
import ChatBubble from "@/app/src/components/ChatBubble";
import ChatInput from "@/app/src/components/ChatInput";
import ProcessingIndicator from "./src/components/ProcessingIndicator";

type Message = {
  role: "user" | "agent";
  content: string;
  files?: {
    fileName: string;
    fileType?: string;
    fileSize?: string;
  }[];
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "agent", content: "Hola 👋 ¿Cómo estás hoy?" },
  ]);

  const [processingSlow, setProcessingSlow] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ======================================================
  // ⬆️ Enviar mensaje
  // ======================================================
  const sendMessage = async (text: string, files: File[]) => {
    setLoading(true);
    setProcessingSlow(false);

    const slowTimer = setTimeout(() => {
      setProcessingSlow(true);
    }, 4000);

    // ============================
    // 1) Renderizar mensaje del usuario
    // ============================
    if (text.trim() && files.length === 0) {
      setMessages((m) => [...m, { role: "user", content: text }]);
    } else if (files.length > 0) {
      setMessages((m) => [
        ...m,
        {
          role: "user",
          content: text || "📎 Envié archivos",
          files: files.map((f) => ({
            fileName: f.name,
            fileType: f.type,
            fileSize: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
          })),
        },
      ]);
    }

    // ============================
    // 2) Subida de archivos
    // ============================
    const uploadedFiles: any[] = [];
    let uploadedFileCount = 0;

    if (files?.length) {
      for (const f of files) {
        const form = new FormData();
        form.append("file", f);
        form.append("title", f.name);
        form.append("metadata", JSON.stringify({ source: "chat-client" }));

        const res = await fetch("/api/documents", {
          method: "POST",
          body: form,
        });

        const data = await res.json();

        uploadedFiles.push({
          documentId: data.documentId,
          openaiFileId: data.openaiFileId,
          fileName: f.name,
        });

        uploadedFileCount++;
      }
    }

    const stopWaiting = () => {
      clearTimeout(slowTimer);
      setProcessingSlow(false);
      setLoading(false);
    };

    // ============================
    // 3) Lógica de orquestación:
    // ============================

    // Solo archivos
    if (uploadedFileCount > 0 && !text.trim()) {
      stopWaiting();
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          content: `📄 Se guardaron ${uploadedFileCount} archivo(s) correctamente.`,
        },
      ]);
      return;
    }

    // Helper que crea el streaming reader
    const streamResponse = async (res: Response) => {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = "";

      // Nueva burbuja del asistente vacía
      setMessages((m) => [...m, { role: "agent", content: "" }]);

      while (true) {
        const { value, done } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        full += chunk;

        // Actualiza la última burbuja
        setMessages((m) => {
          const updated = [...m];
          const lastIndex = updated.length - 1;
          updated[lastIndex] = { ...updated[lastIndex], content: full };
          return updated;
        });
      }

      stopWaiting();
    };

    // Solo texto
    if (uploadedFileCount === 0 && text.trim()) {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });

      await streamResponse(res);
      return;
    }

    // Texto + archivos
    if (uploadedFileCount > 0 && text.trim()) {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, uploadedFiles }),
      });

      await streamResponse(res);
      return;
    }
  };

  const newChat = () => {
    setMessages([{ role: "agent", content: "Nuevo chat iniciado ✨" }]);
  };

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, processingSlow]);

  return (
    <main
      className="min-h-screen w-full px-4 pt-6 flex flex-col"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, #A7DBF5 0%, #A7DBF5 90%, #FFB6C1 100%)",
      }}
    >
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col space-y-4 pb-40">
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} text={msg.content} files={msg.files} />
        ))}

        {loading && <ChatBubble role="agent" text="" loading />}

        {processingSlow && <ProcessingIndicator />}

        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-6 left-0 right-0 flex justify-center pointer-events-none">
        <div className="w-full max-w-3xl px-4 pointer-events-auto">
          <ChatInput onSend={sendMessage} onNewChat={newChat} disabled={loading} />
        </div>
      </div>
    </main>
  );
}
