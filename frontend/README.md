# City of Kigali Service Delivery & Parking Monitoring System (IKAZE)

A modular React application that integrates two core systems for streamlined city hall operations:

## Smart Parking System

Manages vehicle access, real-time parking space allocation, overstay monitoring, and reservation management for staff and visitors.

## Service Delivery System

Tracks visitor journeys from entry to exit, manages department assignments, and enables real-time service tracking with a 3-step handoff flow (Receptionist → Department Manager → Department Employee).

## Features

- **Modular Architecture**: Scalable design allowing easy integration of future systems
- **Role-based Dashboards**: Custom views for Admin, Gate Officer, Receptionist, Department Manager, and Department Employee
- **Real-time Socket Updates**: Live data synchronization across all connected clients
- **Comprehensive Audit Trails**: Track all visitor and vehicle movements

## Tech Stack

- React + TypeScript
- Vite
- Real-time WebSocket integration
- Context-based state management

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```
