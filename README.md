# OhmRGB-Yahkobstyle

My attempt at writing a Node.js/TypeScript middleware application that bridges a Livid Instruments OhmRGB controller to Ableton Live via remote script (using `ableton-js`).

My aim is highly specific to my own ableton workflow so this likely won't be useful to you other than as a reference. Will document progress in time.

**Session clip navigator** (WIP):  
This adds a 6x6 clip navigator 'red ring' to Ableton. Currently has navigation arrows and clip launching/queuing/stopping.  
May possibly move navigation buttons to accommodate scene launching in future, and possibly utilize a row for solo/mute (could maybe do hold-to-solo).

**Looper controller** (WIP):  
This looks for tracks with `[BUSX]` (where X is 1-8) in the name and maps them to the 2x4 buttons on the bottom. These buttons activate indicate 'bus selection' (I may expand this concept in future - e.g. auto-map faders to bus volume). When a bus is selected, macro buttons on top right begin acting as a looper controls (if an instance of Looper is detected on said bus).  
Sadly Ableton doesn't expose 'Undo' or 'Clear' via the API so this screen might be dead in the water unless I use another looping plugin.

Read document details about the project in [AGENTS.md](./AGENTS.md).  
Yes I've used AI, yes I've also basically rewritten everything it's done BUT it has been good for reverse engineering and general discovery.
