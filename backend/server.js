const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Load static data
const dataPath = path.join(__dirname, 'data.json');
let data = {};
if (fs.existsSync(dataPath)) {
    data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

// Initialize Google GenAI
let aiClient = null;
if (process.env.GEMINI_API_KEY) {
    try {
        aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        console.log("Google GenAI initialized successfully.");
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI", e);
    }
} else {
    console.warn("GEMINI_API_KEY is not set in .env. The chatbot will only use basic fallback logic for unknown queries.");
}

// Chatbot endpoint with context-aware logic
const indianStates = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat", 
    "haryana", "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh", 
    "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha", "punjab", 
    "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh", 
    "uttarakhand", "west bengal", "delhi", "jammu", "kashmir", "puducherry", "chandigarh", "lakshadweep", "ladakh", "andaman"
];

app.post('/api/chat', async (req, res) => {
    const { message, context } = req.body;
    let responseText = "";
    let updatedContext = context || { step: 'ask_age' };
    let options = [];

    const msg = message.toLowerCase();

    // Context-aware logic
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
        
        // Match against all states
        for (const s of indianStates) {
            if (msg.includes(s)) {
                // Capitalize first letters for nice formatting
                state = s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                break;
            }
        }
        
        if (state === "General" && msg.length > 2) {
            // If user typed a state not exactly in the array but still typed something, just use it capitalized
            state = msg.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
        
        updatedContext.state = state;
        
        if (updatedContext.step === "ask_state_underage") {
            responseText = `For ${state}, you can check out the timeline on the right. Even though you can't vote, you can learn how to pre-register!`;
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
            let statePortal = updatedContext.state ? ` CEO portal for ${updatedContext.state}` : "the NVSP portal";
            responseText = `No problem! Step 1 is checking eligibility and Step 2 is registration. I can guide you through voter registration on ${statePortal}. Are you ready to start?`;
            updatedContext.step = "registration_guide";
            options = ["Yes, guide me"];
        } else {
            responseText = "Please answer Yes, No, or Not Sure.";
        }
    }
    else if (updatedContext.step === "registration_guide" && msg.includes('yes')) {
        responseText = "To register, visit voters.eci.gov.in and fill out Form 6. Make sure you have your Aadhaar or PAN Card handy. Once registered, Step 3 is Verifying your Voter ID. Would you like to know more about ID requirements?";
        updatedContext.step = "registered_help";
        options = ["Voter ID", "Polling Booth"];
    }
    else if (msg.includes('timeline') || msg.includes('dates')) {
        let state = updatedContext.state || "General";
        let timelineData = data.timelines[state] || [
            { "date": "TBA", "event": `Next Assembly Election in ${state}` },
            { "date": "Continuous", "event": "Voter Registration Open" }
        ];
        responseText = `Here are the important dates for ${state}: ` + timelineData.map(t => `${t.date}: ${t.event}`).join(", ") + ".";
    }
    else if (msg.includes('poll') || msg.includes('location') || msg.includes('booth')) {
        responseText = "I can help you find your polling location. Please check the map section below or visit the ECI website to search your name in the electoral roll.";
    }
    else if (msg.includes('id') || msg.includes('identification')) {
        responseText = "For Step 3 (Verify Voter ID): The Election Commission requires a photo ID like an EPIC (Voter ID), Aadhaar, Driving License, or Passport.";
    }
    else if (msg.includes('register')) {
        responseText = "You can start the registration process online at voters.eci.gov.in.";
    }
    else if (msg.includes('pre-register')) {
        responseText = "If you are 17+ years old, you can apply in advance using Form 6 so you are added to the roll as soon as you turn 18!";
    }
    else {
        // AI Fallback for unscripted queries
        if (aiClient) {
            try {
                const response = await aiClient.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `You are a Smart Election Assistant for India. Please provide a short, helpful, and accurate response to the following user query about elections, voting, government, or good works: "${message}". Keep the response under 3 sentences if possible. Be polite and encouraging.`,
                });
                responseText = response.text;
            } catch (err) {
                console.error("Gemini API error:", err);
                responseText = "I'm experiencing some technical difficulties reaching my advanced AI. Please try asking again later, or ask me about voter registration, polling locations, or dates!";
            }
        } else {
            responseText = "I'm not exactly sure about that. Let me know if you need help with voter registration, polling locations, or dates. (Developer: Add GEMINI_API_KEY in backend/.env for AI answers)";
        }
    }

    res.json({ response: responseText, context: updatedContext, options });
});

// Add basic security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// APIs for frontend
app.get('/api/faqs', (req, res) => {
    res.json(data.faqs || []);
});

app.get('/api/timeline', (req, res) => {
    const state = req.query.state || 'General';
    let timelineData = data.timelines && data.timelines[state];
    
    if (!timelineData) {
        timelineData = [
            { "date": "TBA", "event": `Next Assembly Election in ${state}` },
            { "date": "Continuous", "event": "Voter Registration Open" }
        ];
    }
    
    res.json(timelineData);
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Backend server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
