// ==UserScript==
// @name websteamtts
// @version 0.1
// @description TTS for Steam web chat client
// @author ConsciousCode
// @match *://steamcommunity.com/chat/
// @grant unsafeWindow
// @run-at document-end
// ==/UserScript==

unsafeWindow.eval("(" + (function() {
'use strict';

console.log("websteamtts BEGIN");

function say(what) {
	ttsmonkey_say(what);
}

function hook(obj, fn, hook) {
	let v = obj[fn];
	obj[fn] = function(...args) {
		hook.apply(this, args);
		return v.apply(this, args);
	}
}

hook(g_FriendsUIApp, "OnReadyToRender", () => {
	console.log("websteamtts OnReadyToRender");

	let root = g_FriendsUIApp.UIStore.GetRootChatPerContextData();
	let tabs = root.default_tabset.tabs;

	tabs.observe(change => {
		for(let tab of change.added) {
			hook(tab.m_chat, "OnReceivedNewMessage", msg => {
				let who = g_FriendsUIApp.FriendStore.GetFriend(msg.unAccountID);
				say(
					(who.nickname || who.persona.m_strPlayerName) +
					" said " + msg.strMessage
				);
			});
		}
	})
});

// g_FriendsUIApp.FriendStore.m_self

}).toString() + ")()");
