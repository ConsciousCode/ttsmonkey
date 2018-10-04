'use strict';

class TTSMonkey {
	constructor() {
		this.vq = [];
		this.CLEANUP = [
			[/\bjpg\b/, "jpeg"],
			[/\b(g?ui)\b/g, '<say-as interpret-as="characters">$2</say-as>'],
			[
				/(?:https?:\/\/)?((?:[-\w]+\.)+[-\w]+)(?:\/.+$)?/,
				'<prosody rate="fast">$1</prosody>'
			],
			[/\b([?!()<>\[\]]+)\b/, '<prosody rate="x-fast">$2</prosody>'],
			[/\.{2,}/, s => `<break strength="${
				["x-weak", "weak", "medium", "strong", "x-strong"][s.length - 2] ||
				"x-strong"}"/>`
			]
		];
		this.cleanregex = null;
		this.cleantodo = null;

		this.updateClean();

		this.volume = 100;
		this.engines = {};
		this.engine = null;

		chrome.storage.sync.get(["volume", "engine"], data => {
			let {volume, engine} = data;

			if(typeof volume !== "undefined") {
				this.volume = volume;
			}

			if(engine) {
				this.engine = engine;
			}

			// Save for good measure
			this.save();
		});
	}

	get curEngine() {
		return this.engines[this.engine];
	}

	get curProfile() {
		return this.curEngine.curProfile;
	}

	save() {
		chrome.storage.sync.set({volume: this.volume, engine: this.engine});
	}

	pushSpeech(build) {
			// build {start, stop} to add to the queue
		let token = build(
			// done callback, advances the queue
			() => {
				this.vq.shift();
				if(this.vq.length) {
					this.vq[0].start();
				}
			}
		);
		if(!this.vq.length) {
			token.start();
		}
		this.vq.push(token);
	}

	updateClean() {
		// Combine the regexes into one big regex to be split back to each pattern.
		let todo = [], patv = [];
		for(let [pat, rep] of this.CLEANUP) {
			// Start at 1 for the enclosing group
			let ng = 1;
			pat = pat.source;

			// Count how many groups we have to skip to check the next regex
			let i = 0;
			while(i < pat.length) {
				i = pat.indexOf("(", i);
				if(i === -1) break;
				if(pat[i - 1] === '\\') continue;
				++ng;
				++i;
			}

			// Capture the pattern to make it possible to determine which regex
			patv.push(`(${pat})`);
			todo.push({ng, rep});
		}

		this.cleanregex = patv.join("|", 'g');
		this.cleantodo = todo;
	}

	cleanSay(what) {
		return what.replace(this.cleanregex, ($0, ...groups) => {
			let off = 1;
			for(let {ng, rep} of this.cleantodo) {
				let goff = groups[off];
				if(goff) {
					return rep(goff, ...groups.slice(off, off + ng));
				}

				off += ng;
			}

			return $0;
		});
	}

	speak(what, clean) {
		if(clean) what = this.cleanSay(what);
		this.engines[this.engine].say(what, this);
	}

	addEngine(engine) {
		if(!this.engine) {
			this.engine = engine.name;
		}

		this.engines[engine.name] = engine;
	}

	saveVolume() {
		chrome.storage.sync.set({volume: this.volume});
	}

	saveEngine() {
		chrome.storage.sync.set({engine: this.engine});
	}
}
const core = new TTSMonkey();

class TTSEngine {
	constructor(name) {
		this.profiles = null;
		this.profile = null;
		this.name = name;

		chrome.storage.sync.get([name + "/profiles", name + "/profile"], async res => {
			let
				profiles = res[name + "/profiles"],
				profile = res[name + "/profile"];

			if(!profiles) {
				let def = await this.getDefaults();
				profiles = {Default: def};
				profile = "Default";
				chrome.storage.sync.set({
					[name + "/profiles"]: profiles,
					[name + "/profile"]: profile
				});
			}

			this.profiles = profiles;
			this.profile = profile;
		})
	}

	get curProfile() {
		if(this.profiles) {
			return this.profiles[this.profile];
		}
		else {
			throw new Error(this.name + " is not yet loaded");
		}
	}

	async listConfig() {}

	say(what, core) {}

	get(name) {
		return this.curProfile[name];
	}

	save() {
		chrome.storage.sync.set({
			[this.name + "/profiles"]: this.profiles,
			[this.name + "/profile"]: this.profile
		})
	}

	async getDefaults() {
		let config = await this.listConfig(), def = {};
		for(let opt of config) {
			def[opt.name] = opt.default;
		}

		return def;
	}
}

class TTSNative extends TTSEngine {
	constructor(name) {
		super(name);
	}

	async listConfig() {
		let voices = speechSynthesis.getVoices().
			filter(v => /^en/.test(v.lang)).
			map(v => v.name);

		return [
			{
				name: "Name",
				type: "Text",
				default: "Default",
				refresh: true
			}, {
				name: "Voice",
				type: "select",
				choices: voices,
				default: voices[0]
			}, {
				name: "Lang",
				type: "text",
				default: "en-US"
			}, {
				name: "Pitch",
				type: "range",
				min: 0, max: 2,
				default: 1
			}, {
				name: "Rate",
				type: "range",
				min: 0.1, max: 10,
				default: 1
			}
		];
	}

	say(what, core) {
		core.pushSpeech(done => {
			let utt = new SpeechSynthesisUtterance(what);

			let voices = speechSynthesis.getVoices(), curvoice = this.get("Voice"), voice;
			for(let v of voices) {
				if(v.name === curvoice) {
					voice = v;
					break;
				}
			}
			console.log("Voice", voice);
			utt.voice = voice;
			utt.lang = this.get("Lang");
			utt.pitch = this.get("Pitch");
			utt.rate = this.get("Rate");
			utt.volume = core.volume/100;

			utt.onend = done;

			return {
				start() {
					speechSynthesis.speak(utt);
				},
				stop() {
					speechSynthesis.cancel();
				}
			}
		});
	}
}
core.addEngine(new TTSNative("Native"));

