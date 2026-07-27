export enum OhmColor {
  Off = 0,
  White = 2,
  Cyan = 4,
  Magenta = 8,
  Red = 16,
  Blue = 32,
  Yellow = 64,
  Green = 127,
}

export enum LooperState {
  Stopped = 0,
  Overdubbing = 1,
  Recording = 2,
  Playing = 3,
}

export const LooperStateLabels = {
  [LooperState.Stopped]: 'Stopped',
  [LooperState.Overdubbing]: 'Overdubbing',
  [LooperState.Recording]: 'Recording',
  [LooperState.Playing]: 'Playing',
}

export const LooperStateColors = {
  [LooperState.Stopped]: OhmColor.White,
  [LooperState.Overdubbing]: OhmColor.Blue,
  [LooperState.Recording]: OhmColor.Red,
  [LooperState.Playing]: OhmColor.Green,
}
