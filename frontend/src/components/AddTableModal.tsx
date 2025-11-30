import { useState, useEffect } from "react";
import { Database, Cloud, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import ConnectionsTreeView from "./ConnectionsTreeView";
import S3TreeView from "./S3TreeView";
import FileManager from "./FileManager";
import { SOURCE_TYPE_ICON_COLORS } from "@/constants/connectionColors";
import type { QueryTableSelection } from "@/types";

interface AddTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  queryId: string;
  currentSelections: QueryTableSelection[];
  onSave: (
    additions: Array<{
      connectionId: string;
      schemaName: string;
      tableName: string;
      sourceType: string;
    }>,
    removals: Array<{
      connectionId: string;
      schemaName: string;
      tableName: string;
      sourceType: string;
    }>
  ) => Promise<void>;
  onFileDeleted?: (fileId: string) => Promise<void>;
}

interface PendingChange {
  connectionId: string;
  schemaName: string;
  tableName: string;
  sourceType: string;
}

export default function AddTableModal({
  isOpen,
  onClose,
  queryId,
  currentSelections,
  onSave,
  onFileDeleted,
}: AddTableModalProps) {
  const [activeTab, setActiveTab] = useState("database");
  const [pendingAdditions, setPendingAdditions] = useState<PendingChange[]>([]);
  const [pendingRemovals, setPendingRemovals] = useState<PendingChange[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Reset pending changes when modal opens
  useEffect(() => {
    if (isOpen) {
      setPendingAdditions([]);
      setPendingRemovals([]);
    }
  }, [isOpen]);

  // Calculate the "virtual" selections (current + additions - removals)
  const getVirtualSelections = (): QueryTableSelection[] => {
    const result: QueryTableSelection[] = [];

    // Start with current selections, minus any pending removals
    for (const sel of currentSelections) {
      const isBeingRemoved = pendingRemovals.some(
        (r) =>
          r.connectionId === sel.connection_id &&
          r.schemaName === sel.schema_name &&
          r.tableName === sel.table_name &&
          r.sourceType === sel.source_type
      );
      if (!isBeingRemoved) {
        result.push(sel);
      }
    }

    // Add pending additions
    for (const add of pendingAdditions) {
      const alreadyExists = result.some(
        (r) =>
          r.connection_id === add.connectionId &&
          r.schema_name === add.schemaName &&
          r.table_name === add.tableName &&
          r.source_type === add.sourceType
      );
      if (!alreadyExists) {
        result.push({
          query_id: queryId,
          connection_id: add.connectionId,
          schema_name: add.schemaName,
          table_name: add.tableName,
          source_type: add.sourceType,
        });
      }
    }

    return result;
  };

  const virtualSelections = getVirtualSelections();

  // Handle selection change from tree views
  const handleSelectionChange = async (
    connectionId: string,
    schemaName: string,
    tableName: string,
    checked: boolean,
    sourceType: string
  ) => {
    const change: PendingChange = {
      connectionId,
      schemaName,
      tableName,
      sourceType,
    };

    const isCurrentlySelected = currentSelections.some(
      (s) =>
        s.connection_id === connectionId &&
        s.schema_name === schemaName &&
        s.table_name === tableName &&
        s.source_type === sourceType
    );

    if (checked) {
      // User is checking the item
      if (isCurrentlySelected) {
        // It was originally selected, remove from pending removals
        setPendingRemovals((prev) =>
          prev.filter(
            (r) =>
              !(
                r.connectionId === connectionId &&
                r.schemaName === schemaName &&
                r.tableName === tableName &&
                r.sourceType === sourceType
              )
          )
        );
      } else {
        // It was not originally selected, add to pending additions
        setPendingAdditions((prev) => {
          const exists = prev.some(
            (a) =>
              a.connectionId === connectionId &&
              a.schemaName === schemaName &&
              a.tableName === tableName &&
              a.sourceType === sourceType
          );
          if (exists) return prev;
          return [...prev, change];
        });
      }
    } else {
      // User is unchecking the item
      if (isCurrentlySelected) {
        // It was originally selected, add to pending removals
        setPendingRemovals((prev) => {
          const exists = prev.some(
            (r) =>
              r.connectionId === connectionId &&
              r.schemaName === schemaName &&
              r.tableName === tableName &&
              r.sourceType === sourceType
          );
          if (exists) return prev;
          return [...prev, change];
        });
      } else {
        // It was not originally selected, remove from pending additions
        setPendingAdditions((prev) =>
          prev.filter(
            (a) =>
              !(
                a.connectionId === connectionId &&
                a.schemaName === schemaName &&
                a.tableName === tableName &&
                a.sourceType === sourceType
              )
          )
        );
      }
    }
  };

  const handleSave = async () => {
    if (pendingAdditions.length === 0 && pendingRemovals.length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(pendingAdditions, pendingRemovals);
      onClose();
    } catch (err) {
      console.error("Failed to save table selections:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setPendingAdditions([]);
    setPendingRemovals([]);
    onClose();
  };

  // Calculate counts for each tab
  const connectionSelections = virtualSelections.filter(
    (s) => s.source_type === "connection"
  );
  const s3Selections = virtualSelections.filter((s) => s.source_type === "s3");
  const fileSelections = virtualSelections.filter(
    (s) => s.source_type === "file"
  );

  const totalPendingChanges = pendingAdditions.length + pendingRemovals.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Tables</DialogTitle>
          <DialogDescription>
            Select tables from your data sources to use in your query.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full flex flex-col"
          >
            <TabsList className="w-full grid grid-cols-3 flex-shrink-0">
              <TabsTrigger value="database" className="flex items-center gap-2">
                <Database className={`h-3.5 w-3.5 ${SOURCE_TYPE_ICON_COLORS.connection}`} />
                Database
                {connectionSelections.length > 0 && (
                  <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {connectionSelections.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="s3" className="flex items-center gap-2">
                <Cloud className={`h-3.5 w-3.5 ${SOURCE_TYPE_ICON_COLORS.s3}`} />
                S3
                {s3Selections.length > 0 && (
                  <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {s3Selections.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="files" className="flex items-center gap-2">
                <FileText className={`h-3.5 w-3.5 ${SOURCE_TYPE_ICON_COLORS.file}`} />
                Files
                {fileSelections.length > 0 && (
                  <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {fileSelections.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="database"
              className="flex-1 mt-4 overflow-hidden"
            >
              <ConnectionsTreeView
                selections={virtualSelections}
                onSelectionChange={handleSelectionChange}
              />
            </TabsContent>

            <TabsContent value="s3" className="flex-1 mt-4 overflow-hidden">
              <S3TreeView
                selections={virtualSelections}
                onSelectionChange={handleSelectionChange}
              />
            </TabsContent>

            <TabsContent value="files" className="flex-1 mt-4 overflow-hidden">
              <ScrollArea className="h-full w-full">
                <div className="pr-4">
                  <FileManager
                    queryId={queryId}
                    selectedFiles={fileSelections.map((s) => s.connection_id)}
                    onSelectionChange={async (fileId, fileName, checked) => {
                      await handleSelectionChange(
                        fileId,
                        fileName,
                        fileName,
                        checked,
                        "file"
                      );
                    }}
                    onFileDeleted={onFileDeleted}
                  />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2">
          {totalPendingChanges > 0 && (
            <span className="text-sm text-muted-foreground mr-auto">
              {pendingAdditions.length > 0 && (
                <span className="text-green-600">
                  +{pendingAdditions.length}
                </span>
              )}
              {pendingAdditions.length > 0 && pendingRemovals.length > 0 && (
                <span> / </span>
              )}
              {pendingRemovals.length > 0 && (
                <span className="text-red-500">-{pendingRemovals.length}</span>
              )}
              <span className="ml-1">changes</span>
            </span>
          )}
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : totalPendingChanges > 0 ? (
              `Save Changes`
            ) : (
              "Done"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

