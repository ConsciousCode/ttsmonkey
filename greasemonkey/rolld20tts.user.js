// ==UserScript==
// @name roll20tts
// @version 2.0
// @description roll20.net tts
// @author ConsciousCode
// @namespace https://github.com/ConsciousCode/ttsmonkey
// @match *://roll20*.net/*
// @run-at document-start
// ==/UserScript==

'use strict';

// A few common cleanups for the messages
function cleanWhat(what) {
	return what.
		replace(/\bjpg\b/g, "jpeg"). // without this it spells out j-p-g
		replace(/\b(g?ui)\b/g, '<say-as interpret-as="characters">$2</say-as>').
		replace(/(?:https?:\/\/)?((?:[-\w]+\.)+[-\w]+)(?:\/.+$)?|\b([?!()<>\[\]]+)\b|(<em>)|(<\/em>)|\.{2,}/g,
			($0, $1, $2, $3, $4, $5) => {
				if ($1) return `<prosody rate="fast">${$1}</prosody>`;
				if ($2) return `<prosody rate="x-fast">${$2}</prosody>`;
				if ($3) return '<emphasis level="strong">';
				if ($4) return "</emphasis>";
				if ($5) return `<break strength="${
					["x-weak", "weak", "medium", "strong", "x-strong"][$5.length - 2] || "x-strong"}"/>`;
			});
}

function say(what) {
	ttsmonkey_say(cleanWhat(what), false);
}

function* immediateTextNodes(el) {
	for (let c of el.children) {
		if (c.nodeType === Node.TEXT_NODE) {
			yield c;
		}
	}
}

function trailingText(el) {
	let x = "";
	for (let y of immediateTextNodes(el)) {
		x += y;
	}
	return x;
}

function handleMessage(type, who, msg) {
	switch (type) {
		case "general":
			say(`${who} said ${msg}`);
			break;
		case "emote":
			say(`${who} ${msg}`);
			break;
		case "whisper":
			say(`${msg.who} whispered <emphasis level="reduced">${msg.content}</emphasis>`);
			break;
		case "diceroll":
			say(`Rolling ${msg.formula}. Total is ${msg.rolled}).`);
			break;
		case "system": break;
		case "error":
			say(`Error: ${msg}`);
			break;
		default:
			throw new Error(`Unknown message type "${type}"`);
	}
}

function newMessage(el) {
	let type, who, msg;

	if (el.classList.contains("system")) {
		type = "system";
		who = null;
		msg = null;
	}
	else {
		msg = trailingText(el);

		if (el.classList.contains("emote")) {
			type = "emote";
		}
		else if (el.classList.contains("general")) {
			type = "diceroll";
			msg = {
				formula: el.querySelector(".formula:not(.formattedFormula)"),
				rolled: msg
			};
		}
		else if (el.classList.contains("whisper") {
			type = "whisper";
			who = el.getElementsByClassName("by")[0].slice(0, -1);
		}
		else if (el.classList.contains("error") {
			type = "error";
		}
		else {
			throw new Error(`Unsupported message type(s): "${el.className}"`);
		}
	}

	handleMessage(type, who, msg);
}

let ob = new MutationObserver(ls => {
	for (let mut of ls) {
		for (let el of mut.addedNodes) {
			if (el.classList.contains("message")) {
				try {
					newMessage(el);
				}
				catch (e) {
					alert(e);
				}
			}
		}
	}
}).observe(document.getElementsByClassName("content")[0], {
	attributes: false,
	childList: true,
	subtree: false
});