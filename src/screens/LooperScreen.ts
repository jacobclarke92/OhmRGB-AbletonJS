import type { Track } from 'ableton-js/ns/track'

import { VirtualScreen } from '../core/VirtualScreen'
import {
  OhmColor,
  LooperState,
  LooperStateColors,
  LooperStateLabels,
} from '../enums'
import { getLooperOnTrack, getLooperState } from '../utils/deviceUtils'
import type { Device } from 'ableton-js/ns/device'

// The 2x4 "Slider Buttons" on the OhmRGB
// prettier-ignore
const TRACK_SELECT_BUTTONS = [
  65, 73, 66, 74, // Left side
  67, 75, 68, 76, // Right side
]

const CROSSFADE_BUTTONS = [64, 72]

// Transport buttons
// BIG: 87
// 69, 70, 71
// 77, 78, 79
const TRANSPORT_BUTTONS = {
  REC_DUB: 87,
  PLAY: 71,
  STOP: 79,
  CLEAR: 70,
  UNDO: 78,
  HALVE: 69,
  DOUBLE: 77,
}

type LooperAction =
  | 'Record/Dub/Play'
  | 'Stop'
  | 'Play'
  | 'Overdub'
  | 'Clear'
  | 'Undo'
  | 'Halve'
  | 'Double'
  | 'Reverse'

export class LooperScreen extends VirtualScreen {
  private selectedTrackId: string | null = null
  private busTracks: Map<number, Track> = new Map() // Maps Bus number (1-8) to Ableton Track
  private listenerDisposers: (() => void)[] = []

  async onActivate() {
    console.log('LooperScreen Activated')

    // Just for fun: 8x8 Grid color wave
    await this.playColorWave()

    // Find our [BUSX] tracks
    await this.scanBusTracks()

    // Setup listener for when the user selects a track in Ableton with their mouse
    const disposeSelected = await this.ableton.song.view.addListener(
      'selected_track',
      async (track) => {
        this.selectedTrackId = track.raw.id
        this.updateLeds()
      },
    )
    this.listenerDisposers.push(disposeSelected)

    // Initial state grab
    const currTrack = await this.ableton.song.view.get('selected_track')
    this.selectedTrackId = currTrack.raw.id

    await this.updateLeds()
  }

  async onDeactivate() {
    console.log('LooperScreen Deactivated')
    for (const dispose of this.listenerDisposers) dispose()
    this.listenerDisposers = []
  }

  async onButton(id: number, velocity: number) {
    if (velocity === 0) return

    // Check if it's a BUS track selection button
    const busIndex = TRACK_SELECT_BUTTONS.indexOf(id)
    if (busIndex !== -1) {
      const busNumber = busIndex + 1 // 1-8
      console.log(`Grid button for BUS${busNumber} pressed.`)
      const track = this.busTracks.get(busNumber)

      if (track) {
        try {
          await this.ableton.song.view.set('selected_track', track.raw.id)
          this.selectedTrackId = track.raw.id
          this.updateLeds()
        } catch (e) {
          console.error(`Failed to select BUS${busNumber}:`, e)
        }
      } else {
        console.log(`No track labeled [BUS${busNumber}] found in session.`)
      }
    }

    // Check if it's a transport button targeting the Looper on the selected track
    if (id === TRANSPORT_BUTTONS.REC_DUB) {
      this.triggerLooperAction(this.selectedTrackId, 'Record/Dub/Play')
    } else if (id === TRANSPORT_BUTTONS.PLAY) {
      this.triggerLooperAction(this.selectedTrackId, 'Play')
    } else if (id === TRANSPORT_BUTTONS.STOP) {
      this.triggerLooperAction(this.selectedTrackId, 'Stop')
    } /*else if (id === TRANSPORT_BUTTONS.CLEAR) {
      this.triggerLooperAction(this.selectedTrackId, 'Clear')
    } else if (id === TRANSPORT_BUTTONS.UNDO) {
      this.triggerLooperAction(this.selectedTrackId, 'Undo')
    } else if (id === TRANSPORT_BUTTONS.HALVE) {
      this.triggerLooperAction(this.selectedTrackId, 'Halve')
    } else if (id === TRANSPORT_BUTTONS.DOUBLE) {
      this.triggerLooperAction(this.selectedTrackId, 'Double')
    } */
  }

  onControl(id: number, value: number) {
    // Handle faders/pots if needed
  }

  /**
   * Scans all tracks in Ableton for the [BUSX] naming convention.
   */
  private async scanBusTracks() {
    this.busTracks.clear()
    const tracks = await this.ableton.song.get('tracks')

    for (const track of tracks) {
      const name = await track.get('name')
      const match = name.match(/\[BUS(\d+)\]/i)
      if (match && match[1]) {
        const busNumber = parseInt(match[1], 10)
        if (busNumber >= 1 && busNumber <= 8) {
          this.busTracks.set(busNumber, track)
          console.log(
            `Found [${name}] -> Mapping to Button ${busNumber} (ID: ${TRACK_SELECT_BUTTONS[busNumber - 1]})`,
          )
        }
      }
    }
  }

