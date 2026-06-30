const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Сиздин статикалык файлдарды (HTML, JS, CSS) берүү
app.use(express.static('tank-game'));

let players = {};

io.on('connection', (socket) => {
    console.log('Жаңы оюнчу кошулду: ' + socket.id);

    // Жаңы оюнчуга баштапкы координаттарды берүү
    players[socket.id] = { x: 380, y: 500, hp: 3 };
    
    // Башка оюнчуларга жаңы оюнчу жөнүндө кабарлоо
    io.emit('currentPlayers', players);

    // Оюнчу кыймылдаганда
    socket.on('playerMovement', (movementData) => {
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        socket.broadcast.emit('playerMoved', players[socket.id]);
    });

    // Кландык чат үчүн
    socket.on('chatMessage', (msg) => {
        io.emit('chatMessage', msg);
    });

    socket.on('disconnect', () => {
        console.log('Оюнчу чыгып кетти: ' + socket.id);
        delete players[socket.id];
        io.emit('currentPlayers', players);
    });
});

server.listen(3000, () => {
    console.log('Сервер 3000-портто иштеп жатат. Мультиплеер активдүү.');
});
