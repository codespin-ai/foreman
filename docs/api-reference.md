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

#### Create Run Data
```http
POST /runs/:runId/data
```

Creates a new run data entry. Multiple entries with the same key are allowed.

Request Body:
```json
{
  "taskId": "uuid",
  "key": "string",
  "value": { /* any JSON data */ },
  "tags": ["tag1", "tag2"], // optional array of tags
  "metadata": { /* optional metadata */ }
}
```

Response: RunData object

#### Query Run Data
```http
GET /runs/:runId/data
```

Query run data with flexible filtering options.

Query Parameters:
- `key` - Exact key match
- `keys` - Comma-separated list of exact keys
- `keyStartsWith` - Comma-separated list of key prefixes
- `keyPattern` - Glob pattern for key matching (e.g., "config.*")
- `tags` - Comma-separated list of tags to match
- `tagStartsWith` - Comma-separated list of tag prefixes
- `tagMode` - "any" (default) or "all" for tag matching
- `includeAll` - "true" to get all values (not just latest per key)
- `limit` - Max results (1-1000, default: 100)
- `offset` - Pagination offset (default: 0)
- `sortBy` - "created_at" (default), "updated_at", or "key"
- `sortOrder` - "desc" (default) or "asc"

Examples:
```http
# Get latest value for a specific key
GET /runs/:runId/data?key=customer-data

# Get all values for multiple keys
GET /runs/:runId/data?keys=temp,humidity&includeAll=true

# Query by key prefix
GET /runs/:runId/data?keyStartsWith=sensor.temp

# Query by tags (ANY mode)
GET /runs/:runId/data?tags=production,europe

# Query by tags (ALL mode)
GET /runs/:runId/data?tags=production,europe&tagMode=all

# Complex query
GET /runs/:runId/data?keyStartsWith=sensor.&tags=building-A&limit=50
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "runId": "uuid",
      "taskId": "uuid",
      "orgId": "string",
      "key": "string",
      "value": { /* stored value */ },
      "tags": ["tag1", "tag2"],
      "metadata": { /* metadata */ },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 250
  }
}
```

#### Update Run Data Tags
```http
PATCH /runs/:runId/data/:dataId/tags
```

Add or remove tags from an existing run data entry.

Request Body:
```json
{
  "add": ["new-tag1", "new-tag2"],    // optional tags to add
  "remove": ["old-tag1", "old-tag2"]  // optional tags to remove
}
```

Response: Updated RunData object

#### Delete Run Data
```http
DELETE /runs/:runId/data
```

Delete run data entries by key or ID.

Query Parameters (one required):
- `key` - Delete all entries with this key
- `id` - Delete specific entry by ID

Examples:
```http
# Delete all entries for a key
DELETE /runs/:runId/data?key=temp-data

# Delete specific entry
DELETE /runs/:runId/data?id=uuid
```

Response:
```json
{
  "deleted": 2  // number of entries deleted
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

## Authentication

All endpoints require authentication using a Bearer token:

```
Authorization: Bearer fmn_[environment]_[organizationId]_[random]
```

Example: `Authorization: Bearer fmn_prod_myorg_abc123`

Since Foreman runs in a fully trusted environment, authenticated users have full access to all operations within their organization.