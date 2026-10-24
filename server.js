// Spieleabend – kleiner Relay-Server.
// Die gesamte Spiellogik läuft auf dem Gerät der Spielleitung (Host).
// Der Server verwaltet nur Räume, leitet Ansichten an die Handys weiter
// und schickt deren Aktionen zurück an den Host.

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const ROOM_TTL = 12 * 60 * 60 * 1000; // Räume verfallen nach 12 h ohne Aktivität

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

app.get('/healthz', (req, res) => res.send('ok'));

app.get('/qr.svg', async (req, res) => {
  const text = String(req.query.t || '');
  if (!text || text.length > 500) return res.status(400).end();
  try {
    const svg = await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svg);
  } catch (e) {
    res.status(500).end();
  }
});

app.get(['/j/:code', '/join'], (req, res) => res.sendFile(path.join(PUBLIC, 'join.html')));
app.use(express.static(PUBLIC));

// ---------- Räume ----------
const rooms = new Map();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function newCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function makeRoom(code, hostToken) {
  const room = { code, hostToken, hostSocket: null, players: new Map(), lobby: null, touched: Date.now() };
  rooms.set(code, room);
  return room;
}

function playerList(room) {
  return [...room.players.values()].map(p => ({ pid: p.pid, name: p.name, connected: !!p.socketId }));
}

function notifyHost(room) {
  if (room.hostSocket) io.to(room.hostSocket).emit('players', playerList(room));
}

// Timer werden als Restzeit übertragen. Der Server rechnet sie in eine absolute
// Serverzeit um, damit auch zwischengespeicherte Ansichten die richtige Restzeit zeigen.
function stampIn(view) {
  if (view && view.timer && typeof view.timer.remainingMs === 'number' && !view.timer.paused) {
    view.timer.endServer = Date.now() + view.timer.remainingMs;
  }
  return view;
}
function stampOut(view) {
  if (view && view.timer && view.timer.endServer) {
    return { ...view, timer: { ...view.timer, remainingMs: Math.max(0, view.timer.endServer - Date.now()) } };
  }
  return view;
}

io.on('connection', socket => {
  // ----- Host -----
  socket.on('host:open', (msg = {}, cb) => {
    let { code, hostToken } = msg;
    let room = code && rooms.get(code);
    if (room && room.hostToken !== hostToken) room = null; // Code gehört jemand anderem
    if (!room) {
      if (code && hostToken && /^[A-Z]{4}$/.test(code) && !rooms.has(code)) room = makeRoom(code, hostToken);
      else room = makeRoom(newCode(), crypto.randomBytes(12).toString('hex'));
    }
    room.hostSocket = socket.id;
    room.touched = Date.now();
    socket.data.hostOf = room.code;
    io.to('room:' + room.code).emit('hostStatus', true);
    if (typeof cb === 'function') cb({ code: room.code, hostToken: room.hostToken, players: playerList(room) });
  });

  function hostRoom() {
    const room = rooms.get(socket.data.hostOf);
    if (room && room.hostSocket === socket.id) {
      room.touched = Date.now();
      return room;
    }
    return null;
  }

  socket.on('host:view', ({ pid, view } = {}) => {
    const room = hostRoom();
    if (!room) return;
    const p = room.players.get(pid);
    if (!p) return;
    p.view = stampIn(view);
    if (p.socketId) io.to(p.socketId).emit('view', stampOut(p.view));
  });

  socket.on('host:lobby', lobby => {
    const room = hostRoom();
    if (!room) return;
    room.lobby = lobby;
    io.to('room:' + room.code).emit('lobby', lobby);
  });

  socket.on('host:kick', ({ pid } = {}) => {
    const room = hostRoom();
    if (!room) return;
    const p = room.players.get(pid);
    if (!p) return;
    if (p.socketId) io.to(p.socketId).emit('kicked');
    room.players.delete(pid);
    notifyHost(room);
  });

  socket.on('host:close', () => {
    const room = hostRoom();
    if (!room) return;
    io.to('room:' + room.code).emit('closed');
    rooms.delete(room.code);
  });

  // ----- Mitspielende -----
  socket.on('player:hello', ({ code } = {}, cb) => {
    if (typeof cb !== 'function') return;
    code = String(code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) return cb({ ok: false, error: 'Raum nicht gefunden. Ist der Code richtig und die Spielleitung online?' });
    socket.join('room:' + code);
    cb({ ok: true, lobby: room.lobby, hostOnline: !!room.hostSocket });
  });

  socket.on('player:join', ({ code, pid, name } = {}, cb) => {
    if (typeof cb !== 'function') return;
    code = String(code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) return cb({ ok: false, error: 'Raum nicht gefunden.' });
    name = String(name || '').trim().slice(0, 24);
    let p = pid && room.players.get(pid);
    if (!p) {
      if (!name) return cb({ ok: false, error: 'Bitte gib einen Namen ein.', needName: true });
      const clash = [...room.players.values()].find(x => x.name.toLowerCase() === name.toLowerCase());
      if (clash) {
        if (clash.socketId && clash.socketId !== socket.id) return cb({ ok: false, error: `„${name}“ ist schon verbunden. Wähle einen anderen Namen.` });
        p = clash; // getrennten Spieler übernehmen
      } else {
        const id = pid && /^[a-z0-9]{6,32}$/i.test(pid) ? pid : crypto.randomBytes(8).toString('hex');
        p = { pid: id, name, view: null, socketId: null };
        room.players.set(id, p);
      }
    }
    if (p.socketId && p.socketId !== socket.id) io.to(p.socketId).emit('replaced');
    p.socketId = socket.id;
    socket.data.player = { code, pid: p.pid };
    socket.join('room:' + code);
    room.touched = Date.now();
    notifyHost(room);
    cb({ ok: true, pid: p.pid, name: p.name, view: stampOut(p.view), lobby: room.lobby, hostOnline: !!room.hostSocket });
  });

  socket.on('player:action', data => {
    const info = socket.data.player;
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room || !room.hostSocket) return;
    const p = room.players.get(info.pid);
    if (!p || p.socketId !== socket.id) return;
    room.touched = Date.now();
    io.to(room.hostSocket).emit('action', { pid: info.pid, data });
  });

  socket.on('player:leave', () => {
    const info = socket.data.player;
    if (!info) return;
    const room = rooms.get(info.code);
    socket.data.player = null;
    if (!room) return;
    room.players.delete(info.pid);
    notifyHost(room);
  });

  socket.on('disconnect', () => {
    const hostCode = socket.data.hostOf;
    if (hostCode) {
      const room = rooms.get(hostCode);
      if (room && room.hostSocket === socket.id) {
        room.hostSocket = null;
        io.to('room:' + room.code).emit('hostStatus', false);
      }
    }
    const info = socket.data.player;
    if (info) {
      const room = rooms.get(info.code);
      const p = room && room.players.get(info.pid);
      if (p && p.socketId === socket.id) {
        p.socketId = null;
        notifyHost(room);
      }
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) if (now - room.touched > ROOM_TTL) rooms.delete(code);
}, 30 * 60 * 1000);

server.listen(PORT, () => console.log(`Spieleabend läuft auf http://localhost:${PORT}`));
