import { After,  ConditionalEveryAndAfter, Cooldown, Every, global_trigger, OTween, Tween } from './krx/trigger'
import { linear, quad_in, sine_in  } from './math/ease'
import { b_arrive_steer, b_avoid_circle_steer, b_chase_steer, b_pursuit_steer, b_separation_steer, b_wall_avoid_steer, b_wander_steer, Behavior, steer_behaviours, SteerBehaviors } from './math/steer'
import { Line, Rectangle, Vec2 } from './math/vec2'
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
    life: number
    on_pursuit: boolean
    steer: SteerBehaviors
    knock_force: XY
    patrol?: XY[]
    ping: number
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
    vel_history: XY[]
    pos_history: XY[]
}

type VampireTrail = {
    life: number,
    xy: XYWH
}

let cursor: Cursor

let zz: Zombie[]
let tt: VampireTrail[]

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
        t_stamina_delta: 0,
        vel_history: [[0, 0], [0, 0], [0, 0]],
        pos_history: [[0, 0], [0, 0], [0, 0]]
    }

    tt = []

    zz = []

    Every.add_immediate(3000, zombie_add)

    Every.add(5000, () => {
        let a = rnd_int(0, zz.length - 4)
        let flock = zz.slice(a, a + 4)
        flock.forEach(_ => _.steer.set_bs(
            [
                [b_chase_steer(steer_target(cursor.xy)), .8],
                [b_separation_steer({ get group() { return zz.map(_ => _.steer.body.position) } }), .3]
            ])
        )
        flock.forEach(f => f.on_pursuit = true)
        flock.forEach(f => f.steer.body.max_speed = 1000)

        After.add(3000, () => {
            flock.forEach(_ => _.steer.set_bs(pursuit_zombie_steer()))
            flock.forEach(f => f.on_pursuit = false)
            flock.forEach(f => f.steer.body.max_speed = 800)
        })
    })


    ConditionalEveryAndAfter.add(() => cursor.stick !== undefined, (has_stick: boolean) => {
        let flock = zz

        if (has_stick) {
            flock.forEach(_ => _.steer.set_bs(
                [
                    [b_pursuit_steer(steer_target(cursor.xy), rnd_float(0.0008, 0.005)), rnd_int(1, 2)],
                    [b_avoid_circle_steer(steer_target(cursor.xy), 200), 3],
                    [b_separation_steer({ get group() { return zz.map(_ => _.steer.body.position) } }), .3]
                ])
            )
            flock.forEach(f => f.steer.body.max_speed = 800)
        } else {
            flock.forEach(_ => _.steer.set_bs(pursuit_zombie_steer()))
            flock.forEach(f => f.steer.body.max_speed = 300)
        }
    })

    Every.add(60, () => {
        cursor.vel_history.shift()
        cursor.vel_history.push([cursor.xy.dx, cursor.xy.dy])

        cursor.pos_history.shift()
        cursor.pos_history.push(pos_xy(cursor.xy))
    })
    Cooldown.add(140, is_cursor_slow, vampire_trail_add)

    Every.add(1000, () => {
        console.log(`Zombies: `, zz.length)
        console.log(`\tPatrol: `, zz.filter(_ => _.patrol).length)
        console.log(`\tOn Pursuit: `, zz.filter(_ => _.on_pursuit).length)
    })



    Every.add(2000, () => {
        let z = zz[zz.length - 1]
        if (!z || z.patrol) {
            return
        }

        let a = Vec2.make(rnd_int(0, g.width), rnd_int(0, g.height))
        z.patrol = [a.xy]
        for (let i = 0; i < 3; i++) {
            let b = Vec2.xy(z.patrol![0]).add(Vec2.from_angle(rnd_int(0, Math.PI * 2)).scale(rnd_int(60, 120)))
            z.patrol!.push(b.xy)
        }
    })

    Every.add_immediate(1000, () => {
        for (let z of zz) {
            if (z.on_pursuit) {
                continue
            }
            if (!z.patrol) {
                continue
            }

            z.steer.body.max_speed = 100
            z.patrol.push(z.patrol.shift()!)

            z.steer.set_bs(
                [
                    [b_arrive_steer(xy_target(...z.patrol[0]), 20), .8],
                    [b_wall_avoid_steer(100, { get walls() { return tt.map(_ => Line.make(..._.xy)) }}), 3],
                ])
        }
    })
}

function vampire_trail_add() {

    tt.push({
        life: 5000,
        xy: cursor_trail()
    })
}

function cursor_trail(): XYWH {
    return [...cursor.pos_history[0], ...cursor.pos_history[cursor.pos_history.length - 1]]
}

function is_cursor_slow() {

    let sum_x = cursor.vel_history.map(_ => _[0]).reduce((a, b) => a + b, 0)
    let sum_y = cursor.vel_history.map(_ => _[1]).reduce((a, b) => a + b, 0)

    let avg_x = sum_x / cursor.vel_history.length
    let avg_y = sum_y / cursor.vel_history.length

    let xy = cursor.vel_history.map(_ => {
        let dx = _[0] - avg_x
        let dy = _[1] - avg_y
        return [dx * dx, dy * dy]
    }).reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0])

    let deviation = Vec2.make(Math.sqrt(xy[0] / cursor.vel_history.length),
        Math.sqrt(xy[1] / cursor.vel_history.length))

    return deviation.length > 270
}

