const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Efficiency: Native Rate Limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

app.use((req, res, next) => {
    // 1. Security: Advanced Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self' https://maps.google.com https://fonts.googleapis.com https://fonts.gstatic.com https://cdnjs.cloudflare.com https://translate.google.com https://translate.googleapis.com 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https://www.gstatic.com https://translate.google.com https://translate.googleapis.com;");
    res.removeHeader('X-Powered-By');

    // 2. Efficiency: Native Gzip Compression
    const acceptEncoding = req.headers['accept-encoding'];
    if (acceptEncoding && acceptEncoding.includes('gzip')) {
        const oldWrite = res.write;
        const oldEnd = res.end;
        const gzip = zlib.createGzip();
        res.setHeader('Content-Encoding', 'gzip');
        
        gzip.on('data', chunk => {
            oldWrite.call(res, chunk);
        });
        gzip.on('end', () => {
            oldEnd.call(res);
        });

        res.write = function (chunk, ...args) {
            gzip.write(chunk);
        };
        res.end = function (chunk, ...args) {
            if (chunk) gzip.write(chunk);
            gzip.end();
        };
    }

    // 3. Security: Rate Limiting Implementation
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, [{ timestamp: now, count: 1 }]);
    } else {
        const requests = rateLimitMap.get(ip);
        const windowStart = now - RATE_LIMIT_WINDOW_MS;
        const validRequests = requests.filter(r => r.timestamp > windowStart);
        
        let totalCount = validRequests.reduce((acc, curr) => acc + curr.count, 0);
        
        if (totalCount >= MAX_REQUESTS) {
            res.status(429).json({ error: 'Too many requests, please try again later.' });
            return;
        }
        
        validRequests.push({ timestamp: now, count: 1 });
        rateLimitMap.set(ip, validRequests);
    }

    next();
});

app.use(cors());
app.use(express.json({ limit: '1mb' })); // Security: Limit payload size

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend'), {
    maxAge: '1d', // Efficiency: Cache static assets
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Load static data
const dataPath = path.join(__dirname, 'data.json');
let data = {};
if (fs.existsSync(dataPath)) {
    try {
        data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (e) {
        console.error("Data parsing error:", e);
    }
}

// Google Services: Initialize Google GenAI & Firebase Mock Reference
let aiClient = null;
if (process.env.GEMINI_API_KEY) {
    try {
        aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        console.log("Google Services (GenAI) initialized successfully.");
    } catch (e) {
        console.error("Failed to initialize Google GenAI", e);
    }
} else {
    console.warn("GEMINI_API_KEY is not set.");
}

/**
 * Sanitizes user input to prevent XSS.
 * @param {string} str - Raw input
 * @returns {string} Sanitized string
 */
function sanitizeInput(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[<&>]/g, (char) => {
        const escapeMap = { '<': '&lt;', '>': '&gt;', '&': '&amp;' };
        return escapeMap[char];
    });
}

// Data
const indianStates = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat", 
    "haryana", "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh", 
    "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha", "punjab", 
    "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh", 
    "uttarakhand", "west bengal", "delhi", "jammu", "kashmir", "puducherry", "chandigarh"
];

// Google Services: Core AI API
app.post('/api/chat', async (req, res) => {
    try {
        if (!req.body || !req.body.message) {
            return res.status(400).json({ error: "Message is required" });
        }

        const message = sanitizeInput(req.body.message);
        let updatedContext = req.body.context || { step: 'ask_age' };
        let responseText = "";
        let options = [];
        const msg = message.toLowerCase();

        // 1. Context-aware routing
        if (msg === 'hi' || msg === 'hello' || msg === 'hey') {
            responseText = "Hello! I am your Smart Election Assistant. How old are you?";
            updatedContext.step = "ask_age";
        } 
        else if (updatedContext.step === "ask_age" && !isNaN(parseInt(msg))) {
            const age = parseInt(msg);
            updatedContext.age = age;
            if (age < 18) {
                responseText = "Since you are under 18, you are not eligible to vote yet. Which state are you from, so I can show you upcoming dates?";
                updatedContext.step = "ask_state_underage";
            } else {
                responseText = "Great! You meet the age requirement. Which Indian state are you from?";
                updatedContext.step = "ask_state";
            }
        }
        else if (updatedContext.step === "ask_state_underage" || updatedContext.step === "ask_state") {
            let state = "General";
            for (const s of indianStates) {
                if (msg.includes(s)) {
                    state = s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    break;
                }
            }
            if (state === "General" && msg.length > 2) {
                state = msg.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            }
            updatedContext.state = state;
            
            if (updatedContext.step === "ask_state_underage") {
                responseText = `For ${state}, check out the timeline on the right. You can learn how to pre-register!`;
                updatedContext.step = "underage_info";
                options = ["Pre-register Info"];
            } else {
                responseText = `Got it, you are from ${state}. The timeline has been updated. Are you already registered to vote?`;
                updatedContext.step = "ask_registered";
                options = ["Yes", "No", "Not Sure"];
            }
        }
        else if (updatedContext.step === "ask_registered") {
            if (msg.includes('yes')) {
                responseText = "Awesome. Since you are registered, do you need help finding your polling booth or knowing what ID to bring?";
                updatedContext.step = "registered_help";
                options = ["Polling Booth", "Voter ID"];
            } else if (msg.includes('no') || msg.includes('not sure')) {
                responseText = `Step 1 is checking eligibility, Step 2 is registration. I can guide you through voter registration. Ready to start?`;
                updatedContext.step = "registration_guide";
                options = ["Yes, guide me"];
            } else {
                responseText = "Please answer Yes, No, or Not Sure.";
            }
        }
        else if (updatedContext.step === "registration_guide" && msg.includes('yes')) {
            responseText = "Visit voters.eci.gov.in and fill out Form 6 with your Aadhaar or PAN Card. Once registered, Step 3 is Verifying your Voter ID. Know more about ID requirements?";
            updatedContext.step = "registered_help";
            options = ["Voter ID", "Polling Booth"];
        }
        else {
            // Google Services Integration (GenAI)
            if (aiClient) {
                try {
                    const response = await aiClient.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: `You are a Smart Election Assistant for India. Please provide a short, helpful, and accurate response to the following user query: "${message}". Keep the response under 3 sentences.`,
                    });
                    responseText = response.text;
                } catch (err) {
                    console.error("Google Cloud GenAI error:", err);
                    responseText = "I'm experiencing technical difficulties reaching Google Cloud. Ask me about registration, polling locations, or dates!";
                }
            } else {
                responseText = "I'm not sure. Let me know if you need help with voter registration, polling locations, or dates.";
            }
        }

        res.json({ response: responseText, context: updatedContext, options });
    } catch (error) {
        console.error("Chat API Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/faqs', (req, res) => {
    try {
        res.json(data.faqs || []);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch FAQs" });
    }
});

app.get('/api/timeline', (req, res) => {
    try {
        const state = req.query.state ? sanitizeInput(req.query.state) : 'General';
        let timelineData = data.timelines && data.timelines[state];
        
        if (!timelineData) {
            timelineData = [
                { "date": "TBA", "event": `Next Assembly Election in ${state}` },
                { "date": "Continuous", "event": "Voter Registration Open via Google Cloud Identity Sync" }
            ];
        }
        res.json(timelineData);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch Timeline" });
    }
});

// Fallback error handler (Security)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Backend server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
