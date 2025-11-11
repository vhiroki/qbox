import React from 'react';
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
  aliasReadOnly?: boolean;
  onValidationChange?: (isValid: boolean) => void;
}

export function validateAlias(alias: string): { isValid: boolean; error: string | null } {
  if (!alias || alias.trim() === '') {
    return { isValid: true, error: null }; // Empty is allowed (auto-generate)
  }

  // Must be 3-50 characters
  if (alias.length < 3) {
    return { isValid: false, error: 'Alias must be at least 3 characters long' };
  }
  if (alias.length > 50) {
    return { isValid: false, error: 'Alias cannot exceed 50 characters' };
  }

  // Must start with a letter
  if (!/^[a-zA-Z]/.test(alias)) {
    return { isValid: false, error: 'Alias must start with a letter' };
  }

  // Must contain only alphanumeric characters and underscores
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(alias)) {
    return { isValid: false, error: 'Alias can only contain letters, numbers, and underscores' };
  }

  return { isValid: true, error: null };
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
  aliasReadOnly = false,
  onValidationChange,
}: ConnectionFormFieldsProps) {
  const aliasValidation = validateAlias(connectionAlias);

  // Notify parent of validation status changes
  React.useEffect(() => {
    if (onValidationChange) {
      onValidationChange(aliasValidation.isValid);
    }
  }, [aliasValidation.isValid, onValidationChange]);
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
          Database Alias {!aliasReadOnly && '(Optional)'}
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
          readOnly={aliasReadOnly}
          disabled={aliasReadOnly}
          className={
            aliasReadOnly
              ? 'bg-muted cursor-not-allowed'
              : !aliasValidation.isValid && connectionAlias
              ? 'border-destructive focus-visible:ring-destructive'
              : ''
          }
        />
        {!showPasswordPlaceholder && !aliasReadOnly && !connectionAlias && (
          <p className="text-xs text-muted-foreground">
            Leave empty to auto-generate from connection name
          </p>
        )}
        {!aliasReadOnly && connectionAlias && !aliasValidation.isValid && (
          <p className="text-xs text-destructive">
            {aliasValidation.error}
          </p>
        )}
        {!aliasReadOnly && connectionAlias && aliasValidation.isValid && (
          <p className="text-xs text-green-600 dark:text-green-400">
            ✓ Valid alias format
          </p>
        )}
        {aliasReadOnly && (
          <p className="text-xs text-muted-foreground">
            Alias cannot be changed after creation to prevent breaking existing queries
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

