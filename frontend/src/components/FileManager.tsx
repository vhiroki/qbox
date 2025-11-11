import { useState, useEffect, useCallback } from "react";
import { Upload, FileText, Trash2, Loader2, ChevronDown, ChevronRight, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/services/api";
import type { FileInfo, FileMetadata } from "@/types";

interface FileManagerProps {
  selectedFiles: string[]; // List of file IDs that are selected
  onFileAdded?: (fileId: string, fileName: string) => Promise<void>; // Called when a file is uploaded
  onFileDeleted?: (fileId: string) => Promise<void>; // Called when a file is deleted
}

interface ExpandedState {
  [key: string]: boolean;
}

export default function FileManager({ selectedFiles, onFileAdded, onFileDeleted }: FileManagerProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileMetadata, setFileMetadata] = useState<Map<string, FileMetadata>>(new Map());
  const [expandedSchemas, setExpandedSchemas] = useState<ExpandedState>({});
  const [loadingMetadata, setLoadingMetadata] = useState<Set<string>>(new Set());

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, []);

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
      const filesList = await api.listFiles();
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
        if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
          throw new Error(`Unsupported file type: ${file.name}. Only CSV and XLSX files are supported.`);
        }

        const uploadResponse = await api.uploadFile(file);
        uploadedFiles.push({ id: uploadResponse.id, name: uploadResponse.name });
      }

      // Reload file list
      await loadFiles();

      // Auto-add uploaded files to the query
      if (onFileAdded) {
        for (const uploadedFile of uploadedFiles) {
          try {
            await onFileAdded(uploadedFile.id, uploadedFile.name);
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

  const handleDeleteFile = async (fileId: string) => {
    try {
      await api.deleteFile(fileId);
      
      // Notify parent if file was in selections (so it can be removed)
      if (onFileDeleted && selectedFiles.includes(fileId)) {
        await onFileDeleted(fileId);
      }
      
      await loadFiles();
    } catch (err: any) {
      setError(err.message || "Failed to delete file");
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
            accept=".csv,.xlsx,.xls"
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
          Supports CSV and XLSX files (max 100MB)
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
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  
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
                      <div className="text-xs">
                        <span className="text-muted-foreground">Query as: </span>
                        <code className="font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          {metadata.view_name}
                        </code>
                      </div>
                    )}
                  </div>

                  {metadata && (
                    <Button
                      variant={isSchemaExpanded ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => toggleSchemaExpansion(file.id)}
                      className="h-7 px-2 text-xs gap-1 whitespace-nowrap"
                      title="Toggle schema details"
                    >
                      {isSchemaExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      <Columns3 className="h-3.5 w-3.5" />
                      <span>Schema</span>
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFile(file.id)}
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
    </div>
  );
}

