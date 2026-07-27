import { OhmRGB } from './OhmRGB'
import { Ableton } from 'ableton-js'

export abstract class VirtualScreen {
  protected ohm: OhmRGB
  protected ableton: Ableton

  constructor(ohm: OhmRGB, ableton: Ableton) {
    this.ohm = ohm
    this.ableton = ableton
  }

  /**
   * Called when this screen becomes active.
   */
  abstract onActivate(): Promise<void>

  /**
   * Called when this screen becomes inactive.
   */
  abstract onDeactivate(): Promise<void>

  /**
   * Handle incoming button events from the hardware.
   */
  abstract onButton(id: number, velocity: number): void

  /**
   * Handle incoming pot/fader events from the hardware.
   */
  abstract onControl(id: number, value: number): void
}
