# Getting Started with Foreman

## Installation

### Prerequisites
- Node.js 22+
- PostgreSQL 12+
- Redis (if using BullMQ for queuing)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/codespin-ai/foreman.git
cd foreman
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
./build.sh
```

4. Set up environment variables:
```bash
export FOREMAN_DB_HOST=localhost
export FOREMAN_DB_PORT=5432
export FOREMAN_DB_NAME=foreman
export FOREMAN_DB_USER=foreman
export FOREMAN_DB_PASSWORD=your_password
```

5. Run database migrations:
```bash
npm run migrate:foreman:latest
```

6. Start the server:
```bash
./start.sh
```

## API Key Format

Foreman runs in a fully trusted environment behind a firewall. The API key format is:

```
fmn_[environment]_[organizationId]_[random]
```

Examples:
- `fmn_dev_myorg_abc123`
- `fmn_prod_acme_xyz789`
- `fmn_test_demo_456def`

Since Foreman is fully trusted, there's no database setup required for API keys. The authentication simply:
- Validates the API key format
- Extracts the organization ID from the key
- Grants full access to all operations

## Basic Usage

### 1. Install the Client

```bash
npm install @codespin/foreman-client
```

### 2. Initialize the Client

```typescript
import { initializeForemanClient, createRun } from '@codespin/foreman-client';

// Initialize client (automatically fetches Redis configuration)
const foremanConfig = {
  endpoint: 'http://localhost:3000',
  apiKey: 'fmn_dev_myorg_abc123'
};

const client = await initializeForemanClient(foremanConfig);
const { enqueueTask, createWorker } = client;
```

### 3. Create a Run

```typescript
const runResult = await createRun(foremanConfig, {
  inputData: {
    orderId: 'order-123',
    customerId: 'customer-456'
  },
  metadata: {
    source: 'web',
    priority: 'high'
  }
});

if (!runResult.success) {
  console.error('Failed to create run:', runResult.error);
  return;
}

const run = runResult.data;
console.log('Created run:', run.id);
```

### 4. Enqueue Tasks (Handles DB + Queue)

```typescript
// Enqueue a validation task
const validationTask = await enqueueTask({
  runId: run.id,
  type: 'validate-order',
  inputData: {
    orderId: 'order-123'
  },
  priority: 10
});

// Enqueue a processing task with delay
const processingTask = await enqueueTask({
  runId: run.id,
  type: 'process-payment',
  delay: 5000, // Wait 5 seconds
  inputData: {
    amount: 99.99,
    currency: 'USD'
  }
});
```

### 5. Create Worker (Handles Queue Operations)

```typescript
// foreman-client handles all BullMQ operations internally
const worker = await createWorker({
  'validate-order': async (task) => {
    console.log('Validating order:', task.inputData);
    
    // Perform validation
    const isValid = validateOrder(task.inputData.orderId);
    
    // Store result using run data
    await createRunData(foremanConfig, task.runId, {
      taskId: task.id,
      key: 'order-validation',
      value: { valid: isValid, timestamp: Date.now() },
      tags: ['validation', 'order']
    });
    
    return { valid: isValid };
  },
  
  'process-payment': async (task) => {
    console.log('Processing payment:', task.inputData);
    
    // Query previous validation result
    const validationData = await queryRunData(foremanConfig, task.runId, {
      key: 'order-validation'
    });
    
    if (!validationData.success || !validationData.data.data[0]?.value.valid) {
      throw new Error('Order validation failed');
    }
    
    // Process payment
    const result = await processPayment(task.inputData);
    return result;
  }
}, {
  concurrency: 5,
  maxRetries: 3
});

// Start the worker
await worker.start();
console.log('Worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.stop();
  process.exit(0);
```

### 6. Query Run Data

```typescript
// Query all validation results
const validationResults = await queryRunData(foremanConfig, run.id, {
  tags: ['validation'],
  sortBy: 'created_at',
  sortOrder: 'desc'
});

// Get specific data by key
const orderData = await queryRunData(foremanConfig, run.id, {
  key: 'order-validation'
});
```

### 7. Complete the Run

```typescript
// After all tasks complete, update the run
await updateRun(foremanConfig, run.id, {
  status: 'completed',
  outputData: {
    processedAt: new Date().toISOString(),
    totalAmount: 99.99
  }
});
```

## Best Practices

1. **Store Task IDs Only**: Keep queue payloads minimal by storing only task IDs
2. **Use Run Data**: Share data between tasks using the run data key-value store
3. **Handle Retries**: Configure `maxRetries` when creating tasks
4. **Update Status**: Always update task status during processing
5. **Error Handling**: Store detailed error information for debugging
6. **Metadata**: Use metadata for filtering and additional context

## Next Steps

- Read the [Architecture](architecture.md) documentation
- Check the [API Reference](api-reference.md)
- Set up monitoring and alerts
- Configure rate limits for production