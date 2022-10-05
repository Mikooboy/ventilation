'use strict';
const path = require('path');

const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://192.168.83.223:1883');

const express = require('express');
const app = express();
app.use(express.json());

let statusMessages = [];

client.on('connect', function () {
    console.log("Connected");
    client.subscribe('controller/status');
});

client.on('message', function (topic, message) {
    console.log(message.toString());
    if (topic === "controller/status") {
        statusMessages.push(message.toString());
    }
});

app.get('/update', (req, res) => {
    res.send(statusMessages[statusMessages.length - 1]);
});

app.post('/send', (req, res) => {
    console.log(req.body);
    client.publish("controller/settings", JSON.stringify(req.body));
});

app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'page.html'));
});

app.listen(3000);