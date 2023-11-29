// ==UserScript==
// @name websteamtts
// @version 0.4
// @description TTS for Steam web chat client
// @author ConsciousCode
// @match *://steamcommunity.com/chat/
// @grant unsafeWindow
// @run-at document-end
// ==/UserScript==

unsafeWindow.eval("(" + (function() {
	'use strict';
	
	console.log("websteamtts BEGIN v4");
	
	/* Hook into the page once it's actually loaded. */
	function hook(chatHistory) {
		console.log("websteamtts: hook");
		
		function parseMessage(el) {
			const name = el.querySelector('.speakerName').textContent;
			const timestamp = el.querySelector('.speakerTimeStamp').textContent;
			const content = el.querySelector('.msgText').textContent;
			const isCurrentUser = el.classList.contains('isCurrentUser');
			
			return {name, timestamp, content, isCurrentUser};
		}
		
		new MutationObserver(muts => {
			console.log("websteamtts: mutation")
			for(const mut of muts) {
				if(mut.addedNodes.length == 0) continue;
				
				for(const node of mut.addedNodes) {
					if(node.classList && node.classList.contains('ChatMessageBlock')) {
						const msg = parseMessage(node);
						if(!msg.isCurrentUser) {
							ttsmonkey_say(`${msg.name} says ${msg.content}`);
						}
					}
				}
			}
		}).observe(chatHistory, { childList: true });
	}
	
	/* Wait for Steam React to load. */
	new MutationObserver((muts, observer) => {
		console.log("websteamtts: global mutation")
		for(var mut of muts) {
			if(mut.type === 'childList') {
				const chatHistory = document.querySelector('.chatHistory');
				console.log("websteamtts: chatHistory", chatHistory);
				if(chatHistory) {
					// Element is now present, call your function
					hook(chatHistory);
					observer.disconnect();
					break;
				}
			}
		}
	}).observe(document.body, { childList: true, subtree: true });
	
	}).toString() + ")()");
	