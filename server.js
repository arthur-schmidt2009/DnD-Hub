require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Client } = require("pg");
const bcrypt = require("bcrypt");

const app = express();

const server = http.createServer(app);

const io = new Server(server);

// -----------------------------
// SETTINGS
// -----------------------------

const PORT = 3000;

// -----------------------------
// MIDDLEWARE
// -----------------------------

app.use(express.static("public"));
app.use(express.json());

// -----------------------------
// DATABASE CONNECTION
// -----------------------------

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect()
    .then(() => {
        console.log("✅ Supabase verbunden");
    })
    .catch((err) => {
        console.error("❌ DB Fehler:", err);
    });

// -----------------------------
// TEST ROUTE
// -----------------------------

app.get("/testdb", async (req, res) => {

    try {

        const result = await db.query("SELECT NOW()");

        res.json({
            success: true,
            time: result.rows[0]
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

// -----------------------------
// REGISTER
// -----------------------------

app.post("/register", async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;

        // USER EXISTIERT?
        const existingUser = await db.query(
            `
            SELECT * FROM users
            WHERE username = $1
            `,
            [username]
        );

        if (existingUser.rows.length > 0) {

            return res.status(400).json({
                success: false,
                message: "Username existiert bereits"
            });

        }

        // PASSWORT HASHEN
        const hashedPassword = await bcrypt.hash(password, 10);

        // USER ERSTELLEN
        const result = await db.query(
            `
            INSERT INTO users
            (username, password, role)

            VALUES ($1, $2, $3)

            RETURNING id, username, role
            `,
            [username, hashedPassword, "player"]
        );

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

// -----------------------------
// LOGIN
// -----------------------------

app.post("/login", async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;

        // USER SUCHEN
        const result = await db.query(
            `
            SELECT * FROM users
            WHERE username = $1
            `,
            [username]
        );

        if (result.rows.length === 0) {

            return res.status(400).json({
                success: false,
                message: "User nicht gefunden"
            });

        }

        const user = result.rows[0];

        // PASSWORT PRÜFEN
        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {

            return res.status(400).json({
                success: false,
                message: "Falsches Passwort"
            });

        }

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

// -----------------------------
// CHARACTER CREATE
// -----------------------------

app.post("/character", async (req, res) => {

    try {

        const {
            userId,
            name,
            className,
            race,
            hp,
            armorClass
        } = req.body;

        const result = await db.query(
            `
            INSERT INTO characters
            (
                user_id,
                name,
                class,
                race,
                hp,
                armor_class
            )

            VALUES ($1, $2, $3, $4, $5, $6)

            RETURNING *
            `,
            [
                userId,
                name,
                className,
                race,
                hp,
                armorClass
            ]
        );

        res.json({
            success: true,
            character: result.rows[0]
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

// -----------------------------
// GET USER CHARACTERS
// -----------------------------

app.get("/characters/:userId", async (req, res) => {

    try {

        const result = await db.query(
            `
            SELECT * FROM characters
            WHERE user_id = $1
            `,
            [req.params.userId]
        );

        res.json({
            success: true,
            characters: result.rows
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

// -----------------------------
// SOCKET.IO MULTIPLAYER
// -----------------------------

io.on("connection", (socket) => {

    console.log("🟢 Spieler verbunden");

    // DICE ROLL
    socket.on("rollDice", (data) => {

        io.emit("diceResult", data);

    });

    // DISCONNECT
    socket.on("disconnect", () => {

        console.log("🔴 Spieler disconnected");

    });

});

// -----------------------------
// SERVER START
// -----------------------------

server.listen(PORT, () => {

    console.log(`
====================================
🎲 DND HUB SERVER GESTARTET
🌍 http://localhost:${PORT}
====================================
    `);

});const express = require("express");
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
