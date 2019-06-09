// ==UserScript==
// @name roll20tts
// @version 2.0
// @description roll20.net tts
// @author ConsciousCode
// @namespace https://github.com/ConsciousCode/ttsmonkey
// @match *://roll20*.net/*
// @match *://*.roll20*.net/editor/
// @match *://*.roll20dev.net/editor/
// @run-at document-end
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
	for (let c of el.childNodes) {
		if (c.nodeType === Node.TEXT_NODE) {
			yield c.textContent;
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

function handleMessage({type, who, msg}) {
	console.log("HANDLING", type, who, msg);
	switch (type) {
		case "general":
			say(`${who} said ${msg}`);
			break;
		case "emote":
			say(`${who} ${msg}`);
			break;
		case "whisper":
			say(`${who} whispered <emphasis level="reduced">${msg}</emphasis>`);
			break;
		case "diceroll":
			say(`${who} rolled ${msg.formula}. Total is ${msg.rolled}).`);
			break;
		case "system": break;
		case "error":
			say(`Error: ${msg}`);
			break;
		default:
			throw new Error(`Unknown message type "${type}"`);
	}
}

function parseBy(by) {
	let m = /(?:\(from\s+(.+?)\)|(.+?)):/i.exec(by);
	return m[1] || m[2];
}

let last_who = null;
function parseMessage(el) {
	let type, who, msg;

	if (el.classList.contains("system")) {
		type = "system";
		who = null;
		msg = null;
	}
	else {
		msg = trailingText(el);

		if (el.classList.contains("general")) {
			type = "general";
		}
		else if (el.classList.contains("emote")) {
			type = "emote";
			let m = /^(\S+)\s+(.+?)$/.exec(msg);
			last_who = m[1];
			msg = m[2];
			return {type, who: last_who, msg};
		}
		else if (el.classList.contains("whisper")) {
			type = "whisper";
		}
		else if (el.classList.contains("rollresult")) {
			type = "diceroll";
			msg = {
				formula: /^rolling\s+(.+)$/.exec(
					el.querySelector(".formula:not(.formattedFormula)").textContent
				)[1],
				rolled: el.getElementsByClassName("rolled")[0].textContent
			};
		}
		else if (el.classList.contains("error")) {
			type = "error";
			who = "error";
			return {type, who, msg};
		}
		else {
			throw new Error(`Unsupported message type(s): "${el.className}"`);
		}

		let by = el.getElementsByClassName("by")[0];
		if(by) {
			last_who = parseBy(by.textContent);
		}
	}

	return {type, who: last_who, msg};
}

let obroot = document.querySelector(".content[role=log]");

let is_first = true;
let ob = new MutationObserver(ls => {
	// Skip the first event, which contains the entire backlog
	if(is_first) {
		is_first = false;

		// Loop backwards to seed last_who
		for(let i = ls.length - 1; i >= 0; --i) {
			for(let el of ls[i].addedNodes) {
				let by = el.getElementsByClassName("by");
				if(by) {
					last_who = parseBy(by.textContent);
				}
				else if(el.classList.contains("emote")) {
					last_who = /^(\S+)/.exec(trailingText(el));
				}
				else {
					continue;
				}
				return;
			}
		}
		// Keep last_who as null
		return;
	}

	for (let mut of ls) {
		for (let el of mut.addedNodes) {
			if (el.classList.contains("message") && !el.classList.contains("you")) {
				try {
					let msg = parseMessage(el);
					handleMessage(msg);
				}
				catch (e) {
					alert(e);
				}
			}
		}
	}
}).observe(obroot, {
	attributes: false,
	childList: true,
	subtree: false
});