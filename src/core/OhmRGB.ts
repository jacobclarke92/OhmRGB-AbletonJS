import * as easymidi from 'easymidi'
import { EventEmitter } from 'events'
import { OhmColor } from '../enums'

export const BIG_BUTTON = 87 as const

// Top-right button group
// prettier-ignore
export const MACRO_BUTTONS = [
  69, 70, 71,
  77, 78, 79,
] as const satisfies number[]

// The 2x4 "Slider Buttons" on the OhmRGB
export const TRACK_SELECT_L = [65, 73, 66, 74] as const satisfies number[]
export const TRACK_SELECT_R = [67, 75, 68, 76] as const satisfies number[]
export const TRACK_SELECT_BUTTONS = [...TRACK_SELECT_L, ...TRACK_SELECT_R] as const satisfies number[]

export const CROSSFADER = 24
export const CROSSFADE_BUTTONS = [64, 72] as const satisfies number[]

// prettier-ignore
export const FADERS = [
  23, 22, 15, 14, 
  5,  7,  6,  4,
] as const satisfies number[]

// prettier-ignore
export const POTS_R = [
  3, 1, 0, 2,
] as const satisfies number[]

// prettier-ignore
export const POTS_L = [
  17, 16, 9,  8,
  19, 18, 11, 10,
  21, 20, 13, 12,
] as const satisfies number[]

// prettier-ignore
export const BUTTON_GRID = [
  [0,  1,  2,  3,  4,  5,  6,  7 ],
  [8,  9,  10, 11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20, 21, 22, 23],
  [24, 25, 26, 27, 28, 29, 30, 31],
  [32, 33, 34, 35, 36, 37, 38, 39],
  [40, 41, 42, 43, 44, 45, 46, 47],
  [48, 49, 50, 51, 52, 53, 54, 55],
  [56, 57, 58, 59, 60, 61, 62, 63],
] as const satisfies number[][]

// prettier-ignore
export const LED_GRID = [
  [0, 8, 16, 24, 32, 40, 48, 56],
  [1, 9, 17, 25, 33, 41, 49, 57],
  [2, 10, 18, 26, 34, 42, 50, 58],
  [3, 11, 19, 27, 35, 43, 51, 59],
  [4, 12, 20, 28, 36, 44, 52, 60],
  [5, 13, 21, 29, 37, 45, 53, 61],
  [6, 14, 22, 30, 38, 46, 54, 62],
  [7, 15, 23, 31, 39, 47, 55, 63],
] as const satisfies number[][]

export class OhmRGB extends EventEmitter {
  private input: easymidi.Input
  private output: easymidi.Output

  constructor() {
    super()
    const ports = easymidi.getInputs()
    // Usually the port is named "OhmRGB Controls" or similar
    const inName = ports.find((p) => p.toLowerCase().includes('ohm'))
    const outName = easymidi.getOutputs().find((p) => p.toLowerCase().includes('ohm'))

    if (!inName || !outName) throw new Error('OhmRGB not found! Make sure it is connected.')

    this.input = new easymidi.Input(inName)
    this.output = new easymidi.Output(outName)

    this.input.on('noteon', (msg) => {
      this.emit('button', {
        id: msg.note,
        velocity: msg.velocity,
        channel: msg.channel,
      })
    })

    this.input.on('noteoff', (msg) => {
      this.emit('button', { id: msg.note, velocity: 0, channel: msg.channel })
    })

    this.input.on('cc', (msg) => {
      this.emit('control', {
        id: msg.controller,
        value: msg.value,
        channel: msg.channel,
      })
    })
  }

  setLed(note: number, color: OhmColor) {
    this.output.send('noteon', { note, velocity: color, channel: 0 })
  }

  clearAllLeds() {
    for (let i = 0; i <= BIG_BUTTON; i++) this.setLed(i, OhmColor.Off)
  }

  close() {
    this.input.close()
    this.output.close()
  }
}
