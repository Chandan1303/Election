const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const optionsContainer = document.getElementById('chat-options');
const voiceBtn = document.getElementById('voice-btn');

let chatContext = { step: 'ask_age' };
const BACKEND_URL = 'http://localhost:3000/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchTimeline();
    fetchFAQs();
});

// Send message handling
sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function appendMessage(text, sender) {
    const div = document.createElement('div');
    div.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
    div.innerText = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showOptions(options) {
    optionsContainer.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.classList.add('option-btn');
        btn.innerText = opt;
        btn.onclick = () => {
            chatInput.value = opt;
            sendMessage();
        };
        optionsContainer.appendChild(btn);
    });
}

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    chatInput.value = '';
    optionsContainer.innerHTML = ''; // clear options

    // Show loading
    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('message', 'bot-message');
    loadingDiv.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
    chatMessages.appendChild(loadingDiv);

    try {
        const response = await fetch(`${BACKEND_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, context: chatContext })
        });
        const data = await response.json();
        
        chatMessages.removeChild(loadingDiv);
        appendMessage(data.response, 'bot');
        let oldState = chatContext.state;
        chatContext = data.context;
        
        if (chatContext.state && chatContext.state !== oldState) {
            fetchTimeline(chatContext.state);
            const timelineHeader = document.querySelector('.timeline-section h3');
            if (timelineHeader) {
                timelineHeader.innerHTML = `<i class="fas fa-calendar-alt"></i> Election Timeline: ${chatContext.state}`;
            }
        }
        
        if (data.options && data.options.length > 0) {
            showOptions(data.options);
        }

        updateProgress(chatContext.step);

        // Optional: Voice output
        // const speech = new SpeechSynthesisUtterance(data.response);
        // window.speechSynthesis.speak(speech);

    } catch (error) {
        chatMessages.removeChild(loadingDiv);
        appendMessage("Sorry, I am having trouble connecting to my servers.", 'bot');
    }
}

// Update progress bar based on context
function updateProgress(step) {
    const steps = document.querySelectorAll('.step');
    steps.forEach(s => s.classList.remove('active'));
    
    if (step === 'ask_age' || step === 'ask_registered') {
        steps[0].classList.add('active'); // Eligibility
    } else if (step === 'registration_guide') {
        steps[1].classList.add('active'); // Register
    } else if (step === 'registered_help') {
        steps[2].classList.add('active'); // Verify ID
    }
}

// Fetch Timeline
async function fetchTimeline(state = 'General') {
    try {
        const response = await fetch(`${BACKEND_URL}/timeline?state=${encodeURIComponent(state)}`);
        const data = await response.json();
        const list = document.getElementById('timeline-list');
        list.innerHTML = data.map(item => `
            <li>
                <strong>${item.date}</strong>
                ${item.event}
            </li>
        `).join('');
    } catch (error) {
        console.error("Error fetching timeline", error);
    }
}

// Fetch FAQs
async function fetchFAQs() {
    try {
        const response = await fetch(`${BACKEND_URL}/faqs`);
        const data = await response.json();
        const list = document.getElementById('faq-list');
        list.innerHTML = data.map(item => `
            <div class="faq-item">
                <div class="faq-question"><i class="fas fa-chevron-right"></i> ${item.question}</div>
                <div class="faq-answer">${item.answer}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error("Error fetching FAQs", error);
    }
}

// Voice input support (Web Speech API)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    
    voiceBtn.addEventListener('click', () => {
        voiceBtn.style.color = 'red';
        recognition.start();
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        chatInput.value = transcript;
        voiceBtn.style.color = 'white';
        sendMessage();
    };

    recognition.onerror = () => {
        voiceBtn.style.color = 'white';
    };
} else {
    voiceBtn.style.display = 'none';
}
