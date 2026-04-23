# AuctionX

A high-performance British Auction Request-for-Quotation (RFQ) system. Buyers create RFQs with dynamic extension rules, and suppliers place live bids — all ranked and updated in real-time.

**Tech stack:** React (Vite) · FastAPI · MongoDB (Motor) · HTTP Polling · APScheduler

## Prerequisites

- Python 3.11+
- Node.js 18+ (for the React frontend)
- MongoDB Atlas or local MongoDB

## Project Structure

```
backend/
  app/
    main.py              # FastAPI entry point
    config.py            # Pydantic settings from .env
    db.py                # Motor client + collection references
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
frontend/
  src/                   # React SPA (Vite)
```

## Setup Instructions

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Ensure `backend/app/.env` is configured with your `MONGO_URI`.

### Frontend

```bash
cd frontend
npm install
```

Ensure `frontend/.env` has the correct `VITE_API_URL` (e.g., `http://localhost:5000/api` for local dev).

## Seeding the Database

Populate the database with test buyers, suppliers, and sample RFQs:

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

## Running Locally

**Backend** (runs on http://localhost:5000):

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
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
| GET    | `/api/rfqs`         | Auth     | List all RFQs                  |
| POST   | `/api/rfqs`         | Buyer    | Create a new RFQ               |
| GET    | `/api/rfqs/:id`     | Auth     | Get RFQ details + ranked bids  |
| DELETE | `/api/rfqs/:id`     | Buyer    | Delete a draft RFQ             |
| POST   | `/api/rfqs/:id/bids`| Supplier | Submit a bid                   |

## Key Features

- **Real-time Updates:** Efficient HTTP polling for live leaderboard and timer updates.
- **Dynamic Extensions:** Auto-extends deadlines on last-minute bids (Anti-Sniping).
- **Hard Limits:** Strict forced-close timestamps to ensure auction finality.
- **Auto-Ranking:** Real-time L1, L2, L3 ranking of supplier quotes.
- **Role-Based Access:** Secure JWT authentication for Buyers and Suppliers.
- **Serverless Ready:** Optimized for deployment on platforms like Vercel.

---

## Deployment

This project is configured for a split deployment:
- **Frontend:** [Vercel](https://vercel.com)
- **Backend:** [Render](https://render.com)

### 1. Backend (Render)
1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. Set **Root Directory** to `backend`.
4. Render should auto-detect Python. Use:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add **Environment Variables**:
   - `MONGO_URI`: Your MongoDB connection string.
   - `JWT_SECRET`: A secure random string.
   - `CLIENT_URL`: Your Vercel frontend URL (e.g., `https://auctionx.vercel.app`).
   - `PORT`: 10000 (standard for Render).

### 2. Frontend (Vercel)
1. Create a new project on Vercel.
2. Connect your GitHub repository.
3. The root `vercel.json` will handle the build automatically.
4. Add **Environment Variables**:
   - `VITE_API_URL`: Your Render backend URL + `/api` (e.g., `https://auctionx-backend.onrender.com/api`).

---
*Last updated: April 2026*