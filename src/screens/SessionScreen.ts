import type { ClipSlot } from 'ableton-js/ns/clip-slot'
import { BUTTON_GRID } from '../core/OhmRGB'
import { VirtualScreen } from '../core/VirtualScreen'
import { OhmColor } from '../enums'

const NAV_UP = BUTTON_GRID[1][7]
const NAV_DOWN = BUTTON_GRID[6][7]
const NAV_LEFT = BUTTON_GRID[7][1]
const NAV_RIGHT = BUTTON_GRID[7][6]

export class SessionScreen extends VirtualScreen {
  private trackOffset = 0
  private sceneOffset = 0

  private maxTracks = 0
  private maxScenes = 0

  private activeClipSlots: Map<string, (() => void)[]> = new Map()
  private ledCache: Map<number, OhmColor> = new Map()

  private setLedCached(id: number, color: OhmColor) {
    if (this.ledCache.get(id) !== color) {
      this.ledCache.set(id, color)
      this.ohm.setLed(id, color)
    }
  }

  async onActivate() {
    console.log('SessionScreen Activated')

    // Prepare red ring (6x6 grid)
    await this.ableton.session.setupSessionBox(6, 6)

    // Clear cache
    this.ledCache.clear()

    // Clear all LEDs
    this.ohm.clearAllLeds()

    // Draw navigation controls initially
    this.setLedCached(NAV_UP, OhmColor.Cyan)
    this.setLedCached(NAV_DOWN, OhmColor.Cyan)
    this.setLedCached(NAV_LEFT, OhmColor.Cyan)
    this.setLedCached(NAV_RIGHT, OhmColor.Cyan)

    await this.updateGrid()
  }

  async onDeactivate() {
    console.log('SessionScreen Deactivated')
    this.clearGridListeners()
  }

  async onButton(id: number, velocity: number) {
    if (velocity === 0) return

    if (id === NAV_UP) {
      if (this.sceneOffset <= 0) return
      this.sceneOffset--
      await this.updateGrid()
    } else if (id === NAV_DOWN) {
      if (this.sceneOffset + 6 >= this.maxScenes) return
      this.sceneOffset++
      await this.updateGrid()
    } else if (id === NAV_LEFT) {
      if (this.trackOffset <= 0) return
      this.trackOffset--
      await this.updateGrid()
    } else if (id === NAV_RIGHT) {
      if (this.trackOffset + 6 >= this.maxTracks) return
      this.trackOffset++
      await this.updateGrid()
    } else {
      // Process clip clicks
      const x = id % 8
      const y = Math.floor(id / 8)

      // Inner 6x6 grid is X: 1..6, Y: 1..6
      if (x >= 1 && x <= 6 && y >= 1 && y <= 6) {
        const gridX = x - 1
        const gridY = y - 1

        await this.triggerClip(gridX, gridY)
      }
    }
  }

  onControl(id: number, value: number) {}

  private clearGridListeners() {
    for (const disposers of this.activeClipSlots.values()) {
      for (const dispose of disposers) dispose()
    }
    this.activeClipSlots.clear()
  }

