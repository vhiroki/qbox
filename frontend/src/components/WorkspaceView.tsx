import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ConnectionMetadata } from '../types';

interface WorkspaceViewProps {
  connections: Map<string, ConnectionMetadata>;
  selectedTables: Set<string>;
  onExport: () => void;
}

export default function WorkspaceView({
  connections,
  selectedTables,
  onExport,
}: WorkspaceViewProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const toggleTable = (key: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Get all selected table metadata
  const getSelectedTableMetadata = () => {
    const result: Array<{
      connectionName: string;
      schemaName: string;
      table: any;
      key: string;
    }> = [];

    connections.forEach((metadata, connectionId) => {
      metadata.schemas.forEach(schema => {
        schema.tables.forEach(table => {
          const key = `${connectionId}:${schema.name}:${table.name}`;
          if (selectedTables.has(key)) {
            result.push({
              connectionName: metadata.connection_name,
              schemaName: schema.name,
              table,
              key,
            });
          }
        });
      });
    });

    return result;
  };

  const selectedMetadata = getSelectedTableMetadata();

  if (selectedMetadata.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">No tables connected</p>
          <p className="text-sm">Select tables from the left panel to view their metadata</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Export Button */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Connected Tables ({selectedMetadata.length})</h3>
          <p className="text-sm text-muted-foreground">
            Click on a table to expand and view its metadata
          </p>
        </div>
        <Button onClick={onExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export Metadata
        </Button>
      </div>

      {/* Table Cards */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {selectedMetadata.map(({ connectionName, schemaName, table, key }) => {
            const isExpanded = expandedTables.has(key);

            return (
              <Card key={key}>
                <CardHeader
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => toggleTable(key)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-base">
                        {schemaName}.{table.name}
                      </CardTitle>
                      <CardDescription>
                        {connectionName} • {table.columns.length} columns
                        {table.row_count !== undefined && ` • ${table.row_count.toLocaleString()} rows`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent>
                    {table.description && (
                      <div className="mb-4 p-3 bg-muted rounded-md">
                        <p className="text-sm">{table.description}</p>
                      </div>
                    )}

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2 font-medium">Column</th>
                            <th className="text-left p-2 font-medium">Type</th>
                            <th className="text-left p-2 font-medium">Nullable</th>
                            <th className="text-left p-2 font-medium">Key</th>
                            {table.columns.some((col: any) => col.description) && (
                              <th className="text-left p-2 font-medium">Description</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {table.columns.map((column: any, idx: number) => (
                            <tr
                              key={column.name}
                              className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/50'}
                            >
                              <td className="p-2 font-mono text-xs">{column.name}</td>
                              <td className="p-2 text-xs">{column.type}</td>
                              <td className="p-2 text-xs">
                                {column.nullable ? (
                                  <span className="text-yellow-600">Yes</span>
                                ) : (
                                  <span className="text-green-600">No</span>
                                )}
                              </td>
                              <td className="p-2 text-xs">
                                {column.is_primary_key && (
                                  <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs">
                                    PK
                                  </span>
                                )}
                              </td>
                              {table.columns.some((col: any) => col.description) && (
                                <td className="p-2 text-xs">{column.description || '-'}</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
