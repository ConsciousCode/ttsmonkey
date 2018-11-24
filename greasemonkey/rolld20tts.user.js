// ==UserScript==
// @name roll20tts
// @version 2.0
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
		var checkLoaded = setInterval(function() {
			if (!$("#loading-overlay").is(":visible")) {
				clearInterval(checkLoaded);
				Init();
			}
		}, 1000);
	};

	// Init, d20 variable exposed and views are loaded
	function Init() {
    let d20 = window.d20;
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
		console.log(NAME, "> Ready");
	}

  let lsgi = window.localStorage.getItem;
  window.localStorage.getItem = new Proxy(lsgi, {
    apply: function apply(target, self, args) {
      if(args[0] === "WebRTC-AudioOutput") {
        window.d20 = apply.caller.arguments[0];
        console.log("> Obtained d20 variable");
        window.localStorage.getItem = lsgi;
      }
    }
  });
};

// Inject
unsafeWindow.eval(`(${d20boilerplate})()`);
