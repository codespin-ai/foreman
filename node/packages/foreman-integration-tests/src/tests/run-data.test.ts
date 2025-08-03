import { expect } from 'chai';
import { client } from '../index.js';

describe('Run Data API', () => {
  let runId: string;
  let taskId: string;

  beforeEach(async () => {
    // Create a run and task for testing
    const run = await client.post('/runs', {
      inputData: { test: true }
    });
    runId = run.id;

    const task = await client.post('/tasks', {
      runId,
      type: 'test-task',
      data: {}
    });
    taskId = task.id;
  });

  describe('POST /runs/:id/data', () => {
    it('should write run data', async () => {
      const data = await client.post(`/runs/${runId}/data`, {
        key: 'test-key',
        value: { message: 'Hello, World!' },
        taskId
      });

      expect(data).to.have.property('id');
      expect(data.runId).to.equal(runId);
      expect(data.key).to.equal('test-key');
      expect(data.value).to.deep.equal({ message: 'Hello, World!' });
      expect(data.taskId).to.equal(taskId);
      expect(data.writtenBy).to.equal('test-org');
    });

    it('should write data with metadata', async () => {
      const data = await client.post(`/runs/${runId}/data`, {
        key: 'config',
        value: { setting: 'enabled' },
        taskId,
        metadata: { version: '1.0', source: 'test' }
      });

      expect(data.metadata).to.deep.equal({ version: '1.0', source: 'test' });
    });

    it('should reject duplicate keys', async () => {
      // Write first value
      await client.post(`/runs/${runId}/data`, {
        key: 'unique-key',
        value: { first: true },
        taskId
      });

      // Try to write same key again
      try {
        await client.post(`/runs/${runId}/data`, {
          key: 'unique-key',
          value: { second: true },
          taskId
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('already exists');
      }
    });
  });

  describe('GET /runs/:id/data/:key', () => {
    it('should read run data by key', async () => {
      // Write data first
      const written = await client.post(`/runs/${runId}/data`, {
        key: 'read-test',
        value: { data: 'test-value' },
        taskId
      });

      // Read it back
      const read = await client.get(`/runs/${runId}/data/read-test`);

      expect(read.id).to.equal(written.id);
      expect(read.value).to.deep.equal({ data: 'test-value' });
    });

    it('should return 404 for non-existent key', async () => {
      try {
        await client.get(`/runs/${runId}/data/non-existent`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('404');
      }
    });
  });

  describe('GET /runs/:id/data', () => {
    it('should list all run data', async () => {
      // Write multiple data entries
      await Promise.all([
        client.post(`/runs/${runId}/data`, {
          key: 'data-1',
          value: { index: 1 },
          taskId
        }),
        client.post(`/runs/${runId}/data`, {
          key: 'data-2',
          value: { index: 2 },
          taskId
        }),
        client.post(`/runs/${runId}/data`, {
          key: 'data-3',
          value: { index: 3 },
          taskId
        })
      ]);

      // List all data
      const response = await client.get(`/runs/${runId}/data`);

      expect(response.data).to.have.length(3);
      expect(response.data.map((d: any) => d.key)).to.include.members(['data-1', 'data-2', 'data-3']);
    });

    it('should support key pattern matching', async () => {
      // Write data with patterns
      await Promise.all([
        client.post(`/runs/${runId}/data`, {
          key: 'config.database',
          value: { host: 'localhost' },
          taskId
        }),
        client.post(`/runs/${runId}/data`, {
          key: 'config.api',
          value: { port: 3000 },
          taskId
        }),
        client.post(`/runs/${runId}/data`, {
          key: 'status.ready',
          value: true,
          taskId
        })
      ]);

      // Query by pattern
      const response = await client.get(`/runs/${runId}/data?keyPattern=config.*`);

      expect(response.data).to.have.length(2);
      expect(response.data.map((d: any) => d.key)).to.include.members(['config.database', 'config.api']);
    });
  });

  describe('DELETE /runs/:id/data/:key', () => {
    it('should delete run data', async () => {
      // Write data
      await client.post(`/runs/${runId}/data`, {
        key: 'delete-test',
        value: { temporary: true },
        taskId
      });

      // Delete it
      await client.delete(`/runs/${runId}/data/delete-test`);

      // Verify it's gone
      try {
        await client.get(`/runs/${runId}/data/delete-test`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('404');
      }
    });
  });
});