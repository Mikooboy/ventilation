'use strict';
const path = require('path');

const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://192.168.83.223:1883');

const express = require('express');
const app = express();
app.use(express.json());

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ventilation.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) throw err;
});

//db.run(`CREATE TABLE ventilation(id UNSIGNED INTEGER AUTO_INCREMENT PRIMARY KEY, timestamp DATETIME NOT null DEFAULT(CURRENT_TIMESTAMP), nr, speed, setpoint, pressure, auto, error, co2, rh, temp)`);

let statusMessages = [];

client.on('connect', function () {
    console.log("Connected");
    client.subscribe('controller/status');
});

client.on('message', function (topic, message) {
    console.log(message.toString());
    let parsed = JSON.parse(message.toString());

    if (topic === "controller/status") {
        db.run(`INSERT INTO ventilation (nr, speed, setpoint, pressure, auto, error, co2, rh, temp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                parsed["nr"],
                parsed["speed"],
                parsed["setpoint"],
                parsed["pressure"],
                parsed["auto"],
                parsed["error"],
                parsed["co2"],
                parsed["rh"],
                parsed["temp"]
            ]
        );

        statusMessages.push(message.toString());
    }
});

app.get('/update', (req, res) => {
    db.all(`SELECT * FROM ventilation ORDER BY nr DESC LIMIT 1`,function(err, result) {
        if (err) console.log(err);
        res.send(JSON.stringify(result[0]));
    });
});

app.post('/send', (req, res) => {
    console.log(req.body);
    client.publish("controller/settings", JSON.stringify(req.body));
    res.send("Published settings");
});

app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'page.html'));
});

app.listen(3000);