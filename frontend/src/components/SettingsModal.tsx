import { useState, useEffect } from "react";
import { Settings, Trash2, Save, Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { useTheme } from "@/components/theme-provider";
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
  const { theme, setTheme } = useTheme();
  
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

  // Track which API key fields were explicitly modified (to allow clearing)
  const [modifiedKeys, setModifiedKeys] = useState<Set<string>>(new Set());

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
      setModifiedKeys(new Set());
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

    // Track if an API key field was modified
    if (field === 'openai_api_key' || field === 'anthropic_api_key' || field === 'gemini_api_key') {
      setModifiedKeys(prev => new Set(prev).add(field));
    }
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

      // Include API keys if they were explicitly modified (allows clearing)
      if (modifiedKeys.has('openai_api_key')) {
        update.openai_api_key = aiSettings.openai_api_key?.trim() || '';
      }
      if (modifiedKeys.has('anthropic_api_key')) {
        update.anthropic_api_key = aiSettings.anthropic_api_key?.trim() || '';
      }
      if (modifiedKeys.has('gemini_api_key')) {
        update.gemini_api_key = aiSettings.gemini_api_key?.trim() || '';
      }

      const updated = await api.updateAISettings(update);
      setAISettings(updated);
      setHasChanges(false);
      setModifiedKeys(new Set());
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
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage your QBox application settings.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="appearance" className="py-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="ai">AI Configuration</TabsTrigger>
              <TabsTrigger value="data">Data Management</TabsTrigger>
            </TabsList>

            {/* Appearance Tab */}
            <TabsContent value="appearance" className="space-y-4 mt-4">
              <div>
                <h3 className="text-sm font-medium mb-1">Appearance</h3>
                <p className="text-sm text-muted-foreground">
                  Customize how QBox looks on your device.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Theme</Label>
                <div className="flex gap-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("light")}
                    className="flex-1"
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className="flex-1"
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("system")}
                    className="flex-1"
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    System
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select your preferred theme or use system settings.
                </p>
              </div>
            </TabsContent>

            {/* AI Configuration Tab */}
            <TabsContent value="ai" className="space-y-4 mt-4">
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
                    <Select
                      value={aiSettings.ai_model}
                      onValueChange={(value) => handleSettingsChange("ai_model", value)}
                      disabled={loading}
                    >
                      <SelectTrigger id="ai-model" className="w-full">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>OpenAI</SelectLabel>
                          <SelectItem value="o3-mini">o3 mini</SelectItem>
                          <SelectItem value="o3">o3</SelectItem>
                          <SelectItem value="o4-mini">o4 mini</SelectItem>
                          <SelectItem value="gpt-5">GPT-5</SelectItem>
                          <SelectItem value="gpt-5-mini">GPT-5 mini</SelectItem>
                          <SelectItem value="gpt-5-nano">GPT-5 nano</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Anthropic</SelectLabel>
                          <SelectItem value="claude-sonnet-4-5">Claude Sonnet 4.5</SelectItem>
                          <SelectItem value="claude-haiku-4-5">Claude Haiku 4.5</SelectItem>
                          <SelectItem value="claude-opus-4-5">Claude Opus 4.5</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Google</SelectLabel>
                          <SelectItem value="gemini-3-pro-preview">Gemini 3 Pro Preview</SelectItem>
                          <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                          <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                          <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
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
            </TabsContent>

            {/* Data Management Tab */}
            <TabsContent value="data" className="space-y-4 mt-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <h3 className="text-sm font-medium mb-1">Data Management</h3>
                <p className="text-sm text-muted-foreground">
                  Clear all data to reset the application to its initial state.
                </p>
              </div>

              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-3">
                <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
                <p className="text-sm text-muted-foreground">
                  This action will permanently delete all your data including:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                  <li>All queries and their SQL</li>
                  <li>All database connections</li>
                  <li>All table selections</li>
                  <li>All chat history</li>
                  <li>All cached data</li>
                </ul>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                  disabled={loading}
                  className="w-full mt-4"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Data
                </Button>
              </div>
            </TabsContent>
          </Tabs>
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

