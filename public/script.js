const socket = io();

let currentUser = null;

// LOGIN
async function login() {

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    currentUser = data.user;

    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";

    document.getElementById("welcome").innerText =
        "Willkommen " + currentUser.username;
}

// CREATE CHARACTER
async function createCharacter() {

    const name = document.getElementById("charName").value;
    const hp = document.getElementById("charHP").value;
    const ac = document.getElementById("charAC").value;

    await fetch("/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId: currentUser.id,
            name,
            hp,
            ac,
            stats: {}
        })
    });

    alert("Character gespeichert!");
}

// DICE
function rollDice(sides) {

    const result = Math.floor(Math.random() * sides) + 1;

    socket.emit("rollDice", {
        player: currentUser.username,
        sides,
        result
    });
}

socket.on("diceResult", (data) => {

    const div = document.createElement("div");

    div.innerHTML = `
        <b>${data.player}</b> würfelt D${data.sides} → <b>${data.result}</b>
    `;

    document.getElementById("feed").prepend(div);
});