  private async updateLeds() {
    // Light up track selector buttons

    let selectedTrackLooper: Device | undefined = undefined
    for (let i = 0; i < TRACK_SELECT_BUTTONS.length; i++) {
      const btnId = TRACK_SELECT_BUTTONS[i]!
      const busNumber = i + 1
      const track = this.busTracks.get(busNumber)

      if (track) {
        if (this.selectedTrackId === track.raw.id) {
          this.ohm.setLed(btnId, OhmColor.White)
          selectedTrackLooper = await getLooperOnTrack(track)
        } else {
          this.ohm.setLed(btnId, OhmColor.Blue)
        }
      } else {
        this.ohm.setLed(btnId, OhmColor.Off)
      }
    }

    if (selectedTrackLooper) {
      this.ohm.setLed(TRANSPORT_BUTTONS.PLAY, OhmColor.Green)
      this.ohm.setLed(TRANSPORT_BUTTONS.STOP, OhmColor.Yellow)
      const looperState = await getLooperState(selectedTrackLooper)
      this.ohm.setLed(TRANSPORT_BUTTONS.REC_DUB, LooperStateColors[looperState])
    } else {
      this.ohm.setLed(TRANSPORT_BUTTONS.REC_DUB, OhmColor.Off)
      this.ohm.setLed(TRANSPORT_BUTTONS.PLAY, OhmColor.Off)
      this.ohm.setLed(TRANSPORT_BUTTONS.STOP, OhmColor.Off)
    }
  }

  private async triggerLooperAction(
    targetTrackId: string | null,
    action: LooperAction,
  ) {
    if (!targetTrackId) return

    console.log(`Triggering Looper on Track ID ${targetTrackId}: ${action}`)
    try {
      const tracks = await this.ableton.song.get('tracks')
      const targetTrack = tracks.find((t: any) => t.raw.id === targetTrackId)
      if (!targetTrack) return

      const looper = await getLooperOnTrack(targetTrack)
      if (!looper) {
        console.warn('No Looper device found on the selected track.')
        return
      }

      /*
      NOTE: The lack of Clear, Undo, Halve, Double params -- not exposed by ableton API :(
      { name: 'Device On' },
      { name: 'State' },
      { name: 'Feedback' },
      { name: 'Reverse' },
      { name: 'Monitor' },
      { name: 'Speed' },
      { name: 'Quantization' },
      { name: 'Song Control' },
      { name: 'Tempo Control' }
      */
      const parameters = await looper.get('parameters')
      const stateParam = parameters.find((p) => p.raw.name === 'State')
      const reverseParam = parameters.find((p) => p.raw.name === 'Reverse')

      if (!stateParam || !reverseParam) {
        console.warn('Looper param not found')
        return
      }
      const looperState = await getLooperState(looper)
      const updateLooperState = async (value: LooperState) => {
        console.log(
          `Setting Looper State to ${LooperStateLabels[value]} (${value})`,
        )
        await stateParam.set('value', value)
        this.ohm.setLed(TRANSPORT_BUTTONS.REC_DUB, LooperStateColors[value])
      }

      switch (action) {
        case 'Record/Dub/Play':
          // Simulate pressing the big multi-purpose button on Looper

          if (looperState === LooperState.Stopped)
            await updateLooperState(LooperState.Recording)
          else if (looperState === LooperState.Recording)
            await updateLooperState(LooperState.Playing)
          else if (looperState === LooperState.Playing)
            await updateLooperState(LooperState.Overdubbing)
          else if (looperState === LooperState.Overdubbing)
            await updateLooperState(LooperState.Playing)
          break
        case 'Stop':
          await updateLooperState(LooperState.Stopped) // Reset to Initial
          break
        case 'Play':
          await updateLooperState(LooperState.Playing)
          break
        case 'Reverse':
          await reverseParam.set('value', 1) // Trigger Reverse
          await reverseParam.set('value', 0) // Reset Reverse button
          break
        // case 'Clear':
        //   await clearParam.set('value', 1) // Trigger Clear
        //   await clearParam.set('value', 0) // Reset Clear button
        //   break
        // case 'Undo':
        //   await undoParam.set('value', 1) // Trigger Undo
        //   await undoParam.set('value', 0) // Reset Undo button
        //   break
        // case 'Halve':
        //   await halveParam.set('value', 1) // Trigger Halve
        //   await halveParam.set('value', 0) // Reset Halve button
        //   break
        // case 'Double':
        //   await doubleParam.set('value', 1) // Trigger Double
        //   await doubleParam.set('value', 0) // Reset Double button
        //   break
      }
    } catch (err) {
      console.error('Error interacting with Ableton API:', err)
    }
  }

  private async playColorWave() {
    const colors = [
      OhmColor.Red,
      OhmColor.Yellow,
      OhmColor.Green,
      OhmColor.Cyan,
      OhmColor.Blue,
      OhmColor.Magenta,
      OhmColor.White,
    ]

    for (let d = 0; d <= 14; d++) {
      for (let i = 0; i < 64; i++) {
        const x = i % 8
        const y = Math.floor(i / 8)
        if (x + y === d) {
          this.ohm.setLed(i, colors[d % colors.length] ?? OhmColor.Red)
        }
      }
      await new Promise((r) => setTimeout(r, 60))
    }

    await new Promise((r) => setTimeout(r, 100))
    for (let i = 0; i < 64; i++) {
      this.ohm.setLed(i, OhmColor.Off)
    }
  }
}
