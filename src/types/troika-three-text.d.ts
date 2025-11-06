declare module 'troika-three-text' {
  import { Object3D, Material, Color, ColorRepresentation } from 'three'

  export class Text extends Object3D {
    text: string
    fontSize: number
    color: ColorRepresentation
    anchorX: 'left' | 'center' | 'right' | number
    anchorY: 'top' | 'middle' | 'bottom' | number
    font?: string
    maxWidth?: number
    lineHeight?: number | string
    letterSpacing?: number
    textAlign?: 'left' | 'center' | 'right' | 'justify'
    textIndent?: number
    whiteSpace?: 'normal' | 'nowrap'
    overflowWrap?: 'normal' | 'break-word'
    material?: Material
    depthOffset?: number
    clipRect?: [number, number, number, number]
    orientation?: string
    glyphGeometryDetail?: number
    sdfGlyphSize?: number
    sync(callback?: () => void): void
    dispose(): void
  }

  export function preloadFont(
    font: { font: string; characters?: string },
    callback?: () => void
  ): void
}

