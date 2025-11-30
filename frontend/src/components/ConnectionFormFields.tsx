import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PostgresConfig, S3Config, ConnectionType } from '../types';
import { generateDuckDBIdentifier } from '../utils/identifier';

interface ConnectionFormFieldsProps {
  connectionType?: ConnectionType;
  connectionName: string;
  formData: PostgresConfig | S3Config;
  onTypeChange?: (type: ConnectionType) => void;
  onNameChange: (name: string) => void;
  onFormDataChange: (data: Partial<PostgresConfig | S3Config>) => void;
  showPasswordPlaceholder?: boolean;
  nameRequired?: boolean;
  typeReadOnly?: boolean;
}

export default function ConnectionFormFields({
  connectionType = 'postgres',
  connectionName,
  formData,
  onTypeChange,
  onNameChange,
  onFormDataChange,
  showPasswordPlaceholder = false,
  nameRequired = false,
  typeReadOnly = false,
}: ConnectionFormFieldsProps) {
  const identifierPreview = React.useMemo(() => generateDuckDBIdentifier(connectionName), [connectionName]);

  // Type guards for form data
  const isPostgresConfig = (_data: PostgresConfig | S3Config): _data is PostgresConfig => {
    return connectionType === 'postgres';
  };

  const isS3Config = (_data: PostgresConfig | S3Config): _data is S3Config => {
    return connectionType === 's3';
  };

  return (
    <>
      {/* Connection Type Selector */}
      {onTypeChange && !typeReadOnly && (
        <div className="space-y-2">
          <Label htmlFor="connection-type">Connection Type</Label>
          <Select value={connectionType} onValueChange={(value) => onTypeChange(value as ConnectionType)}>
            <SelectTrigger id="connection-type">
              <SelectValue placeholder="Select connection type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="postgres">PostgreSQL</SelectItem>
              <SelectItem value="s3">AWS S3</SelectItem>
              <SelectItem value="mysql" disabled>MySQL (Coming Soon)</SelectItem>
              <SelectItem value="oracle" disabled>Oracle (Coming Soon)</SelectItem>
              <SelectItem value="dynamodb" disabled>DynamoDB (Coming Soon)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="connection-name">Connection Name</Label>
        <Input
          id="connection-name"
          type="text"
          value={connectionName}
          onChange={(e) => onNameChange(e.target.value)}
          required={nameRequired}
          placeholder={connectionType === 's3' ? 'My S3 Bucket' : 'My Database'}
          disabled={typeReadOnly}
        />
        {identifierPreview && (
          <p className="text-xs text-muted-foreground">
            SQL identifier: <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">{identifierPreview}</code>
          </p>
        )}
        {typeReadOnly && (
          <p className="text-xs text-yellow-600 dark:text-yellow-500">
            Connection name cannot be changed as it would break existing queries that reference this connection.
          </p>
        )}
      </div>

      {/* PostgreSQL-specific fields */}
      {connectionType === 'postgres' && isPostgresConfig(formData) && (
        <>
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
            <Label htmlFor="schemas">
              Schemas <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="schemas"
              type="text"
              value={formData.schemas}
              onChange={(e) => onFormDataChange({ schemas: e.target.value })}
              placeholder="e.g., public, analytics"
            />
            <p className="text-xs text-muted-foreground">
              Enter schema names separated by commas (e.g., <code className="text-xs">public, analytics</code>).
              Leave blank to include all schemas.
            </p>
          </div>
        </>
      )}

      {/* S3-specific fields */}
      {connectionType === 's3' && isS3Config(formData) && (
        <>
          <div className="space-y-2">
            <Label htmlFor="bucket">S3 Bucket Name</Label>
            <Input
              id="bucket"
              type="text"
              value={formData.bucket || ''}
              onChange={(e) => onFormDataChange({ bucket: e.target.value })}
              placeholder="my-data-bucket"
              required={nameRequired}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">
              AWS Region <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="region"
              type="text"
              value={formData.region || 'us-east-1'}
              onChange={(e) => onFormDataChange({ region: e.target.value })}
              placeholder="us-east-1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endpoint-url">
              Endpoint URL <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="endpoint-url"
              type="text"
              value={formData.endpoint_url || ''}
              onChange={(e) => onFormDataChange({ endpoint_url: e.target.value })}
              placeholder="http://localhost:4566"
            />
            <p className="text-xs text-muted-foreground">
              Custom S3 endpoint for LocalStack or S3-compatible services. Leave blank for AWS S3.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="credential-type">Credential Type</Label>
            <Select
              value={formData.credential_type || 'default'}
              onValueChange={(value) => onFormDataChange({ credential_type: value as 'default' | 'manual' })}
            >
              <SelectTrigger id="credential-type">
                <SelectValue placeholder="Select credential type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default AWS Credential Provider Chain</SelectItem>
                <SelectItem value="manual">Manual Credentials</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formData.credential_type === 'manual'
                ? 'Provide AWS access keys explicitly'
                : 'Use credentials from environment variables or ~/.aws/credentials'}
            </p>
          </div>

          {/* Manual credentials fields */}
          {formData.credential_type === 'manual' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="aws_access_key_id">AWS Access Key ID</Label>
                <Input
                  id="aws_access_key_id"
                  type="text"
                  value={formData.aws_access_key_id || ''}
                  onChange={(e) => onFormDataChange({ aws_access_key_id: e.target.value })}
                  placeholder={showPasswordPlaceholder ? "Leave blank to keep existing" : "AKIAIOSFODNN7EXAMPLE"}
                  required={nameRequired && !showPasswordPlaceholder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aws_secret_access_key">AWS Secret Access Key</Label>
                <Input
                  id="aws_secret_access_key"
                  type="password"
                  value={formData.aws_secret_access_key || ''}
                  onChange={(e) => onFormDataChange({ aws_secret_access_key: e.target.value })}
                  placeholder={showPasswordPlaceholder ? "Leave blank to keep existing" : undefined}
                  required={nameRequired && !showPasswordPlaceholder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aws_session_token">
                  AWS Session Token <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  id="aws_session_token"
                  type="password"
                  value={formData.aws_session_token || ''}
                  onChange={(e) => onFormDataChange({ aws_session_token: e.target.value })}
                  placeholder={showPasswordPlaceholder ? "Leave blank to keep existing" : "For temporary credentials"}
                />
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

