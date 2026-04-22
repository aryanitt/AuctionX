# High Level Design — AuctionX (British Auction RFQ System)

## System Overview

AuctionX is a real-time reverse-auction RFQ platform built with **React** and **FastAPI**. Buyers create RFQs with configurable start, close, and hard-stop (forced close) times, along with dynamic auction extension rules. Suppliers can view active RFQs and place bids in real time. The system auto-ranks bids, broadcasts updates to all observers via WebSockets, and conditionally extends deadlines when last-minute bids disrupt the leaderboard.

## Architecture Diagram

```mermaid
flowchart LR
    subgraph Frontend ["React SPA (Vite)"]
        UI[UI Components]
        API_Call[Axios HTTP]
        Socket_Client[Socket.io Client]
    end

    subgraph Backend ["FastAPI Backend"]
        Router[API Routes]
        Services[Service Layer]
        Socket_Server[Socket.io Server]
        Scheduler[APScheduler]
    end

    subgraph Database [MongoDB]
        Users[(Users)]
        RFQs[(RFQs)]
        Bids[(Bids)]
    end

    UI <--> API_Call
    UI <--> Socket_Client

    API_Call --> Router
    Router --> Services
    Services <--> Users & RFQs & Bids

    Socket_Client <--> Socket_Server
    Services --> Socket_Server

    Scheduler --> RFQs
    Scheduler --> Socket_Server
```

## Module Architecture

```mermaid
flowchart TD
    subgraph app ["app/"]
        Main["main.py — ASGI entry point"]
        Config["config.py — Settings"]
        DB["db.py — Motor client"]
        Events["events.py — Socket.io handlers"]
    end

    subgraph middleware ["middleware/"]
        Auth["auth.py — JWT + role guards"]
    end

    subgraph modules ["modules/"]
        AuthMod["auth/ — registration, login"]
        RFQMod["rfq/ — CRUD, reference IDs"]
        BidMod["bid/ — submission, ranking, extension"]
        AuctionMod["auction/ — lifecycle scheduler"]
    end

    subgraph utils ["utils/"]
        JWT["jwt.py — token encode/decode"]
        Serializer["serializer.py — ObjectId → str"]
        Helpers["helpers.py — date parsing"]
    end

    Main --> Config
    Main --> DB
    Main --> Events
    Main --> AuthMod
    Main --> RFQMod
    Main --> BidMod
    Main --> AuctionMod
    AuthMod --> Auth
    RFQMod --> Auth
    BidMod --> Auth
    BidMod --> JWT
    AuthMod --> JWT
    RFQMod --> Helpers
    BidMod --> Helpers
```

## Auction Extension Flow

```mermaid
flowchart TD
    A[Supplier Submits Bid] --> B{Within Trigger Window?}
    B -- No --> C[Save Bid & Exit]
    B -- Yes --> D{Check Extension Trigger Rule}

    D -- bid_received --> E[Should Extend]
    D -- any_rank_change --> F{Did Any Rank Change?}
    D -- l1_rank_change --> G{Did L1 Bidder Change?}

    F -- Yes --> E
    F -- No --> C
    G -- Yes --> E
    G -- No --> C

    E --> H[Calculate Proposed Close Time]
    H --> I{Proposed > Forced Close?}
    I -- Yes --> J[Clamp to Forced Close]
    I -- No --> K[Use Proposed Close]

    J --> L[Save RFQ & Log Extension]
    K --> L
    L --> M["Emit 'auction_extended' via Socket.io"]
```

## Database Entity-Relationship

```mermaid
erDiagram
    USER {
        ObjectId _id PK
        string name
        string email
        string password
        string role "buyer | supplier"
    }

    RFQ {
        ObjectId _id PK
        string referenceId
        string name
        ObjectId buyer FK
        datetime bidStartTime
        datetime bidCloseTime
        datetime forcedCloseTime
        datetime pickupDate
        string status
        object auctionConfig
        array extensionLogs
    }

    BID {
        ObjectId _id PK
        ObjectId rfq FK
        ObjectId supplier FK
        float totalAmount
        int transitTime
        datetime quoteValidityDate
        int rank
        boolean isLatest
    }

    USER ||--o{ RFQ : creates
    USER ||--o{ BID : submits
    RFQ ||--o{ BID : receives
```
