type Canvas = {
  canvas: HTMLCanvasElement
  width: number
  height: number
  rect(x: number, y: number, w: number, h: number, color: Color): void
  stroke_rect(x: number, y: number, w: number, h: number, color: Color, line_width?: number): void
  line(x: number, y: number, x2: number, y2: number, color: Color): void
  clear(): void
  set_transform(x: number, y: number, angle: number, w: number, h: number): void
  image(x: number, y: number, w: number, h: number, sx: number, sy: number): void
  load_sheet(src: string): Promise<void>
  text(text: string, x: number, y: number, size: number, color: Color, align?: CanvasTextAlign): number
}

type Color = string

function Canvas(width: number, height: number): Canvas {

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    function line(x: number, y: number, x2: number, y2: number, color: Color) {
        ctx.strokeStyle = color
        ctx.moveTo(x, y)
        ctx.lineTo(x2, y2)

        ctx.stroke()
    }

    function stroke_rect(x: number, y: number, width: number, height: number, color: Color, line_width = 3) {
        ctx.lineWidth = line_width;
        ctx.strokeStyle = color
        ctx.strokeRect(x, y, width, height)
    }

    function rect(x: number, y: number, width: number, height: number, color: Color) {
        ctx.fillStyle = color
        ctx.fillRect(x, y, width, height)
    }

    function clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    function set_transform(x: number, y: number, angle: number, w: number, h: number) {
        let cx = w
        let cy = h
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        let tx = x - cx * cos + cy * sin
        let ty = y - cx * sin - cy * cos
        ctx.setTransform(cos, sin, -sin, cos, tx, ty)
    }

    let sheet = new Image()

    function load_sheet(src: string) {
        sheet.src = src
        return new Promise<void>(resolve => {
            sheet.onload = () => resolve()
        })
    }

    function image(x: number, y: number, w: number, h: number, sx: number, sy: number) {
        x = Math.floor(x)
        y = Math.floor(y)
        ctx.drawImage(sheet, sx, sy, w, h, x, y, w, h)
    }


    function text(text: string, x: number, y: number, size: number, color: Color, align: CanvasTextAlign = 'center') {
        ctx.fillStyle = color
        ctx.font = `${size}px 'SairaSlick'`
        ctx.textBaseline = 'top'
        ctx.textAlign = align

        ctx.shadowColor = 'black'
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 4

        ctx.fillText(text, x, y)

        return ctx.measureText(text).width
    }

    return {
      canvas,
      clear,
      stroke_rect,
      rect,
      line,
      image,
      set_transform,
      load_sheet,
      width,
      height,
      text,
    }
}

export let c: Canvas = Canvas(1920, 1080)

