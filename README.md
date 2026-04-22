# AuctionX

A real-time British Auction Request-for-Quotation system. Buyers create RFQs with dynamic extension rules, and suppliers place live bids — all ranked and broadcast in real time.

**Tech stack:** React (Vite) · FastAPI · MongoDB (Motor) · Socket.io · APScheduler

## Prerequisites

- Python 3.11+
- Node.js 18+ (for the React frontend)
- MongoDB Atlas or local MongoDB on port 27017

## Project Structure

```
backend/
  app/
    main.py              # FastAPI entry point + Socket.io mount
    config.py            # Pydantic settings from .env
    db.py                # Motor client + collection references
    events.py            # Socket.io event handlers
    seed.py              # Database seeder (python -m app.seed)
    middleware/
      auth.py            # JWT auth + role guard dependencies
    modules/
      auth/              # Registration, login, profile
      rfq/               # RFQ CRUD + reference ID generation
      bid/               # Bid submission, ranking, extension logic
      auction/           # Scheduled lifecycle job (close/force-close)
    utils/
      jwt.py             # Token create / decode
      serializer.py      # ObjectId → string conversion
      helpers.py         # Shared date parsing utilities
frontend/
  src/                   # React SPA (Vite)
```

## Setup Instructions

### Backend

```bash
cd backend
pip install -r app/requirements.txt
```

Copy `backend/app/.env.example` to `backend/app/.env` (or use the existing `.env`).

### Frontend

```bash
cd frontend
npm install
```

## Seeding the Database

Creates test buyers, suppliers, active/closed RFQs, and sample bids:

```bash
cd backend
python -m app.seed
```

**Test credentials (password: `Test@1234`):**

| Role     | Email                |
|----------|----------------------|
| Buyer    | buyer1@test.com      |
| Buyer    | buyer2@test.com      |
| Supplier | supplier1@test.com   |
| Supplier | supplier2@test.com   |
| Supplier | supplier3@test.com   |
| Supplier | supplier4@test.com   |

## Running Locally

**Backend** (runs on http://localhost:5000):

```bash
cd backend
uvicorn app.main:socket_app --host 0.0.0.0 --port 5000 --reload
```

**Frontend** (runs on http://localhost:5173):

```bash
cd frontend
npm run dev
```

## API Endpoints

| Method | Endpoint            | Access   | Description                    |
|--------|---------------------|----------|--------------------------------|
| POST   | `/api/auth/register`| Public   | Register a new user            |
| POST   | `/api/auth/login`   | Public   | Login and get JWT              |
| GET    | `/api/auth/me`      | Auth     | Get current user profile       |
| GET    | `/api/rfqs`         | Auth     | List all RFQs                  |
| POST   | `/api/rfqs`         | Buyer    | Create a new RFQ               |
| GET    | `/api/rfqs/:id`     | Auth     | Get RFQ details + ranked bids  |
| PUT    | `/api/rfqs/:id`     | Buyer    | Update a draft RFQ             |
| GET    | `/api/rfqs/:id/bids`| Auth     | Get bids for an RFQ            |
| POST   | `/api/rfqs/:id/bids`| Supplier | Submit a bid                   |
| GET    | `/api/health`       | Public   | Health check                   |

## Key Features

- Real-time bid updates via Socket.io WebSockets
- Dynamic auction extension rules (auto-extends deadlines on last-minute bids)
- Strict forced-close hard limits
- Auto-ranking of L1, L2, L3 suppliers by total bid amount
- Background auction lifecycle scheduler (APScheduler)
- Interactive countdown timer on the frontend
