import { Ableton } from 'ableton-js'

import { OhmRGB } from './core/OhmRGB'
import { LooperScreen } from './screens/LooperScreen'

async function main() {
  console.log('Connecting to Ableton Live...')
  const ableton = new Ableton({ logger: console })

  try {
    await ableton.start()
    console.log('Connected to Ableton Live API!')
  } catch (err) {
    console.warn(
      'Could not connect to Ableton. Is Max for Live device loaded?',
      err,
    )
  }

  console.log('Connecting to OhmRGB...')
  const ohm = new OhmRGB()
  ohm.clearAllLeds()

  // Screen management
  const looperScreen = new LooperScreen(ohm, ableton)

  ohm.on('button', (event) => {
    looperScreen.onButton(event.id, event.velocity)
  })

  ohm.on('control', (event) => {
    looperScreen.onControl(event.id, event.value)
  })

  console.log('\n🎧 Ready! Press Ctrl+C to exit.')
  await looperScreen.onActivate()

  process.on('SIGINT', () => {
    console.log('\nClosing ports...')
    ohm.clearAllLeds()
    ohm.close()
    process.exit()
  })
}

main().catch(console.error)
