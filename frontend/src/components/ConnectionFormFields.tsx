import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PostgresConfig } from '../types';

interface ConnectionFormFieldsProps {
  connectionName: string;
  connectionAlias: string;
  formData: PostgresConfig;
  onNameChange: (name: string) => void;
  onAliasChange: (alias: string) => void;
  onFormDataChange: (data: Partial<PostgresConfig>) => void;
  showPasswordPlaceholder?: boolean;
  nameRequired?: boolean;
}

export default function ConnectionFormFields({
  connectionName,
  connectionAlias,
  formData,
  onNameChange,
  onAliasChange,
  onFormDataChange,
  showPasswordPlaceholder = false,
  nameRequired = false,
}: ConnectionFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="connection-name">Connection Name</Label>
        <Input
          id="connection-name"
          type="text"
          value={connectionName}
          onChange={(e) => onNameChange(e.target.value)}
          required={nameRequired}
          placeholder="My Database"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="connection-alias">
          Database Alias (Optional)
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            Used in SQL queries (e.g., <code className="text-xs">pg_production</code>)
          </span>
        </Label>
        <Input
          id="connection-alias"
          type="text"
          value={connectionAlias}
          onChange={(e) => onAliasChange(e.target.value)}
          placeholder="production"
          pattern="[a-zA-Z][a-zA-Z0-9_]{2,49}"
          title="3-50 characters, start with letter, only alphanumeric and underscores"
        />
        {!showPasswordPlaceholder && (
          <p className="text-xs text-muted-foreground">
            Leave empty to auto-generate from connection name
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="host">Host</Label>
          <Input
            id="host"
            type="text"
            value={formData.host}
            onChange={(e) => onFormDataChange({ host: e.target.value })}
            required={nameRequired}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            value={formData.port}
            onChange={(e) => onFormDataChange({ port: parseInt(e.target.value) })}
            required={nameRequired}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="database">Database</Label>
        <Input
          id="database"
          type="text"
          value={formData.database}
          onChange={(e) => onFormDataChange({ database: e.target.value })}
          required={nameRequired}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          value={formData.username}
          onChange={(e) => onFormDataChange({ username: e.target.value })}
          required={nameRequired}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => onFormDataChange({ password: e.target.value })}
          placeholder={showPasswordPlaceholder ? "Leave blank to keep existing" : undefined}
          required={nameRequired && !showPasswordPlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="schema">Schema</Label>
        <Input
          id="schema"
          type="text"
          value={formData.schema}
          onChange={(e) => onFormDataChange({ schema: e.target.value })}
        />
      </div>
    </>
  );
}

