import { useState, useEffect } from "react";
import { Settings, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "../services/api";
import type { AISettings, AISettingsUpdate } from "../types";

interface SettingsModalProps {
  onDataCleared?: () => void;
}

export default function SettingsModal({ onDataCleared }: SettingsModalProps) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  
  // AI Settings state
  const [aiSettings, setAISettings] = useState<AISettings>({
    openai_api_key: "",
    anthropic_api_key: "",
    gemini_api_key: "",
    ai_model: "gpt-4o",
    ai_temperature: 0.1,
  });
  
  // Track if settings have changed
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings when modal opens
  useEffect(() => {
    if (open) {
      loadSettings();
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
      const settings = await api.getAISettings();
      setAISettings(settings);
      setHasChanges(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load settings");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSettingsChange = (field: keyof AISettings, value: any) => {
    setAISettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setError(null);
    setSuccess(null);
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      // Prepare update payload (only include changed fields)
      const update: AISettingsUpdate = {
        ai_model: aiSettings.ai_model,
        ai_temperature: aiSettings.ai_temperature,
      };
      
      // Only include API keys if they were changed (not masked)
      if (aiSettings.openai_api_key && !aiSettings.openai_api_key.startsWith("*")) {
        update.openai_api_key = aiSettings.openai_api_key;
      }
      if (aiSettings.anthropic_api_key && !aiSettings.anthropic_api_key.startsWith("*")) {
        update.anthropic_api_key = aiSettings.anthropic_api_key;
      }
      if (aiSettings.gemini_api_key && !aiSettings.gemini_api_key.startsWith("*")) {
        update.gemini_api_key = aiSettings.gemini_api_key;
      }
      
      const updated = await api.updateAISettings(update);
      setAISettings(updated);
      setHasChanges(false);
      setSuccess("Settings saved successfully");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    try {
      setLoading(true);
      setError(null);
      await api.clearAllData();
      
      // Close dialogs
      setConfirmOpen(false);
      setOpen(false);
      
      // Notify parent component
      if (onDataCleared) {
        onDataCleared();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to clear data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage your QBox application settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-500 bg-green-500/10 text-green-600">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* AI Configuration Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-1">AI Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Configure the AI model and API keys for SQL generation.
                </p>
              </div>

              {settingsLoading ? (
                <div className="text-sm text-muted-foreground">Loading settings...</div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai-model">AI Model</Label>
                    <Input
                      id="ai-model"
                      type="text"
                      placeholder="gpt-4o"
                      value={aiSettings.ai_model}
                      onChange={(e) => handleSettingsChange("ai_model", e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Examples: gpt-4o, claude-3-5-sonnet-20241022, gemini/gemini-pro, ollama/llama2
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-temperature">Temperature</Label>
                    <Input
                      id="ai-temperature"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={aiSettings.ai_temperature}
                      onChange={(e) => handleSettingsChange("ai_temperature", parseFloat(e.target.value))}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower values (0.0-0.3) are more deterministic, higher values (0.7-2.0) are more creative
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openai-key">OpenAI API Key</Label>
                    <Input
                      id="openai-key"
                      type="password"
                      placeholder="sk-..."
                      value={aiSettings.openai_api_key || ""}
                      onChange={(e) => handleSettingsChange("openai_api_key", e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for OpenAI models (gpt-4o, gpt-4, etc.)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                    <Input
                      id="anthropic-key"
                      type="password"
                      placeholder="sk-ant-..."
                      value={aiSettings.anthropic_api_key || ""}
                      onChange={(e) => handleSettingsChange("anthropic_api_key", e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for Anthropic models (claude-3-5-sonnet, etc.)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gemini-key">Google Gemini API Key</Label>
                    <Input
                      id="gemini-key"
                      type="password"
                      placeholder="AI..."
                      value={aiSettings.gemini_api_key || ""}
                      onChange={(e) => handleSettingsChange("gemini_api_key", e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for Google models (gemini-pro, gemini-1.5-pro, etc.)
                    </p>
                  </div>

                  <Button
                    onClick={handleSaveSettings}
                    disabled={loading || !hasChanges}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? "Saving..." : "Save AI Settings"}
                  </Button>
                </div>
              )}
            </div>

            {/* Data Management Section */}
            <div className="space-y-2 pt-4 border-t">
              <h3 className="text-sm font-medium">Data Management</h3>
              <p className="text-sm text-muted-foreground">
                Clear all data to reset the application to its initial state.
              </p>
              <Button
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={loading}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Data
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All queries and their SQL</li>
                <li>All database connections</li>
                <li>All table selections</li>
                <li>All chat history</li>
                <li>All cached data</li>
              </ul>
              <p className="mt-2 font-medium">
                The application will be reset to a clean state.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearData}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Clearing..." : "Clear All Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

