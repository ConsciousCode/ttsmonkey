'use strict';

window.addEventListener("__TTSMonkeySay", (ev) => {
	let {what, clean} = ev.detail;
	chrome.runtime.sendMessage({cmd: "speak", what, clean});
});

let inject = document.createElement("script");
inject.innerText = `
'use strict';
function ttsmonkey_say(what, clean=true) {
	window.dispatchEvent(
		new CustomEvent("__TTSMonkeySay", {detail: {what, clean}})
	);
}
`;

document.head.appendChild(inject);
inject.remove();
