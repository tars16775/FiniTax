"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Send,
  Loader2,
  User,
  Sparkles,
  Trash2,
  RotateCcw,
  Receipt,
  Calculator,
  Scale,
  Briefcase,
  HelpCircle,
  ArrowUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  {
    icon: Receipt,
    label: "IVA",
    prompt:
      "Como funciona el credito fiscal IVA en El Salvador? Que gastos son deducibles?",
  },
  {
    icon: Calculator,
    label: "ISR Salarios",
    prompt:
      "Explica los tramos del ISR para salarios en El Salvador con un ejemplo para un salario de $1,500 mensuales.",
  },
  {
    icon: Scale,
    label: "ISSS y AFP",
    prompt:
      "Cuales son las tasas actuales de ISSS y AFP para empleado y patrono? Cual es el salario maximo cotizable?",
  },
  {
    icon: Briefcase,
    label: "Aguinaldo",
    prompt:
      "Como se calcula el aguinaldo en El Salvador? Cuantos dias corresponden segun la antiguedad del empleado?",
  },
  {
    icon: Receipt,
    label: "F-07",
    prompt:
      "Cual es la fecha limite para presentar el formulario F-07 y que pasa si lo presento tarde?",
  },
  {
    icon: HelpCircle,
    label: "Pago a Cuenta",
    prompt:
      "Que es el pago a cuenta (F-11) y como se calcula el 1.75%? Puedo acreditarlo contra el ISR anual?",
  },
];

/* ─── Markdown-like renderer ─── */

function renderContent(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    key++;
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={key} className="font-semibold text-sm mt-4 mb-1.5">
          {line.slice(4)}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={key} className="font-semibold text-base mt-4 mb-1.5">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={key} className="font-bold text-lg mt-4 mb-1.5">
          {line.slice(2)}
        </h2>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={key} className="ml-4 list-disc text-[13px] leading-relaxed">
          {renderInline(line.slice(2))}
        </li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={key} className="ml-4 list-decimal text-[13px] leading-relaxed">
          {renderInline(line.replace(/^\d+\.\s/, ""))}
        </li>
      );
    } else if (line.startsWith("```")) {
      elements.push(
        <code
          key={key}
          className="block rounded-lg bg-muted/80 px-3 py-2 text-xs font-mono my-2 whitespace-pre-wrap"
        >
          {line.replace(/^```\w*/, "")}
        </code>
      );
    } else if (line.startsWith("|")) {
      const cells = line
        .split("|")
        .filter((c) => c.trim() && !c.match(/^[\s-:]+$/));
      if (cells.length > 0 && !line.match(/^[\s|:-]+$/)) {
        elements.push(
          <div key={key} className="flex gap-4 text-xs font-mono py-0.5">
            {cells.map((c, i) => (
              <span key={i} className="flex-1">
                {c.trim()}
              </span>
            ))}
          </div>
        );
      }
    } else if (line.trim() === "") {
      elements.push(<div key={key} className="h-1.5" />);
    } else {
      elements.push(
        <p key={key} className="text-[13px] leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  }
  return elements;
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-muted/80 px-1.5 py-0.5 text-xs font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/* ─── Extract text from UIMessage ─── */

function getMessageText(message: {
  parts: Array<{ type: string; text?: string }>;
}): string {
  return message.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");
}

/* ─── Main ─── */

export default function AssistantPage() {
  const {
    messages,
    sendMessage,
    status,
    setMessages,
    error,
    regenerate,
    clearError,
  } = useChat();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) doSend(input);
    }
  }

  function doSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput("");
    sendMessage({ text: trimmed });
    if (inputRef.current) inputRef.current.style.height = "auto";
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSend(input);
  }

  function handleSuggestedPrompt(prompt: string) {
    doSend(prompt);
  }

  function clearChat() {
    setMessages([]);
    clearError();
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/50 mb-0 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Asistente IA</h1>
            <p className="text-xs text-muted-foreground">
              Legislacion tributaria y laboral de El Salvador
            </p>
          </div>
        </div>
        {hasMessages && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto min-h-0 py-6">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="relative mb-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-white" />
              </div>
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-1.5">
              En que puedo ayudarte?
            </h2>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-10 leading-relaxed">
              Soy tu asistente especializado en legislacion tributaria y laboral
              salvadorena. Preguntame lo que necesites.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-w-2xl w-full">
              {SUGGESTED_PROMPTS.map((sp, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedPrompt(sp.prompt)}
                  className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-sm"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                    <sp.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">
                      {sp.label}
                    </span>
                    <span className="text-xs leading-snug line-clamp-2 text-muted-foreground group-hover:text-foreground transition-colors">
                      {sp.prompt}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-4 max-w-3xl mx-auto">
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} className="animate-fade-in">
                  <div
                    className={cn(
                      "flex gap-3",
                      isUser ? "justify-end" : "justify-start"
                    )}
                  >
                    {!isUser && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mt-0.5">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 max-w-[80%] break-words",
                        isUser
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-card border border-border/60 shadow-sm rounded-bl-md"
                      )}
                    >
                      {isUser ? (
                        <p className="text-[13px] whitespace-pre-wrap leading-relaxed">
                          {getMessageText(message)}
                        </p>
                      ) : (
                        <div>{renderContent(getMessageText(message))}</div>
                      )}
                    </div>
                    {isUser && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading */}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3 justify-start animate-fade-in">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-card border border-border/60 shadow-sm">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs">Pensando...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex gap-3 justify-start animate-fade-in">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 max-w-[75%]">
                  <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                    Hubo un error al procesar tu consulta.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerate()}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Reintentar
                  </Button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-border/50 pt-4 pb-2">
        <form
          onSubmit={handleFormSubmit}
          className="relative max-w-3xl mx-auto"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu consulta tributaria o laboral..."
            rows={1}
            disabled={isLoading}
            className="flex w-full rounded-xl border border-border/60 bg-card px-4 py-3 pr-14 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 resize-none max-h-[200px] transition-all"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
          FiniTax AI puede cometer errores. Verifica la informacion con fuentes
          oficiales.
        </p>
      </div>
    </div>
  );
}
