import { useState } from 'react';
import type { AIQueryRequest, QueryResult } from '../types';
import { api } from '../services/api';

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
    <div style={styles.container}>
      <h2 style={styles.title}>AI Query</h2>
      
      {!connectionId && (
        <div style={styles.warning}>
          Please connect to a database first
        </div>
      )}

      <div style={styles.inputGroup}>
        <label style={styles.label}>Natural Language Query</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Show me all users who signed up in the last month"
          style={styles.textarea}
          rows={3}
          disabled={!connectionId}
        />
      </div>

      <div style={styles.buttonGroup}>
        <button
          onClick={() => handleGenerate(false)}
          disabled={loading || !connectionId || !prompt.trim()}
          style={styles.button}
        >
          {loading ? 'Generating...' : 'Generate SQL'}
        </button>
        <button
          onClick={() => handleGenerate(true)}
          disabled={loading || !connectionId || !prompt.trim()}
          style={{ ...styles.button, backgroundColor: '#28a745' }}
        >
          {loading ? 'Running...' : 'Generate & Execute'}
        </button>
      </div>

      {result && (
        <div style={styles.resultContainer}>
          {result.generated_sql && (
            <div style={styles.sqlContainer}>
              <h3 style={styles.subtitle}>Generated SQL:</h3>
              <pre style={styles.sql}>{result.generated_sql}</pre>
            </div>
          )}

          {result.success && result.rows && (
            <div style={styles.dataContainer}>
              <h3 style={styles.subtitle}>Results ({result.row_count} rows):</h3>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {result.columns?.map((col) => (
                        <th key={col} style={styles.th}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, idx) => (
                      <tr key={idx}>
                        {result.columns?.map((col) => (
                          <td key={col} style={styles.td}>
                            {JSON.stringify(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.error && (
            <div style={styles.errorMessage}>
              <strong>Error:</strong> {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  title: {
    fontSize: '24px',
    marginBottom: '20px',
    color: '#333',
  },
  subtitle: {
    fontSize: '18px',
    marginBottom: '10px',
    color: '#555',
  },
  warning: {
    padding: '10px',
    backgroundColor: '#fff3cd',
    color: '#856404',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  inputGroup: {
    marginBottom: '15px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#555',
    marginBottom: '5px',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '16px',
    fontWeight: '500',
    color: '#fff',
    backgroundColor: '#007bff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  resultContainer: {
    marginTop: '20px',
  },
  sqlContainer: {
    marginBottom: '20px',
  },
  sql: {
    padding: '15px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '14px',
    fontFamily: 'monospace',
  },
  dataContainer: {
    marginTop: '20px',
  },
  tableWrapper: {
    overflow: 'auto',
    maxHeight: '400px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  th: {
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6',
    textAlign: 'left',
    fontWeight: '600',
  },
  td: {
    padding: '10px',
    borderBottom: '1px solid #dee2e6',
  },
  errorMessage: {
    marginTop: '20px',
    padding: '10px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '4px',
  },
};
