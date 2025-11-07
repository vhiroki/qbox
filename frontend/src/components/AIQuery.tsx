import { useState } from 'react';
import type { AIQueryRequest, QueryResult } from '../types';
import { api } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface AIQueryProps {
  connectionId: string | null;
}

export default function AIQuery({ connectionId }: AIQueryProps) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (execute: boolean) => {
    if (!connectionId) {
      alert('Please connect to a database first');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const request: AIQueryRequest = {
        connection_id: connectionId,
        prompt,
        execute,
      };
      const queryResult = await api.aiGenerateQuery(request);
      setResult(queryResult);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.response?.data?.detail || 'Failed to generate query',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>AI Query</CardTitle>
          <CardDescription>
            {!connectionId
              ? 'Please connect to a database first'
              : 'Ask a question in natural language and let AI generate SQL for you'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="prompt">Natural Language Query</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Show me all users who signed up in the last month"
              rows={3}
              disabled={!connectionId}
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => handleGenerate(false)}
              disabled={loading || !connectionId || !prompt.trim()}
              variant="outline"
            >
              {loading ? 'Generating...' : 'Generate SQL'}
            </Button>
            <Button
              onClick={() => handleGenerate(true)}
              disabled={loading || !connectionId || !prompt.trim()}
            >
              {loading ? 'Running...' : 'Generate & Execute'}
            </Button>
          </div>

          {result && (
            <div className="space-y-4">
              {result.generated_sql && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Generated SQL:</h3>
                  <pre className="p-4 bg-slate-100 border border-slate-200 rounded-lg overflow-auto text-sm font-mono">
                    {result.generated_sql}
                  </pre>
                </div>
              )}

              {result.success && result.rows && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Results ({result.row_count} rows):</h3>
                  <div className="border rounded-lg overflow-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {result.columns?.map((col) => (
                            <TableHead key={col}>{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.rows.map((row, idx) => (
                          <TableRow key={idx}>
                            {result.columns?.map((col) => (
                              <TableCell key={col}>
                                {JSON.stringify(row[col])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {result.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
