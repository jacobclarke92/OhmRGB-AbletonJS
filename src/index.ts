import { Ableton } from 'ableton-js'

import { CROSSFADE_BUTTONS, OhmRGB } from './core/OhmRGB'
import { VirtualScreen } from './core/VirtualScreen'
import { LooperScreen } from './screens/LooperScreen'
import { GeometricScreen } from './screens/GeometricScreen'
import { SessionScreen } from './screens/SessionScreen'

async function main() {
  console.log('Connecting to Ableton Live...')
  const ableton = new Ableton({ logger: console })

  try {
    await ableton.start()
    console.log('Connected to Ableton Live API!')
  } catch (err) {
    console.warn('Could not connect to Ableton. Is Max for Live device loaded?', err)
  }

  console.log('Connecting to OhmRGB...')
  const ohm = new OhmRGB()
  ohm.clearAllLeds()

  // Screen management
  let currentScreenIndex = 0
  const screens: VirtualScreen[] = [
    new SessionScreen(ohm, ableton),
    new LooperScreen(ohm, ableton),
    new GeometricScreen(ohm, ableton),
  ]

  ohm.on('button', async (event) => {
    // CC 64 and 72 mapped as crossfade buttons to cycle screens
    if (event.velocity > 0 && CROSSFADE_BUTTONS.includes(event.id)) {
      await screens[currentScreenIndex]!.onDeactivate()

      if (event.id === CROSSFADE_BUTTONS[0])
        currentScreenIndex = (currentScreenIndex - 1 + screens.length) % screens.length
      else currentScreenIndex = (currentScreenIndex + 1) % screens.length

      console.log(`Changed to screen index ${currentScreenIndex}`)
      ohm.clearAllLeds()
      await screens[currentScreenIndex]!.onActivate()
      return
    }

    screens[currentScreenIndex]!.onButton(event.id, event.velocity)
  })

  ohm.on('control', (event) => {
    screens[currentScreenIndex]!.onControl(event.id, event.value)
  })

  console.log('\n🎧 Ready! Press Ctrl+C to exit.\n')
  await screens[currentScreenIndex]!.onActivate()

  process.on('SIGINT', () => {
    console.log('\nClosing ports...')
    ohm.clearAllLeds()
    ohm.close()
    process.exit()
  })
}

main().catch(console.error)
