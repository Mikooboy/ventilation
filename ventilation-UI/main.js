'use strict';
const path = require('path');

const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://192.168.1.254:1883');

const express = require('express');
const basicAuth = require('express-basic-auth');

const app = express();
app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.use(basicAuth({
    challenge: true,
    authorizer: validate
}));

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ventilation.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) throw err;
});

//db.run(`CREATE TABLE ventilation(id INTEGER PRIMARY KEY, timestamp DATETIME NOT null DEFAULT(CURRENT_TIMESTAMP), nr, speed, setpoint, pressure, auto, error, co2, rh, temp)`);
//db.run(`CREATE TABLE login(id INTEGER PRIMARY KEY, timestamp DATETIME NOT null DEFAULT(CURRENT_TIMESTAMP), username)`);

const users = {
    'test': 'd31aceb3c06e3e7acc5acbf53f7a26a578873b547a1932b2c30358c0d1a710e9',     //test123
    'test2': 'd31aceb3c06e3e7acc5acbf53f7a26a578873b547a1932b2c30358c0d1a710e9',    //test123
    'test3': 'd31aceb3c06e3e7acc5acbf53f7a26a578873b547a1932b2c30358c0d1a710e9',    //test123
    'admin': 'd8da308ccd0cf4c331521fc8f8771507e65e9981de1959e0c76e035291024b1e'     //admin
}
let loggedIn = {}

const crypto = require('crypto');
//console.log(crypto.pbkdf2Sync("admin", 'salt', 100000, 32, 'sha512').toString('hex'));
function encrypt(pass) {
    return crypto.pbkdf2Sync(pass, 'salt', 100000, 32, 'sha512').toString('hex');
}

function validate(username, password) {
    if (users[username] === encrypt(password) && !loggedIn[username]) {
        db.run(`INSERT INTO login (username) VALUES (?)`, [username]);
        console.log("logged in as " + username);
        loggedIn[username] = true;
    }
    return (users[username] === encrypt(password));
}

client.on('connect', function () {
    console.log("Connected");
    client.subscribe('controller/status');
});

client.on('message', function (topic, message) {
    let parsed = JSON.parse(message.toString());
    console.log(message.toString());

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
    }
});

app.get('/data/ventilation', function (req, res) {
   db.all(`SELECT * FROM ventilation WHERE timestamp >= datetime('now','-24 hours')`, function (err, result) {
       if (err) console.log(err);
       res.send(JSON.stringify(result));
   });
});

app.get('/data/login', function (req, res) {
   db.all(`SELECT * FROM login`, function (err, result) {
      if (err) console.log(err);
      res.send(JSON.stringify(result));
   });
});

app.get('/data/update', function (req, res) {
    db.all(`SELECT * FROM ventilation ORDER BY id DESC LIMIT 1`,function(err, result) {
        if (err) console.log(err);
        res.send(JSON.stringify(result[0]));
    });
});

app.post('/send', (req, res) => {
    console.log(req.body);
    client.publish("controller/settings", JSON.stringify(req.body));
    res.send("Published settings");
});

app.get('/logout', function (req, res) {
    console.log("logged out as " + req.auth["user"]);
    delete loggedIn[req.auth["user"]];
    res.status(401).sendFile(path.join(__dirname, 'logout.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'page.html'));
});

app.listen(3000);