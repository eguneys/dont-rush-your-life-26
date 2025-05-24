import { XY, XYWH } from "./util"

export type Position = {
  w: number,
  h: number,
  prev_x?: number
  prev_y?: number
  i_x: number
  i_y: number
  rem_x: number
  rem_y: number
  dx: number
  dy: number
  ddx: number
  ddy: number
  hit_y: number
  hit_x: number
  dy_pull: number
  facing: number
}

export function pos_xy(p: Position): XY {
  return [p.i_x + p.rem_x, p.i_y + p.rem_y]
}
export function pos_xy_center(p: Position) {
  let [x, y] = pos_xy(p)

  return [x + p.w / 2, y + p.h / 2]
}

export function pos_box(p: Position): XYWH {
    return [...pos_xy(p), p.w, p.h]
}


export function position(x: number, y: number, w: number, h: number): Position {
  return {
    w,
    h,
    rem_x: 0,
    rem_y: 0,
    i_x: x,
    i_y: y,
    dx: 0,
    dy: 0,
    ddx: 0,
    ddy: 0,
    dy_pull: 0,
    hit_x: 0,
    hit_y: 0,
    facing: 0,
  }
}

export type HasCollidedXYWH = (x: number, y: number, w: number, h: number) => boolean

export function pixel_perfect_position_update(pos: Position, delta: number, has_collided: HasCollidedXYWH) {

  pos.prev_x = pos.i_x
  pos.prev_y = pos.i_y

  let step_x = Math.sign(pos.dx)
  let tx = Math.abs(pos.dx * delta / 1000 + pos.rem_x)
  let sx = Math.floor(tx)

  pos.rem_x = (tx - sx) * Math.sign(pos.dx)

  pos.hit_x = has_collided(pos.i_x + step_x, pos.i_y, pos.w, pos.h) ? step_x : 0

  for (let i = 0; i < sx; i++) {
    if (has_collided(pos.i_x + step_x, pos.i_y, pos.w, pos.h)) {
      pos.dx = 0
      pos.hit_x = step_x
      break
    }
    pos.i_x += step_x
  }

  let step_y = Math.sign(pos.dy)
  let ty = Math.abs(pos.dy * delta / 1000 + pos.rem_y)
  let sy = Math.floor(ty)

  pos.rem_y = (ty - sy) * Math.sign(pos.dy)

  pos.hit_y = has_collided(pos.i_x, pos.i_y + step_y, pos.w, pos.h) ? step_y: 0

  for (let i = 0; i < sy; i++) {
    if (has_collided(pos.i_x, pos.i_y + step_y, pos.w, pos.h)) {
      pos.hit_y = step_y
      pos.dy = 0
      pos.rem_y = 0
      break
    }
    pos.i_y += step_y
  }
}