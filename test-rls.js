#!/usr/bin/env node
/**
 * Test script to verify RLS implementation in Foreman
 * 
 * This script:
 * 1. Creates runs for different organizations
 * 2. Verifies org isolation by attempting cross-org access
 * 3. Tests ROOT context access
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5002/api/v1';

// Test data
const org1 = 'org-123';
const org2 = 'org-456';

async function makeRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await response.json();
  return { status: response.status, data };
}

async function testRLS() {
  console.log('🧪 Testing Foreman RLS Implementation\n');

  try {
    // Test 1: Create run for org1
    console.log('📝 Test 1: Creating run for org-123...');
    const run1 = await makeRequest('/runs', {
      method: 'POST',
      headers: { 'x-org-id': org1 },
      body: JSON.stringify({
        inputData: { test: 'data for org1' },
        metadata: { source: 'test' }
      }),
    });
    
    if (run1.status !== 201) {
      throw new Error(`Failed to create run for org1: ${JSON.stringify(run1.data)}`);
    }
    console.log(`✅ Created run ${run1.data.id} for org-123\n`);

    // Test 2: Create run for org2
    console.log('📝 Test 2: Creating run for org-456...');
    const run2 = await makeRequest('/runs', {
      method: 'POST',
      headers: { 'x-org-id': org2 },
      body: JSON.stringify({
        inputData: { test: 'data for org2' },
        metadata: { source: 'test' }
      }),
    });
    
    if (run2.status !== 201) {
      throw new Error(`Failed to create run for org2: ${JSON.stringify(run2.data)}`);
    }
    console.log(`✅ Created run ${run2.data.id} for org-456\n`);

    // Test 3: Org1 should only see its own run
    console.log('🔒 Test 3: Verifying org-123 can only see its own runs...');
    const org1Runs = await makeRequest('/runs', {
      headers: { 'x-org-id': org1 },
    });
    
    if (org1Runs.status !== 200) {
      throw new Error(`Failed to list runs for org1: ${JSON.stringify(org1Runs.data)}`);
    }
    
    const org1RunIds = org1Runs.data.data.map(r => r.id);
    if (org1RunIds.includes(run2.data.id)) {
      throw new Error('❌ RLS VIOLATION: Org1 can see Org2 runs!');
    }
    if (!org1RunIds.includes(run1.data.id)) {
      throw new Error('❌ Org1 cannot see its own runs!');
    }
    console.log(`✅ Org-123 sees only its runs (${org1Runs.data.data.length} runs)\n`);

    // Test 4: Org2 should only see its own run
    console.log('🔒 Test 4: Verifying org-456 can only see its own runs...');
    const org2Runs = await makeRequest('/runs', {
      headers: { 'x-org-id': org2 },
    });
    
    if (org2Runs.status !== 200) {
      throw new Error(`Failed to list runs for org2: ${JSON.stringify(org2Runs.data)}`);
    }
    
    const org2RunIds = org2Runs.data.data.map(r => r.id);
    if (org2RunIds.includes(run1.data.id)) {
      throw new Error('❌ RLS VIOLATION: Org2 can see Org1 runs!');
    }
    if (!org2RunIds.includes(run2.data.id)) {
      throw new Error('❌ Org2 cannot see its own runs!');
    }
    console.log(`✅ Org-456 sees only its runs (${org2Runs.data.data.length} runs)\n`);

    // Test 5: Attempt cross-org access (should fail)
    console.log('🚫 Test 5: Attempting cross-org access...');
    const crossOrgAccess = await makeRequest(`/runs/${run2.data.id}`, {
      headers: { 'x-org-id': org1 },
    });
    
    if (crossOrgAccess.status !== 404) {
      throw new Error('❌ RLS VIOLATION: Org1 can access Org2 run details!');
    }
    console.log('✅ Cross-org access properly blocked (404 returned)\n');

    // Test 6: ROOT context (no x-org-id) - This might fail if ROOT is disabled
    console.log('👑 Test 6: Testing ROOT context (optional)...');
    const rootRuns = await makeRequest('/runs');
    
    if (rootRuns.status === 200) {
      console.log(`✅ ROOT context can see all runs (${rootRuns.data.data.length} total runs)\n`);
    } else {
      console.log('ℹ️  ROOT context not available or disabled (this is OK)\n');
    }

    console.log('🎉 All RLS tests passed successfully!\n');
    console.log('Summary:');
    console.log('- ✅ Organizations can create runs');
    console.log('- ✅ Organizations can only see their own runs');
    console.log('- ✅ Cross-organization access is blocked');
    console.log('- ✅ RLS is working correctly');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
testRLS().catch(console.error);