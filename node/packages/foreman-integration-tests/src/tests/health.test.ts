import { expect } from 'chai';
import { client } from '../index.js';

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const response = await client.get('/health');
    
    expect(response).to.deep.equal({
      status: 'healthy',
      timestamp: response.timestamp // Dynamic value
    });
    
    expect(response.timestamp).to.be.a('string');
  });
});