// ==UserScript==
// @name roll20tts
// @version 0.1
// @description roll20.net tts
// @author ConsciousCode
// @match *://roll20.net/*
// @match https://app.roll20.net/editor/
// @grant unsafeWindow
// @run-at document-start
// ==/UserScript==

'use strict';

// Source: https://github.com/kcaf/d20-boilerplate
var d20boilerplate = function() {
	const NAME = "d20-boilerplate";
	console.log(NAME,"> Injected");

	// Voice Queue to make sure messages don't talk over each other
	let vq = [];

	function voicedone() {
		vq.shift();
		if(vq.length) {
			vq[0]();
		}
	}

	function vqadd(f) {
		if(!vq.length) {
			f();
		}
		vq.push(f);
	}

	// A few common cleanups for the messages
	function cleanWhat(what) {
		return what.
			replace(/\bjpg\b/g, "jpeg"). // without this it spells out j-p-g
			replace(/\b(g?ui)\b/g, '<say-as interpret-as="characters">$2</say-as>').
			replace(/(?:https?:\/\/)?((?:[-\w]+\.)+[-\w]+)(?:\/.+$)?|\b([?!()<>\[\]]+)\b|(<em>)|(<\/em>)|\.{2,}/g,
			($0, $1, $2, $3, $4, $5) => {
				if($1) return `<prosody rate="fast">${$1}</prosody>`;
				if($2) return `<prosody rate="x-fast">${$2}</prosody>`;
				if($3) return '<emphasis level="strong">';
				if($4) return "</emphasis>";
				if($5) return `<break strength="${
						["x-weak", "weak", "medium", "strong", "x-strong"][$5.length - 2] || "x-strong"}"/>`;
			});
	}

	// Usually uses a different voice so I used this as an error reporter
	function nativeSay(what) {
		let utt = new SpeechSynthesisUtterance(what);
		utt.onend = voicedone;
		vqadd(() => {
			speechSynthesis.speak(utt);
		});
	}
	window.nativeSay = nativeSay;

	const APIKEY = "YOUR KEY HERE";

	// Fully parameterized Google TTS function
	// This is separated to make testing the desired voice easier
	function say(what, type, voice, accent, pitch, speed) {
		// Format the message as SSML
		what = cleanWhat(what);

		let xhr = new XMLHttpRequest();
		xhr.onload = function() {
			let res = JSON.parse(this.responseText);
			if(res.error) {
				nativeSay(`Error ${res.error.code}: ${res.error.message}`);
				throw res.error;
			}
			else {
				let a = new Audio("data:audio/mp3;base64," + JSON.parse(this.responseText).audioContent);
				a.onended = voicedone;
				vqadd(() => {
					a.play();
				});
			}
		}
		xhr.responseType = "application/json";
		xhr.open("POST", `https://texttospeech.googleapis.com/v1/text:synthesize?key=${APIKEY}`);
		xhr.send(JSON.stringify({
			"voice": {
				"name": `en-${accent}-${type}-${voice}`,
				"languageCode": "en-US"
			},
			"input": {
				"ssml": `<speak>${what}</speak>`,
			},
			"audioConfig": {
				"audioEncoding": "mp3",
				"pitch": pitch,
				"speakingRate": speed
			}
		}));
	}
	window.say = say;

	// Permanent configurations for the voice
	const TYPE = "WaveNet"; // "Standard" or "WaveNet"
	const VOICE = "A"; // A-F
	const ACCENT = "US"; // US, GB, or AU
	const PITCH = 0; // -20 to 20, 0 is no change
	const SPEED = 1/1; // 1/4 to 4, use fractions for clarity

	// Use say with those configurations
	function finalSay(what) {
		say(what, TYPE, VOICE, ACCENT, PITCH, SPEED);
	}
	window.finalSay = finalSay;

	// Window loaded
	window.onload = function() {
		window.unwatch("d20");

		var checkLoaded = setInterval(function() {
			if (!$("#loading-overlay").is(":visible")) {
				clearInterval(checkLoaded);
				Init();
			}
		}, 1000);
	};

	// Init, d20 variable exposed and views are loaded
	function Init() {
		console.log(NAME, "> Ready");

		// Hook the incoming function which acts as the core updater for the chat
		let inc = d20.textchat.incoming;
		d20.textchat.incoming = function(b, msg, ...rest) {
			if(msg.who !== "system" && msg.playerid !== d20_player_id) {
				if(msg.type === "emote") {
					finalSay(msg.who + " " + msg.content);
				}
				else if(msg.type === "whisper") {
					finalSay(`${msg.who} whispered <emphasis level="reduced">${msg.content}</emphasis>`);
				}
				else if(msg.type === "diceroll") {
					let roll = JSON.parse(msg.content);
					finalSay(`Rolling ${msg.sanitizedOrigRoll}. Total is ${roll.total}).`);
				}
				else if(msg.type === "error") {
					nativeSay("Error:" + msg.content);
				}
				else {
					finalSay(msg.who + " said " + msg.content);
				}
			}

			return inc.call(d20, b, msg, ...rest);
		}
	}

	/* object.watch polyfill by Eli Grey, http://eligrey.com */
	if (!Object.prototype.watch) {
		Object.defineProperty(Object.prototype, "watch", {
			enumerable: false,
			configurable: true,
			writable: false,
			value: function (prop, handler) {
				var
				oldval = this[prop],
				newval = oldval,
				getter = function () {
					return newval;
				},
				setter = function (val) {
					oldval = newval;
					return (newval = handler.call(this, prop, oldval, val));
				};

				if (delete this[prop]) {
					Object.defineProperty(this, prop, {
						get: getter,
						set: setter,
						enumerable: true,
						configurable: true
					});
				}
			}
		});
	}

	if (!Object.prototype.unwatch) {
		Object.defineProperty(Object.prototype, "unwatch", {
			enumerable: false,
			configurable: true,
			writable: false,
			value: function (prop) {
				var val = this[prop];
				delete this[prop];
				this[prop] = val;
			}
		});
	}
	/* end object.watch polyfill */

	window.d20ext = {};
	window.watch("d20ext", function (id, oldValue, newValue) {
		console.log(NAME, "> Set Development");
		newValue.environment = "development";
		return newValue;
	});

	window.d20 = {};
	window.watch("d20", function (id, oldValue, newValue) {
		console.log(NAME, "> Obtained d20 variable");
		newValue.environment = "production";
		return newValue;
	});
};

// Inject
unsafeWindow.eval(`(${d20boilerplate})()`);
