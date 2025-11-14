import { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  Filter,
  FolderClosed,
  FolderOpen,
  FileText,
  Cloud
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { api } from "@/services/api";
import type { QueryTableSelection } from "@/types";

interface S3TreeViewProps {
  selections: QueryTableSelection[];
  onSelectionChange: (
    connectionId: string,
    schemaName: string,
    tableName: string,
    checked: boolean,
    sourceType: string
  ) => Promise<void>;
}

interface ExpandedState {
  [key: string]: boolean;
}

interface S3FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  extension?: string;
  is_structured?: boolean;
  children?: S3FileNode[];
  hasMore?: boolean;
  continuationToken?: string;
  isLoading?: boolean;
}

interface S3FileMetadata {
  columns: Array<{ name: string; type: string; nullable: boolean }>;
  row_count?: number;
  file_type: string;
}

export default function S3TreeView({
  selections,
  onSelectionChange,
}: S3TreeViewProps) {
  const connections = useConnectionStore((state) => state.connections);
  const loadConnections = useConnectionStore((state) => state.loadConnections);
  const isLoadingConnections = useConnectionStore((state) => state.isLoading);
  
  // Filter to only show S3 connections (memoize to prevent re-creation)
  const s3Connections = connections.filter((conn) => conn.type === "s3");
  const s3ConnectionIds = s3Connections.map(c => c.id).join(',');
  
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [fileTree, setFileTree] = useState<Map<string, S3FileNode[]>>(new Map());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [fileMetadata, setFileMetadata] = useState<Map<string, S3FileMetadata>>(new Map());
  const [expandedFiles, setExpandedFiles] = useState<ExpandedState>({});
  const [togglingFile, setTogglingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefixFilter, setPrefixFilter] = useState("");
  const [filteredResults, setFilteredResults] = useState<Map<string, S3FileNode[]>>(new Map());
  const [isFilterLoading, setIsFilterLoading] = useState(false);

  // Track which folders have been loaded to prevent duplicate fetches
  const loadedFoldersRef = useRef<Set<string>>(new Set());
  // Debounce timer for prefix filter
  const filterTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load connections on mount if not already loaded
  useEffect(() => {
    if (connections.length === 0 && !isLoadingConnections) {
      loadConnections();
    }
  }, [connections.length, isLoadingConnections, loadConnections]);

  // Auto-expand connections with selected files
  useEffect(() => {
    setExpanded((prev) => {
      const newExpanded = { ...prev }; // Preserve existing expansion state

      // Expand connections that have selected files
      s3Connections.forEach((connection) => {
        const hasSelections = selections.some(
          (s) => s.source_type === "s3" && s.connection_id === connection.id
        );
        if (hasSelections) {
          newExpanded[`conn-${connection.id}`] = true;
        }
      });

      return newExpanded;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s3ConnectionIds, selections.length]);

  // Load root level of bucket when connection is expanded
  useEffect(() => {
    s3Connections.forEach((connection) => {
      const key = `conn-${connection.id}`;
      const nodeKey = `${connection.id}-`; // Root node key format matches loadFolderContents
      const folderKey = connection.id; // For tracking loaded folders
      
      if (
        expanded[key] && 
        !fileTree.has(connection.id) && 
        !loadingNodes.has(nodeKey) &&
        !loadedFoldersRef.current.has(folderKey)
      ) {
        loadFolderContents(connection.id, "");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const loadFolderContents = async (
    connectionId: string,
    prefix: string,
    continuationToken?: string,
    append: boolean = false
  ) => {
    const nodeKey = `${connectionId}-${prefix}`;
    const folderKey = prefix === "" ? connectionId : prefix;
    
    setLoadingNodes((prev) => new Set(prev).add(nodeKey));
    setError(null);

    try {
      const result = await api.listS3Files(connectionId, prefix, 100, continuationToken);
      
      // Mark this folder as loaded (unless it's a "see more" request)
      if (!append && !continuationToken) {
        loadedFoldersRef.current.add(folderKey);
      }
      
      const items: S3FileNode[] = [
        ...result.folders.map((folder) => ({
          name: folder.name,
          path: folder.path,
          type: "folder" as const,
        })),
        ...result.files.map((file) => ({
          name: file.name,
          path: file.path,
          type: "file" as const,
          size: file.size,
          extension: file.extension,
          is_structured: file.is_structured,
        })),
      ];

      // Add "See more" item if truncated
      if (result.truncated && result.next_token) {
        items.push({
          name: `Load more (${result.count} shown)...`,
          path: prefix, // Use the current folder prefix so handleSeeMore gets the correct path
          type: "folder",
          hasMore: true,
          continuationToken: result.next_token,
        });
      }

      setFileTree((prev) => {
        const newTree = new Map(prev);
        const existingItems = newTree.get(prefix === "" ? connectionId : prefix) || [];
        
        if (append && continuationToken) {
          // Remove the "See more" item and append new items
          const withoutSeeMore = existingItems.filter((item) => !item.hasMore);
          newTree.set(prefix === "" ? connectionId : prefix, [...withoutSeeMore, ...items]);
        } else {
          newTree.set(prefix === "" ? connectionId : prefix, items);
        }
        
        return newTree;
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to load S3 files");
    } finally {
      setLoadingNodes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(nodeKey);
        return newSet;
      });
    }
  };

  const loadFileMetadata = async (connectionId: string, filePath: string) => {
    const metadataKey = `${connectionId}-${filePath}`;
    
    if (fileMetadata.has(metadataKey)) {
      return; // Already loaded
    }

    try {
      const metadata = await api.getS3FileMetadata(connectionId, filePath);
      setFileMetadata((prev) => new Map(prev).set(metadataKey, metadata));
    } catch (err: any) {
      console.error("Failed to load file metadata:", err);
      // Silently fail - user can try again
    }
  };

  const toggleExpanded = (key: string, connectionId?: string, path?: string) => {
    setExpanded((prev) => {
      const newExpanded = { ...prev, [key]: !prev[key] };
      
      // Load folder contents if expanding a folder
      if (newExpanded[key] && connectionId && path !== undefined) {
        const folderKey = path === "" ? connectionId : path;
        if (!fileTree.has(folderKey) && !loadedFoldersRef.current.has(folderKey)) {
          loadFolderContents(connectionId, path);
        }
      }
      
      return newExpanded;
    });
  };

  const toggleFileExpanded = (key: string, connectionId: string, filePath: string, isStructured: boolean) => {
    setExpandedFiles((prev) => {
      const newExpanded = { ...prev, [key]: !prev[key] };
      
      // Load metadata if expanding and it's a structured file
      if (newExpanded[key] && isStructured) {
        loadFileMetadata(connectionId, filePath);
      }
      
      return newExpanded;
    });
  };

  const isFileSelected = (connectionId: string, filePath: string): boolean => {
    return selections.some(
      (s) =>
        s.source_type === "s3" &&
        s.connection_id === connectionId &&
        s.table_name === filePath
    );
  };

  const handleFileToggle = async (
    connectionId: string,
    filePath: string,
    checked: boolean
  ) => {
    const toggleKey = `${connectionId}-${filePath}`;
    setTogglingFile(toggleKey);

    try {
      // For S3 files:
      // - connection_id: S3 connection ID
      // - schema_name: folder path or bucket name
      // - table_name: full file path
      // - source_type: "s3"
      const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
      await onSelectionChange(connectionId, folderPath || "root", filePath, checked, "s3");
    } catch (err: any) {
      console.error("Failed to toggle file selection:", err);
      setError(err.message || "Failed to update selection");
    } finally {
      setTogglingFile(null);
    }
  };

  const handleSeeMore = (connectionId: string, prefix: string, continuationToken: string) => {
    loadFolderContents(connectionId, prefix, continuationToken, true);
  };

  // Perform prefix-based filtering by querying S3 directly
  const performPrefixFilter = async (prefix: string) => {
    if (!prefix.trim()) {
      setFilteredResults(new Map());
      return;
    }

    setIsFilterLoading(true);
    setError(null);
    const newResults = new Map<string, S3FileNode[]>();

    try {
      // Query each S3 connection with the prefix (flat=true to get all nested files)
      await Promise.all(
        s3Connections.map(async (connection) => {
          try {
            const result = await api.listS3Files(connection.id, prefix, 1000, undefined, true); // flat=true

            // When flat=true, folders array will be empty, only files are returned
            // Show files with their full paths for easier identification
            const items: S3FileNode[] = result.files.map((file) => ({
              name: file.path, // Show full path for clarity in flat view
              path: file.path,
              type: "file" as const,
              size: file.size,
              extension: file.extension,
              is_structured: file.is_structured,
            }));

            // Store results for this connection
            if (items.length > 0) {
              newResults.set(connection.id, items);
            }
          } catch (err: any) {
            console.error(`Failed to filter S3 connection ${connection.name}:`, err);
            // Continue with other connections even if one fails
          }
        })
      );

      setFilteredResults(newResults);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to filter S3 files");
    } finally {
      setIsFilterLoading(false);
    }
  };

  // Debounce prefix filter input
  useEffect(() => {
    // Clear existing timer
    if (filterTimerRef.current) {
      clearTimeout(filterTimerRef.current);
    }

    // Set new timer (500ms debounce)
    filterTimerRef.current = setTimeout(() => {
      performPrefixFilter(prefixFilter);
    }, 500);

    // Cleanup on unmount
    return () => {
      if (filterTimerRef.current) {
        clearTimeout(filterTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefixFilter, s3ConnectionIds]);

  const shouldShowNode = (node: S3FileNode): boolean => {
    // Always show "See more" items
    if (node.hasMore) return true;
    return true;
  };

  const renderFileNode = (
    node: S3FileNode,
    connectionId: string,
    level: number = 0
  ): JSX.Element | null => {
    if (!shouldShowNode(node)) return null;

    const nodeKey = `${connectionId}-${node.path}`;
    const isExpanded = node.type === "folder" ? expanded[nodeKey] : expandedFiles[nodeKey];
    const isLoading = loadingNodes.has(nodeKey);
    const paddingLeft = `${level * 1.5}rem`;

    // Handle "See more" item
    if (node.hasMore) {
      const parentPath = node.path || "";
      return (
        <div key={nodeKey} style={{ paddingLeft }} className="py-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              handleSeeMore(connectionId, parentPath, node.continuationToken!);
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
            ) : (
              <ChevronRight className="h-3 w-3 mr-2" />
            )}
            {node.name}
          </Button>
        </div>
      );
    }

    // Handle folder
    if (node.type === "folder") {
      const children = fileTree.get(node.path) || [];
      const visibleChildren = children.filter((child) => shouldShowNode(child));

      return (
        <div key={nodeKey}>
          <div
            className="flex items-center gap-2 py-1 px-2 hover:bg-accent cursor-pointer rounded"
            style={{ paddingLeft }}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(nodeKey, connectionId, node.path);
            }}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-yellow-500" />
            ) : (
              <FolderClosed className="h-3.5 w-3.5 flex-shrink-0 text-yellow-500" />
            )}
            <span className="text-sm truncate">{node.name}</span>
          </div>
          {isExpanded && visibleChildren.length > 0 && (
            <div>
              {visibleChildren.map((child) => renderFileNode(child, connectionId, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // Handle file
    const isSelected = isFileSelected(connectionId, node.path);
    const isToggling = togglingFile === nodeKey;
    const metadata = fileMetadata.get(nodeKey);
    const canExpand = node.is_structured;

    return (
      <div key={nodeKey}>
        <div
          className={`flex items-center gap-2 py-1 px-2 rounded ${
            isSelected ? "bg-primary/10" : "hover:bg-accent"
          }`}
          style={{ paddingLeft }}
        >
          {canExpand && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFileExpanded(nodeKey, connectionId, node.path, true);
              }}
              className="flex-shrink-0 hover:bg-accent rounded p-0.5"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {!canExpand && <div className="w-4 flex-shrink-0" />}
          
          <Checkbox
            checked={isSelected}
            disabled={isToggling || !node.is_structured}
            onCheckedChange={(checked) =>
              handleFileToggle(connectionId, node.path, checked as boolean)
            }
            className="flex-shrink-0"
          />
          
          <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${
            node.is_structured ? "text-blue-500" : "text-muted-foreground"
          }`} />
          
          <span className={`text-sm truncate ${!node.is_structured && "text-muted-foreground"}`}>
            {node.name}
          </span>
          
          {node.extension && (
            <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
              .{node.extension}
            </span>
          )}
        </div>
        
        {/* Show columns when expanded */}
        {isExpanded && canExpand && metadata && (
          <div style={{ paddingLeft: `${(level + 2) * 1.5}rem` }} className="py-1">
            <div className="text-xs space-y-1">
              {metadata.columns.map((col, idx) => (
                <div key={idx} className="text-muted-foreground font-mono">
                  {col.name}: <span className="text-blue-400">{col.type}</span>
                </div>
              ))}
              {metadata.row_count !== undefined && (
                <div className="text-muted-foreground italic mt-1">
                  {metadata.row_count.toLocaleString()} rows
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b flex-shrink-0">
        <div className="relative flex-1">
          <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter by prefix (e.g., 'folder/subfolder/' or 'prefix_')"
            value={prefixFilter}
            onChange={(e) => setPrefixFilter(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {isFilterLoading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0" />
        )}
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="destructive" className="mx-3 mt-3 flex-shrink-0">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tree view */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2">
          {isLoadingConnections ? (
            <div className="flex items-center justify-center h-32 text-center text-muted-foreground">
              <div>
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Loading connections...</p>
              </div>
            </div>
          ) : s3Connections.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-center text-muted-foreground">
              <div>
                <Cloud className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No S3 connections found</p>
                <p className="text-xs mt-1">Create an S3 connection to browse files</p>
              </div>
            </div>
          ) : prefixFilter.trim() ? (
            // Filtered view - show flat list of results
            <div>
              {filteredResults.size === 0 && !isFilterLoading ? (
                <div className="flex items-center justify-center h-32 text-center text-muted-foreground">
                  <div>
                    <Filter className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No files found with prefix:</p>
                    <p className="text-xs mt-1 font-mono">{prefixFilter}</p>
                  </div>
                </div>
              ) : (
                s3Connections.map((connection) => {
                  const results = filteredResults.get(connection.id);
                  if (!results || results.length === 0) return null;

                  const selectedCount = selections.filter(
                    (s) => s.source_type === "s3" && s.connection_id === connection.id
                  ).length;

                  return (
                    <div key={connection.id} className="mb-4">
                      {/* Connection header - not expandable in filtered view */}
                      <div className="flex items-center gap-2 py-2 px-2 rounded font-medium bg-accent/50">
                        <Cloud className="h-4 w-4 flex-shrink-0 text-blue-500" />
                        <span className="text-sm truncate flex-1">{connection.name}</span>
                        {selectedCount > 0 && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex-shrink-0">
                            {selectedCount}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {results.length} result{results.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Flat list of results */}
                      <div className="mt-1">
                        {results.map((node) => renderFileNode(node, connection.id, 1))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            // Normal tree view
            s3Connections.map((connection) => {
              const connKey = `conn-${connection.id}`;
              const isExpanded = expanded[connKey];
              const rootFiles = fileTree.get(connection.id) || [];
              const isLoadingRoot = loadingNodes.has(`${connection.id}-`);
              const selectedCount = selections.filter(
                (s) => s.source_type === "s3" && s.connection_id === connection.id
              ).length;

              return (
                <div key={connection.id} className="mb-2">
                  {/* Connection header */}
                  <div
                    className="flex items-center gap-2 py-2 px-2 hover:bg-accent cursor-pointer rounded font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(connKey, connection.id, "");
                    }}
                  >
                    {isLoadingRoot ? (
                      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                    ) : isExpanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                    <Cloud className="h-4 w-4 flex-shrink-0 text-blue-500" />
                    <span className="text-sm truncate flex-1">{connection.name}</span>
                    {selectedCount > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex-shrink-0">
                        {selectedCount}
                      </span>
                    )}
                  </div>

                  {/* Connection contents */}
                  {isExpanded && (
                    <div className="mt-1">
                      {isLoadingRoot && rootFiles.length === 0 ? (
                        <div className="text-sm text-muted-foreground px-8 py-2 flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Loading files...
                        </div>
                      ) : rootFiles.length === 0 ? (
                        <div className="text-sm text-muted-foreground px-8 py-2">
                          Empty bucket or no files found
                        </div>
                      ) : (
                        rootFiles
                          .filter((node) => shouldShowNode(node))
                          .map((node) => renderFileNode(node, connection.id, 1))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

