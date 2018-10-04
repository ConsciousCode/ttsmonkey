'use strict';

function $id(id) {
	return document.getElementById(id);
}

const
	$volume = $id("volume"),
	$engine = $id("engine"),
	$profile = $id("profile"),
	$config = $id("config"),
	$newProfile = $id("newProfile"),
	$rmProfile = $id("rmProfile"),
	$test = $id("test");

let
	engines = null,
	engine = null;

function option(value) {
	let el = document.createElement("option");
	el.appendChild(document.createTextNode(value));
	return el;
}

function registerOnChange(el, name, extra) {
	el.addEventListener("change", function(ev) {
		chrome.runtime.sendMessage({
			cmd: "change", name, value: this.value
		});

		if(extra) extra.call(this);
	});
}

function replaceChildren(el, child) {
	while(el.firstChild) {
		el.removeChild(el.firstChild);
	}
	el.appendChild(child);
}

function buildRange(name, min, max, value) {
	function validate(me, twin) {
		let n = +me.value;

		if(n < min) {
			twin.value = min;
		}
		else if(n > max) {
			twin.value = max;
		}
		else {
			me.classList.add("valid");
			twin.classList.remove("invalid")
			twin.value = me.value;
			return;
		}

		me.classList.remove("valid");
		me.classList.add("invalid");
	}

	let rel = document.createElement("input");
	rel.type = "range";
	rel.min = min;
	rel.max = max;
	rel.step = (max - min)/100;

	rel.addEventListener("input", function() {
		validate(rel, tel);
	});
	registerOnChange(rel, name);

	let tel = document.createElement("input");
	tel.type = "text";

	tel.addEventListener("input", function() {
		validate(tel, rel);
	});
	tel.addEventListener("keydown", function(ev) {
		if(ev.key === "ArrowUp") {
			let val = (+this.value) + (+rel.step);
			this.value = rel.value = val;
		}
		else if(ev.key === "ArrowDown") {
			let val = (+this.value) - (+rel.step);;
			this.value = rel.value = val;
		}
		else {
			return;
		}

		rel.dispatchEvent(new Event("change"));

		return ev.preventDefault();
	})
	registerOnChange(tel, name);

	rel.value = value;
	tel.value = value;

	let el = document.createElement("div");
	el.className = "rangepair";
	el.appendChild(rel);
	el.appendChild(tel);

	return el;
}

function renderEngine() {
	let frag = document.createDocumentFragment(), curp;
	for(let eng in engines) {
		frag.appendChild(option(eng));
	}

	replaceChildren($engine, frag);
	$engine.value = engine;
}

function renderProfiles() {
	let frag = document.createDocumentFragment();
	for(let profile in engines[engine].profiles) {
		frag.appendChild(option(profile));
	}

	replaceChildren($profile, frag);
	$profile.value = engines[engine].profile;
}

function renderConfig() {
	let frag = document.createDocumentFragment();

	let {config, profiles, profile} = engines[engine];
	let prof = profiles[profile];

	for(let opt of config) {
		let proval = prof[opt.name], el;

		if(opt.type === "select") {
			el = document.createElement("select");
			for(let choice of opt.choices) {
				el.appendChild(option(choice));
			}
			el.value = proval;
			registerOnChange(el, opt.name, opt.refresh && update);
		}
		else if(opt.type === "range") {
			el = buildRange(opt.name, opt.min, opt.max, proval);
		}
		else {
			el = document.createElement("input");
			el.type = opt.type;
			el.value = proval;

			registerOnChange(el, opt.name, opt.refresh && update);
		}

		let label = document.createElement("label");
		label.appendChild(document.createTextNode(opt.name));

		let row = document.createElement("div");
		row.className = "row";
		row.appendChild(label);
		row.appendChild(el);

		frag.appendChild(row);
	}

	replaceChildren($config, frag);
}

/// Init ///

function speak(what) {
	chrome.runtime.sendMessage({cmd: "speak", what});
}

function update() {
	chrome.runtime.sendMessage({cmd: "getData"}, data => {
		let volume;
		({volume, engines, engine} = data);

		renderProfiles();
		renderConfig();
	});
}

chrome.runtime.sendMessage({cmd: "getData"}, data => {
	let volume;
	({volume, engines, engine} = data);

	renderEngine();

	$engine.value = engine;

	renderProfiles();
	renderConfig();

	$volume.replaceWith(buildRange("Volume", 0, 200, volume));

	registerOnChange($engine, "Engine", function() {
		engine = this.value;

		renderProfiles();
		renderConfig();
	});
	registerOnChange($profile, "Profile", function() {
		renderConfig();
	});

	$newProfile.addEventListener("click", function() {
		chrome.runtime.sendMessage({cmd: "newProfile"}, update);
	});
	$rmProfile.addEventListener("click", function() {
		chrome.runtime.sendMessage({cmd: "rmProfile"}, update);
	});

	$test.addEventListener("keyup", function(ev) {
		if(ev.key === "Enter") {
			speak(this.value);
		}
	});
});
