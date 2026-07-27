export enum OhmColor {
  Off = 0,
  Red = 1,
  Green = 2,
  Yellow = 3,
  Blue = 4,
  Magenta = 5,
  Cyan = 6,
  White = 7,
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
