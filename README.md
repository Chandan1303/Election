# Smart Election Assistant

## 1. Project Overview
The Smart Election Assistant is an AI-powered interactive web application designed to guide voters through the complex election process. It simplifies registration, checks eligibility, and provides deadlines in an accessible, chat-based interface.

## 2. Problem Statement
Many potential voters (especially first-time voters) find the election process confusing. They often struggle to find clear timelines, eligibility requirements, and steps for registration, leading to lower voter turnout.

## 3. Solution Approach
This solution provides a "Smart Election Assistant" that uses a context-aware chatbot to offer personalized guidance. By simply asking users basic questions (like age and registration status), the assistant breaks down the process into actionable steps. It is accompanied by a progress tracker, election timeline, and map to polling booths.

## 4. Features
- **Context-Aware Chatbot**: Analyzes user input to provide personalized guidance (e.g., handles underage users, unregistered users, etc.).
- **Multi-step Guidance**: Breaks down the voting process into 5 clear steps, tracking the user's progress.
- **Dynamic Responses**: Provides quick options as buttons and understands conversational text.
- **Google Maps Integration**: Displays a map for polling booth locations.
- **Google Calendar Integration**: Allows users to add Election Day directly to their Google Calendar.
- **Google Translate Integration**: Automatically provides a widget to translate the entire UI into multiple languages, ensuring accessibility.
- **Voice Input**: Users can speak to the bot using Web Speech API integration.

## 5. Tech Stack
- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript
- **Backend**: Node.js, Express.js
- **Database**: Local JSON storage (for hackathon simulation purposes, acts as a mock database)
- **APIs**: Google Maps URL parameters, Google Translate Widget, Google Calendar Event URLs, Web Speech API

## 6. How to Run the Project
1. **Clone the repository**: `git clone <repo_url>`
2. **Navigate to backend**: `cd backend`
3. **Install dependencies**: `npm install`
4. **Run the backend**: `npm start` (Runs on http://localhost:3000)
5. **Run the frontend**: Open `frontend/index.html` in any modern web browser. You can also use a tool like Live Server.

## 7. Assumptions
- This MVP uses a local JSON file (`data.json`) to simulate a database.
- Polling locations are simulated using a generic City Hall query on Google Maps for demonstration without requiring an API key.
- Google Calendar links use standard event template URLs.

## 8. Future Improvements
- Integrate an LLM (like Gemini or OpenAI) for more fluid NLP processing.
- Add real Firebase authentication to track users across sessions.
- Use actual civic APIs (like Google Civic Information API) to fetch real polling booths based on accurate zip codes.