  private async updateGrid() {
    await this.ableton.session.setSessionOffset(this.trackOffset, this.sceneOffset)

    const tracks = await this.ableton.song.get('tracks')
    const scenes = await this.ableton.song.get('scenes')

    this.maxTracks = tracks.length
    this.maxScenes = scenes.length

    const currentViewSlotIds = new Set<string>()

    // Loop through 6x6 grid
    const startMs = Date.now()
    for (let x = 0; x < 6; x++) {
      for (let y = 0; y < 6; y++) {
        const ledId = y + 1 + (x + 1) * 8
        const tIndex = this.trackOffset + x
        const sIndex = this.sceneOffset + y

        if (tIndex >= tracks.length || sIndex >= scenes.length) {
          this.setLedCached(ledId, OhmColor.Off)
          continue
        }

        const track = tracks[tIndex]
        if (!track) continue

        const clipSlots = await track.get('clip_slots')
        if (sIndex >= clipSlots.length) {
          this.setLedCached(ledId, OhmColor.Off)
          continue
        }

        const clipSlot = clipSlots[sIndex]
        if (!clipSlot) continue

        const slotId = clipSlot.raw.id
        currentViewSlotIds.add(slotId)

        // Set initial color
        this.updateClipSlotColor(ledId, clipSlot)

        // Listen for changes ONLY if we aren't already
        if (!this.activeClipSlots.has(slotId)) {
          const absX = tIndex
          const absY = sIndex
          const disposeHasClip = await clipSlot.addListener('has_clip', async (state) => {
            console.log(`X${absX} Y${absY} Clip has_clip state`, state)
            await this.refreshClipSlot(absX, absY, clipSlot)
          })
          const disposePlaying = await clipSlot.addListener('playing_status', async (state) => {
            console.log(`X${absX} Y${absY} Clip playing status`, state)
            await this.refreshClipSlot(absX, absY, clipSlot)
            await this.refreshTrackColumn(absX)
          })
          const disposeTriggered = await clipSlot.addListener('is_triggered', async (state) => {
            console.log(`X${absX} Y${absY} Clip triggered state`, state)
            await this.refreshClipSlot(absX, absY, clipSlot)
            await this.refreshTrackColumn(absX)
          })

          this.activeClipSlots.set(slotId, [disposeHasClip, disposePlaying, disposeTriggered])
        }
      }
    }

    // Clean up listeners for clip slots that have slipped out of our 6x6 view
    for (const [id, disposers] of this.activeClipSlots.entries()) {
      if (!currentViewSlotIds.has(id)) {
        for (const dispose of disposers) dispose()
        this.activeClipSlots.delete(id)
      }
    }

    const endMs = Date.now()
    console.log(`SessionScreen: updateGrid took ${endMs - startMs} ms`)
  }

  private async refreshClipSlot(absX: number, absY: number, clipSlot: ClipSlot) {
    const x = absX - this.trackOffset
    const y = absY - this.sceneOffset
    if (x >= 0 && x < 6 && y >= 0 && y < 6) {
      const ledId = y + 1 + (x + 1) * 8
      await this.updateClipSlotColor(ledId, clipSlot)
    }
  }

  private async refreshTrackColumn(absX: number) {
    const x = absX - this.trackOffset
    if (x < 0 || x >= 6) return

    const tracks = await this.ableton.song.get('tracks')
    if (absX >= tracks.length) return

    const track = tracks[absX]
    if (!track) return

    const clipSlots = await track.get('clip_slots')
    for (let y = 0; y < 6; y++) {
      const absY = this.sceneOffset + y
      if (absY >= clipSlots.length) continue
      const clipSlot = clipSlots[absY]
      if (!clipSlot) continue

      const ledId = y + 1 + (x + 1) * 8
      await this.updateClipSlotColor(ledId, clipSlot)
    }
  }

  private async updateClipSlotColor(ledId: number, clipSlot: ClipSlot) {
    if (!(await clipSlot.get('has_clip'))) return this.setLedCached(ledId, OhmColor.Off)

    if (await clipSlot.get('is_playing')) this.setLedCached(ledId, OhmColor.Green)
    else if (await clipSlot.get('is_triggered')) this.setLedCached(ledId, OhmColor.Magenta)
    else this.setLedCached(ledId, OhmColor.White)
  }

  private async triggerClip(gridX: number, gridY: number) {
    const tIndex = this.trackOffset + gridX
    const sIndex = this.sceneOffset + gridY

    const tracks = await this.ableton.song.get('tracks')
    if (tIndex >= tracks.length) return

    const track = tracks[tIndex]
    if (!track) return

    const clipSlots = await track.get('clip_slots')
    if (sIndex >= clipSlots.length) return

    const clipSlot = clipSlots[sIndex]
    if (!clipSlot) return

    await clipSlot.sendCommand('fire')
  }
}
