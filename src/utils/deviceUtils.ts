import type { Device } from 'ableton-js/ns/device'
import type { Track } from 'ableton-js/ns/track'
import { LooperStateLabels, type LooperState } from '../enums'

export async function getLooperOnTrack(track: Track) {
  const devices = await track.get('devices')
  return devices.find((d) => d.raw.name.toLowerCase().includes('looper'))
}

export async function getLooperState(looper: Device) {
  const params = await looper.get('parameters')
  const stateParam = params.find((p) => p.raw.name === 'State')!
  const value = (await stateParam.get('value')) as LooperState
  console.log(`Current Looper State: ${LooperStateLabels[value]} (${value})`)
  return value
}
