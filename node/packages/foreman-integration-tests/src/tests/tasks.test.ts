import { expect } from 'chai';
import { client } from '../index.js';

describe('Tasks API', () => {
  let runId: string;

  beforeEach(async () => {
    // Create a run for testing tasks
    const run = await client.post('/runs', {
      inputData: { test: true }
    });
    runId = run.id;
  });

  describe('POST /tasks', () => {
    it('should create a new task', async () => {
      const taskData = {
        runId,
        type: 'test-task',
        data: { action: 'process' },
        dependencies: []
      };

      const task = await client.post('/tasks', taskData);

      expect(task).to.have.property('id');
      expect(task.runId).to.equal(runId);
      expect(task.type).to.equal('test-task');
      expect(task.status).to.equal('pending');
      expect(task.data).to.deep.equal({ action: 'process' });
      expect(task.attemptCount).to.equal(0);
    });

    it('should create task with dependencies', async () => {
      // Create first task
      const task1 = await client.post('/tasks', {
        runId,
        type: 'task-1',
        data: { step: 1 }
      });

      // Create second task depending on first
      const task2 = await client.post('/tasks', {
        runId,
        type: 'task-2',
        data: { step: 2 },
        dependencies: [task1.id]
      });

      expect(task2.dependencies).to.deep.equal([task1.id]);
    });

    it('should reject task for non-existent run', async () => {
      try {
        await client.post('/tasks', {
          runId: 'non-existent',
          type: 'test',
          data: {}
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Run not found');
      }
    });
  });

  describe('GET /tasks/:id', () => {
    it('should retrieve a task by ID', async () => {
      // Create a task
      const created = await client.post('/tasks', {
        runId,
        type: 'test-task',
        data: { foo: 'bar' }
      });

      // Retrieve it
      const retrieved = await client.get(`/tasks/${created.id}`);

      expect(retrieved.id).to.equal(created.id);
      expect(retrieved.data).to.deep.equal({ foo: 'bar' });
    });
  });

  describe('PUT /tasks/:id/status', () => {
    it('should update task status to running', async () => {
      // Create a task
      const task = await client.post('/tasks', {
        runId,
        type: 'test-task',
        data: {}
      });

      // Update status
      const updated = await client.put(`/tasks/${task.id}/status`, {
        status: 'running'
      });

      expect(updated.status).to.equal('running');
      expect(updated.startedAt).to.be.a('string');
      expect(updated.attemptCount).to.equal(1);
    });

    it('should complete a task with result', async () => {
      // Create a task
      const task = await client.post('/tasks', {
        runId,
        type: 'test-task',
        data: {}
      });

      // Complete it
      const completed = await client.put(`/tasks/${task.id}/status`, {
        status: 'completed',
        result: { success: true, output: 'Done' }
      });

      expect(completed.status).to.equal('completed');
      expect(completed.result).to.deep.equal({ success: true, output: 'Done' });
      expect(completed.completedAt).to.be.a('string');
    });

    it('should fail a task with error', async () => {
      // Create a task
      const task = await client.post('/tasks', {
        runId,
        type: 'test-task',
        data: {}
      });

      // Fail it
      const failed = await client.put(`/tasks/${task.id}/status`, {
        status: 'failed',
        error: { message: 'Task failed', code: 'TEST_ERROR' }
      });

      expect(failed.status).to.equal('failed');
      expect(failed.error).to.deep.equal({ message: 'Task failed', code: 'TEST_ERROR' });
    });
  });

  describe('GET /runs/:id/tasks', () => {
    it('should list tasks for a run', async () => {
      // Create multiple tasks
      await Promise.all([
        client.post('/tasks', { runId, type: 'task-1', data: {} }),
        client.post('/tasks', { runId, type: 'task-2', data: {} }),
        client.post('/tasks', { runId, type: 'task-3', data: {} })
      ]);

      // List tasks
      const response = await client.get(`/runs/${runId}/tasks`);

      expect(response.tasks).to.have.length(3);
      expect(response.tasks.map((t: any) => t.type)).to.include.members(['task-1', 'task-2', 'task-3']);
    });

    it('should filter tasks by status', async () => {
      // Create tasks
      const task1 = await client.post('/tasks', { runId, type: 'task-1', data: {} });
      await client.post('/tasks', { runId, type: 'task-2', data: {} });
      
      // Update one to completed
      await client.put(`/tasks/${task1.id}/status`, {
        status: 'completed',
        result: { done: true }
      });

      // Filter by status
      const response = await client.get(`/runs/${runId}/tasks?status=completed`);

      expect(response.tasks).to.have.length(1);
      expect(response.tasks[0].id).to.equal(task1.id);
    });
  });
});