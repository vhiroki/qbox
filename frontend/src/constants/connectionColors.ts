/**
 * Centralized color definitions for connection/data source types.
 * Use these constants throughout the app for consistent styling.
 */

export type SourceType = "connection" | "s3" | "file";
export type ConnectionType = "postgres" | "s3" | "mysql" | "oracle" | "dynamodb";

/**
 * Icon colors for each source type (used with Tailwind text-* classes)
 */
export const SOURCE_TYPE_ICON_COLORS: Record<SourceType, string> = {
  connection: "text-blue-500",
  s3: "text-orange-500",
  file: "text-green-500",
};

/**
 * Icon colors for connection types in the Connection Manager
 */
export const CONNECTION_TYPE_ICON_COLORS: Record<ConnectionType | string, string> = {
  postgres: "text-blue-500",
  s3: "text-orange-500",
  mysql: "text-muted-foreground",
  oracle: "text-muted-foreground",
  dynamodb: "text-muted-foreground",
};

/**
 * Badge classes for connection types (background, text, and border)
 */
export const CONNECTION_TYPE_BADGE_CLASSES: Record<ConnectionType | string, string> = {
  postgres: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  s3: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  mysql: "bg-muted text-muted-foreground border-border",
  oracle: "bg-muted text-muted-foreground border-border",
  dynamodb: "bg-muted text-muted-foreground border-border",
};

/**
 * Default/fallback colors
 */
export const DEFAULT_ICON_COLOR = "text-muted-foreground";
export const DEFAULT_BADGE_CLASSES = "bg-muted text-muted-foreground border-border";

/**
 * Helper to get icon color for a source type
 */
export function getSourceTypeIconColor(sourceType: string): string {
  return SOURCE_TYPE_ICON_COLORS[sourceType as SourceType] || DEFAULT_ICON_COLOR;
}

/**
 * Helper to get icon color for a connection type
 */
export function getConnectionTypeIconColor(connectionType: string): string {
  return CONNECTION_TYPE_ICON_COLORS[connectionType] || DEFAULT_ICON_COLOR;
}

/**
 * Helper to get badge classes for a connection type
 */
export function getConnectionTypeBadgeClasses(connectionType: string): string {
  return CONNECTION_TYPE_BADGE_CLASSES[connectionType] || DEFAULT_BADGE_CLASSES;
}
