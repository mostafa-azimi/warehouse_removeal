# Warehouse Removal

*QR code generation, inventory scanning, and ShipHero integration for warehouse removal operations*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/mikeazimi-dischubcoms-projects/warehouse-removal)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)

## Overview

A comprehensive warehouse removal management system that streamlines inventory scanning, packing, and order creation with ShipHero integration. Features QR code generation, real-time scanning, manifest management, and automated sales order creation.

## Features

- **QR Code Generation**: Create QR codes for inventory items
- **Real-time Scanning**: Scan QR codes to build packing boxes
- **Inventory Management**: Import and manage warehouse inventory data
- **Manifest Generation**: Export packing manifests in multiple formats
- **ShipHero Integration**: Create sales orders directly in ShipHero
- **Token Management**: Secure API token handling with auto-refresh
- **Warehouse Testing**: Test API connections and view warehouse info

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: Radix UI, Tailwind CSS
- **API Integration**: ShipHero GraphQL API
- **Authentication**: JWT token management
- **Deployment**: Vercel

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure ShipHero API in Settings
4. Start development server: `npm run dev`

## ShipHero Integration

The app integrates with ShipHero's GraphQL API to:
- Test API connections and display warehouse information
- Create sales orders from packed boxes
- Manage authentication tokens with automatic refresh
- Streamline the removal process with automated order creation