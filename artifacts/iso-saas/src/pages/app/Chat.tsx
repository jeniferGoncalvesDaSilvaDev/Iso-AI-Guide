import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useGetChatHistory, useSendChatMessage, getGetChatHistoryQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User as UserIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatMessage } from "@workspace/api-client-react";

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

  // Optimistic UI state for pending message
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
          setInput(content); // restore input on error
        }
      }
    );
  };

  if (!user?.companyId) {
    return <div className="p-8 text-center text-muted-foreground">Configure sua empresa para usar o assistente.</div>;
  }

  // Reverse history if API returns newest first, we want oldest top
  const messages = [...(history || [])].reverse();

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Consultor IA</h1>
        <p className="text-muted-foreground mt-2">
          Tire dúvidas sobre normas, auditorias e processos com nosso especialista em ISO.
        </p>
      </div>

      <Card className="flex-1 flex flex-col border-border shadow-sm overflow-hidden bg-card/50">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-6 pb-4">
            {/* Welcome message */}
            <div className="flex items-start gap-4">
              <Avatar className="h-10 w-10 border bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </Avatar>
              <div className="bg-primary/5 border border-primary/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground max-w-[85%]">
                Olá! Sou seu consultor especialista em normas ISO. Como posso ajudar com a certificação da sua empresa hoje?
              </div>
            </div>

            {messages.map((msg: ChatMessage) => (
              <div key={msg.id} className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <Avatar className={`h-10 w-10 border ${msg.role === 'user' ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary'}`}>
                  {msg.role === 'user' ? <UserIcon className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </Avatar>
                <div className={`rounded-2xl px-4 py-3 text-sm max-w-[85%] ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-card border border-border shadow-sm rounded-tl-sm text-foreground'
                }`}>
                  <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>') }} />
                </div>
              </div>
            ))}

            {pendingMessage && (
              <div className="flex items-start gap-4 flex-row-reverse">
                <Avatar className="h-10 w-10 border bg-secondary text-secondary-foreground">
                  <UserIcon className="h-5 w-5" />
                </Avatar>
                <div className="rounded-2xl px-4 py-3 text-sm max-w-[85%] bg-primary text-primary-foreground rounded-tr-sm opacity-70">
                  {pendingMessage}
                </div>
              </div>
            )}

            {sendMutation.isPending && (
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10 border bg-primary/10 text-primary">
                  <Bot className="h-5 w-5 animate-pulse" />
                </Avatar>
                <div className="bg-card border border-border shadow-sm rounded-2xl rounded-tl-sm px-4 py-4 max-w-[85%] flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '300ms' }} />
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
              placeholder="Pergunte sobre um requisito da ISO 9001, como conduzir uma auditoria..." 
              className="flex-1"
              disabled={sendMutation.isPending}
            />
            <Button type="submit" disabled={!input.trim() || sendMutation.isPending} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
