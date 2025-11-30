import { useState } from "react";
import { Database, Cloud, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import ConnectionsTreeView from "./ConnectionsTreeView";
import S3TreeView from "./S3TreeView";
import FileManager from "./FileManager";
import { SOURCE_TYPE_ICON_COLORS } from "@/constants/connectionColors";
import type { QueryTableSelection } from "@/types";

interface DataSourcesPanelProps {
  queryId: string; // The query ID to scope files to
  selections: QueryTableSelection[];
  onSelectionChange: (
    connectionId: string,
    schemaName: string,
    tableName: string,
    checked: boolean,
    sourceType: string
  ) => Promise<void>;
  onFileDeleted?: (fileId: string) => Promise<void>;
}

export default function DataSourcesPanel({
  queryId,
  selections,
  onSelectionChange,
  onFileDeleted,
}: DataSourcesPanelProps) {
  const [activeTab, setActiveTab] = useState("database");

  // Calculate selection counts
  const connectionSelections = selections.filter((s) => s.source_type === "connection");
  const s3Selections = selections.filter((s) => s.source_type === "s3");
  const fileSelections = selections.filter((s) => s.source_type === "file");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
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

      <TabsContent value="database" className="flex-1 mt-0 overflow-hidden">
        <ConnectionsTreeView
          selections={selections}
          onSelectionChange={onSelectionChange}
        />
      </TabsContent>

      <TabsContent value="s3" className="flex-1 mt-0 overflow-hidden">
        <S3TreeView
          selections={selections}
          onSelectionChange={onSelectionChange}
        />
      </TabsContent>

      <TabsContent value="files" className="flex-1 mt-0 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="pr-4">
            <FileManager
              queryId={queryId}
              selectedFiles={fileSelections.map((s) => s.connection_id)}
              onSelectionChange={async (fileId, fileName, checked) => {
                // Files use the file name for both schema_name and table_name
                await onSelectionChange(fileId, fileName, fileName, checked, "file");
              }}
              onFileDeleted={onFileDeleted}
            />
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

