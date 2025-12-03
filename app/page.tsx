"use client";
import { useState, useEffect, useRef } from "react";
import ChatBubble from "@/app/src/components/ChatBubble";
import ChatInput from "@/app/src/components/ChatInput";

export default function Home() {
  const [messages, setMessages] = useState([
    { role: "agent", content: "Hola 👋 ¿Cómo estás hoy?" },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sendMessage = async (text: string) => {
    const userMsg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: text }),
    });

    const data = await res.json();
    console.log("Mostramos lo que llega en data", data);
    const agentMsg = { role: "agent", content: data.answer || "Hubo un problema al intentar dar respuesta, intentalo nuevamente..." };

    setMessages((m) => [...m, agentMsg]);
    setLoading(false);
  };

  const newChat = () => {
    setMessages([{ role: "agent", content: "Nuevo chat iniciado ✨" }]);
  };

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <main
      className="min-h-screen w-full px-4 pt-6 flex flex-col"
      style={{
        backgroundImage: "linear-gradient(to bottom, #A7DBF5 0%, #A7DBF5 90%, #FFB6C1 100%)",
      }}
    >
      {/* CONTENEDOR SCROLLEABLE (todo el cuerpo de la página) */}
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col space-y-4 pb-40">
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} text={msg.content} />
        ))}

        {loading && <ChatBubble role="agent" text="Espera un segundo…" loading />}

        <div ref={bottomRef} />
      </div>

      {/* INPUT STICKY — NO TAPA MENSAJES */}
      <div className="sticky bottom-6 left-0 right-0 flex justify-center pointer-events-none">
        <div className="w-full max-w-3xl px-4 pointer-events-auto">
          <ChatInput onSend={sendMessage} onNewChat={newChat} disabled={loading} />
        </div>
      </div>
    </main>
  );
}
