const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');

console.log('Starting tests...');

// Start the server for testing
const serverProcess = spawn('node', ['server.js'], { cwd: __dirname });

setTimeout(() => {
    // Test 1: Check if FAQs API works
    http.get('http://localhost:3000/api/faqs', (res) => {
        assert.strictEqual(res.statusCode, 200, 'FAQs API should return 200 OK');
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const parsed = JSON.parse(data);
            assert.ok(Array.isArray(parsed), 'FAQs should return an array');
            console.log('✔ Test 1 Passed: FAQs API returns expected data.');

            // Test 2: Check Timeline API
            http.get('http://localhost:3000/api/timeline?state=General', (res2) => {
                assert.strictEqual(res2.statusCode, 200, 'Timeline API should return 200 OK');
                let data2 = '';
                res2.on('data', chunk => data2 += chunk);
                res2.on('end', () => {
                    const parsed2 = JSON.parse(data2);
                    assert.ok(Array.isArray(parsed2), 'Timeline should return an array');
                    console.log('✔ Test 2 Passed: Timeline API returns expected data.');

                    // Cleanup and exit
                    serverProcess.kill();
                    console.log('All tests passed successfully.');
                    process.exit(0);
                });
            });
        });
    }).on('error', (err) => {
        console.error('Test failed:', err.message);
        serverProcess.kill();
        process.exit(1);
    });
}, 1000); // Wait 1 second for server to start
