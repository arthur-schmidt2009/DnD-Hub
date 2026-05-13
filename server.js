const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.json());

// --- DB HELPERS ---
function loadDB() {
    return JSON.parse(fs.readFileSync("db.json"));
}

function saveDB(db) {
    fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
}

// --- LOGIN ---
app.post("/login", (req, res) => {

    const { username, password } = req.body;

    const db = loadDB();

    let user = db.users.find(u => u.username === username);

    if (!user) {
        user = {
            id: Date.now(),
            username,
            password,
            role: "player"
        };

        db.users.push(user);
        saveDB(db);
    }

    res.json({ success: true, user });
});

// --- CHARACTER CREATE ---
app.post("/character", (req, res) => {

    const db = loadDB();

    const char = {
        id: Date.now(),
        userId: req.body.userId,
        name: req.body.name,
        hp: req.body.hp,
        ac: req.body.ac,
        stats: req.body.stats
    };

    db.characters.push(char);
    saveDB(db);

    res.json(char);
});

// --- GET CHARACTERS ---
app.get("/characters/:userId", (req, res) => {

    const db = loadDB();

    const chars = db.characters.filter(c => c.userId == req.params.userId);

    res.json(chars);
});

// --- SOCKET DICE ---
io.on("connection", (socket) => {

    socket.on("rollDice", (data) => {
        io.emit("diceResult", data);
    });

});

server.listen(3000, () => {
    console.log("Server läuft auf http://localhost:3000");
});