class TTSGoogle extends TTSEngine {
	constructor(name) {
		super(name);
		this.type = "Standard";

		// Cache the config since it requires a web call and won't change
		this.config = null;
	}

	async listConfig() {
		if(this.config) return this.config;

		const vlang = new RegExp("^en-[^-]+-" + this.type, 'i');

		let voice = {
			name: "Voice",
			type: "select",
			choices: (
				this.profiles && this.curProfile["API key"]?
					(await this.request("GET", "voices")).voices.
						map(v => v.name).
						filter(v => vlang.test(v))
					: []
			),
			default: ""
		};

		let nc = [
			{
				name: "Name",
				type: "Text",
				default: "Default",
				refresh: true
			}, {
				name: "API key",
				type: "text",
				default: "",
				refresh: true
			}, voice, {
				name: "Lang",
				type: "text",
				default: "en-US"
			}, {
				name: "Pitch",
				type: "range",
				min: -20, max: 20,
				default: 0
			}, {
				name: "Rate",
				type: "range",
				min: 0.25, max: 4,
				default: 1
			}
		];

		// Only cache the config if
		if(voice.choices.length) {
			return this.config = nc;
		}
		else {
			return nc;
		}
	}

	request(method, api, body=undefined) {
		return new Promise((ok, no) => {
			if(!this.profiles) {
				throw new Error(this.name + " is not yet loaded");
			}
			if(!this.curProfile["API key"]) {
				return no(new Error("Need an API key first"));
			}

			let xhr = new XMLHttpRequest();
			xhr.onload = function() {
				let res = JSON.parse(this.responseText);
				if(res.error) {
					return no(res.error);
				}
				else {
					return ok(res);
				}
			}
			xhr.open(
				method, "https://texttospeech.googleapis.com/v1/" +
				api + "?key=" + this.get("API key")
			);

			if(typeof body === "undefined") {
				xhr.send();
			}
			else {
				xhr.send(JSON.stringify(body));
			}
		});
	}

	say(what, core) {
		this.request("POST", "text:synthesize", {
			"voice": {
				"name": this.get("Voice"),
				"languageCode": this.get("Lang")
			},
			"input": {
				"ssml": `<speak>${what}</speak>`,
			},
			"audioConfig": {
				"audioEncoding": "mp3",
				"pitch": this.get("Pitch"),
				"speakingRate": this.get("Rate")
			}
		}).then(res => {
			let a = new Audio(
				"data:audio/mp3;base64," +
				res.audioContent
			);
			let ac = new AudioContext();
			let src = ac.createMediaElementSource(a);
			let gain = ac.createGain();
			gain.gain.value = core.volume/100;
			src.connect(gain);
			gain.connect(ac.destination);

			core.pushSpeech(done => {
				a.onended = done;
				return {
					start() {
						a.play();
					},
					stop() {
						a.pause();
						a.src = "";
					}
				}
			});
		}).catch(err => {
			throw err;
		})
	}
}

class TTSGoogleStandard extends TTSGoogle {}
core.addEngine(new TTSGoogleStandard("Google Standard"));

class TTSGoogleWaveNet extends TTSGoogle {
	constructor(name) {
		super(name);
		this.type = "WaveNet";
	}
}
core.addEngine(new TTSGoogleWaveNet("Google WaveNet"));

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
	(async () => {
		console.log(msg.cmd, msg);
		switch(msg.cmd) {
			case "getData": {
				var engines = {};
				for(let ename in core.engines) {
					let engine = core.engines[ename];

					let config = await engine.listConfig();

					engines[ename] = {
						config,
						profiles: engine.profiles,
						profile: engine.profile
					};
				}

				respond({
					volume: core.volume,
					engine: core.engine,
					engines
				});

				break;
			}

			case "onChange":
				switch(msg.name) {
					case "Volume":
						core.volume = msg.value;
						core.saveVolume();
						break;

					case "Engine":
						core.engine = msg.value;
						core.saveEngine();
						break;

					case "Profile":
						core.curEngine.profile = msg.value;
						core.curEngine.save();
						break;

					case "Name":
						var prof = core.curProfile;
						delete core.curEngine.profiles[prof.Name];
						core.curEngine.profiles[
							prof.Name = core.curEngine.profile = msg.value
						] = prof;
						break;

					default:
						core.curProfile[msg.name] = msg.value;
						core.curEngine.save();
						break;
				}
				respond(true);
				break;

			case "speak":
				core.speak(msg.what, msg.clean);
				respond(true);
				break;

			case "newProfile": {
				var pkv = Object.keys(core.curEngine.profiles);
				do {
					var np = Math.random().toString(36).slice(2);
				} while(pkv.includes(np));

				let prof = await core.curEngine.getDefaults();
				prof.Name = np;

				core.curEngine.profiles[np] = prof;
				core.curEngine.profile = np;

				core.curEngine.save();

				respond(prof);

				break;
			}

			case "rmProfile": {
				delete core.curEngine.profiles[core.curEngine.profile];
				var pkv = Object.keys(core.curEngine.profiles);
				if(pkv.length) {
					core.curEngine.profile = pkv[0];
				}
				else {
					core.curEngine.profiles.Default = await core.curEngine.getDefaults();
					core.curEngine.profile = "Default";
				}
				core.curEngine.save();

				respond(true);

				break;
			}

			default:
				throw new Error("Unknown command " + msg.cmd);
		}
	})();
	return true;
});
