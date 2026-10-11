<!-- Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza -->

# Ecolens Frontend Web Application

The frontend for Ecolens is a modern, responsive single-page web application designed to visually display real-time air quality, carbon metrics, heat indices, exposure analytics, and multi-agent AI features.

## New Features Added

- **Explore Hub (`/explore`)**: A navigation directory that acts as the entry point for agent-powered applications.
- **Eco-Travel Planner (`/travel-planner`)**: Request multi-agent eco-friendly travel itineraries, view custom-tailored day-by-day activities, and download `.ics` calendar files to import into Google Calendar or Apple Calendar.
- **Audio Tour Guide (`/audio-tour`)**: Generate environmental audio tours for specific spots (such as parks and historical spots) and play them back instantly using the built-in custom audio player.

## Technologies Used

- **React** & **TypeScript**
- **Vite**: Next-generation frontend tooling.
- **TanStack Start & Router**: Full-stack framework with type-safe routing.
- **MapLibre GL**: Fast, interactive vector maps.
- **Tailwind CSS**: Utility-first CSS styling framework.
- **Lucide React**: Premium icon set for consistent UI symbols.

## Setup Instructions

### 1. Prerequisites

Ensure you have Node.js (version 18 or higher) and npm installed.

### 2. Install Dependencies

Run the following command in the frontend directory:

```bash
npm install
```

### 3. Environment Variables

Copy `.env.example` to `.env`:

```bash
copy .env.example .env
```

### 4. Running the App

Start the Vite development server:

```bash
npm run dev
```

The application will be available at [http://localhost:8080](http://localhost:8080).
- Navigating to `/explore` (or clicking the **Compass** icon in the bottom menu) will launch the new AI hubs.
