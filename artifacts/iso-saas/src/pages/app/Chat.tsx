import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useGetChatHistory, useSendChatMessage, getGetChatHistoryQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User as UserIcon, Sparkles, Lightbulb, FileText, ClipboardCheck, Shield } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatMessage } from "@workspace/api-client-react";

const SUGGESTIONS = [
  { icon: FileText, text: "Quais documentos preciso para ISO 9001?" },
  { icon: ClipboardCheck, text: "Como conduzir uma auditoria interna?" },
  { icon: Shield, text: "O que muda na ISO 45001?" },
  { icon: Lightbulb, text: "Como definir a política da qualidade?" },
];

function formatMessage(text: string): string {
  // Convert markdown-style formatting to HTML
  return text
    .replace(/### (.+)/g, "<h3 class='text-base font-semibold mt-3 mb-1'>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc text-sm'>$1</li>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

export default function Chat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const chatParams = { companyId: user?.companyId ?? undefined };
  const { data: history, isLoading } = useGetChatHistory(
    chatParams,
    { query: { enabled: !!user?.companyId, queryKey: getGetChatHistoryQueryKey(chatParams) } }
  );

  const sendMutation = useSendChatMessage();

  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, pendingMessage]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user?.companyId) return;

    const content = input.trim();
    setInput("");
    setPendingMessage(content);

    sendMutation.mutate(
      { data: { content, companyId: user.companyId } },
      {
        onSuccess: () => {
          setPendingMessage(null);
          queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey({ companyId: user.companyId! }) });
        },
        onError: () => {
          setPendingMessage(null);
          setInput(content);
        }
      }
    );
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
  };

  if (!user?.companyId) {
    return <div className="p-8 text-center text-muted-foreground">Configure sua empresa para usar o assistente.</div>;
  }

  const messages = [...(history || [])].reverse();

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Consultor IA</h1>
          <p className="text-muted-foreground mt-1">
            Especialista em normas ISO pronto para ajudar sua certificação.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          IA ativa
        </div>
      </div>

      <Card className="flex-1 flex flex-col border-border shadow-sm overflow-hidden bg-card/50">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-5 pb-4">
            {/* Welcome message */}
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="bg-gradient-to-br from-primary/5 to-primary/[0.02] border border-primary/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground max-w-[85%] shadow-sm">
                <div className="font-medium text-primary mb-1">Consultor ISO 🤖</div>
                <p>Olá! Sou seu consultor especialista em normas ISO. Pode me perguntar sobre requisitos, documentação, auditorias ou processos de certificação. Como posso ajudar?</p>
              </div>
            </div>

            {/* Suggestions */}
            {messages.length === 0 && !sendMutation.isPending && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium px-1">Sugestões de perguntas:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestion(s.text)}
                      className="flex items-center gap-1.5 text-xs bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <s.icon className="h-3.5 w-3.5 text-primary" />
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg: ChatMessage) => (
              <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                  msg.role === 'user' 
                    ? 'bg-secondary border-secondary/20' 
                    : 'bg-primary/10 border-primary/20'
                }`}>
                  {msg.role === 'user' 
                    ? <UserIcon className="h-5 w-5 text-secondary-foreground" /> 
                    : <Bot className="h-5 w-5 text-primary" />
                  }
                </div>
                <div className={`rounded-2xl px-4 py-3 text-sm max-w-[85%] shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-card border border-border rounded-tl-sm text-foreground'
                }`}>
                  {msg.role === 'user' ? (
                    <p>{msg.content}</p>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-medium text-primary text-xs mb-1">Consultor ISO</div>
                      <div className="leading-relaxed" dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {pendingMessage && (
              <div className="flex items-start gap-3 flex-row-reverse">
                <div className="h-9 w-9 rounded-full bg-secondary border border-secondary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <UserIcon className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div className="rounded-2xl px-4 py-3 text-sm max-w-[85%] bg-primary text-primary-foreground rounded-tr-sm opacity-70">
                  {pendingMessage}
                </div>
              </div>
            )}

            {sendMutation.isPending && (
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <div className="bg-card border border-border shadow-sm rounded-2xl rounded-tl-sm px-4 py-4 max-w-[85%]">
                  <div className="font-medium text-primary text-xs mb-2">Consultor ISO está pensando...</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 bg-card border-t border-border">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre ISO 9001, auditorias, documentos..." 
              className="flex-1 bg-background"
              disabled={sendMutation.isPending}
            />
            <Button type="submit" disabled={!input.trim() || sendMutation.isPending} size="icon" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
