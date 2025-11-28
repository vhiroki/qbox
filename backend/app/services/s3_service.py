"""Service for S3 file listing and metadata operations."""

import boto3
from typing import Any, Optional
from botocore.exceptions import ClientError, NoCredentialsError

from app.models.schemas import ColumnMetadata, DataSourceType
from app.services.connection_repository import ConnectionRepository
from app.services.duckdb_manager import get_duckdb_manager


class S3Service:
    """Service for managing S3 file operations."""

    def __init__(self):
        self.connection_repo = ConnectionRepository()
        self.duckdb_manager = get_duckdb_manager()

    def _get_s3_client(self, connection_id: str):
        """Get boto3 S3 client configured with connection credentials."""
        import logging
        logger = logging.getLogger(__name__)

        # Load connection config
        connection_config = self.connection_repo.get(connection_id)
        if not connection_config:
            raise ValueError(f"Connection {connection_id} not found")

        if connection_config.type != DataSourceType.S3:
            raise ValueError(f"Connection {connection_id} is not an S3 connection")

        config = connection_config.config

        # Configure boto3 session
        session_kwargs: dict[str, Any] = {
            'region_name': config.get('region', 'us-east-1')
        }

        # Use manual credentials if specified
        if config.get('credential_type') == 'manual':
            session_kwargs['aws_access_key_id'] = config.get('aws_access_key_id')
            session_kwargs['aws_secret_access_key'] = config.get('aws_secret_access_key')
            if config.get('aws_session_token'):
                session_kwargs['aws_session_token'] = config.get('aws_session_token')

        session = boto3.Session(**session_kwargs)

        # Configure S3 client with optional custom endpoint
        client_kwargs: dict[str, Any] = {}
        if config.get('endpoint_url'):
            from botocore.client import Config
            client_kwargs['endpoint_url'] = config.get('endpoint_url')
            # Use path-style addressing for custom endpoints (required for LocalStack)
            client_kwargs['config'] = Config(s3={'addressing_style': 'path'})

        return session.client('s3', **client_kwargs), config.get('bucket')

    async def list_files(
        self,
        connection_id: str,
        prefix: str = "",
        max_results: int = 100,
        continuation_token: Optional[str] = None,
        flat: bool = False
    ) -> dict[str, Any]:
        """
        List files and folders in an S3 bucket at a given prefix.

        Args:
            connection_id: S3 connection ID
            prefix: Path prefix to list (e.g., "folder1/folder2/")
            max_results: Maximum number of items to return
            continuation_token: Token for pagination
            flat: If True, list all files with prefix (no folder grouping). If False, hierarchical.

        Returns:
            Dict with:
                - folders: List of folder paths (CommonPrefixes) - empty if flat=True
                - files: List of file objects
                - next_token: Continuation token for next page (if any)
                - truncated: Whether results are truncated
        """
        try:
            s3_client, bucket = self._get_s3_client(connection_id)

            # Build list parameters
            list_params: dict[str, Any] = {
                'Bucket': bucket,
                'Prefix': prefix,
                'MaxKeys': max_results
            }

            # Only use delimiter for hierarchical navigation, not for flat prefix filtering
            if not flat:
                list_params['Delimiter'] = '/'
            
            if continuation_token:
                list_params['ContinuationToken'] = continuation_token
            
            response = s3_client.list_objects_v2(**list_params)
            
            # Extract folders (CommonPrefixes)
            folders = []
            if 'CommonPrefixes' in response:
                for common_prefix in response['CommonPrefixes']:
                    folder_path = common_prefix['Prefix']
                    # Get folder name (last part before trailing /)
                    folder_name = folder_path.rstrip('/').split('/')[-1]
                    folders.append({
                        'name': folder_name,
                        'path': folder_path,
                        'type': 'folder'
                    })
            
            # Extract files (Contents)
            files = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    # Skip the folder itself (empty objects ending with /)
                    if obj['Key'].endswith('/'):
                        continue
                    
                    # Get file name (last part of path)
                    file_name = obj['Key'].split('/')[-1]
                    
                    # Determine file type
                    file_ext = file_name.split('.')[-1].lower() if '.' in file_name else ''
                    
                    files.append({
                        'name': file_name,
                        'path': obj['Key'],
                        'type': 'file',
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat(),
                        'extension': file_ext,
                        'is_structured': file_ext in ['parquet', 'csv', 'xlsx', 'xls', 'json', 'jsonl']
                    })
            
            return {
                'folders': folders,
                'files': files,
                'next_token': response.get('NextContinuationToken'),
                'truncated': response.get('IsTruncated', False),
                'count': len(folders) + len(files)
            }
            
        except NoCredentialsError:
            raise ValueError("AWS credentials not found or invalid")
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'NoSuchBucket':
                raise ValueError(f"Bucket does not exist")
            elif error_code == 'AccessDenied':
                raise ValueError("Access denied to S3 bucket")
            else:
                raise ValueError(f"S3 error: {e.response['Error']['Message']}")
        except Exception as e:
            raise ValueError(f"Failed to list S3 files: {str(e)}")

    async def get_file_metadata(
        self,
        connection_id: str,
        file_path: str
    ) -> dict[str, Any]:
        """
        Get metadata (columns and types) for a structured data file in S3.
        
        Args:
            connection_id: S3 connection ID
            file_path: Full path to the file in the bucket
            
        Returns:
            Dict with:
                - columns: List of ColumnMetadata objects
                - row_count: Approximate row count (if available)
                - file_type: File extension
        """
        try:
            # Get connection config for bucket info
            connection_config = self.connection_repo.get(connection_id)
            if not connection_config:
                raise ValueError(f"Connection {connection_id} not found")
            
            bucket = connection_config.config.get('bucket')
            
            # Determine file type
            file_ext = file_path.split('.')[-1].lower()
            
            if file_ext not in ['parquet', 'csv', 'xlsx', 'xls', 'json', 'jsonl']:
                raise ValueError(f"Unsupported file type: {file_ext}")
            
            # Construct S3 path
            s3_path = f"s3://{bucket}/{file_path}"

            # Ensure S3 secret is configured in DuckDB
            secret_name = self.duckdb_manager.get_attached_alias(connection_id)
            if not secret_name:
                # Configure the S3 secret
                from app.models.schemas import S3ConnectionConfig
                s3_config = S3ConnectionConfig(**connection_config.config)
                self.duckdb_manager.configure_s3_secret(
                    connection_id,
                    connection_config.name,
                    s3_config,
                    custom_alias=connection_config.alias,
                )
                secret_name = self.duckdb_manager.get_attached_alias(connection_id)
            
            # Build query based on file type (secret is auto-used by DuckDB)
            if file_ext == 'parquet':
                # Use DESCRIBE with read_parquet to get metadata
                query = f"DESCRIBE SELECT * FROM read_parquet('{s3_path}')"
            elif file_ext in ['csv']:
                # Read first few rows to infer schema
                query = f"DESCRIBE SELECT * FROM read_csv('{s3_path}', AUTO_DETECT=TRUE)"
            elif file_ext in ['xlsx', 'xls']:
                # DuckDB doesn't have native Excel support, we'll need spatial extension
                # For now, try to read it as CSV (many Excel files can be read this way)
                # TODO: Add proper Excel support using spatial extension
                query = f"DESCRIBE SELECT * FROM read_csv('{s3_path}', AUTO_DETECT=TRUE)"
            elif file_ext in ['json', 'jsonl']:
                query = f"DESCRIBE SELECT * FROM read_json('{s3_path}', AUTO_DETECT=TRUE)"
            else:
                raise ValueError(f"Unsupported file type: {file_ext}")
            
            # Execute query to get schema
            try:
                columns_list, rows = self.duckdb_manager.execute_query(query)
                
                # Parse the schema - DESCRIBE returns: column_name, column_type, null, key, default, extra
                columns = []
                for row in rows:
                    columns.append(ColumnMetadata(
                        name=row.get('column_name', ''),
                        type=row.get('column_type', ''),
                        nullable=row.get('null', 'YES') == 'YES'
                    ))
                
                # Try to get row count (this may be expensive for large files)
                row_count = None
                try:
                    if file_ext == 'parquet':
                        count_query = f"SELECT COUNT(*) as count FROM read_parquet('{s3_path}')"
                    elif file_ext in ['csv']:
                        count_query = f"SELECT COUNT(*) as count FROM read_csv('{s3_path}', AUTO_DETECT=TRUE)"
                    elif file_ext in ['json', 'jsonl']:
                        count_query = f"SELECT COUNT(*) as count FROM read_json('{s3_path}', AUTO_DETECT=TRUE)"
                    else:
                        count_query = None
                    
                    if count_query:
                        _, count_rows = self.duckdb_manager.execute_query(count_query)
                        if count_rows:
                            row_count = count_rows[0].get('count')
                except Exception:
                    # Row count is optional, continue if it fails
                    pass
                
                return {
                    'columns': [col.model_dump() for col in columns],
                    'row_count': row_count,
                    'file_type': file_ext,
                    'file_path': file_path,
                    's3_path': s3_path
                }
                
            except Exception as e:
                raise ValueError(f"Failed to read file schema: {str(e)}")
            
        except Exception as e:
            raise ValueError(f"Failed to get file metadata: {str(e)}")

    def get_file_view_name(self, connection_id: str, file_path: str) -> str:
        """
        Generate a view name for an S3 file.

        Format: s3_{sanitized_file_name}
        """
        # Get file name without extension and sanitize
        file_name = file_path.split('/')[-1]
        if '.' in file_name:
            file_name = '.'.join(file_name.split('.')[:-1])

        # Sanitize file name (keep only alphanumeric and underscores)
        file_name_safe = ''.join(c if c.isalnum() or c == '_' else '_' for c in file_name)

        return f"s3_{file_name_safe}"

    async def create_file_view(
        self,
        connection_id: str,
        file_path: str,
        view_name: Optional[str] = None
    ) -> str:
        """
        Create a DuckDB view for an S3 file.
        
        Args:
            connection_id: S3 connection ID
            file_path: Full path to the file in the bucket
            view_name: Optional custom view name
            
        Returns:
            The view name created
        """
        try:
            # Get connection config
            connection_config = self.connection_repo.get(connection_id)
            if not connection_config:
                raise ValueError(f"Connection {connection_id} not found")
            
            bucket = connection_config.config.get('bucket')
            
            # Generate view name if not provided
            if not view_name:
                view_name = self.get_file_view_name(connection_id, file_path)
            
            # Determine file type
            file_ext = file_path.split('.')[-1].lower()
            
            # Construct S3 path
            s3_path = f"s3://{bucket}/{file_path}"
            
            # Get the secret name for this connection
            secret_name = self.duckdb_manager.get_attached_alias(connection_id)
            if not secret_name:
                raise ValueError(f"S3 connection {connection_id} not configured in DuckDB")
            
            # Build CREATE VIEW query based on file type (secret is auto-used by DuckDB)
            if file_ext == 'parquet':
                create_query = f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM read_parquet('{s3_path}')"
            elif file_ext == 'csv':
                create_query = f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM read_csv('{s3_path}', AUTO_DETECT=TRUE)"
            elif file_ext in ['json', 'jsonl']:
                create_query = f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM read_json('{s3_path}', AUTO_DETECT=TRUE)"
            else:
                raise ValueError(f"Unsupported file type for view creation: {file_ext}")
            
            # Execute the CREATE VIEW query
            self.duckdb_manager.execute_query(create_query)
            
            return view_name
            
        except Exception as e:
            raise ValueError(f"Failed to create view for S3 file: {str(e)}")

    async def drop_file_view(self, view_name: str) -> None:
        """Drop a DuckDB view for an S3 file."""
        try:
            drop_query = f"DROP VIEW IF EXISTS {view_name}"
            self.duckdb_manager.execute_query(drop_query)
        except Exception as e:
            raise ValueError(f"Failed to drop view {view_name}: {str(e)}")


# Singleton instance
_s3_service = None


def get_s3_service() -> S3Service:
    """Get or create the S3 service singleton."""
    global _s3_service
    if _s3_service is None:
        _s3_service = S3Service()
    return _s3_service

