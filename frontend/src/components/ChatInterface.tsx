import { useState, useEffect, useRef } from "react";
import { api } from "../services/api";
import type { Query, ChatMessage } from "../types";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";

interface ChatInterfaceProps {
  query: Query;
  onSQLUpdate: (updatedQuery: Query) => void;
}

export default function ChatInterface({
  query,
  onSQLUpdate,
}: ChatInterfaceProps) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sqlText, setSqlText] = useState(query.sql_text);
  const [sqlEdited, setSqlEdited] = useState(false);
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

  // Update SQL when query prop changes
  useEffect(() => {
    setSqlText(query.sql_text);
    setSqlEdited(false);
  }, [query.sql_text]);

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

      // Update SQL text
      setSqlText(response.updated_sql);
      setSqlEdited(false);

      // Update parent component with new query data
      onSQLUpdate({
        ...query,
        sql_text: response.updated_sql,
      });

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

  const handleSaveSQL = async () => {
    if (!sqlEdited) return;

    try {
      const updated = await api.updateQuerySQL(query.id, {
        sql_text: sqlText,
      });
      setSqlEdited(false);
      onSQLUpdate(updated);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to save SQL. Please try again."
      );
    }
  };

  const handleSQLChange = (value: string) => {
    setSqlText(value);
    setSqlEdited(value !== query.sql_text);
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
    <div className="flex flex-col h-full gap-4">
      {/* SQL Editor */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">SQL Query</h3>
          {sqlEdited && (
            <Button onClick={handleSaveSQL} size="sm" variant="outline">
              Save SQL
            </Button>
          )}
        </div>
        <Textarea
          value={sqlText}
          onChange={(e) => handleSQLChange(e.target.value)}
          placeholder="-- Your SQL query will appear here&#10;-- You can also edit it directly"
          className="font-mono text-sm min-h-[200px] resize-none"
        />
        {sqlEdited && (
          <p className="text-xs text-muted-foreground mt-2">
            SQL has been modified. Click "Save SQL" to persist changes.
          </p>
        )}
      </Card>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col p-4">
        <div className="flex items-center justify-between mb-4">
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
        <ScrollArea className="flex-1 pr-4 -mr-4 mb-4">
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
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Input Area */}
        <div className="flex gap-2">
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
      </Card>
    </div>
  );
}
