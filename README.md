# Gun Del Sol Web

Web dashboard for Gun Del Sol - A Solana token analysis and monitoring tool.

## Overview

This is the frontend web interface for Gun Del Sol, built with:

- Framework - [Next.js 15](https://nextjs.org/15)
- Language - [TypeScript](https://www.typescriptlang.org)
- Styling - [Tailwind CSS v4](https://tailwindcss.com)
- Components - [Shadcn-ui](https://ui.shadcn.com)
- Tables - [Tanstack Data Tables](https://ui.shadcn.com/docs/components/data-table)
- State Management - [Zustand](https://zustand-demo.pmnd.rs)
- Linting - [ESLint](https://eslint.org)
- Formatting - [Prettier](https://prettier.io)

## Features

- **Token Analysis Dashboard**: View and analyze Solana token data
- **Wallet Tracking**: Monitor early buyer wallets and their transactions
- **Historical Analysis**: View past token analysis runs with detailed wallet breakdowns
- **Real-time Updates**: Live data from the Flask backend API

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Gun Del Sol backend running on `http://localhost:5001`

### Installation

1. Clone the repository:
```bash
git clone https://github.com/88simon/gun_del_sol_web.git
cd gun_del_sol_web
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Dashboard pages
│   │   └── tokens/       # Token analysis pages
│   └── api/              # API routes
├── components/           # Shared components
│   ├── ui/              # UI components
│   └── layout/          # Layout components
├── lib/                 # Utilities
│   └── api.ts          # Backend API client
└── types/              # TypeScript types
```

## Backend Integration

This frontend connects to the Gun Del Sol Flask backend API. Make sure the backend is running on port 5001 before starting the frontend.

Backend repository: [gun_del_sol](https://github.com/88simon/gun_del_sol)

## License

MIT License - see LICENSE file for details
