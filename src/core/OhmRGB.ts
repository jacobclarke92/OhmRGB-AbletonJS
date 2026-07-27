import * as easymidi from 'easymidi'
import { EventEmitter } from 'events'
import { OhmColor } from '../enums'

export class OhmRGB extends EventEmitter {
  private input: easymidi.Input
  private output: easymidi.Output

  constructor() {
    super()
    const ports = easymidi.getInputs()
    // Usually the port is named "OhmRGB Controls" or similar
    const inName = ports.find((p) => p.toLowerCase().includes('ohm'))
    const outName = easymidi
      .getOutputs()
      .find((p) => p.toLowerCase().includes('ohm'))

    if (!inName || !outName)
      throw new Error('OhmRGB not found! Make sure it is connected.')

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
    // Basic standard map covers 0 to 87
    // TODO: abstract this range to elsewhere?
    for (let i = 0; i <= 87; i++) this.setLed(i, OhmColor.Off)
  }

  close() {
    this.input.close()
    this.output.close()
  }
}
