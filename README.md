# AuctionX

A real-time ascending-price British Auction Request for Quotation system. Buyers can create RFQs, and suppliers can place live bids. Built with the MERN stack (MongoDB, Express, React, Node.js) and real-time WebSockets via Socket.io.

## Prerequisites
- Node.js 18+
- MongoDB running locally on default port (27017)

## Setup Instructions

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   cd ../frontend
   npm install
   ```

2. **Environment Configuration**
   - Copy `backend/.env.example` to `backend/.env` (configured by default for local development).

3. **Seeding the Database**
   Creates test buyers, suppliers, active/closed RFQs, and sample bids.
   ```bash
   cd backend
   npm run seed
   ```
   **Credentials (Password for all: `Test@1234`)**:
   - Buyers: `buyer1@test.com`, `buyer2@test.com`
   - Suppliers: `supplier1@test.com`, `supplier2@test.com`, `supplier3@test.com`, `supplier4@test.com`

4. **Run Backend**
   ```bash
   cd backend
   npm run dev
   ```
   Server runs on `http://localhost:5000`

5. **Run Frontend**
   ```bash
   cd frontend
   npm run dev
   ```
   App runs on `http://localhost:5173`

## API Endpoints (`/api`)

| Method | Endpoint | Access | Function |
|--------|----------|--------|----------|
| POST | `/auth/register` | Public | Register new user |
| POST | `/auth/login` | Public | Login & get JWT |
| GET | `/auth/me` | Auth | Get current profile |
| GET | `/rfqs` | Auth | List all RFQs |
| POST | `/rfqs` | Buyer | Create RFQ |
| GET | `/rfqs/:id` | Auth | Get RFQ details and ranked bids |
| GET | `/rfqs/:id/bids` | Auth | Get bids for an RFQ |
| POST | `/rfqs/:id/bids`| Supplier | Submit a bid |

## Features
- Real-time bid updates via Socket.io
- Dynamic auction extension rules (auto-extends if bids are placed near deadline)
- Strict forced-close hard limits
- Auto-ranking of L1, L2, L3 suppliers
- Interactive countdown timer
- Glassmorphic dark UI with Tailwind CSS
