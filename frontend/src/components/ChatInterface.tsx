import { useState, useEffect, useRef } from "react";
import { api } from "../services/api";
import type { Query, ChatMessage } from "../types";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";

interface ChatInterfaceProps {
  query: Query;
  onSQLUpdate: (updatedQuery: Query) => void;
  onSQLChange?: (sqlText: string) => void;
}

export default function ChatInterface({
  query,
  onSQLUpdate,
  onSQLChange,
}: ChatInterfaceProps) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const history = await api.getChatHistory(query.id);
        setChatHistory(history);
      } catch (err: any) {
        console.error("Failed to load chat history:", err);
      }
    };
    loadChatHistory();
  }, [query.id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!userMessage.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.chatWithAI(query.id, {
        message: userMessage,
      });

      // Add both user message and assistant response to chat
      setChatHistory((prev) => [...prev, response.message]);

      // Update parent component with new query data
      onSQLUpdate({
        ...query,
        sql_text: response.updated_sql,
      });

      // Notify parent of SQL change if callback provided
      if (onSQLChange) {
        onSQLChange(response.updated_sql);
      }

      // Clear input
      setUserMessage("");
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Failed to process message. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm("Clear all chat history? This cannot be undone.")) return;

    try {
      await api.clearChatHistory(query.id);
      setChatHistory([]);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Failed to clear chat history. Please try again."
      );
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-sm font-medium">Chat with AI</h3>
        {chatHistory.length > 0 && (
          <Button
            onClick={handleClearChat}
            size="sm"
            variant="ghost"
            className="text-xs"
          >
            Clear History
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 pr-4 -mr-4 mb-4 min-h-0">
        {chatHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet. Start a conversation to modify your SQL query.
          </div>
        ) : (
          <div className="space-y-4">
            {chatHistory.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-4 flex-shrink-0">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Input Area */}
      <div className="flex gap-2 flex-shrink-0">
        <Textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Ask AI to modify your SQL query... (Shift+Enter for new line)"
          className="flex-1 min-h-[60px] max-h-[120px] resize-none"
          disabled={loading}
        />
        <Button
          onClick={handleSendMessage}
          disabled={loading || !userMessage.trim()}
          size="icon"
          className="h-[60px] w-[60px]"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
