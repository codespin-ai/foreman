# Configuration

This document describes all configuration options for Foreman.

## Environment Variables

Foreman uses environment variables for configuration. Most have sensible defaults for development.

### Database Configuration

| Variable              | Description           | Default     | Required |
| --------------------- | --------------------- | ----------- | -------- |
| `FOREMAN_DB_HOST`     | PostgreSQL host       | `localhost` | Yes      |
| `FOREMAN_DB_PORT`     | PostgreSQL port       | `5432`      | Yes      |
| `FOREMAN_DB_NAME`     | Database name         | `foreman`   | Yes      |
| `FOREMAN_DB_USER`     | Database user         | `postgres`  | Yes      |
| `FOREMAN_DB_PASSWORD` | Database password     | -           | Yes      |
| `FOREMAN_DB_SSL`      | Enable SSL connection | `false`     | No       |

### Redis Configuration

| Variable         | Description           | Default     |
| ---------------- | --------------------- | ----------- |
| `REDIS_HOST`     | Redis host            | `localhost` |
| `REDIS_PORT`     | Redis port            | `6379`      |
| `REDIS_PASSWORD` | Redis password        | -           |
| `REDIS_DB`       | Redis database number | `0`         |

### Queue Configuration

| Variable            | Description              | Default           |
| ------------------- | ------------------------ | ----------------- |
| `TASK_QUEUE_NAME`   | BullMQ task queue name   | `foreman:tasks`   |
| `RESULT_QUEUE_NAME` | BullMQ result queue name | `foreman:results` |

### Server Configuration

| Variable      | Description                            | Default       |
| ------------- | -------------------------------------- | ------------- |
| `PORT`        | Server port                            | `3000`        |
| `LOG_LEVEL`   | Logging level (debug/info/warn/error)  | `info`        |
| `NODE_ENV`    | Environment (development/production)   | `development` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `*`           |

### Authentication Configuration

| Variable                  | Description                   | Default                  |
| ------------------------- | ----------------------------- | ------------------------ |
| `FOREMAN_API_KEY`         | Default API key for testing   | -                        |
| `FOREMAN_API_KEY_ENABLED` | Enable API key authentication | `true` if API key is set |

**Note**: In production, always use proper API keys. The format is: `fmn_[environment]_[organizationId]_[random]`

### Rate Limiting

| Variable                  | Description                       | Default           |
| ------------------------- | --------------------------------- | ----------------- |
| `RATE_LIMIT_WINDOW_MS`    | Rate limit window in milliseconds | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window           | `100`             |

### Docker-Specific Configuration

| Variable         | Description                             | Default |
| ---------------- | --------------------------------------- | ------- |
| `RUN_MIGRATIONS` | Auto-run database migrations on startup | `false` |

## Configuration Examples

### Development Environment

```bash
# Database
export FOREMAN_DB_HOST=localhost
export FOREMAN_DB_PORT=5432
export FOREMAN_DB_NAME=foreman
export FOREMAN_DB_USER=postgres
export FOREMAN_DB_PASSWORD=postgres

# Redis
export REDIS_HOST=localhost
export REDIS_PORT=6379

# Server
export PORT=3000
export LOG_LEVEL=debug

# Test API key
export FOREMAN_API_KEY=fmn_dev_testorg_123
```

### Production Environment

```bash
# Database
export FOREMAN_DB_HOST=prod-db.example.com
export FOREMAN_DB_PORT=5432
export FOREMAN_DB_NAME=foreman_prod
export FOREMAN_DB_USER=foreman_app
export FOREMAN_DB_PASSWORD=secure-password-here
export FOREMAN_DB_SSL=true

# Redis
export REDIS_HOST=redis.example.com
export REDIS_PORT=6379
export REDIS_PASSWORD=redis-password-here

# Server
export PORT=3000
export LOG_LEVEL=info
export NODE_ENV=production
export CORS_ORIGIN=https://app.example.com,https://admin.example.com

# Queues (custom names for isolation)
export TASK_QUEUE_NAME=prod:foreman:tasks
export RESULT_QUEUE_NAME=prod:foreman:results

# Rate limiting
export RATE_LIMIT_WINDOW_MS=60000  # 1 minute
export RATE_LIMIT_MAX_REQUESTS=50
```

### Docker Deployment

```bash
# With auto-migration for first deployment
docker run -p 3000:3000 \
  -e FOREMAN_DB_HOST=postgres \
  -e FOREMAN_DB_USER=postgres \
  -e FOREMAN_DB_PASSWORD=postgres \
  -e REDIS_HOST=redis \
  -e RUN_MIGRATIONS=true \
  ghcr.io/codespin-ai/foreman:latest
```

## Using .env Files

While not included by default, you can use `.env` files with a package like `dotenv`. An `.env.example` file is provided as a template:

```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env

# Load in your application
# Add to your startup script: require("dotenv").config()
```

## Client Configuration

The foreman-client library uses these environment variables as defaults:

| Variable           | Description                             |
| ------------------ | --------------------------------------- |
| `FOREMAN_ENDPOINT` | Default Foreman server URL              |
| `FOREMAN_API_KEY`  | Default API key for authentication      |
| `FOREMAN_TIMEOUT`  | Default request timeout in milliseconds |

## Configuration Validation

The server validates configuration on startup:

- Required database configuration must be present
- Redis configuration is validated when Redis features are used
- API key format is validated if authentication is enabled

## Security Notes

1. **Never commit secrets** - Use environment variables or secret management systems
2. **Rotate API keys regularly** - Generate new keys periodically
3. **Use SSL in production** - Enable `FOREMAN_DB_SSL` for database connections
4. **Restrict CORS origins** - Don"t use `*` in production
5. **Enable rate limiting** - Protect against abuse
