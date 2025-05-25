import { After, Every, global_trigger, Tween } from './krx/trigger'
import { linear } from './math/ease'
import { b_chase_steer, b_pursuit_steer, b_separation_steer, b_wander_steer, Behavior, steer_behaviours, SteerBehaviors } from './math/steer'
import { Vec2 } from './math/vec2'
import { PointerJust } from './pointer_just'
import { pixel_perfect_position_update, pos_xy, position, Position } from './position'
import { random, rnd_float, rnd_int } from './random'
import { appr, box_intersect, clamp, step_round, XY, XYWH } from './util'
import { Color } from './webgl/color'
import { g } from './webgl/gl_init'

// @ts-ignore
class Theme {
    static Shadow = Color.hex(0x0a071e)
    static HighShadow = Color.hex(0xf9ed69) // #f9ed6900
    static HighShadowOnWhite = Color.hex(0xa217e8) //#a217e800
}

let p: PointerJust

type Zombie = {
    steer: SteerBehaviors
    knock_force: XY
}

type Cursor = {
    xy: Position,
    theta: number
    stick?: Position
    stick_ran_on_down: boolean
    t_stick: number
    stamina: number
    stamina_delta: number
    t_stamina_delta: number
}

let cursor: Cursor

let zz: Zombie[]

export function _init() {

    p = PointerJust()
    //p.set_sensitivity(0.3)
    p.set_sensitivity(0.8)

    cursor = {
        xy: position(g.width / 2, g.height/ 2, 20, 20),
        theta: 0,
        stick_ran_on_down: false,
        t_stick: 0,
        stamina: 5000,
        stamina_delta: 0,
        t_stamina_delta: 0
    }


    zz = []

    Every.add_immediate(3000, () => { for (let i = 0; i < 3; i++) zombie_add() })

    Every.add(5000, () => {
        let a = rnd_int(0, zz.length - 4)
        let flock = zz.slice(a, a + 4)
        flock.forEach(_ => _.steer.set_bs(
            [
                [b_chase_steer(steer_target(cursor.xy)), .8],
                [b_separation_steer({ get group() { return zz.map(_ => _.steer.body.position) } }), .3]
            ])
        )

        After.add(3000, () => {
            flock.forEach(_ => _.steer.set_bs(default_zombie_steer()))
        })
    })
}

let t_slow = 0
export function _update(delta: number) {
    if (t_slow > 0) {
        t_slow = appr(t_slow, 0, delta)
        delta *= 0.555
    }


    for (let z of zz) update_zombie(z, delta)
    
    update_cursor(delta)

    for (let z of zz) {
        if (cursor_has_collided_zombie(z)) {
            cursor_knock_zombie(z)
            t_slow += 20
        }
    }


    global_trigger.update(delta)
}

function cursor_has_collided_zombie(z: Zombie) {
    return box_intersect(c_box(cursor.xy), zombie_box(z.steer.body.position.xy))
}

function cursor_knock_zombie(z: Zombie) {
    z.knock_force = z.steer.body.side.scale(6000).xy
    Tween.add(200, z.knock_force, [0, 0], linear)
}

function zombie_add() {
    if (zz.length !== 0) {
        //return

    }
    zz.push({
        knock_force: [0, 0],
        steer: steer_behaviours(Vec2.make(100, 100), {
            mass: 1,
            damping: 1,
            max_speed: 300,
            max_force: 2000
        }, default_zombie_steer()),
    })
}

function default_zombie_steer(): Behavior[] {
    return [
        [b_pursuit_steer(steer_target(cursor.xy), rnd_float(0.0008, 0.005)), rnd_int(1, 3)],
        [b_separation_steer({ get group() { return zz.map(_ => _.steer.body.position) } }), 1],
        //[b_wander_steer(rnd_int(250, 500), 500, 100, random), rnd_int(2, 4)]
        [b_wander_steer(80, 500, 100, random), 8]
    ]
}

function steer_target(pos: Position) {

    return {
        get position() {
            return Vec2.xy(pos_xy(pos))
        },
        get velocity() {
            return Vec2.make(pos.dx, pos.dy)
        }
    }
}

function update_zombie(z: Zombie, delta: number) {

    z.steer.update(delta)

    z.steer.add_applied_force(Vec2.xy(z.knock_force))
    //z.steer.body.add_impulse(Vec2.xy(z.knock_force))
}


