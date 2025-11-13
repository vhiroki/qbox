"""
Connection modules for QBox.

This package provides a plugin-like architecture for different data source types.
Each connection type is implemented as a separate module that registers itself
with the ConnectionRegistry.

To add a new connection type:
1. Create a new directory under connections/ (e.g., connections/mysql/)
2. Implement a DataSourceConnection class that inherits from BaseConnection
3. Register it using @ConnectionRegistry.register(DataSourceType.YOUR_TYPE)
4. The connection will automatically be available without modifying core code
"""

from abc import ABC, abstractmethod
from typing import Any, Optional

from app.models.schemas import DataSourceType, TableSchema


class BaseConnection(ABC):
    """Abstract base class for all data source connections."""

    def __init__(self, connection_id: str, connection_name: str, config: dict[str, Any]):
        self.connection_id = connection_id
        self.connection_name = connection_name
        self.config = config
        self.connection_error: Optional[str] = None

    @abstractmethod
    async def connect(self) -> bool:
        """
        Establish connection to the data source.
        
        Returns:
            True if connection successful, False otherwise.
            If False, set self.connection_error with the error message.
        """
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Close connection to the data source."""
        pass

    @abstractmethod
    async def execute_query(self, query: str) -> tuple[list[str], list[dict[str, Any]]]:
        """
        Execute a query and return results.
        
        Returns:
            Tuple of (column_names, rows)
        """
        pass

    @abstractmethod
    async def get_schema(self) -> list[TableSchema]:
        """Get schema information from the data source."""
        pass

    @abstractmethod
    async def cleanup(self, duckdb_manager) -> None:
        """
        Cleanup resources when connection is deleted.
        
        Args:
            duckdb_manager: DuckDB manager instance for cleanup operations
        """
        pass


class ConnectionRegistry:
    """Registry for connection types. Allows plugins to self-register."""

    _registry: dict[DataSourceType, type[BaseConnection]] = {}

    @classmethod
    def register(cls, connection_type: DataSourceType):
        """
        Decorator to register a connection class for a specific type.
        
        Usage:
            @ConnectionRegistry.register(DataSourceType.POSTGRES)
            class PostgresConnection(BaseConnection):
                ...
        """
        def decorator(connection_class: type[BaseConnection]):
            cls._registry[connection_type] = connection_class
            return connection_class
        return decorator

    @classmethod
    def get(cls, connection_type: DataSourceType) -> Optional[type[BaseConnection]]:
        """Get the connection class for a given type."""
        return cls._registry.get(connection_type)

    @classmethod
    def is_supported(cls, connection_type: DataSourceType) -> bool:
        """Check if a connection type is supported."""
        return connection_type in cls._registry

    @classmethod
    def get_supported_types(cls) -> list[DataSourceType]:
        """Get list of all supported connection types."""
        return list(cls._registry.keys())


# Import connection modules to trigger registration
# New connection types can be added here
from app.connections.postgres import PostgresConnection  # noqa: E402, F401
from app.connections.s3 import S3Connection  # noqa: E402, F401