// @ts-ignore
function is_position_slow(xy: Position) {
    return Vec2.make(xy.dx, xy.dy).length < 10
}

let t_slow = 0
export function _update(delta: number) {
    if (t_slow > 0) {
        t_slow = appr(t_slow, 0, delta)
        delta *= 0.555
    }

    update_cursor(delta)

    for (let z of zz) update_zombie(z, delta)
    for (let t of tt) update_trail(t, delta)

    if (cursor.stick) {

    } else {
        for (let z of zz) {
            if (cursor_has_collided_zombie(z)) {
                cursor_knock_zombie(z)
                t_slow += 20
            }
        }
    }

    for (let z of zz) {
        if (!zombie_collided_play_world(z)) {
            z.ping += delta
        }
    }

    global_trigger.update(delta)
}

function update_trail(t: VampireTrail, delta: number) {
    t.life = appr(t.life, 0, delta)
    if (t.life < 3600) {
        t.life = appr(t.life, 0, delta * 2)
    }
    if (t.life < 2000) {
        t.life = appr(t.life, 0, delta * 2)
    }

    if (t.life === 0) {
        tt.splice(tt.indexOf(t), 1)
    }
}

// @ts-ignore
let _play_world_box: XYWH = [-g.width / 2, -g.height/ 2, g.width * 2, g.height * 2]
function zombie_collided_play_world(z: Zombie) {
    return has_collided_bounds(...zombie_box(z.steer.body.position.xy))
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


    for (let i = 0; i < 3; i++)
        zz.push({
            life: 0,
            ping: 0,
            on_pursuit: false,
            knock_force: [0, 0],
            steer: steer_behaviours(Vec2.make(100, 100), {
                mass: 1,
                damping: 1,
                max_speed: 300,
                max_force: 2000
            }, spawn_zombie_steer()),
        })

}

function xy_target(x: number, y: number) {
    return {
        position: Vec2.make(x, y)
    }
}


function spawn_zombie_steer(): Behavior[] {
    return [
        [b_separation_steer({ get group() { return zz.map(_ => _.steer.body.position) } }), 1],
        [b_wander_steer(rnd_int(250, 500), 500, 100, random), rnd_int(2, 4)],
        [b_wander_steer(rnd_int(250, 500), 500, 100, random), rnd_int(2, 4)],
        [b_wander_steer(80, 500, 100, random), 8]
    ]
}

