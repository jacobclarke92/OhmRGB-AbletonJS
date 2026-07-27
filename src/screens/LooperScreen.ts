import { VirtualScreen } from '../core/VirtualScreen'
import { OhmColor } from '../core/OhmRGB'

// The 2x4 "Slider Buttons" on the OhmRGB (ID 66-73 in standard livid mapping)
// Left column: 66, 67, 68, 69. Right column: 70, 71, 72, 73.
// Let's arrange them logically 1-8. We can tweak the exact layout order if needed.
const TRACK_SELECT_BUTTONS = [66, 67, 68, 69, 70, 71, 72, 73]

// Assumed transport right buttons
const TRANSPORT_BUTTONS = {
  REC_DUB: 77,
  PLAY: 78,
  STOP: 79,
  CLEAR: 80,
}

export class LooperScreen extends VirtualScreen {
  private selectedTrackId: string | null = null
  private busTracks: Map<number, any> = new Map() // Maps Bus number (1-8) to Ableton Track
  private listenerDisposers: (() => void)[] = []

  async onActivate() {
    console.log('LooperScreen Activated')

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
    if (velocity > 0) {
      // On press

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
        this.triggerLooper(this.selectedTrackId, 'Record/Dub/Play')
      } else if (id === TRANSPORT_BUTTONS.PLAY) {
        this.triggerLooper(this.selectedTrackId, 'Play')
      } else if (id === TRANSPORT_BUTTONS.STOP) {
        this.triggerLooper(this.selectedTrackId, 'Stop')
      } else if (id === TRANSPORT_BUTTONS.CLEAR) {
        this.triggerLooper(this.selectedTrackId, 'Clear')
      }
    }
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
    for (let i = 0; i < TRACK_SELECT_BUTTONS.length; i++) {
      const btnId = TRACK_SELECT_BUTTONS[i]!
      const busNumber = i + 1
      const track = this.busTracks.get(busNumber)

      if (track) {
        // If the track exists and is currently selected, make it BLUE
        if (this.selectedTrackId === track.raw.id) {
          this.ohm.setLed(btnId, OhmColor.Blue)
        } else {
          // If the track exists but is NOT selected, give it a dim color like Cyan or Green
          this.ohm.setLed(btnId, OhmColor.Green)
        }
      } else {
        // Unmapped bus button
        this.ohm.setLed(btnId, OhmColor.Off)
      }
    }

    // Default static colors to transport buttons for visibility
    this.ohm.setLed(TRANSPORT_BUTTONS.REC_DUB, OhmColor.Red)
    this.ohm.setLed(TRANSPORT_BUTTONS.PLAY, OhmColor.Green)
    this.ohm.setLed(TRANSPORT_BUTTONS.STOP, OhmColor.Yellow)
    this.ohm.setLed(TRANSPORT_BUTTONS.CLEAR, OhmColor.White)
  }

  private async triggerLooper(targetTrackId: string | null, action: string) {
    if (!targetTrackId) return

    console.log(`Triggering Looper on Track ID ${targetTrackId}: ${action}`)
    try {
      const tracks = await this.ableton.song.get('tracks')
      const targetTrack = tracks.find((t: any) => t.raw.id === targetTrackId)

      if (!targetTrack) return

      const devices = await targetTrack.get('devices')

      // Look for a device named "Looper" (default Ableton name)
      const looper = devices.find((d: any) =>
        d.raw.name.toLowerCase().includes('looper'),
      )

      if (looper) {
        const parameters = await looper.get('parameters')
        // Ableton Looper "State" parameter index is usually 1 (State: 0=Stop, 1=Record, 2=Play, 3=Overdub)
        // "Clear" is typically mapped to parameter 2, or triggered differently.
        const stateParam = parameters.find(
          (p: any) => p.raw.original_name === 'State',
        )

        if (stateParam) {
          switch (action) {
            case 'Record/Dub/Play':
              // Simulate pressing the big multi-purpose button on Looper
              const currentState = await stateParam.get('value')
              if (currentState === 0)
                await stateParam.set('value', 1) // Not recording -> Record
              else if (currentState === 1)
                await stateParam.set('value', 2) // Recording -> Play
              else if (currentState === 2)
                await stateParam.set('value', 3) // Playing -> Overdub
              else if (currentState === 3) await stateParam.set('value', 2) // Overdub -> Play
              break
            case 'Stop':
              await stateParam.set('value', 0)
              break
            case 'Play':
              await stateParam.set('value', 2)
              break
          }
        }
      } else {
        console.log('No Looper found on this selected track.')
      }
    } catch (err) {
      console.error('Error interacting with Ableton API:', err)
    }
  }
}
