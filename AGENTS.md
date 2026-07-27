# Livid OhmRGB - Ableton Integration

## Project Scope

A Node.js/TypeScript middleware application that bridges a Livid OhmRGB controller to Ableton Live via Max for Live (using `ableton-js`). The app abstracts the hardware into "virtual screens", managing the state, LED feedback, and routing of the MIDI I/O.

## Hardware Constants (OhmRGB)

Below is the SysEx and hardware mapping protocol gleaned from the `livid-online-editor` reference submodule.

- **Manufacturer ID:** 97 (`0x61`)
- **Product ID (PID):** 7 (OhmRGB)
- **SysEx Header:** `[240, 0, 1, 97, 7]`

### Color Palette (Velocity / Index)

The OhmRGB uses a 3-bit RGB LED under each button. Supported combinations yield 8 colors, which are controlled via standard MIDI Note On velocity payload bits. To correctly command true colors inside Ableton/Node, the velocities are mapped to powers of 2 (bitmasks/binary scaling thresholds) rather than sequentially:

0. Off = 0
1. White = 2
2. Cyan = 4
3. Magenta = 8
4. Red = 16
5. Blue = 32
6. Yellow = 64
7. Green = 127

### Hardware Layout & Parsing Defaults

According to the `livid-online-editor` layout mapping (`posi[7]`):

- **Grid:** 8x8 matrix (Buttons 0-63)
- **Crossfader Buttons:** (Buttons 64-65)
- **Top / Side Slider Buttons:** (Buttons 66-73)
- **Right Function Buttons:** (Buttons 74-80) Note: The large bottom right button often has ID 80.
- **Pots (Left):** 0-11
- **Sliders (Left):** 16-19
- **Pots (Right):** 12-15
- **Sliders (Right):** 20-23
- **Crossfader:** 24

### Commands (CMD)

Relevant SysEx commands used for updating the controller interface:

- **CMD 4:** Set all LED indicators (requires bitpacking 81 LEDs into a specific order)
- **CMD 8:** Local Control Response
- **CMD 9:** Map Single LED Indicator
- **CMD 10/11/12:** Map Analog / Map Buttons / Set Settings Channel
- **CMD 35/36:** LED Note Map / LED CC Map

## Workflow Modes (Virtual Screens)

The application will listen to SysEx or Note/CC data on a specific global channel to switch visual and functional contexts.

1. **Session Screen:** Maps the OhmRGB inner 6x6 grid to Ableton's Session View clip slots.
   - **Grid Navigation:** Defines an inner 6x6 grid to reserve the outer edge pads for navigation and utility functions. Controls the Ableton "Red Ring" session view highlight natively via `setupSessionBox` and `setSessionOffset`.
   - **Intelligent LED Caching:** Sending 64 individual MIDI messages takes time and blocks the event loop. By using a `Map<number, OhmColor>` state cache, `setLedCached()` only dispatches a `noteon` message if the requested color is different from the currently known state. This dramatically reduces latency from ~2000ms down to a fraction.
   - **Garbage-Collected Absolute Listeners:** Clip slot event listeners (`is_playing`, `has_clip`, `is_triggered`) are mapped to absolute coordinates (`trackOffset + x`, etc.) rather than grid-relative keys. A `Map` tracking active `id` hashes guarantees listeners aren't duplicated and are garbage-collected dynamically as the 6x6 viewport navigates away from them.
   - **Column Context Sweeping:** Stopping a playing track by clicking an _empty_ clip slot in Live stops the audio, but the `ableton-js` API occasionally doesn't emit state teardown events for the clip that was actually stopped. The `SessionScreen` handles this elegantly by manually refreshing the visual states of an entire vertical track column bounds whenever a slot interaction occurs.
2. **Device/Drum Screen:** Map 8x8 to Drum Racks mapping and device macro controls.
3. **Looper Screen (Proof of Concept):**
   - Dynamically scans Ableton session for tracks containing `[BUSX]` (where X is 1-8).
   - Maps `[BUSX]` tracks to the 2x4 "Slider Buttons" block (IDs 66-73) for track selection.
   - Assigns top-right macro buttons (IDs 77-80) to manipulate the fundamental "State" parameters of an Ableton `Looper` device on the currently selected track (0=Stopped, 1=Overdubbing, 2=Recording, 3=Playing).
   - Demonstrates dynamic LED feedback (e.g. Blue = Selected track, Green = Track exists but inactive, Off = No track mapped).

## Architecture & Implementation Learnings

- **Technical Stack:** We chose a Node.js/TypeScript stack running via `tsx` combined with `ableton-js` communicating over Max for Live. This is preferred over Python Remote Scripts as it allows modern dependencies, rapid iteration, and avoids Ableton's undocumented Python API limitations.
- **Python Scripts Location (If needed):** Live 11+ requires 3rd party Remote Scripts to be placed in `~/Music/Ableton/User Library/Remote Scripts/`. The legacy preferences folder (`~/Library/Preferences/Ableton/Live X.X/User Remote Scripts`) ignores `.py` directories and only supports generic `UserConfiguration.txt` templates.
- **Execution Tooling:** Use `npx tsx src/index.ts` to run the project. Standard `ts-node` struggles with module resolution out of the box in this specific build context.
- **Virtual Screen Abstract:** The hardware connection acts as a global singleton (`core/OhmRGB.ts`), which dispatches `button` and `control` events to a subclass of `core/VirtualScreen.ts`. This allows rapid context switching and encapsulates logic neatly (e.g. `LooperScreen.ts`).

## Hardware & Reverse-Engineering Learnings

### Action Maps vs LED Maps

On the OhmRGB firmware, **Action Maps** (the MIDI note emitted when a button is physically pressed) and **LED Maps** (the MIDI note the hardware listens to in order to light up a button) are completely decoupled.  
For example the 8x8 grid, midi notes flow from left to right, top to bottom, but the LED map is from top to bottom, left to right.

- When changing a color in the Livid Editor, it communicates via raw hardware dumps (`CMD 4` SysEx), modifying the physical `btn_ID` embedded in the hardware (e.g., `btn_76` for the Play button).

### Deciphering the Livid Online Editor Codebase

When debugging routing, SysEx mapping, or LED behavior, the `livid-online-editor` source code acts as our Rosetta Stone. Look in these specific files:

- `livid-online-editor/js/sysexToLivid.js`: The most important file. Parses incoming raw SysEx from the device and mutates state. `sxToObj[7]` (Product ID 7) contains the schema for interpreting OhmRGB memory dumps. E.g., `CMD 35` and `CMD 36` arrays contain the exact tables of CC/Note -> internal hardware LED ID.
- `livid-online-editor/js/faceplate.js`: Contains the UI geometry and geographical element ID assignments. Searching `controller[7]` maps physical button placement (e.g. "Play") to its canonical internal Hardware ID (e.g., `btn_76`).
- `livid-online-editor/index.html`: Contains drop-downs and static UI constraints that usually betray parameter formatting—such as discovering that "fixed note velocity" or specific color values require special thresholds.
- `livid-online-editor/js/lividToSysex.js`: Controls how the web app marshals interface changes back into raw `F0 ... F7` packets. Useful for learning how to securely overwrite controller states if we ever move out of purely performance commands (`noteon`).
