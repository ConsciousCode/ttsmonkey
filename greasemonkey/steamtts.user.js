// ==UserScript==
// @name websteamtts
// @version 0.1
// @description TTS for Steam web chat client
// @author ConsciousCode
// @match *://steamcommunity.com/chat/
// @grant unsafeWindow
// @run-at document-start
// ==/UserScript==

unsafeWindow.eval("(" + (function() {
	'use strict';
	
	console.log("websteamtts BEGIN - new");
	
	function parseMessage(el) {
		const name = el.querySelector('.speakerName').textContent;
		const timestamp = el.querySelector('.speakerTimeStamp').textContent;
		const content = el.querySelector('.msgText').textContent;
	
		return {name, timestamp, content};
	}
	
	const chatHistory = document.querySelector('.chatHistory');
	console.log("websteamtts: chatHistory", chatHistory);
	if(chatHistory) {
		new MutationObserver(muts => {
			console.log("websteamtts: mutation")
			for(const mut of muts) {
				if(mut.addedNodes.length == 0) continue;
				
				for(const node of mut.addedNodes) {
					if(node.classList && node.classList.contains('ChatMessageBlock')) {
						const msg = parseMessage(node);
						ttsmonkey_say(`${msg.name} says ${msg.content}`);
					}
				}
			}
		}).observe(chatHistory, { childList: true });
	}
	else {
		throw new Error("websteamtts: `.chatHistory` not found");
	}
	
	}).toString() + ")()");
	