function update_cursor(delta: number) {

    if (has_collided_bounds(...p.cursor, 10, 10)) {
        p.cursor[0] = clamp(p.cursor[0], 0, g.width)
        p.cursor[1] = clamp(p.cursor[1], 0, g.height)
    }

    if (p.is_down) {
        if (!cursor.stick_ran_on_down) {

            if (cursor.stamina === 0) {

            } else {
                cursor.stick = position(...p.cursor, 10, 10)
                cursor.stick_ran_on_down = true
                cursor.t_stick = 300

                let stamina = cursor.stamina
                cursor.stamina = Math.max(0, cursor.stamina - 300)

                cursor.stamina_delta = cursor.stamina - stamina
                cursor.t_stamina_delta = 200
            }
        }
    } else {
        cursor.stick_ran_on_down = false

        if (cursor.t_stick === 0) {
            let stamina = cursor.stamina
            cursor.stamina = appr(cursor.stamina, 5000, delta * 0.2)

            cursor.stamina_delta = cursor.stamina - stamina
            cursor.t_stamina_delta = 200
        }
    }

    if (cursor.t_stamina_delta > 0) {
        cursor.t_stamina_delta = appr(cursor.t_stamina_delta, 0, delta)
    }
    if (cursor.t_stamina_delta === 0) {
        cursor.stamina_delta = appr(cursor.stamina_delta, 0, delta * 2)
    }

    if (cursor.t_stick > 0) {
        cursor.t_stick = appr(cursor.t_stick, 0, delta)

        if (cursor.t_stick === 0) {
            cursor.stick = undefined
        }
    }

    let dx = p.cursor[0] - cursor.xy.i_x
    let dy = p.cursor[1] - cursor.xy.i_y

    if (Math.sign(cursor.xy.dx) !== Math.sign(dx)) {
        cursor.xy.dx = appr(cursor.xy.dx, dx, 300)
    } else {
        cursor.xy.dx = appr(cursor.xy.dx, dx * 13, 200)
    }
    if (Math.sign(cursor.xy.dy) !== Math.sign(dy)) {
        cursor.xy.dy = appr(cursor.xy.dy, dy, 300)
    } else {
        cursor.xy.dy = appr(cursor.xy.dy, dy * 13, 200)
    }


    pixel_perfect_position_update(cursor.xy, delta, has_collided_bounds)
}

// @ts-ignore
function damp_zero(pos: Position, delta: number) {
    pos.dx = appr(pos.dx, 0, pos.ddx * (delta / 1000))
    pos.dy = appr(pos.dy, 0, pos.ddy * (delta / 1000))
}

// @ts-ignore
function has_collided_none() {
    return false
}

function has_collided_bounds(x: number, y: number, w: number, h: number) {
    if (x < 0 || x + w > g.width) {
        return true
    }
    if (y < 0 || y + h > g.height) {
        return true
    }

    return false
}

function c_box(xy: Position): XYWH {
    return [xy.i_x, xy.i_y, xy.w, xy.h]
}

export function _render() {


    g.clear()


    g.begin_shapes()

    if (cursor.stick) {
        g.shape_rect(...c_box(cursor.stick), Color.black, cursor.theta)
        g.shape_rect(...c_box(cursor.xy), Color.white, cursor.theta)
    } else {
        g.shape_rect(...c_box(cursor.xy), Color.red, cursor.theta)
    }

    for (let z of zz) {
        render_zombie(z)
    }



    g.shape_rect(...stamina_box, Color.black, 0)
    g.shape_rect(...stamina_box2(cursor.stamina), Color.red, 0)
    if (cursor.stamina_delta) {
        g.shape_rect(...stamina_delta_box2(cursor.stamina, cursor.stamina_delta), Color.white, 0)
    }

    g.end_shapes()
}

function render_zombie(z: Zombie) {
    g.shape_rect(...zombie_box(z.steer.body.position.xy), Color.red, z.steer.body.side.angle)
}

function zombie_box(xy: XY): XYWH {
    return [xy[0], xy[1], 8, 16]
}

let stamina_box: XYWH = [2, 2, 8, 180 -4]

function stamina_box2(stamina: number): XYWH {
    let t = step_round((stamina / 5000) * (180 - 4), 3)
    return [2, 2 + (180 - 4 - t), 8, t]
}

function stamina_delta_box2(stamina: number, delta: number): XYWH {
    let t = step_round((stamina / 5000) * (180 - 4), 3)
    let t_delta = delta / 5000 * (180 - 4)
    return [2, 2 + (180 - 4 - t), 8, t_delta]
}