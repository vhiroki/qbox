import { useState } from 'react';
import { ChevronDown, ChevronRight, Database, Table as TableIcon, Folder } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { ConnectionMetadata } from '../types';

interface WorkspaceSelectorProps {
  connections: Map<string, ConnectionMetadata>;
  selectedTables: Set<string>;
  onTableToggle: (connectionId: string, schemaName: string, tableName: string) => void;
  onSchemaToggle: (connectionId: string, schemaName: string) => void;
}

export default function WorkspaceSelector({
  connections,
  selectedTables,
  onTableToggle,
  onSchemaToggle,
}: WorkspaceSelectorProps) {
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());

  const toggleConnection = (connectionId: string) => {
    setExpandedConnections(prev => {
      const next = new Set(prev);
      if (next.has(connectionId)) {
        next.delete(connectionId);
      } else {
        next.add(connectionId);
      }
      return next;
    });
  };

  const toggleSchema = (key: string) => {
    setExpandedSchemas(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isTableSelected = (connectionId: string, schemaName: string, tableName: string): boolean => {
    return selectedTables.has(`${connectionId}:${schemaName}:${tableName}`);
  };

  const isSchemaFullySelected = (connectionId: string, schemaName: string, tables: any[]): boolean => {
    return tables.every(table => isTableSelected(connectionId, schemaName, table.name));
  };

  const isSchemaPartiallySelected = (connectionId: string, schemaName: string, tables: any[]): boolean => {
    const selectedCount = tables.filter(table => 
      isTableSelected(connectionId, schemaName, table.name)
    ).length;
    return selectedCount > 0 && selectedCount < tables.length;
  };

  if (connections.size === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No connections loaded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="space-y-2">
        {Array.from(connections.entries()).map(([connectionId, metadata]) => {
          const isExpanded = expandedConnections.has(connectionId);
          
          return (
            <div key={connectionId} className="border rounded-lg">
              {/* Connection Header */}
              <div
                className="flex items-center gap-2 p-3 hover:bg-accent cursor-pointer"
                onClick={() => toggleConnection(connectionId)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                )}
                <Database className="h-4 w-4 flex-shrink-0 text-blue-500" />
                <span className="font-medium truncate">{metadata.connection_name}</span>
              </div>

              {/* Schemas */}
              {isExpanded && (
                <div className="border-t">
                  {metadata.schemas.map((schema) => {
                    const schemaKey = `${connectionId}:${schema.name}`;
                    const isSchemaExpanded = expandedSchemas.has(schemaKey);
                    const allSelected = isSchemaFullySelected(connectionId, schema.name, schema.tables);
                    const partiallySelected = isSchemaPartiallySelected(connectionId, schema.name, schema.tables);

                    return (
                      <div key={schemaKey} className="border-b last:border-b-0">
                        {/* Schema Header */}
                        <div className="flex items-center gap-2 p-3 pl-8 hover:bg-accent">
                          <div
                            className="flex items-center gap-2 flex-1 cursor-pointer"
                            onClick={() => toggleSchema(schemaKey)}
                          >
                            {isSchemaExpanded ? (
                              <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 flex-shrink-0" />
                            )}
                            <Folder className="h-4 w-4 flex-shrink-0 text-yellow-500" />
                            <span className="text-sm truncate">{schema.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {schema.tables.length} tables
                            </span>
                          </div>
                          <Checkbox
                            checked={allSelected}
                            className={partiallySelected ? 'data-[state=checked]:bg-primary/50' : ''}
                            onCheckedChange={() => onSchemaToggle(connectionId, schema.name)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        {/* Tables */}
                        {isSchemaExpanded && (
                          <div className="bg-muted/30">
                            {schema.tables.map((table) => (
                              <div
                                key={table.name}
                                className="flex items-center gap-2 p-2 pl-16 hover:bg-accent"
                              >
                                <TableIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
                                <span className="text-sm flex-1 truncate">{table.name}</span>
                                <span className="text-xs text-muted-foreground mr-2">
                                  {table.columns.length} cols
                                </span>
                                <Checkbox
                                  checked={isTableSelected(connectionId, schema.name, table.name)}
                                  onCheckedChange={() => onTableToggle(connectionId, schema.name, table.name)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
