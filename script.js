const socket = io();

let playerName = "";

// LOGIN
function login() {
    const input = document.getElementById("nameInput");

    playerName = input.value.trim();

    if (!playerName) return;

    localStorage.setItem("playerName", playerName);

    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("game").style.display = "block";

    document.getElementById("welcome").innerText =
        "Willkommen, " + playerName;
}

// DICE ROLL
function rollDice(sides) {

    const result = Math.floor(Math.random() * sides) + 1;

    socket.emit("rollDice", {
        player: playerName,
        sides,
        result
    });
}

// RECEIVE UPDATES
socket.on("diceResult", (data) => {

    const feed = document.getElementById("feed");

    const div = document.createElement("div");

    div.innerHTML = `
        <b>${data.player}</b> würfelt D${data.sides}
        → <b>${data.result}</b>
    `;

    feed.prepend(div);
});﻿function rollDice(player, sides) {

    const result = Math.floor(Math.random() * sides) + 1;

    const feed = document.getElementById("feed");

    const entry = document.createElement("div");

    entry.classList.add("feed-entry");

    if (sides === 20 && result === 20) {
        entry.classList.add("crit");
    }

    if (sides === 20 && result === 1) {
        entry.classList.add("fail");
    }

    entry.innerHTML = `
        <strong>${player}</strong> würfelt D${sides}<br>
        Ergebnis: <strong>${result}</strong>
    `;

    feed.prepend(entry);
}
