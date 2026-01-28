# Planning Poker

## Features

- **Node.js Backend**: Uses the built-in `http` module and `ws` for real-time communication.
- **In-Memory Storage**: No external database required.
- **Anonymous & Persistent**: Player names are saved in `localStorage`.
- **Game Customization**: Choose between Fibonacci, T-Shirt sizes, or Natural numbers.
- **Privacy Controls**: Decide who can reveal cards (Everyone or only the Creator).
- **Interactive Timer**: Keep track of the discussion time.
- **Responsive Design**: Works great on mobile and desktop with a premium glassmorphic UI.

## How to Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000` in your browser.

## Tech Stack

- **Backend**: Node.js, `ws` (WebSockets)
- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS (via CDN)
- **Design**: Google Fonts (Outfit), Custom Glassmorphism effects
