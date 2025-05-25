import { Easing } from "../math/ease"
import { rnd_float } from "../random"
import { lerp } from "../util"

interface TriggerUpdate {
    timer: number
    _update: (t: number) => boolean
    action?: () => void
    after?:() => void
}

const gen_tag = (() => {
    let t = 0

    return () => {
        return `auto_tag_${t++}`
    }
})()

export class Run implements TriggerUpdate {

    timer = 0

    /**
     * Calls the action every frame until it's cancelled via trigger.cancel
     * 
     * The tag must be passed otherwise there will be no way to stop this from running.
     * 
     * If after is passed in then it is called after the run is cancelled
     */
    static add = (action: () => void, after?: () => void, tag = gen_tag(), t = global_trigger): void => {
        t.add(tag, new Run(action, after))
    }

    constructor(readonly action: () => void, readonly after?: () => void) {}

    _update(): boolean {
        this.action()
        return false
    }
}

type Delay = number | [number, number]


function resolve_delay(delay: Delay) {
    if (typeof delay === 'number') {
        return delay
    } else {
        return rnd_float(delay[0], delay[1])
    }
}

export class After implements TriggerUpdate {

    timer = 0

    /**
     * Calls the action after delay seconds.
     * If tag is passed in then any other trigger actiosn with the same tag are automatically cancelled.
     */
    static add = (delay: Delay, action: () => void, tag = gen_tag(), t = global_trigger): void => {
        t.add(tag, new After(delay, action))
    }


    delay: number

    constructor(readonly unresolved_delay: Delay, readonly action: () => void) {
        this.delay = resolve_delay(unresolved_delay)
    }

    _update() {
        if (this.timer > this.delay) {
            this.action()
            return true
        }
        return false
    }
}


export class ConditionalAfter implements TriggerUpdate {

    timer = 0

    /**
     * Calls the action after the condition is true
     */
    static add = (delay: () => boolean, action: () => void, tag = gen_tag(), t = global_trigger): void => {
        t.add(tag, new ConditionalAfter(delay, action))
    }

    constructor(readonly delay: () => boolean, readonly action: () => void) {}

    _update(): boolean {
        if (this.delay()) {
            this.action()
            return true
        }
        return false
    }
}

export class Cooldown implements TriggerUpdate {

    timer = 0

    /**
     * Calls the action every delay seconds if the condition is true
     * If the condition isn't true, no action is taken
     * If times is passed then it only calls action for that amount of times.
     * If after is passed in then it is called after the last time action is called (or with times passed, after the number of times has passed.)
     * If multiplier is passed delay is scaled by multiplier
     */
    static add = (delay: Delay, condition: () => boolean, action: () => void, after?: () => void, times = 0, multiplier = 1, tag = gen_tag(), t = global_trigger): void => {
        t.add(tag, new Cooldown(delay, condition, action, after, times, multiplier))
    }

    delay: number

    constructor(readonly unresolved_delay: Delay, readonly condition: () => boolean, readonly action: () => void, readonly after?: () => void, public times = 0, public multiplier = 1) {
        this.delay = resolve_delay(unresolved_delay)
    }

    _update(): boolean {
        if (this.timer > this.delay * this.multiplier && this.condition()) {
            this.action()
            this.timer = 0
            this.delay = resolve_delay(this.unresolved_delay)
            if (this.times > 0) {
                this.times = this.times - 1
                if (this.times <= 0) {
                    return true
                }
            }
        }
        return false
    }
}


export class Every implements TriggerUpdate {

    timer = 0

    /**
     * Calls the action every delay seconds
     */
    static add = (delay: Delay, action: () => void, after?: () => void, times = 0, multiplier = 1, tag = gen_tag(), t = global_trigger): void => {
        t.add(tag, new Every(delay, action, after, times, multiplier))
    }

    /**
     * Calls the action every delay seconds and immediately inside this function
     */
    static add_immediate = (delay: Delay, action: () => void, after?: () => void, times = 0, multiplier = 1, tag = gen_tag(), t = global_trigger): void => {
        t.add(tag, new Every(delay, action, after, times, multiplier))
        action()
    }



    delay: number

    constructor(readonly unresolved_delay: Delay, readonly action: () => void, readonly after?: () => void, public times = 0, public multiplier = 1) {
        this.delay = resolve_delay(unresolved_delay)
    }

    _update(): boolean {
        if (this.timer > this.delay * this.multiplier) {
            this.action()
            this.timer = this.timer - this.delay * this.multiplier
            this.delay = resolve_delay(this.unresolved_delay)
            if (this.times > 0) {
                this.times = this.times - 1
                if (this.times  <= 0) {
                    return true
                }
            }
        }
        return false
    }
}



export class ConditionalEvery implements TriggerUpdate {

    timer = 0

    /**
     * Calls the action once every time the condition becomes true
     */
    static add = (condition: () => boolean, action: () => void, after?: () => void, times = 0, multiplier = 1, tag = gen_tag(), t = global_trigger): void => {
        t.add(tag, new ConditionalEvery(condition, action, after, times, multiplier))
    }

