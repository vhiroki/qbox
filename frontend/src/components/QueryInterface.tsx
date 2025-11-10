import { useState } from "react";
import { Loader2, Sparkles, Play, Edit2, History } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Alert, AlertDescription } from "./ui/alert";
import { Card } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { api } from "../services/api";
import type {
  AIQueryResponse,
  QueryExecutionResult,
  QueryHistoryItem,
} from "../types";
import QueryResults from "./QueryResults";
import QueryHistory from "./QueryHistory";

interface QueryInterfaceProps {
  workspaceId: string;
}

export default function QueryInterface({ workspaceId }: QueryInterfaceProps) {
  const [prompt, setPrompt] = useState("");
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [editedSQL, setEditedSQL] = useState("");
  const [explanation, setExplanation] = useState("");
  const [queryId, setQueryId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryExecutionResult | null>(null);
  const [activeTab, setActiveTab] = useState("query");
  const [refreshHistory, setRefreshHistory] = useState(0);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a query description");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response: AIQueryResponse = await api.generateQuery(workspaceId, {
        prompt: prompt.trim(),
      });

      setGeneratedSQL(response.generated_sql);
      setEditedSQL(response.generated_sql);
      setExplanation(response.explanation || "");
      setQueryId(response.query_id);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to generate query. Please try again."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecute = async () => {
    const sqlToExecute = editedSQL || generatedSQL;
    if (!sqlToExecute.trim()) {
      setError("No SQL query to execute");
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const execResult: QueryExecutionResult = await api.executeAIQuery(
        workspaceId,
        {
          sql: sqlToExecute,
          save_to_history: true,
          query_id: queryId || undefined,
        }
      );

      if (execResult.success) {
        setResult(execResult);
        setRefreshHistory((prev) => prev + 1); // Trigger history refresh
      } else {
        setError(execResult.error || "Query execution failed");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to execute query. Please try again."
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRerunQuery = (historyItem: QueryHistoryItem) => {
    setPrompt(historyItem.prompt);
    setGeneratedSQL(historyItem.generated_sql);
    setEditedSQL(historyItem.executed_sql || historyItem.generated_sql);
    setExplanation(historyItem.explanation || "");
    setQueryId(historyItem.id);
    setActiveTab("query");
  };

  const handleClearAll = () => {
    setPrompt("");
    setGeneratedSQL("");
    setEditedSQL("");
    setExplanation("");
    setQueryId(null);
    setError(null);
    setResult(null);
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
          <TabsTrigger value="query" className="rounded-none border-b-2 data-[state=active]:border-primary">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Query
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-none border-b-2 data-[state=active]:border-primary">
            <History className="w-4 h-4 mr-2" />
            Query History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="query" className="flex-1 mt-4 space-y-4">
          {/* Natural Language Input */}
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-2">Describe your query</h3>
            <Textarea
              placeholder="Example: List all users that have logged into the application in the last month and are associated to more than one school"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px] mb-3"
              disabled={isGenerating}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate SQL
                  </>
                )}
              </Button>
              {(generatedSQL || editedSQL) && (
                <Button variant="outline" onClick={handleClearAll}>
                  Clear
                </Button>
              )}
            </div>
          </Card>

          {/* Generated SQL Display */}
          {generatedSQL && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Generated SQL</h3>
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </div>
              {explanation && (
                <p className="text-sm text-muted-foreground mb-3">
                  {explanation}
                </p>
              )}
              <Textarea
                value={editedSQL}
                onChange={(e) => setEditedSQL(e.target.value)}
                className="font-mono text-sm min-h-[200px]"
                placeholder="SQL will appear here..."
              />
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={handleExecute}
                  disabled={isExecuting || !editedSQL.trim()}
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Execute Query
                    </>
                  )}
                </Button>
                {editedSQL !== generatedSQL && (
                  <Button
                    variant="outline"
                    onClick={() => setEditedSQL(generatedSQL)}
                  >
                    Reset to Generated
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Query Results */}
          {result && result.success && (
            <QueryResults result={result} />
          )}
        </TabsContent>

        <TabsContent value="history" className="flex-1 mt-4">
          <QueryHistory
            workspaceId={workspaceId}
            onRerun={handleRerunQuery}
            refreshTrigger={refreshHistory}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
