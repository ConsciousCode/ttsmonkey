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

	function say(what) {
		ttsmonkey_say(cleanWhat(what), false);
	}

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
					say(msg.who + " " + msg.content);
				}
				else if(msg.type === "whisper") {
					say(`${msg.who} whispered <emphasis level="reduced">${msg.content}</emphasis>`);
				}
				else if(msg.type === "diceroll") {
					let roll = JSON.parse(msg.content);
					say(`Rolling ${msg.sanitizedOrigRoll}. Total is ${roll.total}).`);
				}
				else if(msg.type === "error") {
					say("Error: " + msg.content);
				}
				else {
					say(msg.who + " said " + msg.content);
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
