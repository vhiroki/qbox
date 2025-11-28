import { useState } from "react";
import { MessageSquare, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ChatInterface from "./ChatInterface";
import SelectedTablesView from "./SelectedTablesView";
import AddTableModal from "./AddTableModal";
import type { Query, QueryTableSelection } from "@/types";

interface RightSidePanelProps {
  query: Query;
  queryId: string;
  selections: QueryTableSelection[];
  onSQLChange: (sql: string) => void;
  onSelectionChange: (
    connectionId: string,
    schemaName: string,
    tableName: string,
    checked: boolean,
    sourceType: string
  ) => Promise<void>;
  onFileDeleted?: (fileId: string) => Promise<void>;
  onRemoveSelection: (
    connectionId: string,
    schemaName: string,
    tableName: string,
    sourceType: string,
    label: string
  ) => void;
  fileInfoMap: Map<string, { name: string; viewName: string }>;
  connectionInfoMap: Map<string, { name: string; alias: string }>;
}

type PanelView = "tables" | "chat";

export default function RightSidePanel({
  query,
  queryId,
  selections,
  onSQLChange,
  onSelectionChange,
  onFileDeleted,
  onRemoveSelection,
  fileInfoMap,
  connectionInfoMap,
}: RightSidePanelProps) {
  const [activeView, setActiveView] = useState<PanelView>("tables");
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);

  const handleSaveTableChanges = async (
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
  ) => {
    // Process removals first
    for (const removal of removals) {
      await onSelectionChange(
        removal.connectionId,
        removal.schemaName,
        removal.tableName,
        false,
        removal.sourceType
      );
    }

    // Then process additions
    for (const addition of additions) {
      await onSelectionChange(
        addition.connectionId,
        addition.schemaName,
        addition.tableName,
        true,
        addition.sourceType
      );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Panel Toggle Header */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg mb-3 flex-shrink-0">
        <Button
          variant={activeView === "tables" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveView("tables")}
          className={cn(
            "flex-1 h-8 text-xs font-medium transition-all",
            activeView === "tables" ? "shadow-sm" : "hover:bg-muted/50"
          )}
        >
          <Table2 className="h-3.5 w-3.5 mr-1.5" />
          Tables
          {selections.length > 0 && (
            <span className="ml-1.5 bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
              {selections.length}
            </span>
          )}
        </Button>
        <Button
          variant={activeView === "chat" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveView("chat")}
          className={cn(
            "flex-1 h-8 text-xs font-medium transition-all",
            activeView === "chat" ? "shadow-sm" : "hover:bg-muted/50"
          )}
        >
          <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
          AI Chat
        </Button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === "tables" ? (
          <SelectedTablesView
            selections={selections}
            onRemoveSelection={onRemoveSelection}
            onAddTableClick={() => setIsAddTableModalOpen(true)}
            fileInfoMap={fileInfoMap}
            connectionInfoMap={connectionInfoMap}
          />
        ) : (
          <ChatInterface query={query} onSQLChange={onSQLChange} />
        )}
      </div>

      {/* Add Table Modal */}
      <AddTableModal
        isOpen={isAddTableModalOpen}
        onClose={() => setIsAddTableModalOpen(false)}
        queryId={queryId}
        currentSelections={selections}
        onSave={handleSaveTableChanges}
        onFileDeleted={onFileDeleted}
      />
    </div>
  );
}
