import { expect } from 'chai';
import { client } from '../index.js';

describe('Runs API', () => {
  describe('POST /runs', () => {
    it('should create a new run', async () => {
      const runData = {
        inputData: { message: 'Hello, World!' },
        metadata: { source: 'test-suite' }
      };

      const run = await client.post('/runs', runData);

      expect(run).to.have.property('id');
      expect(run.status).to.equal('pending');
      expect(run.orgId).to.equal('test-org');
      expect(run.inputData).to.deep.equal(runData.inputData);
      expect(run.metadata).to.deep.equal(runData.metadata);
      expect(run.totalTasks).to.equal(0);
      expect(run.completedTasks).to.equal(0);
      expect(run.failedTasks).to.equal(0);
    });

    it('should validate input data', async () => {
      try {
        await client.post('/runs', { invalidField: 'test' });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Invalid request');
      }
    });
  });

  describe('GET /runs/:id', () => {
    it('should retrieve a run by ID', async () => {
      // Create a run first
      const created = await client.post('/runs', {
        inputData: { test: true }
      });

      // Retrieve it
      const retrieved = await client.get(`/runs/${created.id}`);

      expect(retrieved.id).to.equal(created.id);
      expect(retrieved.inputData).to.deep.equal({ test: true });
    });

    it('should return 404 for non-existent run', async () => {
      try {
        await client.get('/runs/non-existent-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('404');
      }
    });
  });

  describe('PUT /runs/:id/status', () => {
    it('should update run status', async () => {
      // Create a run
      const run = await client.post('/runs', {
        inputData: { test: true }
      });

      // Update status
      const updated = await client.put(`/runs/${run.id}/status`, {
        status: 'running'
      });

      expect(updated.status).to.equal('running');
      expect(updated.startedAt).to.be.a('string');
    });

    it('should complete a run with output', async () => {
      // Create a run
      const run = await client.post('/runs', {
        inputData: { test: true }
      });

      // Complete it
      const completed = await client.put(`/runs/${run.id}/status`, {
        status: 'completed',
        outputData: { result: 'success' }
      });

      expect(completed.status).to.equal('completed');
      expect(completed.outputData).to.deep.equal({ result: 'success' });
      expect(completed.completedAt).to.be.a('string');
      expect(completed.durationMs).to.be.a('number');
    });

    it('should fail a run with error', async () => {
      // Create a run
      const run = await client.post('/runs', {
        inputData: { test: true }
      });

      // Fail it
      const failed = await client.put(`/runs/${run.id}/status`, {
        status: 'failed',
        errorData: { message: 'Test error' }
      });

      expect(failed.status).to.equal('failed');
      expect(failed.errorData).to.deep.equal({ message: 'Test error' });
    });
  });

  describe('GET /runs', () => {
    it('should list runs with pagination', async () => {
      // Create multiple runs
      await Promise.all([
        client.post('/runs', { inputData: { index: 1 } }),
        client.post('/runs', { inputData: { index: 2 } }),
        client.post('/runs', { inputData: { index: 3 } })
      ]);

      // List with pagination
      const response = await client.get('/runs?limit=2');

      expect(response.runs).to.have.length(2);
      expect(response.total).to.equal(3);
      expect(response.hasMore).to.be.true;
    });

    it('should filter runs by status', async () => {
      // Create runs with different statuses
      const run1 = await client.post('/runs', { inputData: { test: 1 } });
      await client.post('/runs', { inputData: { test: 2 } });
      
      // Update one to running
      await client.put(`/runs/${run1.id}/status`, { status: 'running' });

      // Filter by status
      const response = await client.get('/runs?status=running');

      expect(response.runs).to.have.length(1);
      expect(response.runs[0].id).to.equal(run1.id);
    });
  });
});