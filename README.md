# IOTA Donation Platform

A decentralized donation platform built on the **IOTA Tangle**, enabling users to post, close, and donate campaign with trustless payment settlement. This project demonstrates a full-stack integration of a **Move** smart contract with a modern **React** frontend.

## Table of Contents

- [IOTA Donation Platform](#IOTA Donation Platform)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Key Features](#key-features)
  - [Techniques \& Architecture](#techniques--architecture)
  - [Technologies Used](#technologies-used)
  - [Project Structure](#project-structure)
  - [Installation \& Setup](#installation--setup)
    - [Prerequisites](#prerequisites)
    - [1. Smart Contract Deployment](#1-smart-contract-deployment)
    - [2. Frontend Setup](#2-frontend-setup)
  - [Configuration](#configuration)
  - [Smart Contract API](#smart-contract-api)
  - [Contribution](#contribution)
  - [License](#license)

## Introduction

The **IOTA Donation Platform** leverages the IOTA network's unique object-centric data model to create a transparent marketplace for tasks. Unlike traditional bounty boards, this dApp ensures that funds are locked in the contract at the time of posting and are only released when the pool is at a certain by the creator, eliminating counterparty risk.

## Key Features

- **State-Driven Workflow**: Enforces a strict lifecycle: `Open` → `Claimed` → `Completed` → `Paid`.
- **Role-Based Access Control**:
  - **Creators** can create, close and withdraw campaigns.
  - **Public** users can view and donate for campaigns.
- **Reactive UI**: Real-time updates and optimistic UI states using React Query.
- **Wallet Integration**: Seamless connection with IOTA wallets via the dApp Kit.

## Techniques & Architecture

This project employs several advanced patterns suitable for scalable dApp development:

- **Resource-Oriented Programming (Move)**:
  The smart contract treats the `Task` as a [Move Resource](https://docs.iota.org/developer/move-overview/move-intro). This ensures that the bounty reward (an `IOTA` Coin) is physically stored within the task object and cannot be duplicated or accidentally destroyed.

- **Client-Side State Management**:
  We utilize [TanStack Query (React Query)](https://tanstack.com/query/latest) to manage server state. This abstracts the complexity of asynchronous blockchain data fetching, caching, and synchronization, providing a snappy user experience.

- **Component Composition**:
  The UI is built using [Radix UI](https://www.radix-ui.com/) primitives. This allows for accessible, unstyled components that are composed into a custom design system using `@radix-ui/themes`, avoiding the overhead of runtime CSS-in-JS libraries.

## Technologies Used

- **[IOTA Move](https://docs.iota.org/developer/move-overview/move-intro)**: Smart contract logic.
- **[React](https://react.dev/)**: Frontend library.
- **[@iota/dapp-kit](https://sdk.iota.org/dapp-kit)**: React hooks and components for IOTA.
- **[@radix-ui/themes](https://www.radix-ui.com/themes/docs/overview/getting-started)**: High-quality, accessible UI components.
- **[TypeScript](https://www.typescriptlang.org/)**: Static typing for safer code.

## Project Structure

```string
/
├── iota-scan-screenshot/
├── iota-donation-platform/
│   ├── src/
│   │   ├── App.tsx          # Main application logic & UI
│   │   └── index.tsx         # App entry & providers
│   ├── tailwind.config.js    # Tailwaind configuration
│   └── package.json         # Frontend dependencies
├── fundraising/
│   ├── sources/
│   │   └── fundraising.move # Move smart contract logic
│   └── Move.toml             # Package manifest
└── README.md
```

- **`iota-donation-platform/`**: Contains the Single Page Application (SPA).
- **`fundraising/`**: Contains the Move package, including the `fundraising` module.

## Installation & Setup

### Prerequisites

- **Node.js** (v18+)
- **IOTA CLI** (for smart contract deployment)
- **IOTA Wallet** (browser extension)

### Clone Project
Prepare an empty folder to clone the project by execute this command:
```bash
git clone https://github.com/phuchtq/iota-donation-platform.git
```

### 1. Smart Contract Deployment

Navigate to the move directory and publish the package to the IOTA Testnet.

```bash
cd fundraising
iota move build
iota client publish
```

> **Note**: Copy the **Package ID** from the output. You will need this for the frontend configuration.

### 2. Frontend Setup

Navigate to the frontend directory, install dependencies, and start the development server.

```bash
cd iota-donation-platform
npm install
npm start
```

## Configuration

After deploying the contract, update the frontend configuration to point to your new package.

Edit `iota-donation-platform/src/App.tsx`:

```typescript
const PACKAGE_ID = "0x...<YOUR_PACKAGE_ID>";
```

## Smart Contract API

The `fundraising` module exposes the following entry functions:

| Function          | Description                                                               |
| :---------------- | :------------------------------------------------------------------------ |
| `create_campaign`       | Creates a new `Campaign` object 
| `donate`      | User donates to a specific campaign                                       |
| `withdraw`   | Withdraw an amount of money from the campaign pool (Creator only).                        |
| `close_campaign`     | Closes the campaign when achieves a specific amount (Creator only).    |

## Contribution

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/{your-amazing-feature}`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/{your-amazing-feature}`).
5. Open a Pull Request.

## Contract address
https://explorer.iota.org/object/0x5766fdcf2ce2163c2ea0850cdd5b5f7199a5f3afdc850d5ec7c9305ef7ebf5d1?network=testnet

<img width="2054" height="1244" alt="image" src="https://github.com/phuchtq/iota-donation-platform/blob/main/iota-scan-screenshot/iota-pkg-scan-screenshot.png" />


## License

Distributed under the MIT License.