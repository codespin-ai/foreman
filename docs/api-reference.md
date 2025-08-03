# Foreman API Reference

## Authentication

All API requests require authentication using an API key in the Authorization header:

```
Authorization: Bearer your-api-key-here
```

## Base URL

```
http://localhost:3000/api/v1
```

## Endpoints

### Runs

#### Create Run
```http
POST /runs
```

Request Body:
```json
{
  "inputData": { /* any JSON data */ },
  "metadata": { /* optional metadata */ }
}
```

Response:
```json
{
  "id": "uuid",
  "orgId": "string",
  "status": "pending",
  "inputData": { /* your input data */ },
  "metadata": { /* your metadata */ },
  "totalTasks": 0,
  "completedTasks": 0,
  "failedTasks": 0,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### Get Run
```http
GET /runs/:id
```

Response: Run object

#### Update Run
```http
PATCH /runs/:id
```

Request Body:
```json
{
  "status": "running|completed|failed|cancelled",
  "outputData": { /* optional output */ },
  "errorData": { /* optional error details */ },
  "metadata": { /* optional metadata update */ }
}
```

Response: Updated run object

#### List Runs
```http
GET /runs?limit=20&offset=0&status=pending&sortBy=created_at&sortOrder=desc
```

Response:
```json
{
  "items": [ /* array of runs */ ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

### Tasks

#### Create Task
```http
POST /tasks
```

Request Body:
```json
{
  "runId": "uuid",
  "parentTaskId": "uuid", // optional
  "type": "string",
  "inputData": { /* any JSON data */ },
  "metadata": { /* optional metadata */ },
  "maxRetries": 3 // optional, 0-10
}
```

Response: Task object

#### Get Task
```http
GET /tasks/:id
```

Response:
```json
{
  "id": "uuid",
  "runId": "uuid",
  "parentTaskId": "uuid",
  "orgId": "string",
  "type": "string",
  "status": "pending|queued|running|completed|failed|cancelled|retrying",
  "inputData": { /* task input */ },
  "outputData": { /* task output */ },
  "errorData": { /* error details */ },
  "metadata": { /* metadata */ },
  "retryCount": 0,
  "maxRetries": 3,
  "createdAt": "2024-01-01T00:00:00Z",
  "queuedAt": "2024-01-01T00:00:00Z",
  "startedAt": "2024-01-01T00:00:00Z",
  "completedAt": "2024-01-01T00:00:00Z",
  "durationMs": 1234,
  "queueJobId": "external-queue-job-id"
}
```

#### Update Task
```http
PATCH /tasks/:id
```

Request Body:
```json
{
  "status": "pending|queued|running|completed|failed|cancelled|retrying",
  "outputData": { /* optional output */ },
  "errorData": { /* optional error details */ },
  "metadata": { /* optional metadata update */ },
  "queueJobId": "string" // optional external queue ID
}
```

Response: Updated task object

### Run Data

#### Create/Update Run Data
```http
POST /runs/:runId/data
```

Request Body:
```json
{
  "taskId": "uuid",
  "key": "string",
  "value": { /* any JSON data */ },
  "metadata": { /* optional metadata */ }
}
```

Response: RunData object

#### Get Run Data
```http
GET /runs/:runId/data/:key
```

Response:
```json
{
  "id": "uuid",
  "runId": "uuid",
  "taskId": "uuid",
  "orgId": "string",
  "key": "string",
  "value": { /* stored value */ },
  "metadata": { /* metadata */ },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### List Run Data
```http
GET /runs/:runId/data
```

Response:
```json
{
  "items": [ /* array of RunData objects */ ]
}
```

## Status Codes

- `200 OK` - Successful GET/PATCH requests
- `201 Created` - Successful POST requests
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid API key
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Error Response Format

```json
{
  "error": "Error message",
  "details": [ /* optional validation errors */ ]
}
```

## Permissions

API keys can have the following permissions:
- `runs:create` - Create runs
- `runs:read` - Read runs
- `runs:update` - Update runs
- `tasks:create` - Create tasks
- `tasks:read` - Read tasks
- `tasks:update` - Update tasks
- `rundata:read` - Read run data
- `rundata:write` - Write run data
- `*` - All permissions