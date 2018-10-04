'use strict';

function ttsmonkey_say(what, clean=true) {
	chrome.runtime.sendMessage({msg: "speak", what, clean});
}
