export enum OhmColor {
  Off = 0,
  Red = 2,
  Green = 4,
  Yellow = 8,
  Blue = 16,
  Magenta = 32,
  Cyan = 64,
  White = 127,
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
