
# FitQueue — Session Booking System

FitQueue is a web-based session booking application that helps members reserve places in training sessions. Users can view upcoming sessions, book available seats, manage reservations, and join a waitlist when a session is full.

## Live Demo

- **Website:** https://fit-queue.vercel.app
- **Backend API:** https://fit-queue.onrender.com
- **GitHub Repository:** https://github.com/ayushray041/fit-queue

## Features

- User registration and login
- View upcoming training sessions and remaining seats
- Book available sessions
- Unique booking codes for reservations
- Join a waitlist when a session is full
- Cancel eligible bookings
- Automatic promotion of the next waitlisted member when a seat becomes available
- Admin access for creating sessions

## Technology Stack

**Frontend:** React, Vite  
**Backend:** Node.js, Express.js  
**Database:** PostgreSQL with Supabase  
**Authentication:** JSON Web Tokens (JWT)  
**Deployment:** Vercel (frontend) and Render (backend)

## Project Structure

```text
fit-queue/
├── client/       # React frontend
├── server/       # Express backend and API
└── README.md     # Project documentation
```

## Run Locally

### Requirements

- Node.js and npm
- A Supabase PostgreSQL database
- Git

### 1. Clone the repository

```bash
git clone https://github.com/ayushray041/fit-queue.git
cd fit-queue
```

### 2. Configure the backend

```bash
cd server
npm install
```

Create a `.env` file inside the `server` directory:

```env
PORT=5001
DATABASE_URL=your_supabase_connection_string
JWT_SECRET=your_private_jwt_secret
```

Replace the placeholder values with your own private configuration.

Start the backend:

```bash
npm start
```

### 3. Configure the frontend

Open a second terminal from the project root:

```bash
cd client
npm install
```

Create a `.env.local` file inside `client`:

```env
VITE_API_URL=http://localhost:5001
```

Start the frontend:

```bash
npm run dev
```

Open the local URL printed by Vite in your browser.

Ensure the backend port matches `VITE_API_URL` and that the database connection is configured correctly.

## Environment Variables

Keep credentials private. Never commit `.env` or `.env.local` files containing real passwords, database URLs, or JWT secrets.

For production, configure the backend environment variables on Render and the frontend variable `VITE_API_URL` on Vercel.

## Project Goal

FitQueue demonstrates a simple session booking workflow, including authentication, seat availability, reservation management, and waitlist handling.
