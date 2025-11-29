-- Initial QBox schema migration
-- This migration creates all 7 tables for QBox v0.1.0
-- depends:

-- =============================================================================
-- CONNECTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL,
    alias TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_name_unique
    ON connections(name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_alias
    ON connections(alias) WHERE alias IS NOT NULL;

-- =============================================================================
-- QUERIES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS queries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sql_text TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- QUERY SELECTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS query_selections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_id TEXT NOT NULL,
    connection_id TEXT NOT NULL,
    schema_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    source_type TEXT DEFAULT 'connection',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(query_id, connection_id, schema_name, table_name),
    FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_query_selections
    ON query_selections(query_id);

-- =============================================================================
-- QUERY CHAT HISTORY TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS query_chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_id TEXT NOT NULL,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_query_chat_history
    ON query_chat_history(query_id, created_at);

-- =============================================================================
-- QUERY SQL HISTORY TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS query_sql_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_id TEXT NOT NULL,
    sql_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_query_sql_history
    ON query_sql_history(query_id, created_at DESC);

-- =============================================================================
-- FILES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    size_bytes INTEGER,
    view_name TEXT,
    query_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_name
    ON files(name);

CREATE INDEX IF NOT EXISTS idx_files_query_id
    ON files(query_id);

-- =============================================================================
-- SETTINGS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
