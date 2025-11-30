import { useState, useEffect, useCallback } from "react";
import { Upload, FileText, Trash2, Loader2, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/services/api";
import { SOURCE_TYPE_ICON_COLORS } from "@/constants/connectionColors";
import type { FileInfo, FileMetadata } from "@/types";

interface FileManagerProps {
  queryId: string; // The query ID to scope files to
  selectedFiles: string[]; // List of file IDs that are selected
  onSelectionChange?: (fileId: string, fileName: string, checked: boolean) => Promise<void>; // Called when checkbox is toggled
  onFileDeleted?: (fileId: string) => Promise<void>; // Called when a file is deleted
}

interface ExpandedState {
  [key: string]: boolean;
}

export default function FileManager({ queryId, selectedFiles, onSelectionChange, onFileDeleted }: FileManagerProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileMetadata, setFileMetadata] = useState<Map<string, FileMetadata>>(new Map());
  const [expandedSchemas, setExpandedSchemas] = useState<ExpandedState>({});
  const [loadingMetadata, setLoadingMetadata] = useState<Set<string>>(new Set());
  const [copiedViewName, setCopiedViewName] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);

  // Load files when queryId changes and reset state
  useEffect(() => {
    // Reset state when switching queries
    setFileMetadata(new Map());
    setExpandedSchemas({});
    setCopiedViewName(null);
    setError(null);
    
    loadFiles();
  }, [queryId]);

  // Auto-load metadata for all files
  useEffect(() => {
    files.forEach((file) => {
      if (!fileMetadata.has(file.id) && !loadingMetadata.has(file.id)) {
        loadFileMetadata(file.id);
      }
    });
  }, [files, fileMetadata, loadingMetadata]);

  const loadFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filesList = await api.listFiles(queryId);
      setFiles(filesList);
    } catch (err: any) {
      setError(err.message || "Failed to load files");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      // Upload files one by one
      const uploadedFiles: Array<{ id: string; name: string }> = [];
      
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        
        // Validate file type
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!ext || !["csv"].includes(ext)) {
          throw new Error(`Unsupported file type: ${file.name}. Only CSV files are supported.`);
        }

        const uploadResponse = await api.uploadFile(file, queryId);
        uploadedFiles.push({ id: uploadResponse.id, name: uploadResponse.name });
      }

      // Reload file list
      await loadFiles();

      // Auto-add uploaded files to the query
      if (onSelectionChange) {
        for (const uploadedFile of uploadedFiles) {
          try {
            await onSelectionChange(uploadedFile.id, uploadedFile.name, true);
          } catch (err: any) {
            console.error(`Failed to add file ${uploadedFile.name} to query:`, err);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteClick = (fileId: string, fileName: string) => {
    setFileToDelete({ id: fileId, name: fileName });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;

    try {
      await api.deleteFile(fileToDelete.id);
      
      // Notify parent if file was in selections (so it can be removed)
      if (onFileDeleted && selectedFiles.includes(fileToDelete.id)) {
        await onFileDeleted(fileToDelete.id);
      }
      
      await loadFiles();
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete file");
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    handleFileUpload(droppedFiles);
  }, []);

  const loadFileMetadata = async (fileId: string) => {
    // Mark as loading
    setLoadingMetadata((prev) => new Set(prev).add(fileId));
    
    try {
      const metadata = await api.getFileMetadata(fileId);
      setFileMetadata((prev) => new Map(prev).set(fileId, metadata));
    } catch (err: any) {
      console.error(`Failed to load metadata for file: ${err.message}`);
    } finally {
      // Remove from loading set
      setLoadingMetadata((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  const isFileSelected = (fileId: string): boolean => {
    return selectedFiles.includes(fileId);
  };

  const toggleSchemaExpansion = (fileId: string) => {
    setExpandedSchemas((prev) => ({
      ...prev,
      [fileId]: !prev[fileId],
    }));
  };

  const handleCopyViewName = async (fileId: string, viewName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(viewName);
      setCopiedViewName(fileId);
      // Reset after 2 seconds
      setTimeout(() => setCopiedViewName(null), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading files...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">
          {isDragging ? "Drop files here" : "Drag & drop files here"}
        </p>
        <p className="text-xs text-muted-foreground mb-3">or</p>
        <label>
          <input
            type="file"
            multiple
            accept=".csv"
            onChange={(e) => handleFileUpload(e.target.files)}
            disabled={isUploading}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Browse Files
              </>
            )}
          </Button>
        </label>
        <p className="text-xs text-muted-foreground mt-3">
          Supports CSV files (max 100MB)
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* File List */}
      {files.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-center text-muted-foreground border-2 border-dashed rounded-md">
          <div>
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No files uploaded yet</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => {
            const isSelected = isFileSelected(file.id);
            const metadata = fileMetadata.get(file.id);
            const isSchemaExpanded = expandedSchemas[file.id] || false;

            return (
              <div 
                key={file.id} 
                className={`border rounded-lg overflow-hidden transition-colors ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                {/* File Header */}
                <div className="p-3 flex items-center gap-3">
                  {/* Checkbox */}
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={async (checked) => {
                      if (onSelectionChange) {
                        await onSelectionChange(file.id, file.name, checked === true);
                      }
                    }}
                    className="flex-shrink-0"
                  />
                  
                  {metadata && (
                    <button
                      onClick={() => toggleSchemaExpansion(file.id)}
                      className="flex-shrink-0 hover:bg-muted p-1 rounded transition-colors"
                      title="Toggle schema details"
                    >
                      {isSchemaExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  <FileText className={`h-4 w-4 ${SOURCE_TYPE_ICON_COLORS.file} flex-shrink-0`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground uppercase px-1.5 py-0.5 bg-muted rounded flex-shrink-0">
                        {file.file_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>{formatFileSize(file.size_bytes)}</span>
                      {metadata ? (
                        metadata.row_count != null && (
                          <>
                            <span>•</span>
                            <span>{metadata.row_count.toLocaleString()} rows</span>
                            <span>•</span>
                            <span>{metadata.columns.length} columns</span>
                          </>
                        )
                      ) : (
                        <>
                          <span>•</span>
                          <Loader2 className="h-3 w-3 animate-spin inline" />
                        </>
                      )}
                    </div>
                    {metadata && (
                      <div className="text-xs flex items-center gap-1">
                        <span className="text-muted-foreground">Query as: </span>
                        <code className="font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          {metadata.view_name}
                        </code>
                        <button
                          onClick={(e) => handleCopyViewName(file.id, metadata.view_name, e)}
                          className="hover:bg-muted p-0.5 rounded transition-all flex-shrink-0"
                          aria-label={`Copy ${metadata.view_name}`}
                          title="Copy view name"
                        >
                          {copiedViewName === file.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(file.id, file.name)}
                    className="h-7 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>

                {/* Schema Details */}
                {isSchemaExpanded && metadata && (
                  <div className="px-3 pb-3 pt-0 border-t text-xs">
                    <div className="mt-3">
                      {/* Columns */}
                      <p className="font-semibold text-muted-foreground mb-2">Schema ({metadata.columns.length} columns)</p>
                      <div className="space-y-1.5">
                        {metadata.columns.map((column) => (
                          <div
                            key={column.name}
                            className="flex items-center gap-2 p-2 rounded bg-muted/50"
                          >
                            <span className="font-medium text-foreground flex-1 truncate">
                              {column.name}
                            </span>
                            <span className="font-mono text-muted-foreground text-xs flex-shrink-0">
                              {column.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fileToDelete?.name}"? This will permanently remove the file from the system and from all queries. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

