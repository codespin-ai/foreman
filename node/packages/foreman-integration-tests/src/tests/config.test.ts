import { expect } from 'chai';
import { client } from '../test-setup.js';

describe('Config API', () => {
  describe('GET /api/v1/config', () => {
    it('should return full configuration', async () => {
      const response = await client.get('/api/v1/config');

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('redis');
      expect(response.data).to.have.property('queues');
      expect(response.data).to.have.property('version');
      
      // Check Redis config structure
      expect(response.data.redis).to.have.property('host');
      expect(response.data.redis).to.have.property('port');
      
      // Check queues config structure
      expect(response.data.queues).to.have.property('taskQueue');
      expect(response.data.queues).to.have.property('resultQueue');
      
      // Check version
      expect(response.data.version).to.be.a('string');
    });
  });

  describe('GET /api/v1/config/redis', () => {
    it('should return Redis configuration only', async () => {
      const response = await client.get('/api/v1/config/redis');

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('host');
      expect(response.data).to.have.property('port');
      expect(response.data).to.not.have.property('queues');
      expect(response.data).to.not.have.property('version');
      
      // Validate types
      expect(response.data.host).to.be.a('string');
      expect(response.data.port).to.be.a('number');
      
      // Check for optional fields
      if (response.data.password !== undefined) {
        expect(response.data.password).to.be.a('string');
      }
      if (response.data.db !== undefined) {
        expect(response.data.db).to.be.a('number');
      }
    });
  });

  describe('GET /api/v1/config/queues', () => {
    it('should return queue configuration only', async () => {
      const response = await client.get('/api/v1/config/queues');

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('taskQueue');
      expect(response.data).to.have.property('resultQueue');
      expect(response.data).to.not.have.property('redis');
      expect(response.data).to.not.have.property('version');
      
      // Validate queue names are strings
      expect(response.data.taskQueue).to.be.a('string');
      expect(response.data.resultQueue).to.be.a('string');
      
      // Check for default values
      expect(response.data.taskQueue).to.include('tasks');
      expect(response.data.resultQueue).to.include('results');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for config endpoints', async () => {
      // Create client without API key
      const unauthenticatedClient = client;
      unauthenticatedClient.removeHeader('x-api-key');
      unauthenticatedClient.removeHeader('Authorization');

      const response = await unauthenticatedClient.get('/api/v1/config');

      expect(response.status).to.equal(401);
      expect(response.data).to.have.property('error');
      
      // Restore API key for other tests
      unauthenticatedClient.setApiKey('test-api-key');
    });

    it('should work with valid API key header', async () => {
      const response = await client.get('/api/v1/config', {
        'x-api-key': 'fmn_test_testorg_abc123'
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('redis');
    });

    it('should work with valid Authorization header', async () => {
      const response = await client.get('/api/v1/config', {
        'Authorization': 'Bearer fmn_test_testorg_abc123'
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('redis');
    });

    it('should reject invalid API key format', async () => {
      const response = await client.get('/api/v1/config', {
        'x-api-key': 'invalid-key-format'
      });

      expect(response.status).to.equal(401);
      expect(response.data).to.have.property('error');
    });
  });

  describe('Health Check', () => {
    it('should return health status without authentication', async () => {
      // Remove auth headers
      const unauthenticatedClient = client;
      unauthenticatedClient.removeHeader('x-api-key');
      unauthenticatedClient.removeHeader('Authorization');

      const response = await unauthenticatedClient.get('/health');

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('status', 'healthy');
      expect(response.data).to.have.property('timestamp');
      expect(response.data).to.have.property('environment', 'test');
      
      // Restore API key for other tests
      unauthenticatedClient.setApiKey('test-api-key');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await client.get('/api/v1/non-existent');

      expect(response.status).to.equal(404);
      expect(response.data).to.have.property('error', 'Not found');
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await client.request('/api/v1/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }'
      });

      expect(response.status).to.equal(400);
      expect(response.data).to.have.property('error');
    });
  });
});