/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  Loader2,
  User,
} from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant · Ecolens" }] }),
  component: AssistantPage,
});

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  sqlQuery?: string;
  queryResults?: any[];
}

const SUGGESTED_PROMPTS = [
  { text: "How does PM2.5 affect my lungs?" },
  { text: "Explain AQI levels & safety scales" },
  { text: "How do AQI meter sensors work?" },
  { text: "Health tips for high pollution days" },
  { text: "Best protection against bad air" },
];

function cleanTextForDisplay(text: string): string {
  if (!text) return "";
  let clean = text;

  // 1. Clean LaTeX expressions like $\text{NO}_2$, $\text{SO}_2$, $\mu\text{g/m}^3$
  clean = clean.replace(/\\\s*text\{([^}]+)\}/g, "$1");
  clean = clean.replace(/\\mu/g, "micrograms").replace(/\^3/g, "³").replace(/\^2/g, "²");
  clean = clean.replace(/g\/m3/g, "grams per cubic meter").replace(/g\/m³/g, "grams per cubic meter");
  clean = clean.replace(/[\$_\{\}\^]/g, "");
  clean = clean.replace(/\\/g, "");

  // 2. Strip repeated greetings at the start if any
  clean = clean.replace(/^(Hello|Hi|Hey|Greetings|Welcome)[!\.,\s]+((I am|I'm)[^\n\.]*[\.\n]*)?/i, "");

  // 3. Clean markdown symbols: **, ---, //, \\, ```, `, headers #
  clean = clean.replace(/\*\*/g, "");
  clean = clean.replace(/---/g, "");
  clean = clean.replace(/[\/\\]{2,}/g, "");
  clean = clean.replace(/`{1,3}/g, "");
  clean = clean.replace(/^#{1,6}\s*/gm, "");

  return clean.trim();
}

function renderInlineMarkdown(text: string, isUser: boolean) {
  const sanitizedText = cleanTextForDisplay(text);
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = sanitizedText.split(regex);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong
          key={i}
          className={cn(
            "font-extrabold",
            isUser ? "text-current" : "text-foreground font-extrabold",
          )}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={i} className={cn("italic", isUser ? "text-current/90" : "text-muted-foreground")}>
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className={cn(
            "font-mono text-[10px] px-1 py-0.5 rounded border",
            isUser
              ? "bg-black/15 border-black/10 text-white"
              : "bg-muted border-border/30 text-eco-orange",
          )}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

interface MarkdownBlock {
  type: "code" | "heading" | "list" | "paragraph";
  level?: number;
  ordered?: boolean;
  language?: string;
  items?: string[];
  content?: string;
}

function parseMarkdown(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = text.split("\n");
  let inCodeBlock = false;
  let codeLanguage = "";
  let codeContent: string[] = [];
  let currentList: { ordered: boolean; items: string[] } | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Check code block
    const codeBlockMatch = line.match(/^```(\w*)/);
    if (codeBlockMatch) {
      if (inCodeBlock) {
        // End of code block
        blocks.push({
          type: "code",
          language: codeLanguage,
          content: codeContent.join("\n"),
        });
        inCodeBlock = false;
        codeContent = [];
        codeLanguage = "";
      } else {
        // Start of code block
        // Flush any active lists
        if (currentList) {
          blocks.push({
            type: "list",
            ordered: currentList.ordered,
            items: currentList.items,
          });
          currentList = null;
        }
        inCodeBlock = true;
        codeLanguage = codeBlockMatch[1] || "";
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Headers
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      // Flush lists
      if (currentList) {
        blocks.push({
          type: "list",
          ordered: currentList.ordered,
          items: currentList.items,
        });
        currentList = null;
      }
      const level = headingMatch[1].length;
      blocks.push({
        type: "heading",
        level,
        content: headingMatch[2],
      });
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (olMatch) {
      if (currentList && !currentList.ordered) {
        blocks.push({
          type: "list",
          ordered: false,
          items: currentList.items,
        });
        currentList = null;
      }
      if (!currentList) {
        currentList = { ordered: true, items: [] };
      }
      currentList.items.push(olMatch[1]);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (ulMatch) {
      if (currentList && currentList.ordered) {
        blocks.push({
          type: "list",
          ordered: true,
          items: currentList.items,
        });
        currentList = null;
      }
      if (!currentList) {
        currentList = { ordered: false, items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      if (currentList) {
        blocks.push({
          type: "list",
          ordered: currentList.ordered,
          items: currentList.items,
        });
        currentList = null;
      }
      blocks.push({ type: "paragraph", content: "" });
      continue;
    }

    // Regular paragraph line
    if (currentList) {
      blocks.push({
        type: "list",
        ordered: currentList.ordered,
        items: currentList.items,
      });
      currentList = null;
    }

    blocks.push({
      type: "paragraph",
      content: line,
    });
  }

  // Flush remaining lists or code block
  if (inCodeBlock) {
    blocks.push({
      type: "code",
      language: codeLanguage,
      content: codeContent.join("\n"),
    });
  }
  if (currentList) {
    blocks.push({
      type: "list",
      ordered: currentList.ordered,
      items: currentList.items,
    });
  }

  return blocks;
}

function MarkdownRenderer({ text, isUser }: { text: string; isUser: boolean }) {
  const blocks = parseMarkdown(text);

  return (
    <div className="space-y-1.5 select-text text-left">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "code":
            return (
              <pre
                key={idx}
                className={cn(
                  "font-mono text-[10px] p-2.5 rounded-lg border my-1.5 overflow-x-auto select-text",
                  isUser
                    ? "bg-black/15 border-black/10 text-white"
                    : "bg-muted border-border/30 text-foreground",
                )}
              >
                <code>{block.content}</code>
              </pre>
            );
          case "heading": {
            const content = renderInlineMarkdown(block.content || "", isUser);
            const level = block.level || 1;
            if (level === 1) {
              return (
                <h1
                  key={idx}
                  className={cn(
                    "text-sm font-bold mt-2 pb-0.5",
                    isUser ? "" : "border-b border-border/20",
                  )}
                >
                  {content}
                </h1>
              );
            }
            if (level === 2) {
              return (
                <h2
                  key={idx}
                  className={cn("text-xs font-bold mt-2", isUser ? "" : "text-eco-orange")}
                >
                  {content}
                </h2>
              );
            }
            return (
              <h3 key={idx} className="text-xs font-semibold mt-1.5">
                {content}
              </h3>
            );
          }
          case "list": {
            if (block.ordered) {
              return (
                <ol key={idx} className="list-decimal pl-5 space-y-0.5 my-0.5">
                  {block.items?.map((item, i) => (
                    <li key={i} className="pl-0.5">
                      {renderInlineMarkdown(item, isUser)}
                    </li>
                  ))}
                </ol>
              );
            } else {
              return (
                <ul key={idx} className="list-disc pl-5 space-y-0.5 my-0.5">
                  {block.items?.map((item, i) => (
                    <li key={i} className="pl-0.5">
                      {renderInlineMarkdown(item, isUser)}
                    </li>
                  ))}
                </ul>
              );
            }
          }
          case "paragraph":
          default:
            if (block.content?.trim() === "") {
              return <div key={idx} className="h-1" />;
            }
            return (
              <p key={idx} className="leading-relaxed">
                {renderInlineMarkdown(block.content || "", isUser)}
              </p>
            );
        }
      })}
    </div>
  );
}



function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "I am your EcoLens Health & AQI Assistant.\n\nAsk me anything about Air Quality Index (AQI) ratings, laser meter sensors, PM2.5 and PM10 health effects, or practical advice for protecting your body from air pollution.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsgId = `msg-${Date.now()}-user`;
    const botMsgId = `msg-${Date.now()}-bot`;

    const newUserMessage: Message = {
      id: userMsgId,
      sender: "user",
      text: textToSend,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");
    setLoading(true);

    try {
      const data = await apiFetch<{
        reply: string;
        sql_query?: string;
        query_results?: any[];
      }>("/api/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ message: textToSend }),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          sender: "assistant",
          text: data.reply,
          sqlQuery: data.sql_query,
          queryResults: data.query_results,
        },
      ]);
    } catch (err) {
      console.error("Assistant chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          sender: "assistant",
          text: "I encountered an error connecting to the assistant service. Please check if the backend is running.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell>
      <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-4xl w-full flex-col px-4 py-4 md:py-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 text-primary shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                AI Health & AQI Assistant
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Respiratory Guidance & Atmospheric Insights
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Multi-Agent Ready
          </span>
        </div>

        {/* Message Area */}
        <div className="flex-1 flex flex-col overflow-hidden rounded-3xl bg-card/60 backdrop-blur-xl border border-border/80 shadow-xl relative min-h-0">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex w-full gap-3 sm:gap-4",
                    isUser
                      ? "justify-end animate-in slide-in-from-right-3 duration-200"
                      : "justify-start animate-in slide-in-from-left-3 duration-200"
                  )}
                >
                  {!isUser && (
                    <div className="flex shrink-0 h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 text-primary mt-0.5">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}

                  <div className={cn("flex flex-col gap-1.5", isUser ? "items-end max-w-[85%]" : "items-start max-w-[85%]")}>
                    {/* Message Bubble */}
                    <div
                      className={cn(
                        "rounded-3xl px-5 py-3.5 text-sm leading-relaxed shadow-sm",
                        isUser
                          ? "rounded-br-sm bg-primary text-primary-foreground font-medium shadow-md shadow-primary/20"
                          : "rounded-tl-sm bg-card border border-border/80 text-foreground"
                      )}
                    >
                      <MarkdownRenderer text={msg.text} isUser={isUser} />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex w-full gap-3 justify-start">
                <div className="flex shrink-0 h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 text-primary mt-0.5">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2.5 rounded-3xl rounded-tl-sm bg-card border border-border/80 px-5 py-3.5 text-sm text-muted-foreground animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Synthesizing environmental response...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Prompts & Input Area */}
          <div className="px-4 sm:px-6 pb-5 pt-3 border-t border-border/60 bg-background/50 backdrop-blur-md">
            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-2 mb-3.5 animate-in slide-in-from-bottom-2 duration-300">
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(p.text)}
                    className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground active:scale-95 transition-all shadow-2xs"
                  >
                    <span>{p.text}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="relative flex items-center w-full"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about PM2.5, respiratory precautions, sensor data..."
                disabled={loading}
                className="w-full rounded-2xl border border-border/80 bg-background/90 pl-5 pr-14 py-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60 placeholder:text-muted-foreground shadow-inner"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
