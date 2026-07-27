import { VirtualScreen } from '../core/VirtualScreen'
import { OhmColor } from '../enums'

/**
 * This is literally just for fun, it doesn't do anything
 */
export class GeometricScreen extends VirtualScreen {
  private isActive = false
  private animFrameId: NodeJS.Timeout | null = null
  private time = 0
  private ripples: { cx: number; cy: number; startTime: number }[] = []

  async onActivate() {
    console.log('GeometricScreen Activated')
    this.isActive = true
    this.time = 0
    this.animationLoop()
  }

  async onDeactivate() {
    console.log('GeometricScreen Deactivated')
    this.isActive = false
    if (this.animFrameId) {
      clearTimeout(this.animFrameId)
      this.animFrameId = null
    }
  }

  onButton(id: number, velocity: number) {
    if (velocity === 0) return
    if (id >= 64) return

    const x = id % 8
    const y = Math.floor(id / 8)
    this.ripples.push({ cx: x, cy: y, startTime: this.time })
  }

  onControl(id: number, value: number) {
    // Handle faders/pots if needed
  }

  private animationLoop = () => {
    if (!this.isActive) return

    for (let id = 0; id < 64; id++) {
      const x = id % 8
      const y = Math.floor(id / 8)

      // center of the 8x8 grid is at (3.5, 3.5)
      const cx = 3.5
      const cy = 3.5
      const dx = x - cx
      const dy = y - cy

      const dist = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx)

      const v = Math.sin(dist * 1.5 - this.time * 2) + Math.cos(angle * 3 + this.time)

      let color = OhmColor.Off
      if (v > 1.2) color = OhmColor.White
      else if (v > 0.2) color = OhmColor.Cyan
      else if (v > -0.8) color = OhmColor.Magenta
      else color = OhmColor.Blue

      for (const ripple of this.ripples) {
        const rdx = x - ripple.cx
        const rdy = y - ripple.cy
        const rDist = Math.sqrt(rdx * rdx + rdy * rdy)
        const age = this.time - ripple.startTime
        const radius = age * 4 // speed of ripple expansion
        const thickness = 0.8

        if (Math.abs(rDist - radius) < thickness) color = OhmColor.White
      }

      this.ohm.setLed(id, color)
    }

    this.time += 0.15
    this.ripples = this.ripples.filter((r) => this.time - r.startTime < 4) // Remove old ripples
    this.animFrameId = setTimeout(this.animationLoop, 100)
  }
}
