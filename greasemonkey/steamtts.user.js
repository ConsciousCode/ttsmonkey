// ==UserScript==
// @name websteamtts
// @version 0.12
// @description TTS for Steam web chat client
// @author ConsciousCode
// @match *://steamcommunity.com/chat/
// @grant unsafeWindow
// @run-at document-end
// ==/UserScript==

unsafeWindow.eval("(" + (function() {
	'use strict';
	
	console.log("websteamtts BEGIN v12");
	
	function read_messages(block) {
		const messages = [];
		for(const msg of block.querySelectorAll(".msgText:not(.ttsmonkey-seen)")) {
			const text = msg.textContent.trim();
			if(text === "") continue;
			msg.classList.add("ttsmonkey-seen");
			
			messages.push(text);
		}
		
		if(messages.length > 0) {
			const name = block.querySelector('.speakerName').textContent.trim();
			ttsmonkey_say(`${name} says ${messages.join(" ; ")}`);
		}
	}
	
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
					
					if(node.classList.contains('ChatMessageBlock')) {
						read_messages(node);
						
						// Read any future changes
						new MutationObserver(
							() => read_messages(node)
						).observe(node, { childList: true });
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
	