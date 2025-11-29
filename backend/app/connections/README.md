# Connection Modules

This directory contains modular connection implementations for QBox. Each connection type is self-contained and automatically registered with the system.

## Table of Contents

- [Architecture](#architecture)
- [Adding a New Connection Type](#adding-a-new-connection-type)
  - [1. Create a new directory](#1-create-a-new-directory)
  - [2. Create __init__.py with your connection class](#2-create-__init__py-with-your-connection-class)
  - [3. Register your connection module](#3-register-your-connection-module)
  - [4. Add the connection type to models](#4-add-the-connection-type-to-models)
  - [5. That's it!](#5-thats-it)
- [Example Connections](#example-connections)
  - [PostgreSQL (app/connections/postgres/)](#postgresql-appconnectionspostgres)
  - [S3 (app/connections/s3/)](#s3-appconnectionss3)
- [Connection Lifecycle](#connection-lifecycle)
- [Key Methods](#key-methods)
  - [connect() -> bool](#connect---bool)
  - [disconnect() -> None](#disconnect---none)
  - [execute_query(query: str) -> tuple[list[str], list[dict]]](#execute_queryquery-str---tupleliststr-listdict)
  - [get_schema() -> list[TableSchema]](#get_schema---listtableschema)
  - [cleanup(duckdb_manager) -> None](#cleanupduckdb_manager---none)
- [Best Practices](#best-practices)

## Architecture

The connection system uses a **plugin-like architecture** with these components:

1. **BaseConnection** - Abstract base class that all connections must inherit from
2. **ConnectionRegistry** - Auto-discovery registry that connections register with
3. **Connection Modules** - Self-contained implementations in their own directories

## Adding a New Connection Type

To add a new connection type (e.g., MySQL), follow these steps:

### 1. Create a new directory

```bash
mkdir app/connections/mysql
```

### 2. Create `__init__.py` with your connection class

```python
"""MySQL connection module."""

from typing import Any

from app.connections import BaseConnection, ConnectionRegistry
from app.models.schemas import DataSourceType, TableSchema
# Import your config model (create it in schemas.py first)
from app.models.schemas import MySQLConnectionConfig


@ConnectionRegistry.register(DataSourceType.MYSQL)
class MySQLConnection(BaseConnection):
    """MySQL data source connection."""

    def __init__(self, connection_id: str, connection_name: str, config: dict[str, Any]):
        super().__init__(connection_id, connection_name, config)
        # Parse and validate config
        self.mysql_config = MySQLConnectionConfig(**config)

    async def connect(self) -> bool:
        """Connect to MySQL."""
        try:
            # Your connection logic here
            # ...
            return True
        except Exception as e:
            self.connection_error = str(e)
            return False

    async def disconnect(self) -> None:
        """Disconnect from MySQL."""
        # Your disconnect logic
        pass

    async def execute_query(self, query: str) -> tuple[list[str], list[dict[str, Any]]]:
        """Execute a SQL query."""
        # Your query execution logic
        pass

    async def get_schema(self) -> list[TableSchema]:
        """Get schema information."""
        # Your schema retrieval logic
        pass

    async def cleanup(self, duckdb_manager) -> None:
        """Cleanup when connection is deleted."""
        # Your cleanup logic (e.g., detach from DuckDB)
        pass
```

### 3. Register your connection module

Add the import to `app/connections/__init__.py`:

```python
# Import connection modules to trigger registration
from app.connections.postgres import PostgresConnection  # noqa: E402, F401
from app.connections.s3 import S3Connection  # noqa: E402, F401
from app.connections.mysql import MySQLConnection  # noqa: E402, F401  # <- Add this
```

### 4. Add the connection type to models

In `app/models/schemas.py`, add your type to the enum and create a config model:

```python
class DataSourceType(str, Enum):
    POSTGRES = "postgres"
    S3 = "s3"
    MYSQL = "mysql"  # <- Add this
    # ...

class MySQLConnectionConfig(BaseModel):
    """MySQL connection configuration."""
    host: str
    port: int = 3306
    database: str
    username: str
    password: str
    # ... other MySQL-specific fields
```

### 5. That's it!

Your new connection type will automatically:
- Be available in the ConnectionManager
- Work with all existing APIs
- Be selectable in the frontend

**No changes needed to core code!**

## Example Connections

### PostgreSQL (`app/connections/postgres/`)
- Attaches to DuckDB using the postgres extension
- Supports multiple schemas
- Full database operations

### S3 (`app/connections/s3/`)
- Configures AWS credentials as DuckDB secrets
- Files queried directly using `s3://` paths
- Supports both manual and credential chain authentication

## Connection Lifecycle

1. **Creation**: `connect()` is called to establish the connection
2. **Usage**: `execute_query()` and `get_schema()` are used during operation
3. **Update**: Connection is disconnected and cleaned up, then recreated
4. **Deletion**: `disconnect()` and `cleanup()` are called to remove all resources

## Key Methods

### `connect() -> bool`
Establish connection to the data source. Return `True` on success, `False` on failure.
If failed, set `self.connection_error` with the error message for user feedback.

### `disconnect() -> None`
Close the connection and release immediate resources.

### `execute_query(query: str) -> tuple[list[str], list[dict]]`
Execute a SQL query and return (columns, rows).

### `get_schema() -> list[TableSchema]`
Get schema/metadata information from the data source.

### `cleanup(duckdb_manager) -> None`
Clean up persistent resources when connection is deleted (e.g., detach from DuckDB, drop secrets).

## Best Practices

1. **Always validate config** - Use Pydantic models for type safety
2. **Store errors** - Set `self.connection_error` when `connect()` fails
3. **Handle cleanup** - Implement `cleanup()` to remove all persistent state
4. **Be idempotent** - Connection operations should be safe to retry
5. **Document behavior** - Add docstrings explaining connection semantics

