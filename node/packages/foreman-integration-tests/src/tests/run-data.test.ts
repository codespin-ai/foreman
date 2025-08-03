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
      expect(data.orgId).to.equal('test-org');
      expect(data.tags).to.be.an('array').that.is.empty;
    });

    it('should write data with metadata and tags', async () => {
      const data = await client.post(`/runs/${runId}/data`, {
        key: 'config',
        value: { setting: 'enabled' },
        taskId,
        tags: ['production', 'v1.0'],
        metadata: { version: '1.0', source: 'test' }
      });

      expect(data.metadata).to.deep.equal({ version: '1.0', source: 'test' });
      expect(data.tags).to.deep.equal(['production', 'v1.0']);
    });

    it('should allow multiple entries with same key', async () => {
      // Create first entry
      const data1 = await client.post(`/runs/${runId}/data`, {
        key: 'temperature',
        value: 20.5,
        taskId,
        tags: ['morning', 'sensor-1']
      });

      // Create second entry with same key
      const data2 = await client.post(`/runs/${runId}/data`, {
        key: 'temperature',
        value: 22.3,
        taskId,
        tags: ['afternoon', 'sensor-1']
      });

      expect(data1.id).to.not.equal(data2.id);
      expect(data1.key).to.equal(data2.key);
      expect(data1.value).to.equal(20.5);
      expect(data2.value).to.equal(22.3);
    });

  });

  describe('GET /runs/:id/data with key parameter', () => {
    it('should get latest value by key', async () => {
      // Write multiple values
      await client.post(`/runs/${runId}/data`, {
        key: 'status',
        value: 'starting',
        taskId,
        tags: ['v1']
      });

      await client.post(`/runs/${runId}/data`, {
        key: 'status',
        value: 'running',
        taskId,
        tags: ['v2']
      });

      // Query for latest value
      const response = await client.get(`/runs/${runId}/data?key=status`);

      expect(response.data).to.have.length(1);
      expect(response.data[0].value).to.equal('running');
      expect(response.data[0].tags).to.include('v2');
    });

    it('should get all values when includeAll=true', async () => {
      // Write multiple values
      await client.post(`/runs/${runId}/data`, {
        key: 'log',
        value: 'event1',
        taskId
      });

      await client.post(`/runs/${runId}/data`, {
        key: 'log',
        value: 'event2',
        taskId
      });

      // Query all values
      const response = await client.get(`/runs/${runId}/data?key=log&includeAll=true`);

      expect(response.data).to.have.length(2);
      expect(response.data[0].value).to.equal('event1');
      expect(response.data[1].value).to.equal('event2');
    });

    it('should return empty array for non-existent key', async () => {
      const response = await client.get(`/runs/${runId}/data?key=non-existent`);
      expect(response.data).to.be.an('array').that.is.empty;
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

    it('should support key prefix matching', async () => {
      // Write sensor data
      await Promise.all([
        client.post(`/runs/${runId}/data`, {
          key: 'sensor.temp.indoor',
          value: 22.5,
          taskId,
          tags: ['building-A']
        }),
        client.post(`/runs/${runId}/data`, {
          key: 'sensor.temp.outdoor',
          value: 18.3,
          taskId,
          tags: ['building-A']
        }),
        client.post(`/runs/${runId}/data`, {
          key: 'sensor.humidity.indoor',
          value: 45,
          taskId,
          tags: ['building-A']
        })
      ]);

      // Query by key prefix
      const response = await client.get(`/runs/${runId}/data?keyStartsWith=sensor.temp`);

      expect(response.data).to.have.length(2);
      expect(response.data.map((d: any) => d.key)).to.include.members(['sensor.temp.indoor', 'sensor.temp.outdoor']);
    });

    it('should support tag filtering', async () => {
      // Write data with tags
      await Promise.all([
        client.post(`/runs/${runId}/data`, {
          key: 'metric1',
          value: 100,
          taskId,
          tags: ['production', 'europe']
        }),
        client.post(`/runs/${runId}/data`, {
          key: 'metric2',
          value: 200,
          taskId,
          tags: ['production', 'asia']
        }),
        client.post(`/runs/${runId}/data`, {
          key: 'metric3',
          value: 300,
          taskId,
          tags: ['development', 'europe']
        })
      ]);

      // Query by tags (ANY mode - default)
      const anyResponse = await client.get(`/runs/${runId}/data?tags=production,europe`);
      expect(anyResponse.data).to.have.length(3); // All have at least one tag

      // Query by tags (ALL mode)
      const allResponse = await client.get(`/runs/${runId}/data?tags=production,europe&tagMode=all`);
      expect(allResponse.data).to.have.length(1); // Only metric1 has both tags
      expect(allResponse.data[0].key).to.equal('metric1');
    });

    it('should support tag prefix matching', async () => {
      // Write data with timestamp tags
      await Promise.all([
        client.post(`/runs/${runId}/data`, {
          key: 'event1',
          value: 'data1',
          taskId,
          tags: ['2024-03-15', 'location-helsinki']
        }),
        client.post(`/runs/${runId}/data`, {
          key: 'event2',
          value: 'data2',
          taskId,
          tags: ['2024-03-16', 'location-stockholm']
        }),
        client.post(`/runs/${runId}/data`, {
          key: 'event3',
          value: 'data3',
          taskId,
          tags: ['2024-04-01', 'location-helsinki']
        })
      ]);

      // Query by tag prefix
      const response = await client.get(`/runs/${runId}/data?tagStartsWith=2024-03,location-helsinki`);
      expect(response.data).to.have.length(2); // event1 and event3 match
    });
  });

  describe('PATCH /runs/:id/data/:dataId/tags', () => {
    it('should update tags on run data', async () => {
      // Create data with initial tags
      const data = await client.post(`/runs/${runId}/data`, {
        key: 'tagged-data',
        value: { test: true },
        taskId,
        tags: ['initial', 'draft']
      });

      // Update tags
      const updated = await client.patch(`/runs/${runId}/data/${data.id}/tags`, {
        add: ['reviewed', 'production'],
        remove: ['draft']
      });

      expect(updated.tags).to.include.members(['initial', 'reviewed', 'production']);
      expect(updated.tags).to.not.include('draft');
    });
  });

  describe('DELETE /runs/:id/data', () => {
    it('should delete by key', async () => {
      // Write multiple entries
      await client.post(`/runs/${runId}/data`, {
        key: 'delete-test',
        value: { v: 1 },
        taskId
      });
      await client.post(`/runs/${runId}/data`, {
        key: 'delete-test',
        value: { v: 2 },
        taskId
      });

      // Delete all entries for key
      const result = await client.delete(`/runs/${runId}/data?key=delete-test`);
      expect(result.deleted).to.equal(2);

      // Verify they're gone
      const response = await client.get(`/runs/${runId}/data?key=delete-test`);
      expect(response.data).to.be.empty;
    });

    it('should delete by id', async () => {
      // Write data
      const data = await client.post(`/runs/${runId}/data`, {
        key: 'specific-delete',
        value: { temporary: true },
        taskId
      });

      // Delete by ID
      const result = await client.delete(`/runs/${runId}/data?id=${data.id}`);
      expect(result.deleted).to.equal(1);
    });
  });
});