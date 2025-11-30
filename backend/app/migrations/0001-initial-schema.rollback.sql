-- Rollback: Drop all tables in reverse dependency order

DROP INDEX IF EXISTS idx_files_query_id;
DROP INDEX IF EXISTS idx_files_name;
DROP TABLE IF EXISTS files;

DROP INDEX IF EXISTS idx_query_sql_history;
DROP TABLE IF EXISTS query_sql_history;

DROP INDEX IF EXISTS idx_query_chat_history;
DROP TABLE IF EXISTS query_chat_history;

DROP INDEX IF EXISTS idx_query_selections;
DROP TABLE IF EXISTS query_selections;

DROP TABLE IF EXISTS queries;

DROP INDEX IF EXISTS idx_connections_alias;
DROP INDEX IF EXISTS idx_connections_name_unique;
DROP TABLE IF EXISTS connections;

DROP TABLE IF EXISTS settings;
