// Helper function to generate DuckDB identifier from connection name
// This mirrors the backend logic in duckdb_manager.py
export function generateDuckDBIdentifier(name: string): string {
  if (!name) return '';

  // Convert to lowercase and replace special chars with underscores
  let sanitized = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, '');

  // Ensure it doesn't start with a digit
  if (sanitized && /^[0-9]/.test(sanitized)) {
    sanitized = `db_${sanitized}`;
  }

  // Truncate to 50 chars
  if (sanitized.length > 50) {
    sanitized = sanitized.substring(0, 50).replace(/_+$/, '');
  }

  return sanitized;
}
