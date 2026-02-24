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
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Suggested Prompts
// ============================================

const SUGGESTED_PROMPTS = [
  {
    icon: <Receipt className="h-4 w-4" />,
    label: "IVA",
    prompt: "¿Cómo funciona el crédito fiscal IVA en El Salvador? ¿Qué gastos son deducibles?",
  },
  {
    icon: <Calculator className="h-4 w-4" />,
    label: "ISR Salarios",
    prompt: "Explica los tramos del ISR para salarios en El Salvador con un ejemplo para un salario de $1,500 mensuales.",
  },
  {
    icon: <Scale className="h-4 w-4" />,
    label: "ISSS y AFP",
    prompt: "¿Cuáles son las tasas actuales de ISSS y AFP para empleado y patrono? ¿Cuál es el salario máximo cotizable?",
  },
  {
    icon: <Briefcase className="h-4 w-4" />,
    label: "Aguinaldo",
    prompt: "¿Cómo se calcula el aguinaldo en El Salvador? ¿Cuántos días corresponden según la antigüedad del empleado?",
  },
  {
    icon: <Receipt className="h-4 w-4" />,
    label: "F-07",
    prompt: "¿Cuál es la fecha límite para presentar el formulario F-07 y qué pasa si lo presento tarde?",
  },
  {
    icon: <HelpCircle className="h-4 w-4" />,
    label: "Pago a Cuenta",
    prompt: "¿Qué es el pago a cuenta (F-11) y cómo se calcula el 1.75%? ¿Puedo acreditarlo contra el ISR anual?",
  },
];

// ============================================
// Markdown-like renderer (simple)
// ============================================

function renderContent(text: string) {
  // Split into paragraphs and render with basic formatting
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    key++;
    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={key} className="font-bold text-sm mt-3 mb-1">
          {line.slice(4)}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={key} className="font-bold text-base mt-3 mb-1">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={key} className="font-bold text-lg mt-3 mb-1">
          {line.slice(2)}
        </h2>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={key} className="ml-4 list-disc text-sm">
          {renderInline(line.slice(2))}
        </li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={key} className="ml-4 list-decimal text-sm">
          {renderInline(line.replace(/^\d+\.\s/, ""))}
        </li>
      );
    } else if (line.startsWith("```")) {
      // Simple code fence — just show as monospace block
      elements.push(
        <code key={key} className="block bg-muted rounded px-2 py-1 text-xs font-mono my-1 whitespace-pre-wrap">
          {line.replace(/^```\w*/, "")}
        </code>
      );
    } else if (line.startsWith("|")) {
      // Table row
      const cells = line.split("|").filter((c) => c.trim() && !c.match(/^[\s-:]+$/));
      if (cells.length > 0 && !line.match(/^[\s|:-]+$/)) {
        elements.push(
          <div key={key} className="flex gap-4 text-xs font-mono py-0.5">
            {cells.map((c, i) => (
              <span key={i} className="flex-1">{c.trim()}</span>
            ))}
          </div>
        );
      }
    } else if (line.trim() === "") {
      elements.push(<div key={key} className="h-2" />);
    } else {
      elements.push(
        <p key={key} className="text-sm leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  }

  return elements;
}

function renderInline(text: string) {
  // Bold **text** and inline `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="bg-muted px-1 rounded text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// ============================================
// Main Page
// ============================================

// Extract text content from UIMessage parts
function getMessageText(message: { parts: Array<{ type: string; text?: string }> }): string {
  return message.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");
}

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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        doSend(input);
      }
    }
  }

  function doSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput("");
    sendMessage({ text: trimmed });
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSend(input);
  }

  function handleSuggestedPrompt(prompt: string) {
    setInput(prompt);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function clearChat() {
    setMessages([]);
    clearError();
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Asistente IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consulta sobre leyes tributarias, laborales y contabilidad de El Salvador
          </p>
        </div>
        {hasMessages && (
          <Button variant="outline" size="sm" onClick={clearChat} className="text-xs">
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!hasMessages ? (
          /* Empty state with suggested prompts */
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">¿En qué puedo ayudarte?</h2>
            <p className="text-muted-foreground text-sm text-center max-w-md mb-8">
              Soy tu asistente especializado en legislación tributaria y laboral
              salvadoreña. Pregúntame lo que necesites.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl w-full">
              {SUGGESTED_PROMPTS.map((sp, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedPrompt(sp.prompt)}
                  className="flex items-start gap-3 rounded-xl border p-3 text-left text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="flex-shrink-0 mt-0.5 text-primary">{sp.icon}</span>
                  <div>
                    <span className="font-medium block text-xs text-muted-foreground mb-0.5">
                      {sp.label}
                    </span>
                    <span className="text-xs leading-snug line-clamp-2">{sp.prompt}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="space-y-4 pb-4">
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
                >
                  {!isUser && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 max-w-[75%] break-words",
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 border"
                    )}
                  >
                    {isUser ? (
                      <p className="text-sm whitespace-pre-wrap">{getMessageText(message)}</p>
                    ) : (
                      <div className="prose-sm">{renderContent(getMessageText(message))}</div>
                    )}
                  </div>
                  {isUser && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading indicator */}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-muted/60 border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Pensando...
                  </div>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-red-600" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 max-w-[75%]">
                  <p className="text-sm text-red-600 mb-2">
                    Hubo un error al procesar tu consulta. Intenta de nuevo.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => regenerate()} className="text-xs">
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
      <div className="flex-shrink-0 border-t pt-4 mt-2">
        <form onSubmit={handleFormSubmit} className="flex gap-2 items-end">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu consulta tributaria o laboral..."
              rows={1}
              disabled={isLoading}
              className="flex w-full rounded-xl border border-input bg-background px-4 py-3 pr-12 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none max-h-[200px]"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-11 w-11 rounded-xl flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          FiniTax AI puede cometer errores. Verifica la información importante con fuentes oficiales.
        </p>
      </div>
    </div>
  );
}
