import { PointerMouse } from './loop_input'
import type { XY } from './util'
import { g } from './webgl/gl_init'

export type PointerJust = {
    is_just_up: boolean
    is_just_down: boolean
    is_just_lock: boolean
    is_just_unlock: boolean
    is_down: boolean
    cursor: XY
    update(): void
    destroy(): void
    set_sensitivity(s: number): void
}

export function PointerJust(): PointerJust {
    
    let sensitivity = 1

    let is_just_up = false,
        is_just_down = false,
        is_just_lock = false,
        is_just_unlock = false

    let is_down = false

    let mouse = PointerMouse(g.canvas, {
        on_up: function (): void {
            is_just_up = true
            is_down = false
        },
        on_down: function (): void {
            is_just_down = true
            is_down = true
        },
        on_lock: function (): void {
            is_just_lock = true
        },
        on_unlock: function (): void {
            is_just_unlock = true
            is_down = false
        },
        on_move(e: XY): void {
            cursor[0] += e[0] * sensitivity
            cursor[1] += e[1] * sensitivity
        }
    })

    let cursor: XY = [g.width / 2, g.height / 2]

    return {
        set_sensitivity(s: number) {
            sensitivity = s
        },
        get is_just_up() {
            return is_just_up
        },
        get is_just_down() {
            return is_just_down
        },
        get is_just_lock() {
            return is_just_lock
        },
        get is_just_unlock() {
            return is_just_unlock
        },
        get cursor() {
            return cursor
        },
        get is_down() {
            return is_down
        },
        update() {
            is_just_up = false
            is_just_down = false
            is_just_lock = false
            is_just_unlock = false
            cursor = [0, 0]
        },
        destroy() {
            mouse()
        }
    }
}