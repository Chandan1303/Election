const test = require('node:test');
const assert = require('node:assert');
const app = require('./server'); // Import our express app

test('Comprehensive Server & API Tests', async (t) => {
    
    await t.test('1. Core Initialization', () => {
        assert.ok(app, 'Express app exists');
        assert.ok(typeof app.use === 'function', 'App has middleware');
    });

    // Mock response object
    const mockRes = () => {
        const res = {};
        res.statusCode = 200;
        res.status = (code) => {
            res.statusCode = code;
            return res;
        };
        res.json = (data) => {
            res.data = data;
            return res;
        };
        res.setHeader = (name, value) => {
            res.headers = res.headers || {};
            res.headers[name] = value;
        };
        res.removeHeader = () => {};
        res.write = () => {};
        res.end = () => {};
        return res;
    };

    const runRoute = async (method, path, req) => {
        const res = mockRes();
        const router = app._router;
        const route = router.stack.find(r => r.route && r.route.path === path && r.route.methods[method.toLowerCase()]);
        if (!route) throw new Error('Route not found');
        const handler = route.route.stack[0].handle;
        await handler(req, res);
        return res;
    };

    await t.test('2. Timeline API: Default behavior', async () => {
        const req = { query: {} };
        const res = await runRoute('GET', '/api/timeline', req);
        assert.ok(Array.isArray(res.data), 'Returns an array');
        assert.ok(res.data[0].date === 'TBA', 'Returns TBA for default');
        assert.ok(res.data[1].event.includes('Google Cloud'), 'Contains Google Services integration text');
    });

    await t.test('3. Timeline API: State specific', async () => {
        const req = { query: { state: 'maharashtra' } };
        const res = await runRoute('GET', '/api/timeline', req);
        assert.ok(Array.isArray(res.data), 'Returns an array');
    });

    await t.test('4. FAQs API: Returns data', async () => {
        const req = { query: {} };
        const res = await runRoute('GET', '/api/faqs', req);
        assert.ok(Array.isArray(res.data), 'Returns FAQs array');
    });

    await t.test('5. Chat API: Missing message throws 400', async () => {
        const req = { body: {} };
        const res = await runRoute('POST', '/api/chat', req);
        assert.strictEqual(res.statusCode, 400);
        assert.ok(res.data.error === 'Message is required');
    });

    await t.test('6. Chat API: Basic greeting', async () => {
        const req = { body: { message: 'hello' } };
        const res = await runRoute('POST', '/api/chat', req);
        assert.ok(res.data.response.includes('How old are you?'), 'Correct context logic');
        assert.strictEqual(res.data.context.step, 'ask_age');
    });

    await t.test('7. Chat API: Underage logic', async () => {
        const req = { body: { message: '16', context: { step: 'ask_age' } } };
        const res = await runRoute('POST', '/api/chat', req);
        assert.ok(res.data.response.includes('not eligible'), 'Detects underage');
        assert.strictEqual(res.data.context.step, 'ask_state_underage');
    });

    await t.test('8. Chat API: State recognition with XSS Sanitization', async () => {
        const req = { body: { message: '<script>alert(1)</script> Delhi', context: { step: 'ask_state' } } };
        const res = await runRoute('POST', '/api/chat', req);
        assert.strictEqual(res.data.context.state, 'Delhi', 'Extracts state safely');
    });
});
