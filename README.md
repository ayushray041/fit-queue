
# FitQueue

FitQueue is a session booking website I built for my Byte Society web development project. Users can create an account, log in, check upcoming training sessions, and book a seat.

I also added a waitlist feature for sessions that are full. When someone cancels their booking, the next person on the waitlist can get the available seat.

## Live Website

https://fit-queue.vercel.app

## Features

- Register and log in
- View upcoming sessions and available seats
- Book a session and get a booking code
- Cancel a booking
- Join a waitlist when a session is full
- Automatically promote the next person on the waitlist when a seat becomes available
- Admin access to create sessions

## Tech Stack

- Frontend: React and Vite
- Backend: Node.js and Express
- Database: PostgreSQL with Supabase
- Authentication: JWT
- Deployment: Vercel and Render

## Run Locally

You need Node.js, npm, and a Supabase database.

### Backend

```bash
cd server
npm install
```

Create a `.env` file in the `server` folder with your database connection string and JWT secret. Keep these values private.

Start the backend:

```bash
npm start
```

### Frontend

Open another terminal from the project root:

```bash
cd client
npm install
```

Create a `.env.local` file in the `client` folder and add:

```env
VITE_API_URL=http://localhost:5001
```

Start the frontend:

```bash
npm run dev
```

Open the local URL shown in the terminal.


## Stack and Data Model
- Frontend: React and Vite; backend: Node.js and Express.
- Database: PostgreSQL hosted on Supabase.
- Authentication: JWT; users have MEMBER or ADMIN roles.
- Sessions store dates, start times, and capacity.
- Bookings link members to sessions; the waitlist manages full sessions.
- Assumption: session capacity is 20 seats.
- The backend checks authentication and permissions for protected actions.

## Setup Instructions
1. Clone the repository and install dependencies in `server` and `client`.
2. Configure `DATABASE_URL` and `JWT_SECRET` in `server/.env`.
3. Configure `VITE_API_URL=http://localhost:5001` in `client/.env.local`.
4. Start the backend with `npm start` and the frontend with `npm run dev`.

## Reviewer Test Accounts
- ADMIN email: REPLACE_WITH_DEMO_ADMIN_EMAIL
- ADMIN password: REPLACE_WITH_DEMO_ADMIN_PASSWORD
- MEMBER email: REPLACE_WITH_DEMO_MEMBER_EMAIL
- MEMBER password: REPLACE_WITH_DEMO_MEMBER_PASSWORD


## Repository

https://github.com/ayushray041/fit-queue
