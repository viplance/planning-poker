const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// In-memory database
const games = new Map();

const server = http.createServer((req, res) => {
  // Basic file server
  let filePath = path.join(
    __dirname,
    'public',
    req.url === '/' ? 'index.html' : req.url,
  );

  // Handle hash-based routing for the frontend
  // If the path doesn't exist and doesn't have an extension, serve index.html
  const ext = path.extname(filePath);
  if (!ext && !fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'public', 'index.html');
  }

  const contentType =
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.svg': 'image/svg+xml',
    }[ext] || 'text/html';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Internal Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let currentPlayer = null;
  let currentGameId = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    const { type, payload } = data;

    switch (type) {
      case 'CREATE_GAME': {
        const gameId = crypto.randomBytes(4).toString('hex');
        const game = {
          id: gameId,
          name: payload.gameName,
          votingSystem: payload.votingSystem,
          revealPolicy: payload.revealPolicy, // 'all' or 'creator'
          creatorId: payload.playerId,
          players: new Map(),
          revealed: false,
          timer: null,
          timerStartedAt: null,
        };
        games.set(gameId, game);
        ws.send(JSON.stringify({ type: 'GAME_CREATED', payload: { gameId } }));
        break;
      }

      case 'JOIN_GAME': {
        const game = games.get(payload.gameId);
        if (!game) {
          ws.send(
            JSON.stringify({
              type: 'ERROR',
              payload: { message: 'Game not found' },
            }),
          );
          return;
        }

        currentPlayer = {
          id: payload.playerId,
          name: payload.playerName,
          vote: null,
          ws: ws,
        };
        currentGameId = payload.gameId;
        game.players.set(currentPlayer.id, currentPlayer);

        broadcastUpdate(game);
        break;
      }

      case 'VOTE': {
        const game = games.get(currentGameId);
        if (game && currentPlayer) {
          game.players.get(currentPlayer.id).vote = payload.vote;
          broadcastUpdate(game);
        }
        break;
      }

      case 'REVEAL_CARDS': {
        const game = games.get(currentGameId);
        if (game) {
          const canReveal =
            game.revealPolicy === 'all' || game.creatorId === currentPlayer.id;
          if (canReveal) {
            game.revealed = true;
            broadcastUpdate(game);
          }
        }
        break;
      }

      case 'RESET_GAME': {
        const game = games.get(currentGameId);
        if (game) {
          const canReset =
            game.revealPolicy === 'all' || game.creatorId === currentPlayer.id;
          if (canReset) {
            game.revealed = false;
            game.players.forEach((p) => (p.vote = null));
            game.timerStartedAt = null;
            broadcastUpdate(game);
          }
        }
        break;
      }

      case 'START_TIMER': {
        const game = games.get(currentGameId);
        if (game) {
          game.timerStartedAt = Date.now();
          broadcastUpdate(game);
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (currentGameId && currentPlayer) {
      const game = games.get(currentGameId);
      if (game) {
        game.players.delete(currentPlayer.id);
        if (game.players.size === 0) {
          // games.delete(currentGameId); // Keep for a while?
        } else {
          broadcastUpdate(game);
        }
      }
    }
  });
});

function broadcastUpdate(game) {
  const gameState = {
    id: game.id,
    name: game.name,
    votingSystem: game.votingSystem,
    revealPolicy: game.revealPolicy,
    revealed: game.revealed,
    creatorId: game.creatorId,
    timerStartedAt: game.timerStartedAt,
    players: Array.from(game.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      vote: game.revealed ? p.vote : p.vote !== null,
      isCreator: p.id === game.creatorId,
    })),
  };

  game.players.forEach((p) => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify({ type: 'GAME_UPDATE', payload: gameState }));
    }
  });
}

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
