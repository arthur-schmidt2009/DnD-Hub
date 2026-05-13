function rollDice(player, sides) {

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