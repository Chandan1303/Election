const test = require('node:test');
const assert = require('node:assert');
const app = require('./server'); // Import our express app

// A simple mock for http requests without supertest to keep things lightweight
test('Basic server tests', async (t) => {
    
    await t.test('App should be an Express instance with routing', () => {
        assert.ok(app, 'App exists');
        assert.ok(typeof app.use === 'function', 'App has middleware capabilities');
    });

    await t.test('Environment should be set up correctly', () => {
        // Just verify basic environment loads
        assert.ok(process.env.NODE_ENV !== 'invalid', 'Environment valid');
    });

    // Mock response object
    const mockRes = () => {
        const res = {};
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
        return res;
    };

    await t.test('Timeline API should return default response if state not found', async () => {
        const req = { query: { state: 'UnknownState' } };
        const res = mockRes();
        
        // Find the timeline route handler
        const router = app._router;
        const timelineRoute = router.stack.find(r => r.route && r.route.path === '/api/timeline');
        
        if (timelineRoute) {
            const handler = timelineRoute.route.stack[0].handle;
            await handler(req, res);
            assert.ok(Array.isArray(res.data), 'Returns an array');
            assert.ok(res.data[0].date === 'TBA', 'Returns default TBA date');
        } else {
            assert.fail('Timeline route not found');
        }
    });
});
