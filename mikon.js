"use strict";

////////////////////////// require dependency yang dibutuhkan ////////////////////////////
const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const firebaseAdmin = require("firebase-admin");
const mqtt = require('mqtt');



///////////////////////////////////// setup database /////////////////////////////////////
const serviceAccount = require('./proyek-mikon.json');

firebaseAdmin.initializeApp({
  	credential: firebaseAdmin.credential.cert(serviceAccount),
  	databaseURL: "https://proyek-mikon.firebaseio.com"
});

var database = firebaseAdmin.database();
var dayaRef = database.ref('daya');
var energiRef = database.ref('energi');

var energyWh = 0.0;
energiRef.on('value', data => {
	energyWh = Number(data.val());
});



/////////////////////////////////// setup koneksi MQTT //////////////////////////////////
const mqttClient  = mqtt.connect('mqtt://52.230.69.177');

mqttClient.on('connect', function () {
	console.log('MQTT connected.');
	mqttClient.subscribe('mikon/daya', () => {
		console.log('MQTT subscribed to "mikon/daya".');	
	});
});



/////////////////////////////////// setup webserver /////////////////////////////////////
const app = express();
const port = 7071;
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors());
app.listen(port, () => { console.log(`Listening on port ${port}.`) });



////////////////////////////////////// promises ///////////////////////////////////////
var checkBody = function() {
	return new Promise((resolve, reject) => {
		for (var arg in arguments) {
			if (typeof arguments[arg] == 'undefined') reject('NO_BODY');
		}
		resolve('OK');
	});
}


/////////////////////////////////// handle request /////////////////////////////////////
app.post('/mikon/setWh', (req, res) => {
	var {Wh} = req.body;
	checkBody(Wh).then(() => {
		var setWh = Number(Wh);
		energyWh = setWh;
		energiRef.set(setWh);
		res.send('OK');
	}).catch(msg => res.send(msg));
});



var readInterval = 500;
var lastReadTime = Math.floor((new Date).getTime());

/////////////////////////////// MQTT incoming message ///////////////////////////////////
mqttClient.on('message', (topic, message) => {
	var currentTime = Math.floor((new Date).getTime());
	var payload = message.toString();
	var number = Number(payload);

	if ((currentTime - lastReadTime) > readInterval) {
		lastReadTime = currentTime;
		energyWh = energyWh + (number > 0 ? number/3600 : 0);
		energiRef.set(energyWh.toFixed(4));
		dayaRef.child(Math.floor((new Date).getTime()/1000)).set(message.toString());
	}

	else return;
});