function pursuit_zombie_steer(): Behavior[] {
    return [
        [b_pursuit_steer(steer_target(cursor.xy), rnd_float(0.0008, 0.005)), rnd_int(1, 3)],
        [b_separation_steer({ get group() { return zz.map(_ => _.steer.body.position) } }), 1],
        [b_wander_steer(rnd_int(250, 500), 500, 100, random), rnd_int(2, 4)],
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

    z.life += delta
    z.ping = appr(z.ping, -10000, delta)

    if (z.ping === -10000) {
        zz.splice(zz.indexOf(z), 1)
    }

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
                cursor.stick = position(...p.cursor, 20, 20)
                cursor.stick_ran_on_down = true
                cursor.t_stick = 600

                let stamina = cursor.stamina
                cursor.stamina = Math.max(0, cursor.stamina - 300)

                cursor.stamina_delta = cursor.stamina - stamina
                cursor.t_stamina_delta = 200


                OTween.add(1000, cursor, { theta: cursor.theta + 1 }, linear)
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
    let [x, y] = pos_xy(xy)

    return [x - xy.w / 2, y - xy.h / 2, xy.w, xy.h]
}

export function _render() {


    g.clear()


    g.begin_shapes()

    render_cursor()
    
    zz.forEach(render_zombie)

    tt.forEach(render_trail_shadow)
    tt.forEach(render_trail)

    render_ui()

    g.end_shapes()
}

function render_trail_shadow(t: VampireTrail) {
    g.shape_line_vary(...drop_shadow(trail_line(t.xy)), t.life/ 1000 * 2, Theme.Shadow)
}

function render_trail(t: VampireTrail) {
    let color = Color.lerp(Theme.HighShadow, Color.red, sine_in(1 - t.life / 5000))
    g.shape_line_vary(...trail_line(t.xy), t.life/ 1000 * 2, color)

    g.shape_arc(...trail_box(t.xy, t.life / 1000 * 3.8), color)
}
function trail_line(xy: XYWH): XYWH {

    return [xy[2], xy[3], xy[0], xy[1]]
}



function trail_box(xy: XYWH, radius: number): XYWH {
    return [xy[2] - radius / 2, xy[3] - radius / 2, radius, radius]
}

function render_ui() {
    g.shape_rect(...stamina_box, Color.black, 0)
    g.shape_rect(...stamina_box2(cursor.stamina), Color.red, 0)
    if (cursor.stamina_delta) {
        g.shape_rect(...stamina_delta_box2(cursor.stamina, cursor.stamina_delta), Color.white, 0)
    }
}

function render_cursor() {
    if (cursor.stick) {
        g.shape_rect(...c_box(cursor.stick), Color.black, cursor.theta)
        g.shape_rect(...c_box(cursor.xy), Color.white, cursor.theta)

        let theta = cursor.theta
        g.shape_rect(...stick_box(cursor.xy), new Color(10, 100, 20, 25), theta)
        draw_lines(cursor_stick_lines(...drop_shadow(stick_box(cursor.xy)), 30, 30, 30, theta), 4, Theme.Shadow)
        draw_lines(cursor_stick_lines(...stick_box(cursor.xy), 30, 30, 30, theta), 4, Color.red)


        g.shape_rect(...stick_box_inner(cursor.xy), new Color(100, 10, 10, 85), theta + Math.PI / 4)
        draw_lines(cursor_stick_lines(...drop_shadow(stick_box_inner(cursor.xy)), 30, 30, 30, theta + Math.PI / 4), 1, Theme.Shadow)
        draw_lines(cursor_stick_lines(...stick_box_inner(cursor.xy), 30, 30, 30, theta + Math.PI / 4), 1.8, Color.white)



    } else {
        g.shape_arc(...c_box(cursor.xy), Color.red, cursor.theta)
    }
}

let dash_offset = 0
function cursor_stick_lines(x: number, y: number, w: number, h: number, dash_length: number, gap_length: number, offset: number, theta: number = 0): XY[] {

    const segments: XY[] = []

    let cx = x + w / 2
    let cy = y + h / 2
  const points = [
    Vec2.rotate_point(x, y, theta, cx, cy),
    Vec2.rotate_point(x + w, y, theta, cx, cy),
    Vec2.rotate_point(x + w, y + h, theta, cx, cy),
    Vec2.rotate_point(x, y + h, theta, cx, cy),
    Vec2.rotate_point(x, y, theta, cx, cy)
  ];

  dash_offset++ 

  for (let i = 0; i < 4; i++) {
    let p1 = points[i]
    let p2 = points[i + 1]
    let edge_len = p1.distance(p2)

    let dash_start = (offset + (dash_offset * 1.6 + i)) % (dash_length + gap_length) - dash_length / 2
    let dash_neg_cut = dash_start < 0 ? 0 : dash_start

    let line = new Line(p1, p2)
    while (dash_start < edge_len) {
        const dash_end = Math.min(dash_start + dash_length, edge_len)
        const start = line.interpolate(dash_neg_cut)
        const end = line.interpolate(dash_end)
        segments.push(start.xy)
        segments.push(end.xy)
        dash_start += dash_length + gap_length
        dash_neg_cut = dash_start
    }
  }

  return segments
}

function draw_lines(l: XY[], thickness: number, color: Color) {
    for (let i = 0; i < l.length - 1; i+=2) {
        let l0 = l[i]
        let l1 = l[i + 1]
        let [x, y] = l0
        let [x2, y2] = l1
        g.shape_line(x, y, x2, y2, thickness, color)
    }
}

function stick_box(xy: Position): XYWH {
    let [x, y] = pos_xy(xy)
    return [x - 100, y - 100, 200, 200]
}

function stick_box_inner(xy: Position): XYWH {
    return Rectangle.make(...stick_box(xy)).smaller(120).xywh
}



function render_zombie(z: Zombie) {


    let color = z.on_pursuit ? Color.white : Color.red
    g.shape_rect(...drop_shadow(zombie_box(z.steer.body.position.xy)), Theme.Shadow, z.steer.body.side.angle)

    g.shape_line_vary(...drop_shadow(zombie_tail(z)), 7, Theme.Shadow)

    g.shape_line_vary(...zombie_tail(z), 7, color)

    g.shape_rect_vary(...zombie_box(z.steer.body.position.xy), color, z.steer.body.side.angle)
    g.shape_rect_vary(...high_shadow2(zombie_box(z.steer.body.position.xy)), Theme.HighShadow, z.steer.body.side.angle)
}

function zombie_tail(z: Zombie): XYWH {
    let p = z.steer.body.position
 
    p = p.sub(z.steer.body.heading.scale(3))
    let p2 = p.sub(z.steer.body.heading.add_angle(Math.sin(z.life * 0.01) * Math.PI * 0.2).scale(12))

    return [...p.xy, ...p2.xy]
}

function zombie_box(xy: XY): XYWH {
    return [xy[0] - 4, xy[1] - 8, 8, 16]
}


function drop_shadow(xywh: XYWH): XYWH {
    return [xywh[0] + 2, xywh[1] + 2, xywh[2], xywh[3]]
}
// @ts-ignore
function high_shadow(xywh: XYWH): XYWH {
    return [xywh[0], xywh[1], xywh[2] / 2, xywh[3] / 2]
}
function high_shadow2(xywh: XYWH): XYWH {
    return [xywh[0] + xywh[2] / 2, xywh[1], xywh[2] / 2, xywh[3] / 2]
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