
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