#!/bin/sh

# pull with submodules
git pull --recurse-submodules

rm -rf ~/Music/Ableton/User\ Library/Remote\ Scripts/AbletonJS
cp -r ./ableton-js/midi-script ~/Music/Ableton/User\ Library/Remote\ Scripts/AbletonJS