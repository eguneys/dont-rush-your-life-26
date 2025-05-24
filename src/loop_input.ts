export function Loop(update: (dt: number) => void, render: (alpha: number) => void) {

  const timestep = 1000/60
  let last_time = performance.now()
  let accumulator = 0

  function step(current_time: number) {
    requestAnimationFrame(step)


    let delta_time = Math.min(current_time - last_time, 1000)
    last_time = current_time

    accumulator += delta_time

    while (accumulator >= timestep) {
      update(timestep)
      accumulator -= timestep
    }

    render(accumulator / timestep)
  }
  requestAnimationFrame(step)
}


type XY = [number, number]
export type PointerMouse = {
  on_up(): void
  on_down(): void
  on_lock(): void
  on_move(n: XY): void
  on_unlock(): void
}

export function PointerMouse($element: HTMLCanvasElement, hooks: PointerMouse) {


  const onPointerLock = () => hooks.on_lock()

  const onPointerUnlock = () => hooks.on_unlock()



  const onClick = () => {}
  const onDown = () => hooks.on_down()
  const onUp = () => hooks.on_up()
  const onMove = (e: MouseEvent) => hooks.on_move([e.movementX, e.movementY])

  const test_pointer_lock = (on_pointer_lock: () => void, on_no_lock?: () => void) => {
    return () => {
      if (document.pointerLockElement === $element) {
        on_pointer_lock()
      } else {
        on_no_lock?.()
      }
    }
  }


  const _fn_pointer_lock_change = test_pointer_lock(() => {
    onPointerLock()
    document.addEventListener('mousemove', onMove, false)
  }, () => {
    onPointerUnlock()
    document.removeEventListener('mousemove', onMove, false)
    just_exited = true
    setTimeout(() => {
      just_exited = false
    }, 1600)
  })

  let just_exited = false
  document.addEventListener('pointerlockchange', _fn_pointer_lock_change)

  const _fn_click = test_pointer_lock(onClick, () => {
    if (!just_exited) {
      $element.requestPointerLock()
    }
  })

  $element.addEventListener('click', _fn_click)

  const _fn_mouse_down = test_pointer_lock(onDown)
  const _fn_mouse_up = test_pointer_lock(onUp)

  $element.addEventListener('mousedown', _fn_mouse_down)
  $element.addEventListener('mouseup', _fn_mouse_up)


  return () => {
    document.removeEventListener('pointerlockchange', _fn_pointer_lock_change)

    $element.removeEventListener('click', _fn_click)

    $element.removeEventListener('mousedown', _fn_mouse_down)
    $element.removeEventListener('mouseup', _fn_mouse_up)
  }
}