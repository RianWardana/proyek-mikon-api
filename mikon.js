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
app.post('/ecg/signals', (req, res) => {
	var {signals} = req.body;
	checkBody(signals).then(() => {
		var signalsArray = JSON.parse(signals);
		// console.log(signalsArray);
		ecgRef.child(Math.floor((new Date).getTime()/1000)).set(signalsArray);
		// signalsArray.forEach(signal => {
		// 	console.log(signal);
		// });
		res.send('OK');
	}).catch(msg => res.send(msg));
});

app.post('/ecg/bpm', (req, res) => {
	var {bpm} = req.body;
	checkBody(bpm).then(() => {
		bpmRef.child(Math.floor((new Date).getTime()/1000)).set(bpm);
		res.send('OK');
	}).catch(msg => res.send(msg));
});



var readInterval = 500;
var lastReadTime = Math.floor((new Date).getTime());
var energyWh = 0;

/////////////////////////////// MQTT incoming message ///////////////////////////////////
mqttClient.on('message', (topic, message) => {
	var currentTime = Math.floor((new Date).getTime());

	if ((currentTime - lastReadTime) > readInterval) {
		lastReadTime = currentTime;
		energyWh = energyWh + ( Number(message.toString()) / 3600 );
		energiRef.set(energyWh.toFixed(4));
		dayaRef.child(Math.floor((new Date).getTime()/1000)).set(message.toString());
	}

	else return;
});