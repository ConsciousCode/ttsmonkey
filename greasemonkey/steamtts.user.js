// ==UserScript==
// @name websteamtts
// @version 0.10
// @description TTS for Steam web chat client
// @author ConsciousCode
// @match *://steamcommunity.com/chat/
// @grant unsafeWindow
// @run-at document-end
// ==/UserScript==

unsafeWindow.eval("(" + (function() {
	'use strict';
	
	console.log("websteamtts BEGIN v10");
	
	/* Hook into the page once it's actually loaded. */
	function hook(chatHistory) {
		console.log("websteamtts: hook");
		
		let initialLoad = true; // debounce initial load
		new MutationObserver(muts => {
			if(initialLoad) {
				initialLoad = false;
				return;
			}
			console.log("websteamtts: mutation");
			
			for(const mut of muts) {
				if(mut.addedNodes.length == 0) continue;
				
				for(const node of mut.addedNodes) {
					if(!node.classList) continue;
					
					if(node.classList.contains('msg')) {
						let block = node.parentNode;
						
						// Don't read our own messages
						if(block.querySelector(".ChatSpeaker.isCurrentUser") !== null) {
							continue;
						}
						
						// Don't read messages that are already marked as read
						if(node.classList.contains("ttsmonkey-seen")) {
							continue;
						}
						
						const text = node.textContent.trim();
						if(text === "") continue;
						
						const name = parent.querySelector('.speakerName').textContent;
						
						console.log("websteamtts: msg", name, text);
						ttsmonkey_say(`${name} says ${text}`);
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
					break;
				}
			}
		}
	}).observe(document.body, { childList: true, subtree: true });
	
	}).toString() + ")()");
	