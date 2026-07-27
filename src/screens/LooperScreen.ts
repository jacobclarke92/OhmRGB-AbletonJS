import type { Track } from 'ableton-js/ns/track'

import { VirtualScreen } from '../core/VirtualScreen'
import { OhmColor, LooperState, LooperStateColors, LooperStateLabels } from '../enums'
import { getLooperOnTrack, getLooperState } from '../utils/deviceUtils'
import type { Device } from 'ableton-js/ns/device'
import { BIG_BUTTON, MACRO_BUTTONS, TRACK_SELECT_BUTTONS } from '../core/OhmRGB'

const TRANSPORT_BUTTONS = {
  REC_DUB: BIG_BUTTON,
  PLAY: MACRO_BUTTONS[2],
  STOP: MACRO_BUTTONS[5],
  CLEAR: MACRO_BUTTONS[1],
  UNDO: MACRO_BUTTONS[4],
  HALVE: MACRO_BUTTONS[0],
  DOUBLE: MACRO_BUTTONS[3],
}

type LooperAction = 'Record/Dub/Play' | 'Stop' | 'Play' | 'Overdub' | 'Clear' | 'Undo' | 'Halve' | 'Double' | 'Reverse'

export class LooperScreen extends VirtualScreen {
  private selectedTrackId: string | null = null
  private busTracks: Map<number, Track> = new Map() // Maps Bus number (1-8) to Ableton Track
  private listenerDisposers: (() => void)[] = []

  async onActivate() {
    console.log('LooperScreen Activated')

    // just for fun
    await this.playColorWave()

    // detect all [BUSX] tracks in the session and map them to buttons
    await this.scanBusTracks()

    // set up listener in case track is manually selected in Ableton
    const disposeSelected = await this.ableton.song.view.addListener('selected_track', async (track) => {
      this.selectedTrackId = track.raw.id
      this.updateLeds()
    })
    this.listenerDisposers.push(disposeSelected)

    // grab initial state
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

    const busIndex = (TRACK_SELECT_BUTTONS as number[]).indexOf(id)
    if (busIndex >= 0) {
      const busNumber = busIndex + 1 // 1-8
      console.log(`Grid button for BUS${busNumber} pressed.`)

      const track = this.busTracks.get(busNumber)
      if (!track) return console.log(`No track labeled [BUS${busNumber}] found in session.`)

      await this.ableton.song.view.set('selected_track', track.raw.id)
      this.selectedTrackId = track.raw.id
      this.updateLeds()
    }

    if (id === TRANSPORT_BUTTONS.REC_DUB) await this.triggerLooperAction(this.selectedTrackId, 'Record/Dub/Play')
    else if (id === TRANSPORT_BUTTONS.PLAY) await this.triggerLooperAction(this.selectedTrackId, 'Play')
    else if (id === TRANSPORT_BUTTONS.STOP) await this.triggerLooperAction(this.selectedTrackId, 'Stop')
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
        if (busNumber < 1 || busNumber > 8) continue
        this.busTracks.set(busNumber, track)
        console.log(`Found [${name}] -> Mapping to Button ${busNumber} (ID: ${TRACK_SELECT_BUTTONS[busNumber - 1]})`)
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

      if (!track) {
        this.ohm.setLed(btnId, OhmColor.Off)
        continue
      }

      if (this.selectedTrackId === track.raw.id) {
        this.ohm.setLed(btnId, OhmColor.White)
        selectedTrackLooper = await getLooperOnTrack(track)
        continue
      }

      this.ohm.setLed(btnId, OhmColor.Blue)
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

  private async triggerLooperAction(targetTrackId: string | null, action: LooperAction) {
    if (!targetTrackId) return
    console.log(`Triggering Looper on Track ID ${targetTrackId}: ${action}`)

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
      Only params exposed are as follows:
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

    if (!stateParam || !reverseParam) return console.warn('Looper param not found')

    const looperState = await getLooperState(looper)
    const updateLooperState = async (value: LooperState) => {
      console.log(`Setting Looper State to ${LooperStateLabels[value]} (${value})`)
      await stateParam.set('value', value)
      this.ohm.setLed(TRANSPORT_BUTTONS.REC_DUB, LooperStateColors[value])
    }

    switch (action) {
      case 'Record/Dub/Play':
        // Simulate pressing the big multi-purpose button on Looper
        if (looperState === LooperState.Stopped) await updateLooperState(LooperState.Recording)
        else if (looperState === LooperState.Recording) await updateLooperState(LooperState.Playing)
        else if (looperState === LooperState.Playing) await updateLooperState(LooperState.Overdubbing)
        else if (looperState === LooperState.Overdubbing) await updateLooperState(LooperState.Playing)
        break
      case 'Stop':
        await updateLooperState(LooperState.Stopped)
        break
      case 'Play':
        await updateLooperState(LooperState.Playing)
        break
      case 'Reverse':
        await reverseParam.set('value', 1) // Trigger Reverse
        await reverseParam.set('value', 0) // Reset Reverse button
        break
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
        if (x + y === d) this.ohm.setLed(i, colors[d % colors.length] ?? OhmColor.Red)
      }
      await new Promise((r) => setTimeout(r, 60))
    }

    await new Promise((r) => setTimeout(r, 100))
    for (let i = 0; i < 64; i++) this.ohm.setLed(i, OhmColor.Off)
  }
}
