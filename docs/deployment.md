# Deployment Guide

This guide covers various deployment options for Foreman.

## Docker Deployment

### Quick Start with Docker

Pull and run the official Docker image:

```bash
# Pull the latest image
docker pull ghcr.io/codespin-ai/foreman:latest

# Run with environment variables
docker run -p 3000:3000 \
  -e FOREMAN_DB_HOST=your-db-host \
  -e FOREMAN_DB_USER=postgres \
  -e FOREMAN_DB_PASSWORD=your-password \
  -e REDIS_HOST=your-redis-host \
  -e RUN_MIGRATIONS=true \
  ghcr.io/codespin-ai/foreman:latest
```

**Note**: Set `RUN_MIGRATIONS=true` for automatic database migrations on first run.

### Building Docker Images

Build your own Docker image:

```bash
# From project root
./scripts/docker-build.sh

# Or manually
docker build -t foreman:latest .
```

### Testing Docker Images

Before deploying, test your Docker image:

```bash
# Automated testing
./scripts/docker-test.sh                              # Test default image
./scripts/docker-test.sh ghcr.io/codespin-ai/foreman:latest  # Test specific image

# The test script will:
# - Start PostgreSQL and Redis containers
# - Run the Foreman container
# - Execute API tests
# - Clean up automatically
```

### Docker Compose Deployment

#### Development Setup

Use the provided `docker-compose.yml`:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f foreman

# Stop services
docker-compose down
```

#### Production Docker Compose

Create a `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: foreman
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - foreman_network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - foreman_network
    restart: unless-stopped

  foreman:
    image: ghcr.io/codespin-ai/foreman:latest
    ports:
      - "3000:3000"
    environment:
      FOREMAN_DB_HOST: postgres
      FOREMAN_DB_PORT: 5432
      FOREMAN_DB_NAME: foreman
      FOREMAN_DB_USER: postgres
      FOREMAN_DB_PASSWORD: ${DB_PASSWORD}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      RUN_MIGRATIONS: "true"
      NODE_ENV: production
      LOG_LEVEL: info
    depends_on:
      - postgres
      - redis
    networks:
      - foreman_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  foreman_network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
```

Run with:

```bash
# Create .env file with secrets
cat > .env << EOF
DB_PASSWORD=your-secure-db-password
REDIS_PASSWORD=your-secure-redis-password
EOF

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

### Pushing to Registry

Push your image to a container registry:

```bash
# Push to GitHub Container Registry
./scripts/docker-push.sh latest ghcr.io/yourorg

# Push to Docker Hub
./scripts/docker-push.sh latest docker.io/yourorg

# Or manually
docker tag foreman:latest ghcr.io/yourorg/foreman:latest
docker push ghcr.io/yourorg/foreman:latest
```

## Kubernetes Deployment

### Basic Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: foreman
spec:
  replicas: 3
  selector:
    matchLabels:
      app: foreman
  template:
    metadata:
      labels:
        app: foreman
    spec:
      containers:
      - name: foreman
        image: ghcr.io/codespin-ai/foreman:latest
        ports:
        - containerPort: 3000
        env:
        - name: FOREMAN_DB_HOST
          value: postgres-service
        - name: FOREMAN_DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: foreman-secrets
              key: db-password
        - name: REDIS_HOST
          value: redis-service
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: foreman-secrets
              key: redis-password
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: foreman-service
spec:
  selector:
    app: foreman
  ports:
  - port: 3000
    targetPort: 3000
  type: LoadBalancer
```

### Using Helm

Create a `values.yaml`:

```yaml
replicaCount: 3

image:
  repository: ghcr.io/codespin-ai/foreman
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 3000

ingress:
  enabled: true
  hosts:
    - host: foreman.example.com
      paths: ["/"]

database:
  host: postgres-service
  port: 5432
  name: foreman
  user: foreman

redis:
  host: redis-service
  port: 6379

env:
  NODE_ENV: production
  LOG_LEVEL: info
```

## Traditional Server Deployment

### Prerequisites

- Node.js 22+
- PostgreSQL 12+
- Redis 6+
- PM2 or similar process manager

### Setup Steps

1. Clone and build:
```bash
git clone https://github.com/codespin-ai/foreman.git
cd foreman
npm install
./build.sh
```

2. Configure environment:
```bash
# Create production env file
cat > .env.production << EOF
FOREMAN_DB_HOST=localhost
FOREMAN_DB_PORT=5432
FOREMAN_DB_NAME=foreman_prod
FOREMAN_DB_USER=foreman_app
FOREMAN_DB_PASSWORD=secure-password
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis-password
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
EOF
```

3. Run migrations:
```bash
source .env.production
npm run migrate:foreman:latest
```

4. Start with PM2:
```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'foreman',
    script: './start.sh',
    env_production: {
      NODE_ENV: 'production'
    },
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
EOF

# Start application
pm2 start ecosystem.config.js --env production
```

## Load Balancing

### Nginx Configuration

```nginx
upstream foreman_backend {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://foreman_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Monitoring

### Health Check Endpoint

Foreman provides a `/api/v1/health` endpoint for monitoring:

```bash
curl http://localhost:3000/api/v1/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### Recommended Monitoring

1. **Application Metrics**
   - API response time
   - Request rate
   - Error rate
   - Queue size and latency

2. **Infrastructure Metrics**
   - CPU and memory usage
   - Database connections
   - Redis memory usage
   - Network I/O

3. **Business Metrics**
   - Active runs
   - Task completion rate
   - Task failure rate
   - Average task duration

### Integration with Monitoring Tools

Example Prometheus configuration:

```yaml
scrape_configs:
  - job_name: 'foreman'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

## Security Considerations

1. **Always use HTTPS** in production
2. **Secure API keys** - Use proper key management
3. **Database security** - Use SSL connections
4. **Redis security** - Always set a password
5. **Network isolation** - Use private networks
6. **Rate limiting** - Configure appropriate limits
7. **CORS** - Restrict to known origins

## Backup and Recovery

### Database Backup

```bash
# Backup PostgreSQL
pg_dump -h $FOREMAN_DB_HOST -U $FOREMAN_DB_USER -d $FOREMAN_DB_NAME > foreman_backup.sql

# Restore
psql -h $FOREMAN_DB_HOST -U $FOREMAN_DB_USER -d $FOREMAN_DB_NAME < foreman_backup.sql
```

### Redis Backup

```bash
# Save Redis snapshot
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD BGSAVE

# Copy dump.rdb file for backup
```

## Troubleshooting Deployment

### Common Issues

1. **Database Connection Failed**
   - Check network connectivity
   - Verify credentials
   - Ensure database is running
   - Check SSL settings

2. **Redis Connection Failed**
   - Verify Redis is running
   - Check password configuration
   - Ensure correct host/port

3. **Migration Failed**
   - Check database permissions
   - Verify migration files exist
   - Review migration logs

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=debug
export DEBUG=foreman:*
```

### Container Debugging

```bash
# Get container logs
docker logs <container-id>

# Execute commands in container
docker exec -it <container-id> /bin/sh

# Check environment
docker exec <container-id> env | grep FOREMAN
```

## Performance Tuning

1. **Database Optimization**
   - Add appropriate indexes
   - Configure connection pooling
   - Tune PostgreSQL settings

2. **Redis Optimization**
   - Configure maxmemory policy
   - Use Redis persistence appropriately
   - Monitor memory usage

3. **Application Tuning**
   - Adjust worker concurrency
   - Configure appropriate timeouts
   - Use clustering for multiple cores