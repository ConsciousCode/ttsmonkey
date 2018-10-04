# TTS Monkey

TTS Monkey is a TTS configuration extension that exposes a dead simple
TTS interface for use in grease/tampermonkey scripts. With this, you can
configure everything about the voice and it'll all be reflected in
whichever greasemonkey scripts you write to take advantage of it.
So far the sites with special support are:
* roll20.net
* steamcommunity.com/chat

## Usage
Simply call ttsmonkey_say(what, clean)
* what (string) - what to say
* clean (boolean) - whether or not it needs to be "cleaned" (made more readable)

## Planned features
* Broader TTS support (cursor reading)
* More specialized greasemonkey scripts
* More TTS engines

### Special thanks
* Google for their highly accessible TTS libraries
* https://github.com/kcaf/d20-boilerplate for the roll20 hooks
* My friend Felis, for whom all of this was for <3
