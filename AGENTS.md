# Livid OhmRGB - Ableton Integration

## Project Scope

A Node.js/TypeScript middleware application that bridges a Livid OhmRGB controller to Ableton Live via Max for Live (using `ableton-js`). The app abstracts the hardware into "virtual screens", managing the state, LED feedback, and routing of the MIDI I/O.

## Hardware Constants (OhmRGB)

Below is the SysEx and hardware mapping protocol gleaned from the `livid-online-editor` reference submodule.

- **Manufacturer ID:** 97 (`0x61`)
- **Product ID (PID):** 7 (OhmRGB)
- **SysEx Header:** `[240, 0, 1, 97, 7]`

### Color Palette (Velocity / Index)

The OhmRGB uses a 3-bit RGB LED under each button. Supported combinations yield 8 colors: 0. Off

1. Red
2. Green
3. Yellow
4. Blue
5. Magenta
6. Cyan
7. White

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

1. **Session Screen:** Map 8x8 to Ableton Clip Slots.
2. **Device/Drum Screen:** Map 8x8 to Drum Racks mapping and device macro controls.
3. **Looper Screen (Proof of Concept):**
   - Dynamically scans Ableton session for tracks containing `[BUSX]` (where X is 1-8).
   - Maps `[BUSX]` tracks to the 2x4 "Slider Buttons" block (IDs 66-73) for track selection.
   - Assigns right transport buttons (IDs 77-80) to manipulate the fundamental "State" parameters of an Ableton `Looper` device on the currently selected track (0=Stop, 1=Record, 2=Play, 3=Overdub).
   - Demonstrates dynamic LED feedback (e.g. Blue = Selected track, Green = Track exists but inactive, Off = No track mapped).

## Architecture & Implementation Learnings

- **Technical Stack:** We chose a Node.js/TypeScript stack running via `tsx` combined with `ableton-js` communicating over Max for Live. This is preferred over Python Remote Scripts as it allows modern dependencies, rapid iteration, and avoids Ableton's undocumented Python API limitations.
- **Python Scripts Location (If needed):** Live 11+ requires 3rd party Remote Scripts to be placed in `~/Music/Ableton/User Library/Remote Scripts/`. The legacy preferences folder (`~/Library/Preferences/Ableton/Live X.X/User Remote Scripts`) ignores `.py` directories and only supports generic `UserConfiguration.txt` templates.
- **Execution Tooling:** Use `npx tsx src/index.ts` to run the project. Standard `ts-node` struggles with module resolution out of the box in this specific build context.
- **Virtual Screen Abstract:** The hardware connection acts as a global singleton (`core/OhmRGB.ts`), which dispatches `button` and `control` events to a subclass of `core/VirtualScreen.ts`. This allows rapid context switching and encapsulates logic neatly (e.g. `LooperScreen.ts`).
