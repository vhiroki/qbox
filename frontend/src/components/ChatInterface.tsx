import { useState, useEffect, useRef } from "react";
import type { Query } from "../types";
import { useQueryStore } from "../stores";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { AlertCircle, Loader2, Send, RotateCcw, Copy, Check, ChevronRight } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";

interface ChatInterfaceProps {
  query: Query;
  onSQLChange?: (sqlText: string) => void;
  onCollapse?: () => void;
}

export default function ChatInterface({
  query,
  onSQLChange,
  onCollapse,
}: ChatInterfaceProps) {
  // Zustand store
  const sendChatMessage = useQueryStore((state) => state.sendChatMessage);
  const retryChatMessage = useQueryStore((state) => state.retryChatMessage);
  const loadChatHistory = useQueryStore((state) => state.loadChatHistory);
  const clearChatHistory = useQueryStore((state) => state.clearChatHistory);
  const queryChatHistory = useQueryStore((state) => state.queryChatHistory);
  const isLoading = useQueryStore((state) => state.isLoading);
  const storeError = useQueryStore((state) => state.error);

  const [userMessage, setUserMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const chatHistory = queryChatHistory.get(query.id) || [];

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory(query.id);
  }, [query.id, loadChatHistory]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!userMessage.trim()) return;

    const messageText = userMessage;
    setError(null);
    setUserMessage(""); // Clear input immediately for better UX

    try {
      const response = await sendChatMessage(query.id, messageText);

      // Notify parent of SQL change if callback provided
      if (onSQLChange) {
        onSQLChange(response.updatedSQL);
      }
    } catch (err: any) {
      // Don't restore message - retry button will be shown in chat history
      setError(storeError || "Failed to process message. Please try again.");
    }
  };

  const handleRetry = async (messageId: string) => {
    setError(null);
    try {
      const response = await retryChatMessage(query.id, messageId);

      // Notify parent of SQL change if callback provided
      if (onSQLChange) {
        onSQLChange(response.updatedSQL);
      }
    } catch (err: any) {
      setError(storeError || "Failed to retry message. Please try again.");
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm("Clear all chat history? This cannot be undone.")) return;

    try {
      await clearChatHistory(query.id);
    } catch (err: any) {
      setError(storeError || "Failed to clear chat history. Please try again.");
    }
  };

  const handleCopyMessage = async (messageId: string, messageText: string) => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopiedMessageId(messageId);
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-sm font-medium">Chat with AI</h3>
        <div className="flex items-center gap-2">
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
          {onCollapse && (
            <Button
              onClick={onCollapse}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              title="Collapse chat panel"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
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
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === "user"
                      ? msg.has_error
                        ? "bg-destructive/20 border border-destructive"
                        : "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <p className="text-xs opacity-70">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </p>
                    <div className="flex items-center gap-1">
                      {msg.is_pending && (
                        <div className="flex items-center gap-1 text-xs opacity-70">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Sending...</span>
                        </div>
                      )}
                      {msg.has_error && (
                        <Button
                          onClick={() => handleRetry(String(msg.id))}
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                      {!msg.is_pending && (
                        <Button
                          onClick={() => handleCopyMessage(String(msg.id), msg.message)}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          title="Copy message"
                        >
                          {copiedMessageId === String(msg.id) ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
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
          disabled={isLoading}
        />
        <Button
          onClick={handleSendMessage}
          disabled={isLoading || !userMessage.trim()}
          size="icon"
          className="h-[60px] w-[60px]"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