    last_condition = false

    constructor(readonly condition: () => boolean, readonly action: () => void, readonly after?: () => void, public times = 0, public multiplier = 1) {}

    _update(): boolean {
        let condition = this.condition()
        if (condition && !this.last_condition) {
            this.action()

            if (this.times > 0) {
                this.times = this.times - 1
                if (this.times <= 0) {
                    return true
                }
            }
        }
        this.last_condition = condition
        return false
    }
}



export class During implements TriggerUpdate {

    timer = 0

    /**
     * Calls the action every frame for delay seconds
     */
    static add = (delay: Delay, action: () => void, after?: () => void, tag = gen_tag(), t = global_trigger): void => {
        t.add(tag, new During(delay, action, after))
    }

    delay: number

    constructor(readonly unresolved_delay: Delay, readonly action: () => void, readonly after?: () => void) {
        this.delay = resolve_delay(unresolved_delay)
    }

    _update(): boolean {
        this.action()
        if (this.timer > this.delay) {
            return true
        }
        return false
    }
}



export class ConditionalDuring implements TriggerUpdate {

    timer = 0

    /**
     * Calls the action every frame while the condition is true
     * When after is passed it is called after the condition becomes false.
     */
    static add = (condition: () => boolean, action: () => void, after?: () => void, tag = gen_tag(), t = global_trigger): void => {
        t.add(tag, new ConditionalDuring(condition, action, after))
    }

    last_condition = false

    constructor(readonly condition: () => boolean, readonly action: () => void, readonly after?: () => void, public times = 0, public multiplier = 1) {}

    _update(): boolean {
        let condition = this.condition()
        if (condition) {
            this.action()
        }
        if (this.last_condition && !condition) {
            this.after?.()
        }
        this.last_condition = condition
        return false
    }
}

export class OTween implements TriggerUpdate {

    timer = 0

    /**
     * Tweens the source values to specified target values for delay seconds
     * after is called after the duration ends.
     */
    static add = (delay: Delay, source: Record<string, number>, target: Record<string, number>, easing: Easing, after?: () => void, tag = gen_tag(), t = global_trigger): void => {
        t.add(tag, new OTween(delay, source, target, easing, after))
    }


    delay: number
    initial_values: Record<string, number>

    constructor(readonly unresolved_delay: Delay, readonly source: Record<string, number>, readonly target: Record<string, number>, readonly easing: Easing, readonly after?: () => void) {
        this.initial_values = {}
        for (let key of Object.keys(target)) {
            this.initial_values[key] = this.source[key]
        }
        this.delay = resolve_delay(unresolved_delay)
    }

    _update(): boolean {
        let t = this.easing(this.timer / this.delay)
        for (let key of Object.keys(this.target)) {
            this.source[key] = lerp(this.initial_values[key], this.target[key], t)
        }
        if (this.timer > this.delay) {
            return true
        }
        return false
    }
}

export class Tween implements TriggerUpdate {

    timer = 0

    /**
     * Tweens the source values to specified target values for delay seconds
     * after is called after the duration ends.
     */
    static add = (delay: Delay, source: number[], target: number[], easing: Easing, after?: () => void, tag = gen_tag(), t = global_trigger): void => {
        t.add(tag, new Tween(delay, source, target, easing, after))
    }


    delay: number
    initial_values: number[]

    constructor(readonly unresolved_delay: Delay, readonly source: number[], readonly target: number[], readonly easing: Easing, readonly after?: () => void) {
        this.initial_values = []
        for (let i = 0; i < this.target.length; i++) {
            this.initial_values[i] = this.source[i]
        }
        this.delay = resolve_delay(unresolved_delay)
    }

    _update(): boolean {
        let t = this.easing(this.timer / this.delay)
        for (let i = 0; i < this.target.length; i++) {
            this.source[i] = lerp(this.initial_values[i], this.target[i], t)
        }
        if (this.timer > this.delay) {
            return true
        }
        return false
    }
}





export class Trigger {

    triggers: Map<string, TriggerUpdate> = new Map()
    t = 0

    update(delta: number) {
        this.t += delta

        this.triggers.forEach((_, key) => {
            _.timer += delta
            if (_._update(this.t)) {
                _.after?.()
                this.triggers.delete(key)
            }
        })
    }
    
    add(tag: string, t: TriggerUpdate) {
        if (this.triggers.has(tag)) {
            this.triggers.get(tag)!.after?.()
            this.triggers.delete(tag)
        }
        this.triggers.set(tag, t)
    }


    cancel(tag: string) {
        this.triggers.get(tag)!.after?.()
        this.triggers.delete(tag)
    }

    reset(tag: string) {
        this.triggers.get(tag)!.timer = 0
    }

    set_multiplier(tag: string, multiplier: number) {
        let res = this.triggers.get(tag)
        if (res) {
            (res as any).multiplier = multiplier
        }
    }
}


export const global_trigger = new Trigger()