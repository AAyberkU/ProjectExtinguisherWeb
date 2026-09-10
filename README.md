# Project Extinguisher - Web Port 🚒

Welcome to the web-native port of **Project Extinguisher**, a short, hex-based puzzle game where you guide Larry across a dangerous board by calculating paths before running out of moves. 

This project serves as both a portfolio piece showcasing a clean Unity-to-Web port, and an experimental sandbox for **Agentic Workflow**—demonstrating how AI can autonomously drive project development through living documentation.

## 🎮 Gameplay

- **The Goal:** Reach the target hex tile before you run out of moves.
- **The Challenge:** Larry can only move to adjacent tiles. You are not controlling him freely, but preparing safe steps for him under pressure.
- **Special Tiles:** Navigate through blocked obstacles, utilize catapults that launch Larry across the board, and grab health tiles to replenish your moves.
- **The Engine:** Levels are pure data-driven JSON ports directly from Unity `LevelData.asset` files, rendered smoothly on a 61-cell axial hex grid.

## 🛠️ Tech Stack

This project was built from the ground up to be lightweight, mobile-friendly, and independent of backend infrastructure for the initial playable slice.

- **Core Logic:** TypeScript
- **Rendering:** Pixi.js (2D WebGL canvas)
- **UI & HUD:** React + SCSS
- **Build Tool:** Vite
- **Data:** JSON (Level definitions)
- **Distribution:** Progressive Web App (PWA) ready, optimized for mobile landscape play.

## 🤖 Agentic Workflow & AI Integration

What makes this repository special isn't just the code, but *how* it was written. This project was developed utilizing an **Agentic AI Workflow**, guided by the root `AGENTS.md` and living documentation in the `docs/` directory.

Instead of traditional pair-programming with AI, the AI agents act autonomously by maintaining and reading their own operational memory:

1. **Context Initialization:** Before every session, the AI reads `AGENTS.md` (the operational guide) and `docs/progress.md` (the current state).
2. **Design Adherence:** The AI cross-references `docs/design.md` for architectural rules and `docs/game.md` for game design intent, ensuring decisions are aligned with the original vision.
3. **Execution & Documentation:** The AI implements features in small, deterministic steps, and then updates the documentation (including `docs/bugs.md`) to reflect the new reality for the *next* agent session.

This approach proves that with structured, living markdown files acting as an "external brain," AI agents can handle complex porting tasks, maintain architectural separation (like keeping React UI separate from Pixi rendering), and autonomously drive a project to completion.

## 🚀 Getting Started

To run the project locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/AAyberkU/ProjectExtinguisherWeb.git
   ```
2. Navigate to the web app directory:
   ```bash
   cd ProjectExtinguisherWeb/apps/web
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## 📱 PWA & Mobile Support

The game is configured as a Progressive Web App. It features a custom `manifest.json`, mobile-specific UI scaling, and CSS rules enforcing landscape mode for the best possible touch experience on mobile devices.
