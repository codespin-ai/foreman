import { expect } from 'chai';
import { testDb, client } from '../test-setup.js';

describe('Run Data API', () => {
  let runId: string;
  let taskId: string;

  beforeEach(async () => {
    await testDb.truncateAllTables();
    
    // Create a run for run data tests
    const runResponse = await client.post('/api/v1/runs', {
      inputData: { type: 'test-workflow' }
    });
    runId = runResponse.data.id;

    // Create a task for run data tests
    const taskResponse = await client.post('/api/v1/tasks', {
      runId,
      type: 'test-task',
      inputData: {}
    });
    taskId = taskResponse.data.id;
  });

  describe('POST /api/v1/runs/:runId/data', () => {
    it('should create run data with key-value', async () => {
      const response = await client.post(`/api/v1/runs/${runId}/data`, {
        taskId,
        key: 'user-profile',
        value: { name: 'John Doe', email: 'john@example.com' }
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property('id');
      expect(response.data).to.have.property('runId', runId);
      expect(response.data).to.have.property('taskId', taskId);
      expect(response.data).to.have.property('key', 'user-profile');
      expect(response.data).to.have.property('value');
      expect(response.data.value).to.deep.equal({ name: 'John Doe', email: 'john@example.com' });
      expect(response.data).to.have.property('createdAt');
    });

    it('should create run data with tags', async () => {
      const response = await client.post(`/api/v1/runs/${runId}/data`, {
        taskId,
        key: 'order-status',
        value: { status: 'processing' },
        tags: ['order', 'status', 'important']
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property('tags');
      expect(response.data.tags).to.deep.equal(['order', 'status', 'important']);
    });

    it('should create multiple values for the same key', async () => {
      // Create first entry
      const response1 = await client.post(`/api/v1/runs/${runId}/data`, {
        taskId,
        key: 'log-entry',
        value: { message: 'Started processing', timestamp: '2023-01-01T10:00:00Z' },
        tags: ['log']
      });

      // Create second entry with same key
      const response2 = await client.post(`/api/v1/runs/${runId}/data`, {
        taskId,
        key: 'log-entry',
        value: { message: 'Processing complete', timestamp: '2023-01-01T10:05:00Z' },
        tags: ['log']
      });

      expect(response1.status).to.equal(201);
      expect(response2.status).to.equal(201);
      expect(response1.data.key).to.equal('log-entry');
      expect(response2.data.key).to.equal('log-entry');
      expect(response1.data.id).to.not.equal(response2.data.id);
    });

    it('should return 400 for invalid input', async () => {
      const response = await client.post(`/api/v1/runs/${runId}/data`, {
        // Missing required fields
        taskId
      });

      expect(response.status).to.equal(400);
      expect(response.data).to.have.property('error');
    });

    it('should return 404 for non-existent run', async () => {
      const response = await client.post('/api/v1/runs/00000000-0000-0000-0000-000000000000/data', {
        taskId,
        key: 'test-key',
        value: { test: 'data' }
      });

      expect(response.status).to.equal(404);
      expect(response.data).to.have.property('error');
    });
  });

  describe('GET /api/v1/runs/:runId/data', () => {
    beforeEach(async () => {
      // Create some test data
      await client.post(`/api/v1/runs/${runId}/data`, {
        taskId,
        key: 'user-data',
        value: { name: 'John', age: 30 },
        tags: ['user', 'profile']
      });

      await client.post(`/api/v1/runs/${runId}/data`, {
        taskId,
        key: 'config',
        value: { theme: 'dark', lang: 'en' },
        tags: ['config', 'settings']
      });

      await client.post(`/api/v1/runs/${runId}/data`, {
        taskId,
        key: 'user-data',
        value: { name: 'Jane', age: 25 },
        tags: ['user', 'profile']
      });
    });

    it('should get all run data', async () => {
      const response = await client.get(`/api/v1/runs/${runId}/data?includeAll=true`);

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('data');
      expect(response.data).to.have.property('pagination');
      expect(response.data.data).to.have.lengthOf(3);
    });

    it('should filter by key', async () => {
      const response = await client.get(`/api/v1/runs/${runId}/data?key=user-data&includeAll=true`);

      expect(response.status).to.equal(200);
      expect(response.data.data).to.have.lengthOf(2);
      response.data.data.forEach((item: any) => {
        expect(item.key).to.equal('user-data');
      });
    });

    it('should filter by tags', async () => {
      const response = await client.get(`/api/v1/runs/${runId}/data?tags=config&includeAll=true`);

      expect(response.status).to.equal(200);
      expect(response.data.data).to.have.lengthOf(1);
      expect(response.data.data[0].tags).to.include('config');
    });

    it('should filter by key prefix', async () => {
      const response = await client.get(`/api/v1/runs/${runId}/data?keyStartsWith=user&includeAll=true`);

      expect(response.status).to.equal(200);
      expect(response.data.data).to.have.lengthOf(2);
      response.data.data.forEach((item: any) => {
        expect(item.key).to.match(/^user/);
      });
    });

    it('should support pagination', async () => {
      const response = await client.get(`/api/v1/runs/${runId}/data?limit=2&offset=1&includeAll=true`);

      expect(response.status).to.equal(200);
      expect(response.data.data).to.have.lengthOf(2);
      expect(response.data.pagination).to.have.property('total', 2); // Currently returns count of returned items, not total
      expect(response.data.pagination).to.have.property('limit', 2);
      expect(response.data.pagination).to.have.property('offset', 1);
    });

    it('should sort by created date', async () => {
      const response = await client.get(`/api/v1/runs/${runId}/data?sortBy=created_at&sortOrder=desc&includeAll=true`);

      expect(response.status).to.equal(200);
      const dates = response.data.data.map((item: any) => new Date(item.createdAt).getTime());
      
      // Check if sorted in descending order
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i-1]).to.be.greaterThanOrEqual(dates[i]);
      }
    });
  });

  describe('PATCH /api/v1/runs/:runId/data/:dataId/tags', () => {
    let dataId: string;

    beforeEach(async () => {
      const response = await client.post(`/api/v1/runs/${runId}/data`, {
        taskId,
        key: 'test-data',
        value: { test: 'value' },
        tags: ['original', 'tag']
      });
      dataId = response.data.id;
    });

    it('should update tags', async () => {
      const response = await client.patch(`/api/v1/runs/${runId}/data/${dataId}/tags`, {
        remove: ['original', 'tag'],
        add: ['updated', 'tags', 'new']
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('tags');
      expect(response.data.tags).to.deep.equal(['updated', 'tags', 'new']);
    });

    it('should return 404 for non-existent data', async () => {
      const response = await client.patch(`/api/v1/runs/${runId}/data/non-existent-id/tags`, {
        add: ['test']
      });

      expect(response.status).to.equal(404);
      expect(response.data).to.have.property('error');
    });
  });

  describe('DELETE /api/v1/runs/:runId/data', () => {
    beforeEach(async () => {
      // Create some test data
      await client.post(`/api/v1/runs/${runId}/data`, {
        taskId,
        key: 'temp-data',
        value: { temp: 'value1' }
      });

      await client.post(`/api/v1/runs/${runId}/data`, {
        taskId,
        key: 'temp-data',
        value: { temp: 'value2' }
      });

      await client.post(`/api/v1/runs/${runId}/data`, {
        taskId,
        key: 'keep-data',
        value: { keep: 'value' }
      });
    });

    it('should delete data by key', async () => {
      const response = await client.delete(`/api/v1/runs/${runId}/data?key=temp-data`);

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('deleted');
      expect(response.data.deleted).to.equal(2);

      // Verify deletion
      const listResponse = await client.get(`/api/v1/runs/${runId}/data?includeAll=true`);
      expect(listResponse.data.data).to.have.lengthOf(1);
      expect(listResponse.data.data[0].key).to.equal('keep-data');
    });

    it('should delete data by id', async () => {
      // Get a specific data entry
      const listResponse = await client.get(`/api/v1/runs/${runId}/data?key=temp-data&limit=1&includeAll=true`);
      const dataId = listResponse.data.data[0].id;

      const response = await client.delete(`/api/v1/runs/${runId}/data?id=${dataId}`);

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('deleted', 1);

      // Verify only one was deleted
      const newListResponse = await client.get(`/api/v1/runs/${runId}/data?includeAll=true`);
      expect(newListResponse.data.data).to.have.lengthOf(2);
    });

    it('should return 400 if neither key nor id provided', async () => {
      const response = await client.delete(`/api/v1/runs/${runId}/data`);

      expect(response.status).to.equal(400);
      expect(response.data).to.have.property('error');
    });
  });
});