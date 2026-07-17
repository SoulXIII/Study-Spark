# StudySpark

StudySpark is an AI-powered study assistant developed as a BSc CSIT project. It helps students generate summaries, flashcards, quizzes, and solutions from study materials using modern AI models.

## Features

- Generate summaries from study notes
- Create flashcards automatically
- Generate quizzes
- Solve text and image-based questions
- Manage study sets
- User authentication
- Support for multiple AI providers

## Technologies Used

### Frontend

- React
- Vite
- Tailwind CSS

### Backend

- Node.js
- Express.js
- PostgreSQL

### AI Providers

- Google Gemini 3.5 Flash
- OpenRouter

## Project Structure

```
StudySpark/
├── academic-alchemy-ai-main/   # Frontend
├── backend/
│   ├── src/
│   ├── .env.example
│   └── package.json
├── README.md
└── .gitignore
```

## Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/StudySpark.git
cd StudySpark
```

### Frontend

```bash
cd academic-alchemy-ai-main
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

## Environment Variables

Copy the example environment file:

```text
backend/.env.example
```

to

```text
backend/.env
```

Configure the required variables, including:

```env
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=
DB_NAME=

JWT_SECRET=

AI_PROVIDER=gemini

GEMINI_API_KEY=

OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
```

## AI Provider Configuration

The application supports multiple AI providers through a common abstraction layer.

Currently supported:

- Google Gemini
- OpenRouter

Switch providers by changing:

```env
AI_PROVIDER=gemini
```

or

```env
AI_PROVIDER=openrouter
```

No code changes are required when switching providers.

## Future Improvements

- AI chat assistant
- Voice interaction
- PDF annotation
- Study planner
- Additional AI providers

## Author

Utsav Rai

Bachelor of Science in Computer Science and Information Technology (BSc CSIT)

## License

This project was developed for educational purposes.
