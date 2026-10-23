import { EditorTab, FileTreeNode } from '../types/editor'

export const sampleFiles: EditorTab[] = [
  {
    id: 'sample/user-profile.json',
    name: 'user-profile.json',
    path: 'sample/user-profile.json',
    language: 'json',
    isDirty: false,
    content: `{
  "id": "usr_01HXYZ1234",
  "name": "Ritesh Verma",
  "email": "ritesh@example.com",
  "role": "admin",
  "preferences": {
    "theme": "dark",
    "language": "en",
    "notifications": {
      "email": true,
      "push": false,
      "sms": false
    }
  },
  "createdAt": "2024-01-15T09:00:00Z",
  "lastLogin": "2026-10-23T05:30:00Z",
  "tags": ["developer", "early-adopter", "beta"]
}
`,
    originalContent: `{
  "id": "usr_01HXYZ1234",
  "name": "Ritesh Verma",
  "email": "ritesh@example.com",
  "role": "admin",
  "preferences": {
    "theme": "dark",
    "language": "en",
    "notifications": {
      "email": true,
      "push": false,
      "sms": false
    }
  },
  "createdAt": "2024-01-15T09:00:00Z",
  "lastLogin": "2026-10-23T05:30:00Z",
  "tags": ["developer", "early-adopter", "beta"]
}
`,
  },
  {
    id: 'sample/api-response.json',
    name: 'api-response.json',
    path: 'sample/api-response.json',
    language: 'json',
    isDirty: false,
    content: `{
  "status": "success",
  "code": 200,
  "data": {
    "products": [
      {
        "id": "prod_001",
        "name": "Ajson Studio Pro",
        "price": 49.99,
        "currency": "USD",
        "inStock": true,
        "categories": ["editor", "developer-tool", "json"]
      },
      {
        "id": "prod_002",
        "name": "Ajson Studio Team",
        "price": 129.99,
        "currency": "USD",
        "inStock": true,
        "categories": ["editor", "developer-tool", "collaboration"]
      }
    ],
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 2,
      "hasMore": false
    }
  },
  "meta": {
    "requestId": "req_abc123xyz",
    "timestamp": "2026-10-23T10:00:00Z",
    "version": "v2"
  }
}
`,
    originalContent: `{
  "status": "success",
  "code": 200,
  "data": {
    "products": [
      {
        "id": "prod_001",
        "name": "Ajson Studio Pro",
        "price": 49.99,
        "currency": "USD",
        "inStock": true,
        "categories": ["editor", "developer-tool", "json"]
      },
      {
        "id": "prod_002",
        "name": "Ajson Studio Team",
        "price": 129.99,
        "currency": "USD",
        "inStock": true,
        "categories": ["editor", "developer-tool", "collaboration"]
      }
    ],
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 2,
      "hasMore": false
    }
  },
  "meta": {
    "requestId": "req_abc123xyz",
    "timestamp": "2026-10-23T10:00:00Z",
    "version": "v2"
  }
}
`,
  },
  {
    id: 'sample/config.json',
    name: 'config.json',
    path: 'sample/config.json',
    language: 'json',
    isDirty: false,
    content: `{
  "app": {
    "name": "Ajson Studio",
    "version": "1.0.0",
    "environment": "development",
    "debug": true
  },
  "server": {
    "host": "localhost",
    "port": 3000,
    "cors": {
      "enabled": true,
      "origins": ["http://localhost:5173", "https://ajson.studio"]
    }
  },
  "database": {
    "type": "sqlite",
    "path": "./data/ajson.db",
    "pool": {
      "min": 2,
      "max": 10
    }
  },
  "features": {
    "aiAssistant": true,
    "jsonDiff": true,
    "schemaValidation": true,
    "syntaxHighlighting": true
  }
}
`,
    originalContent: `{
  "app": {
    "name": "Ajson Studio",
    "version": "1.0.0",
    "environment": "development",
    "debug": true
  },
  "server": {
    "host": "localhost",
    "port": 3000,
    "cors": {
      "enabled": true,
      "origins": ["http://localhost:5173", "https://ajson.studio"]
    }
  },
  "database": {
    "type": "sqlite",
    "path": "./data/ajson.db",
    "pool": {
      "min": 2,
      "max": 10
    }
  },
  "features": {
    "aiAssistant": true,
    "jsonDiff": true,
    "schemaValidation": true,
    "syntaxHighlighting": true
  }
}
`,
  },
]

export const sampleFileTree: FileTreeNode[] = [
  {
    id: 'node-sample',
    name: 'sample',
    path: 'sample',
    isDirectory: true,
    children: [
      {
        id: 'node-user-profile',
        name: 'user-profile.json',
        path: 'sample/user-profile.json',
        isDirectory: false,
        extension: '.json',
      },
      {
        id: 'node-api-response',
        name: 'api-response.json',
        path: 'sample/api-response.json',
        isDirectory: false,
        extension: '.json',
      },
      {
        id: 'node-config',
        name: 'config.json',
        path: 'sample/config.json',
        isDirectory: false,
        extension: '.json',
      },
    ],
  },
  {
    id: 'node-package-json',
    name: 'package.json',
    path: 'package.json',
    isDirectory: false,
    extension: '.json',
  },
  {
    id: 'node-readme',
    name: 'README.md',
    path: 'README.md',
    isDirectory: false,
    extension: '.md',
  },
]
