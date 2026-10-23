/**
 * AJSON Studio — JSON Tool Types (Phase 2+)
 */

/** Which JSON tool is currently active */
export type JsonToolId =
  | "editor"
  | "format"
  | "diff"
  | "schema"
  | "jsonpath"
  | "csv"
  | "typescript"
  | "settings"
  | "templates"
  | "ai"
  | "api";

export interface JsonDocument {
  id: string;
  name: string;
  content: string;
  isDirty: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  theme: "dark" | "light" | "system";
  fontSize: number;
  fontFamily: "JetBrains Mono" | "Fira Code" | "Cascadia Code" | "Consolas";
  indentSize: number | "tab";
  wordWrap: boolean;
  defaultView: "editor" | "split";
  autoFormat: boolean;
  sortKeysOnFormat: boolean;
  validateOnType: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  fontSize: 13,
  fontFamily: "JetBrains Mono",
  indentSize: 2,
  wordWrap: false,
  defaultView: "editor",
  autoFormat: false,
  sortKeysOnFormat: false,
  validateOnType: true,
};

export interface JsonTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  content: string;
}

export const JSON_TEMPLATES: JsonTemplate[] = [
  {
    id: "empty-object",
    name: "Empty Object",
    description: "Simple empty JSON object",
    icon: "braces",
    content: "{\n  \n}",
  },
  {
    id: "nested-config",
    name: "Nested Config",
    description: "App configuration with nested sections",
    icon: "settings",
    content: JSON.stringify(
      {
        app: { name: "my-app", version: "1.0.0", debug: false },
        server: { host: "localhost", port: 3000, tls: false },
        database: { url: "postgresql://localhost:5432/db", poolSize: 10, timeout: 30 },
        features: { darkMode: true, analytics: false, beta: false },
      },
      null,
      2
    ),
  },
  {
    id: "api-request",
    name: "API Request",
    description: "Example REST API request body",
    icon: "send",
    content: JSON.stringify(
      {
        method: "POST",
        url: "https://api.example.com/v1/resource",
        headers: { "Content-Type": "application/json", Authorization: "Bearer <token>" },
        body: { field1: "value1", field2: 42, nested: { key: "value" } },
      },
      null,
      2
    ),
  },
  {
    id: "api-response",
    name: "API Response",
    description: "Example REST API response body",
    icon: "download",
    content: JSON.stringify(
      {
        status: 200,
        message: "OK",
        data: { id: "abc123", createdAt: "2024-01-01T00:00:00Z", items: [] },
        meta: { page: 1, limit: 20, total: 0 },
      },
      null,
      2
    ),
  },
  {
    id: "user-profile",
    name: "User Profile",
    description: "User object with common fields",
    icon: "user",
    content: JSON.stringify(
      {
        id: "usr_01j9k2d7bc8x",
        username: "jdoe",
        email: "john.doe@example.com",
        name: { first: "John", last: "Doe" },
        role: "admin",
        active: true,
        createdAt: "2024-01-15T08:30:00Z",
        preferences: { theme: "dark", language: "en", notifications: true },
      },
      null,
      2
    ),
  },
  {
    id: "product-catalog",
    name: "Product Catalog",
    description: "Array of product objects",
    icon: "package",
    content: JSON.stringify(
      [
        {
          id: "prod_001",
          name: "Widget Pro",
          sku: "WGT-PRO-001",
          price: 49.99,
          currency: "USD",
          stock: 142,
          tags: ["widget", "pro", "featured"],
          specs: { weight: "0.5kg", dimensions: "10x5x3cm" },
        },
        {
          id: "prod_002",
          name: "Gadget Lite",
          sku: "GDG-LT-002",
          price: 19.99,
          currency: "USD",
          stock: 0,
          tags: ["gadget", "lite"],
          specs: { weight: "0.2kg", dimensions: "8x4x2cm" },
        },
      ],
      null,
      2
    ),
  },
  {
    id: "json-schema",
    name: "JSON Schema",
    description: "JSON Schema draft-07 skeleton",
    icon: "file-check",
    content: JSON.stringify(
      {
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "ExampleSchema",
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string", description: "Unique identifier" },
          name: { type: "string", minLength: 1, maxLength: 100 },
          age: { type: "integer", minimum: 0, maximum: 150 },
          active: { type: "boolean", default: true },
          tags: { type: "array", items: { type: "string" }, uniqueItems: true },
        },
        additionalProperties: false,
      },
      null,
      2
    ),
  },
  {
    id: "array-of-objects",
    name: "Array of Objects",
    description: "Generic records array",
    icon: "list",
    content: JSON.stringify(
      [
        { id: 1, label: "Item One", value: 100, active: true },
        { id: 2, label: "Item Two", value: 200, active: false },
        { id: 3, label: "Item Three", value: 300, active: true },
      ],
      null,
      2
    ),
  },
];
