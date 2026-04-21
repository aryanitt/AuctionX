# High Level Design - British Auction RFQ System

## System Overview
The British Auction RFQ system is a MERN stack application designed to facilitate real-time, ascending-price (reverse context) bidding for freight requests. Buyers can create RFQs with specific start, close, and hard-stop (forced close) times, along with dynamic auction extension rules. Suppliers (carriers) can view active RFQs and place real-time bids. The system ensures fairness by auto-ranking bids, instantly broadcasting updates to all observers via WebSockets, and conditionally extending auction deadlines if last-minute bids disrupt the leaderboard (L1 rank changes, any rank changes, or simply bid receipt).

## Architecture Diagram
```mermaid
flowchart LR
    subgraph Frontend [React SPA]
        UI[UI Components]
        API_Call[Axios HTTP]
        Socket_Client[Socket.io Client]
    end

    subgraph Backend [Express API]
        Router[REST Routes]
        Controllers[Business Logic]
        Socket_Server[Socket.io Server]
        Services[Extension Service]
        Cron[Cron Job]
    end

    subgraph Database [MongoDB]
        Users[(Users)]
        RFQs[(RFQs)]
        Bids[(Bids)]
    end

    UI <--> API_Call
    UI <--> Socket_Client
    
    API_Call --> Router
    Router --> Controllers
    Controllers --> Services
    Controllers <--> Users & RFQs & Bids
    
    Socket_Client <--> Socket_Server
    Controllers --> Socket_Server
    
    Cron --> RFQs
    Cron --> Socket_Server
```

## Auction Extension Flow
```mermaid
flowchart TD
    A[Supplier Submits Bid] --> B{Within Trigger Window?}
    B -- No --> C[Save Bid & Exit]
    B -- Yes --> D{Check Extension Trigger Rule}
    
    D -- bid_received --> E[Should Extend]
    D -- any_rank_change --> F{Did Any Rank Change?}
    D -- l1_rank_change --> G{Did Lowest Bidder Change?}
    
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
    L --> M[Emit Socket Event 'auction_extended']
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
        date bidStartTime
        date bidCloseTime
        date forcedCloseTime
        date pickupDate
        string status
        object auctionConfig
        array extensionLogs
    }

    BID {
        ObjectId _id PK
        ObjectId rfq FK
        ObjectId supplier FK
        number totalAmount
        number transitTime
        date quoteValidityDate
        number rank
        boolean isLatest
    }

    USER ||--o{ RFQ : creates
    USER ||--o{ BID : submits
    RFQ ||--o{ BID : receives
```
