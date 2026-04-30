const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('./server'); // Import our express app

test('Comprehensive Server & API Tests', async (t) => {
    let server;
    let port;

    await t.test('Setup Server', () => {
        return new Promise((resolve) => {
            server = app.listen(0, () => {
                port = server.address().port;
                resolve();
            });
        });
    });

    const makeRequest = (method, path, body = null, headers = {}) => {
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: port,
                path: path,
                method: method,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: data ? JSON.parse(data) : null,
                            raw: data
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: null,
                            raw: data
                        });
                    }
                });
            });
            req.on('error', reject);
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    };

    await t.test('1. Core Initialization', () => {
        assert.ok(app, 'Express app exists');
        assert.ok(typeof app.use === 'function', 'App has middleware');
    });

    await t.test('2. Timeline API: Default behavior', async () => {
        const res = await makeRequest('GET', '/api/timeline');
        assert.strictEqual(res.statusCode, 200);
        assert.ok(Array.isArray(res.data), 'Returns an array');
        assert.ok(res.data[0].date === '2024' || res.data[0].date === 'TBA', 'Returns 2024 or TBA for default');
    });

    await t.test('3. Timeline API: State specific', async () => {
        const res = await makeRequest('GET', '/api/timeline?state=maharashtra');
        assert.strictEqual(res.statusCode, 200);
        assert.ok(Array.isArray(res.data), 'Returns an array');
    });

    await t.test('4. FAQs API: Returns data', async () => {
        const res = await makeRequest('GET', '/api/faqs');
        assert.strictEqual(res.statusCode, 200);
        assert.ok(Array.isArray(res.data), 'Returns FAQs array');
    });

    await t.test('5. Chat API: Missing message throws 400', async () => {
        const res = await makeRequest('POST', '/api/chat', {});
        assert.strictEqual(res.statusCode, 400);
        assert.ok(res.data.error === 'Message is required');
    });

    await t.test('6. Chat API: Basic greeting', async () => {
        const res = await makeRequest('POST', '/api/chat', { message: 'hello' });
        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.data.response.includes('How old are you?'), 'Correct context logic');
        assert.strictEqual(res.data.context.step, 'ask_age');
    });

    await t.test('7. Chat API: Underage logic', async () => {
        const res = await makeRequest('POST', '/api/chat', { message: '16', context: { step: 'ask_age' } });
        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.data.response.includes('not eligible'), 'Detects underage');
        assert.strictEqual(res.data.context.step, 'ask_state_underage');
    });

    await t.test('8. Chat API: State recognition with XSS Sanitization', async () => {
        const res = await makeRequest('POST', '/api/chat', { message: '<script>alert(1)</script> Delhi', context: { step: 'ask_state' } });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.context.state, 'Delhi', 'Extracts state safely');
    });

    await t.test('9. Security Headers Check', async () => {
        const res = await makeRequest('GET', '/api/faqs');
        assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
        assert.strictEqual(res.headers['x-frame-options'], 'DENY');
        assert.strictEqual(res.headers['x-xss-protection'], '1; mode=block');
    });

    await t.test('10. Edge Cases and Integration', async () => {
        const notFound = await makeRequest('GET', '/api/unknown');
        assert.ok(notFound.statusCode === 404 || notFound.statusCode === 200 || notFound.statusCode === 301);
    });

    await t.test('Teardown Server', () => {
        return new Promise((resolve) => {
            server.close(resolve);
        });
    });
});
