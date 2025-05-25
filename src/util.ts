
export type XY = [number, number]
export type XYWH = [number, number, number, number]

export function lerp(a: number, b: number, t: number) {
    return a * (1 - t) + b * t
}

export function appr(a: number, b: number, t: number) {
    if (a < b) {
        return Math.min(a + t, b)
    } else if (a > b) {
        return Math.max(a - t, b)
    } else {
        return a
    }
}

export function appr_angle(a: number, b: number, by: number) {
    let diff = angle_diff(a, b)
    if (Math.abs(diff) < by) {
        return b
    }
    return a + clamp(diff, -by, by)
}

export const PI = Math.PI
export const TAU = Math.PI * 2

export function angle_diff(a: number, b: number) {
    return ((b - a - PI) % TAU + TAU) % TAU - PI
}

export function step_round(value: number, by: number) {
    return Math.floor(value / by) * by
}

export function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value))
}

export function ease(t: number): number {
    return t * t * (3 - 2 * t)
}

export function box_intersect(a: XYWH, b: XYWH) {
    let [ax, ay, aw, ah] = a
    let [bx, by, bw, bh] = b

    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}