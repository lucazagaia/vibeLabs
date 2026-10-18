'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * World Radar Map
 *
 * A borderless dot-matrix world (coastlines only, no country lines) drawn on a
 * canvas, with small radar-style container ships drifting along real shipping
 * lanes: Suez, Panama, Malacca, the Cape, the North Pacific. Each ship leaves a
 * fading trace of the water it has crossed, and a slow radar sweep brightens
 * every contact it passes. Fully procedural: no tiles, no images, and no
 * dependencies beyond React.
 *
 * Fills its box: give it a height (default 100vh). Anything passed as children
 * is layered over the map, centred on the radar, e.g. a call to action.
 *
 * Land data: Natural Earth (public domain), baked into LAND_MASK at the bottom
 * of this file at 0.5° per cell by scripts/generate-land-mask.mjs.
 */

export type WorldRadarMapProps = {
  /** Height of the map box, e.g. 720 or '100vh'. Default '100vh'. */
  height?: number | string
  className?: string
  /** Ships at sea. Default 30. */
  ships?: number
  /** Speed multiplier. 1 is a slow drift. */
  speed?: number
  /** Radar colour, as a hex string. Default '#5cf2c6'. */
  accent?: string
  /** The rotating radar sweep. Default true. */
  sweep?: boolean
  /** Longitude in the middle of the frame (the map wraps around). Default 10. */
  centerLon?: number
  /** Content layered over the map. */
  children?: ReactNode
  /** The first frame is drawn. */
  onReady?: () => void
}

export default function WorldRadarMap({
  height = '100vh',
  className,
  ships = 30,
  speed = 1,
  accent = '#5cf2c6',
  sweep = true,
  centerLon = 10,
  children,
  onReady,
}: WorldRadarMapProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readyRef = useRef(onReady)
  useEffect(() => {
    readyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    return startRadar(root, canvas, {
      ships,
      speed,
      accent,
      sweep,
      centerLon,
      onReady: () => readyRef.current?.(),
    })
  }, [ships, speed, accent, sweep, centerLon])

  return (
    <div
      ref={rootRef}
      className={['relative w-full overflow-hidden', className].filter(Boolean).join(' ')}
      style={{
        height,
        background: 'radial-gradient(120% 90% at 50% 45%, #0a1418 0%, #060a0d 55%, #030506 100%)',
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="World map with container ships moving slowly along global shipping lanes, shown as radar contacts."
        className="absolute inset-0 block size-full"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(3,5,6,0.35) 75%, rgba(3,5,6,0.85) 100%)',
        }}
      />
      {children ? <div className="absolute inset-0">{children}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

type LonLat = [number, number]
type Route = { name: string; path: LonLat[] }

/** A route smoothed and measured in map units (Miller projection, in degrees). */
type Lane = {
  name: string
  xs: Float32Array
  ys: Float32Array
  len: Float32Array
  count: number
  length: number
}

type Ship = {
  lane: Lane
  d: number
  dir: 1 | -1
  v: number
  trail: number
  fade: number
  dock: number
}

type Port = { x: number; y: number; phase: number }

type RadarOptions = {
  ships: number
  speed: number
  accent: string
  sweep: boolean
  centerLon: number
  onReady: () => void
}

const TAU = Math.PI * 2
const RAD = Math.PI / 180
const MASK_CELL = 0.5
const MASK_NORTH = 84
const MASK_SOUTH = -60
const MASK_COLS = 720
const MASK_ROWS = 288
const VIEW_NORTH = 80
const VIEW_SOUTH = -57
const TRAIL = 42 // map units of trace behind a ship
const SWEEP_PERIOD = 12 // seconds per radar revolution
const SWEEP_WEDGE = 1.15 // radians of afterglow behind the beam
const FRAME_MS = 1000 / 30
const LAND_RGB = '150, 186, 192'

// Miller cylindrical projection, in degrees so map units read like longitude.
const projectY = (lat: number) => (1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * RAD))) / RAD
const unprojectY = (y: number) => (2.5 * Math.atan(Math.exp(0.8 * y * RAD)) - 0.625 * Math.PI) / RAD
const wrap180 = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const MAP_TOP = projectY(VIEW_NORTH)
const MAP_BOTTOM = projectY(VIEW_SOUTH)

function startRadar(root: HTMLElement, canvas: HTMLCanvasElement, o: RadarOptions): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const mask = getMask()
  const lanes = getLanes()
  const [ar, ag, ab] = hexToRgb(o.accent)
  const accent = `rgb(${ar}, ${ag}, ${ab})`
  const hull = `rgb(${(ar + 255) >> 1}, ${(ag + 255) >> 1}, ${(ab + 255) >> 1})`
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  const canSweep = o.sweep && !reduceMotion && typeof ctx.createConicGradient === 'function'

  const base = document.createElement('canvas')
  const bctx = base.getContext('2d')!
  const glow = glowSprite(ar, ag, ab)

  // Ports sit at the ends of the lanes; lanes that share a port share one marker.
  const ports: Port[] = []
  for (const lane of lanes)
    for (const i of [0, lane.count - 1]) {
      const x = lane.xs[i]
      const y = lane.ys[i]
      if (!ports.some((p) => Math.abs(wrap180(p.x - x)) < 1.5 && Math.abs(p.y - y) < 1.5))
        ports.push({ x, y, phase: Math.random() })
    }

  // Ships spread over the lanes by length, already under way when the page opens.
  const total = lanes.reduce((sum, l) => sum + l.length, 0)
  const fleet: Ship[] = []
  for (let i = 0; i < o.ships; i++) {
    let pick = Math.random() * total
    const lane = lanes.find((l) => (pick -= l.length) <= 0) ?? lanes[lanes.length - 1]
    const d = Math.random() * lane.length
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
    fleet.push({
      lane,
      d,
      dir,
      v: 0.55 + Math.random() * 0.45,
      trail: Math.min(TRAIL, dir > 0 ? d : lane.length - d),
      fade: 1,
      dock: 0,
    })
  }

  let w = 0
  let h = 0
  let dpr = 1
  let scale = 1
  let cx = 0
  let cy = 0
  let midY = 0
  let time = Math.random() * SWEEP_PERIOD
  let visible = true
  let ready = false
  const sx = (x: number) => cx + wrap180(x - o.centerLon) * scale
  const sy = (y: number) => cy - (y - midY) * scale

  function isLand(px: number, py: number) {
    const lat = unprojectY(midY - (py - cy) / scale)
    if (lat >= MASK_NORTH || lat <= MASK_SOUTH) return false
    const lon = wrap180(o.centerLon + (px - cx) / scale)
    const row = Math.floor((MASK_NORTH - lat) / MASK_CELL)
    const col = Math.min(MASK_COLS - 1, Math.floor((lon + 180) / MASK_CELL))
    return mask[row * MASK_COLS + col] === 1
  }

  function layout() {
    const nw = root.clientWidth
    const nh = root.clientHeight
    if (!nw || !nh) return false
    w = nw
    h = nh
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    // Fit the whole world across wide screens; on tall screens fill more height and crop the sides.
    const fill = w / h < 1 ? 0.5 : 0.8
    scale = Math.max(w / 360, (h * fill) / (MAP_TOP - MAP_BOTTOM))
    cx = w / 2
    cy = h / 2
    midY = (MAP_TOP + MAP_BOTTOM) / 2
    paintBase()
    return true
  }

  // Static layer: land dots, the faint lanes and the ports. Repainted only on resize.
  function paintBase() {
    base.width = canvas.width
    base.height = canvas.height
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    bctx.clearRect(0, 0, w, h)

    const gap = clamp(scale * 1.1, 4.5, 9)
    const r = clamp(gap * 0.19, 0.75, 1.5)
    const top = sy(MAP_TOP)
    const bottom = sy(MAP_BOTTOM)
    const levels = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]
    const alphas = [0.16, 0.22, 0.3, 0.52]
    const x0 = cx - Math.floor(cx / gap) * gap
    for (let y = cy - Math.floor((cy - top) / gap) * gap; y <= bottom; y += gap) {
      for (let x = x0; x <= w; x += gap) {
        if (!isLand(x, y)) continue
        const coast =
          !isLand(x - gap, y) || !isLand(x + gap, y) || !isLand(x, y - gap) || !isLand(x, y + gap)
        const level = coast ? 3 : Math.floor(hash(Math.round(x / gap), Math.round(y / gap)) * 3)
        levels[level].moveTo(x + r, y)
        levels[level].arc(x, y, r, 0, TAU)
      }
    }
    bctx.fillStyle = `rgb(${LAND_RGB})`
    levels.forEach((path, i) => {
      bctx.globalAlpha = alphas[i]
      bctx.fill(path)
    })

    bctx.globalAlpha = 0.1
    bctx.strokeStyle = accent
    bctx.lineWidth = 1
    bctx.setLineDash([2, 5])
    for (const lane of lanes) {
      bctx.beginPath()
      let px = sx(lane.xs[0])
      bctx.moveTo(px, sy(lane.ys[0]))
      for (let i = 1; i < lane.count; i++) {
        const x = sx(lane.xs[i])
        const y = sy(lane.ys[i])
        if (Math.abs(x - px) > 180 * scale) bctx.moveTo(x, y)
        else bctx.lineTo(x, y)
        px = x
      }
      bctx.stroke()
    }
    bctx.setLineDash([])

    for (const port of ports) {
      const x = sx(port.x)
      const y = sy(port.y)
      bctx.globalAlpha = 0.55
      bctx.fillStyle = accent
      bctx.beginPath()
      bctx.arc(x, y, 1.6, 0, TAU)
      bctx.fill()
      bctx.globalAlpha = 0.2
      bctx.beginPath()
      bctx.arc(x, y, 4, 0, TAU)
      bctx.stroke()
    }
    bctx.globalAlpha = 1
  }

  function step(dt: number) {
    for (const ship of fleet) {
      if (ship.dock > 0) {
        // In port: the old trace fades out, then the ship turns round for the return leg.
        ship.dock -= dt
        ship.fade = Math.max(0, ship.fade - dt / 2.5)
        if (ship.dock <= 0) {
          ship.dir = ship.dir > 0 ? -1 : 1
          ship.trail = 0
          ship.fade = 1
        }
        continue
      }
      const move = ship.v * o.speed * dt
      ship.d += move * ship.dir
      ship.trail = Math.min(TRAIL, ship.trail + move)
      if (ship.d <= 0 || ship.d >= ship.lane.length) {
        ship.d = clamp(ship.d, 0, ship.lane.length)
        ship.dock = 3 + Math.random() * 4
      }
    }
  }

  const tx = new Float32Array(4096)
  const ty = new Float32Array(4096)
  const tf = new Float32Array(4096)
  const at = { x: 0, y: 0, i: 0, dx: 1, dy: 0 }

  // Screen points of the trace behind a ship, tail first, with 0..1 progress towards the bow.
  function trace(ship: Ship) {
    const { lane, d: head, dir } = ship
    const tail = clamp(head - dir * ship.trail, 0, lane.length)
    const span = Math.abs(head - tail)
    if (span < 0.05) return 0
    let n = 0
    const push = (x: number, y: number, f: number) => {
      if (n >= tx.length) return
      tx[n] = sx(x)
      ty[n] = sy(y)
      tf[n] = f
      n++
    }
    sample(lane, tail, at)
    push(at.x, at.y, 0)
    if (dir > 0) {
      for (let i = at.i + 1; i < lane.count && lane.len[i] < head; i++)
        push(lane.xs[i], lane.ys[i], (lane.len[i] - tail) / span)
    } else {
      let i = lane.len[at.i] >= tail ? at.i - 1 : at.i
      for (; i >= 0 && lane.len[i] > head; i--) push(lane.xs[i], lane.ys[i], (tail - lane.len[i]) / span)
    }
    sample(lane, head, at)
    push(at.x, at.y, 1)
    return n
  }

  function render() {
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx!.globalCompositeOperation = 'source-over'
    ctx!.globalAlpha = 1
    ctx!.clearRect(0, 0, w, h)
    ctx!.drawImage(base, 0, 0, w, h)
    const c = ctx!
    const theta = ((time / SWEEP_PERIOD) * TAU) % TAU
    const reach = Math.hypot(w, h) / 2

    if (canSweep) {
      const g = c.createConicGradient(theta - SWEEP_WEDGE, cx, cy)
      const wedge = SWEEP_WEDGE / TAU
      g.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, 0)`)
      g.addColorStop(wedge * 0.6, `rgba(${ar}, ${ag}, ${ab}, 0.018)`)
      g.addColorStop(wedge * 0.995, `rgba(${ar}, ${ag}, ${ab}, 0.085)`)
      g.addColorStop(wedge, `rgba(${ar}, ${ag}, ${ab}, 0)`)
      g.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0)`)
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
      const ex = cx + Math.cos(theta) * reach
      const ey = cy + Math.sin(theta) * reach
      const line = c.createLinearGradient(cx, cy, ex, ey)
      line.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, 0.28)`)
      line.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0.02)`)
      c.strokeStyle = line
      c.lineWidth = 1
      c.beginPath()
      c.moveTo(cx, cy)
      c.lineTo(ex, ey)
      c.stroke()
    }

    c.globalCompositeOperation = 'lighter'

    // Ports ping slowly, each on its own beat.
    c.strokeStyle = accent
    c.lineWidth = 1
    for (const port of ports) {
      const p = (time / 7 + port.phase) % 1
      c.globalAlpha = 0.3 * (1 - p) * (1 - p)
      c.beginPath()
      c.arc(sx(port.x), sy(port.y), 3 + p * 16, 0, TAU)
      c.stroke()
    }

    for (const ship of fleet) {
      sample(ship.lane, ship.d, at)
      const hx = sx(at.x)
      const hy = sy(at.y)
      // How recently the beam passed this contact: radar afterglow.
      const lit = canSweep
        ? Math.exp(-((((theta - Math.atan2(hy - cy, hx - cx)) % TAU) + TAU) % TAU) / 1.3)
        : 0.35

      // The trace: a line that fades towards the stern, plus plotted past positions.
      const n = trace(ship)
      if (n > 1 && ship.fade > 0) {
        const strength = (0.5 + 0.3 * lit) * ship.fade
        const buckets = 8
        let bucket = -1
        c.strokeStyle = accent
        c.lineWidth = 1.2
        c.lineCap = 'round'
        for (let i = 1; i < n; i++) {
          const b = Math.min(buckets - 1, Math.floor(tf[i] * buckets))
          if (b !== bucket) {
            if (bucket >= 0) c.stroke()
            bucket = b
            c.globalAlpha = strength * Math.pow((b + 1) / buckets, 1.8)
            c.beginPath()
            c.moveTo(tx[i - 1], ty[i - 1])
          }
          if (Math.abs(tx[i] - tx[i - 1]) > 180 * scale) c.moveTo(tx[i], ty[i])
          else c.lineTo(tx[i], ty[i])
        }
        c.stroke()

        c.fillStyle = accent
        for (let back = 5; back < ship.trail; back += 5) {
          const dd = ship.d - ship.dir * back
          if (dd < 0 || dd > ship.lane.length) break
          sample(ship.lane, dd, at)
          c.globalAlpha = 0.55 * strength * (1 - back / TRAIL)
          c.fillRect(sx(at.x) - 0.75, sy(at.y) - 0.75, 1.5, 1.5)
        }
        sample(ship.lane, ship.d, at)
      }

      // Halo, a tiny hull pointing along the heading, and a short course vector.
      const size = 9 + 7 * lit
      c.globalAlpha = 0.18 + 0.5 * lit
      c.drawImage(glow, hx - size, hy - size, size * 2, size * 2)

      const heading = Math.atan2(-at.dy, at.dx) + (ship.dir < 0 ? Math.PI : 0)
      const cos = Math.cos(heading)
      const sin = Math.sin(heading)
      c.globalAlpha = 0.25 + 0.35 * lit
      c.strokeStyle = accent
      c.lineWidth = 1
      c.beginPath()
      c.moveTo(hx + cos * 6, hy + sin * 6)
      c.lineTo(hx + cos * 16, hy + sin * 16)
      c.stroke()

      c.globalAlpha = 0.7 + 0.3 * lit
      c.fillStyle = hull
      c.beginPath()
      const hullShape: [number, number][] = [
        [4.6, 0],
        [2, -1.7],
        [-3.6, -1.7],
        [-3.6, 1.7],
        [2, 1.7],
      ]
      hullShape.forEach(([u, v], i) => {
        const x = hx + u * cos - v * sin
        const y = hy + u * sin + v * cos
        if (i) c.lineTo(x, y)
        else c.moveTo(x, y)
      })
      c.closePath()
      c.fill()
    }

    c.globalCompositeOperation = 'source-over'
    c.globalAlpha = 1
    if (!ready) {
      ready = true
      o.onReady()
    }
  }

  let raf = 0
  let last = performance.now()
  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    // The ships drift slowly, so ~30 fps looks the same as 60 at half the work:
    // on a 60 Hz screen this draws every other frame, on a 30 Hz one every frame.
    if (now - last < FRAME_MS * 0.6) return
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    if (!visible || !w) return
    time += dt
    step(dt)
    render()
  }

  const resize = () => {
    if (layout()) render()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(root)
  const seen = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting && !document.hidden
    last = performance.now()
  })
  seen.observe(root)
  const onVisibility = () => {
    visible = !document.hidden
    last = performance.now()
  }
  document.addEventListener('visibilitychange', onVisibility)

  resize()
  // Reduced motion: a still frame, redrawn only when the box changes size.
  if (!reduceMotion) raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    observer.disconnect()
    seen.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

/** Position, segment index and direction of a lane at distance d. */
function sample(lane: Lane, d: number, out: { x: number; y: number; i: number; dx: number; dy: number }) {
  let lo = 0
  let hi = lane.count - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (lane.len[mid] <= d) lo = mid
    else hi = mid
  }
  const seg = lane.len[hi] - lane.len[lo] || 1
  const u = clamp((d - lane.len[lo]) / seg, 0, 1)
  out.dx = lane.xs[hi] - lane.xs[lo]
  out.dy = lane.ys[hi] - lane.ys[lo]
  out.x = lane.xs[lo] + out.dx * u
  out.y = lane.ys[lo] + out.dy * u
  out.i = lo
  return out
}

function glowSprite(r: number, g: number, b: number) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')!
  const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`)
  grad.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, 0.35)`)
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  x.fillStyle = grad
  x.fillRect(0, 0, 64, 64)
  return c
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.replace(/./g, (ch) => ch + ch)
  const n = parseInt(h, 16)
  if (h.length !== 6 || Number.isNaN(n)) return [92, 242, 198]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

let maskCache: Uint8Array | null = null
function getMask() {
  if (maskCache) return maskCache
  const mask = new Uint8Array(MASK_COLS * MASK_ROWS)
  let i = 0
  for (let row = 0; row < MASK_ROWS; row++) {
    let col = 0
    let land = 0
    while (col < MASK_COLS) {
      const run = parseInt(LAND_MASK.slice(i, i + 2), 36)
      i += 2
      if (land) mask.fill(1, row * MASK_COLS + col, row * MASK_COLS + col + run)
      col += run
      land ^= 1
    }
    if (!land) i += 2 // a row that ends on land carries a closing empty sea run
  }
  return (maskCache = mask)
}

let laneCache: Lane[] | null = null
function getLanes() {
  return (laneCache ??= ROUTES.map(buildLane))
}

function buildLane(route: Route): Lane {
  // Unwrap longitudes so a lane can cross the antimeridian, then project.
  const pts: [number, number][] = []
  let prev = route.path[0][0]
  for (const [lon0, lat] of route.path) {
    let lon = lon0
    while (lon - prev > 180) lon -= 360
    while (lon - prev < -180) lon += 360
    prev = lon
    pts.push([lon, projectY(lat)])
  }
  const smooth = centripetal(pts, 0.5)
  const count = smooth.length
  const xs = new Float32Array(count)
  const ys = new Float32Array(count)
  const len = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    xs[i] = smooth[i][0]
    ys[i] = smooth[i][1]
    if (i) len[i] = len[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1])
  }
  return { name: route.name, xs, ys, len, count, length: len[count - 1] }
}

/** Centripetal Catmull-Rom through the waypoints: smooth, with no overshoot into the coast. */
function centripetal(p: [number, number][], step: number): [number, number][] {
  const n = p.length
  const ext = [
    [2 * p[0][0] - p[1][0], 2 * p[0][1] - p[1][1]],
    ...p,
    [2 * p[n - 1][0] - p[n - 2][0], 2 * p[n - 1][1] - p[n - 2][1]],
  ]
  const lerp = (a: number[], b: number[], ta: number, tb: number, t: number) => {
    const u = (t - ta) / (tb - ta)
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
  }
  const knot = (a: number[], b: number[]) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])))
  const out: [number, number][] = [[p[0][0], p[0][1]]]
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]]
    const t1 = knot(p0, p1)
    const t2 = t1 + knot(p1, p2)
    const t3 = t2 + knot(p2, p3)
    const steps = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let s = 1; s <= steps; s++) {
      const t = t1 + (t2 - t1) * (s / steps)
      const a1 = lerp(p0, p1, 0, t1, t)
      const a2 = lerp(p1, p2, t1, t2, t)
      const a3 = lerp(p2, p3, t2, t3, t)
      const b1 = lerp(a1, a2, 0, t2, t)
      const b2 = lerp(a2, a3, t1, t3, t)
      const c = lerp(b1, b2, t1, t2, t)
      out.push([c[0], c[1]])
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Shipping lanes, as [longitude, latitude] waypoints. Ships sail them end to
// end and back. scripts/check-routes.mjs checks that they stay at sea.
// ---------------------------------------------------------------------------

/* routes:start */
const MALACCA: LonLat[] = [
  [104.3, 1.25], [103.3, 1.25], [102.7, 1.6], [101.9, 2.15], [100.9, 2.7], [100.2, 3.3], [99.5, 3.9],
  [99.0, 4.5], [98.4, 5.3], [97.0, 5.9], [95.0, 6.4],
]
const CHANNEL: LonLat[] = [
  [3.9, 51.98], [2.6, 51.45], [1.5, 50.95], [0.5, 50.35], [-2.0, 50.0], [-4.5, 49.4],
]
const WEST_EUROPE: LonLat[] = [...CHANNEL, [-6.0, 48.4], [-9.6, 43.8], [-10.2, 38.7]]
const CANARIES: LonLat[] = [[-12.5, 33.5], [-15.0, 30.5], [-18.8, 29.2], [-19.2, 27.0]]
const LUZON: LonLat[] = [[114.3, 22.0], [118.5, 21.2], [121.3, 21.4]]
const GULF_OF_PANAMA: LonLat[] = [[-79.55, 8.85], [-79.55, 8.3], [-79.8, 7.2]]

const ROUTES: Route[] = [
  {
    name: 'Shanghai – Rotterdam via Suez',
    path: [
      [122.6, 30.6], [122.2, 28.0], [121.0, 26.4], [120.2, 25.0], [119.2, 23.8], [117.5, 22.5],
      [115.0, 21.6], [113.0, 19.6], [111.6, 16.6], [110.4, 12.0], [108.0, 7.5], [105.8, 4.0],
      [104.6, 1.6], ...MALACCA, [88.0, 6.0], [81.5, 5.4], [76.0, 7.0], [73.0, 7.7], [65.0, 10.5],
      [55.0, 13.4], [51.5, 13.0], [48.0, 12.6], [45.3, 12.2], [43.8, 12.2], [43.25, 12.75],
      [42.75, 13.25], [42.2, 14.0], [41.8, 15.0], [40.8, 16.8], [38.8, 20.0], [37.0, 23.0], [35.0, 26.5], [33.9, 27.6], [33.3, 28.5],
      [32.8, 29.3], [32.55, 29.95], [32.35, 30.6], [32.32, 31.3], [31.5, 32.0], [28.0, 33.2],
      [24.5, 34.2], [20.0, 35.4], [16.0, 35.9], [14.0, 36.6], [12.0, 37.3], [10.5, 37.75],
      [8.0, 37.9], [5.0, 37.6], [1.0, 37.2], [-2.0, 36.0], [-4.5, 35.95], [-5.6, 35.95],
      [-6.4, 35.95], [-9.4, 36.7], ...[...WEST_EUROPE].reverse(),
    ],
  },
  {
    name: 'Shanghai – Los Angeles',
    path: [
      [122.6, 30.6], [125.5, 30.4], [129.0, 30.0], [131.8, 30.4], [135.5, 32.7], [138.5, 33.3],
      [142.0, 34.6], [146.0, 36.6], [155.0, 41.0], [165.0, 44.8], [175.0, 47.0], [-175.0, 47.8],
      [-160.0, 47.2], [-145.0, 44.5], [-132.0, 39.5], [-124.0, 35.0], [-121.0, 33.9],
      [-119.5, 33.65], [-118.25, 33.7],
    ],
  },
  {
    name: 'Tokyo – Vancouver',
    path: [
      [139.75, 35.1], [139.9, 34.75], [141.0, 34.8], [144.0, 36.4], [150.0, 40.5], [160.0, 45.0],
      [170.0, 48.5], [180.0, 50.2], [-170.0, 50.9], [-160.0, 51.0], [-145.0, 50.0], [-134.0, 49.0],
      [-127.5, 48.4], [-125.2, 48.4],
    ],
  },
  {
    name: 'Rotterdam – New York',
    path: [
      ...CHANNEL, [-6.5, 49.2], [-12.0, 48.5], [-25.0, 46.5], [-40.0, 44.0], [-50.0, 42.5],
      [-60.0, 41.5], [-66.0, 41.0], [-70.0, 40.5], [-72.5, 40.35], [-73.8, 40.42],
    ],
  },
  {
    name: 'Colón – New York',
    path: [
      [-79.9, 9.45], [-79.5, 11.0], [-76.5, 15.0], [-75.2, 17.6], [-74.2, 19.4], [-73.9, 20.1],
      [-74.2, 21.0], [-74.55, 22.55], [-74.1, 24.2], [-73.2, 27.0], [-73.5, 32.0], [-74.4, 35.5],
      [-73.6, 38.5], [-73.8, 40.42],
    ],
  },
  {
    name: 'Houston – Colón',
    path: [
      [-94.7, 29.25], [-93.0, 27.5], [-89.5, 24.5], [-86.0, 21.7], [-85.4, 20.0], [-83.0, 15.8],
      [-81.2, 12.6], [-80.0, 10.2], [-79.9, 9.45],
    ],
  },
  {
    name: 'Balboa – Los Angeles',
    path: [
      ...GULF_OF_PANAMA, [-81.0, 6.9], [-82.6, 7.1], [-85.5, 9.0], [-88.5, 11.5], [-92.5, 13.8],
      [-96.5, 15.1], [-100.0, 16.2], [-103.5, 17.6], [-105.3, 18.9], [-106.6, 20.4], [-109.0, 22.3], [-110.6, 22.6],
      [-112.8, 24.3], [-114.8, 26.6], [-116.0, 28.3], [-117.6, 31.0], [-118.0, 32.5],
      [-118.25, 33.7],
    ],
  },
  {
    name: 'Balboa – Valparaíso',
    path: [
      ...GULF_OF_PANAMA, [-80.5, 4.0], [-81.5, 0.0], [-82.0, -4.5], [-80.5, -8.5], [-77.6, -12.1],
      [-76.0, -15.0], [-72.0, -20.0], [-71.5, -26.0], [-72.2, -31.0], [-71.8, -33.0],
    ],
  },
  {
    name: 'Rotterdam – Buenos Aires',
    path: [
      ...WEST_EUROPE, ...CANARIES, [-21.0, 20.0], [-21.3, 16.0], [-21.5, 10.0], [-26.0, 2.0],
      [-31.0, -5.0], [-34.0, -8.5], [-36.5, -13.0], [-38.0, -17.5], [-39.5, -21.0], [-41.3, -23.0],
      [-44.0, -23.9], [-45.5, -24.3], [-46.3, -24.25], [-48.0, -26.5], [-48.8, -29.5], [-51.5, -33.0],
      [-54.0, -35.3], [-56.5, -35.3], [-57.6, -35.0],
    ],
  },
  {
    name: 'Rotterdam – Lagos',
    path: [
      ...WEST_EUROPE, ...CANARIES, [-18.5, 21.0], [-18.5, 15.0], [-17.0, 11.0], [-14.5, 7.0],
      [-10.5, 4.2], [-7.6, 3.7], [-2.2, 4.1], [1.5, 5.6], [3.4, 6.3],
    ],
  },
  {
    name: 'Singapore – Jebel Ali',
    path: [
      ...MALACCA, [88.0, 6.0], [81.5, 5.4], [79.6, 5.9], [77.0, 7.2], [73.0, 12.5], [69.0, 19.5],
      [64.0, 23.5], [59.5, 24.2], [57.2, 25.5], [56.5, 26.6], [55.9, 26.45], [55.3, 25.9],
      [55.0, 25.15],
    ],
  },
  {
    name: 'Singapore – Santos via the Cape',
    path: [
      ...MALACCA, [90.0, 3.0], [80.0, -5.0], [65.0, -15.0], [55.0, -25.5], [45.0, -27.5],
      [35.0, -31.0], [27.0, -35.0], [20.0, -35.6], [17.5, -34.6], [15.0, -33.0], [5.0, -30.0],
      [-15.0, -27.0], [-30.0, -25.5], [-40.0, -25.0], [-45.0, -24.6], [-46.3, -24.25],
    ],
  },
  {
    name: 'Hong Kong – Sydney',
    path: [
      ...LUZON, [123.5, 20.5], [127.0, 16.0], [129.0, 10.0], [130.5, 5.0], [140.0, 3.0],
      [150.0, 0.5], [157.0, -3.0], [161.5, -7.0], [163.3, -11.0], [160.0, -20.0], [156.5, -26.5],
      [153.8, -31.0], [151.4, -33.9],
    ],
  },
  {
    name: 'Hong Kong – Tokyo',
    path: [
      ...LUZON, [123.5, 22.8], [127.5, 25.6], [131.0, 28.8], [133.8, 32.4], [137.5, 33.6],
      [139.6, 34.6], [139.75, 35.1],
    ],
  },
  {
    name: 'Sydney – Auckland',
    path: [
      [151.4, -33.9], [160.0, -34.0], [168.0, -33.6], [172.6, -33.9], [174.9, -35.3],
      [175.15, -36.0], [174.95, -36.55],
    ],
  },
  {
    name: 'New York – Genoa',
    path: [
      [-73.8, 40.42], [-70.0, 40.0], [-60.0, 39.0], [-45.0, 37.5], [-30.0, 36.5], [-20.0, 36.2],
      [-12.0, 36.0], [-7.5, 36.0], [-5.6, 35.95], [-4.5, 35.95], [-2.0, 36.0], [1.0, 37.2],
      [5.0, 37.6], [7.0, 40.0], [8.2, 42.5], [8.9, 44.2],
    ],
  },
]
/* routes:end */

// Land mask: 720 × 288 cells of 0.5°, 84°N to 60°S, run-length encoded in base-36 pairs.
const LAND_MASK =
  'k07l030204020nbh5i0z0y1db85904021609060201040601040116bb4y1i06280908ap4s04051c05010228010h3v0321024o' +
  '4o0a0404010e010m052u3d030101010407050201020502041k094l4o0e01020206020o072t1y01010402061704080105051v' +
  '0b4l4o0i010u0d2j01021m0502010204010g3m04010c4g45050i02010e020h01020i2l1o09010608033w0a04034a3u020c08' +
  '04030611092s1t0i4f09463s050a01030603060603060o062v1w03020703054909483n0102060r060b04010f0e2u1w090605' +
  '4g01473d070l020s01050g0i2w1u064o08453a0a0d020o060601010n0h2p04011x022q061s0c02063u370702010306060308' +
  '0401030105050301070h030l0b012e02014f0e1p0s3r3e02030a0408050b050105050a0619274c0d1i171c06010301031z3h' +
  '0n030107050306020q17250102450a1h1f1b0f04071o3o070t05030o1a2347081h1f1g030i031o330903023e2245071k1b04' +
  '021j0126340g0j030808030a0605040302011c1z45071h1d030605010g010x0422330l0c07070605080506020h161v47060r' +
  '030i1h020l0a0a0q0421320m010402030205060c02070506020a02010104171u46060q0705010701022p0o0521310c020k01' +
  '06080903020807020902020107131v45060q0805010405042n0k0e01041q3308030m0106090603030808010n111u44080q08' +
  '0204012y07010d0l1o0416011u020a01010o0g070a06010q111i030646050m0a0304040a022k050b010r1j02150e1x0s0f08' +
  '07140t04021g03052g010302010101051d060k0b030i014815100t13020m0s0b090a0g010l0r1p2k0h1k020f0b034s140y17' +
  '0i0c03010304080t0102060103070e060b0j0p06021k2b02010p1i07080b024u05020703030c070x1e060x060i0109070504' +
  '07020107080501050i0w1g2c110q030l0a05090359050h01020q2v020805020g040506010406070e0d0y1d2b0203140v0208' +
  '02030d040803050154010k050n2v0c080c03050d04070c02050c0s1601022k0101190a04090702100305025o090m2r070403' +
  '0b040201020103010f03090a04050g0m152o1f0703071c035v0a0n33010n010g010b0i0i0j152o1h0602061c045w0a02050k' +
  '4e0j0n0g132n13020e071d0104035y01010h0a03054604010k0d02090h0v01040q010b021l1607040503017k01020g064c01' +
  '0501020n0b06050j0t01020q05020c1i0k040k0c7r0107070c4b06020l0f04030m0q0y0h1h0i080i0b7s0a050c0a01430208' +
  '090p0r0n0z0i1e0l060l0305027q021242030a0802070g0r0m110e1f0l060o047t03123y060603040h0f0q0m13081h0m058n' +
  '030k020d400a010d020c0702040s0k2r0l068q020u420h030m0803010t0h2q0m068t010t410j0106010306010309050w0g2n' +
  '0o087v020o080s410r01030c190f2m0p087l0406020k0c0t3z0w0d190d2n0o097i0703050h0f0u0q0205042w0x0h1b062o0p' +
  '087h0e0h0h0q02030o0207072s0y0g090113042b010c0r080607700e07010206010j100i03030i02012h0z0g08033u0s0i71' +
  '0d050x100g05010o2g0y0h08043t010109010f0a6n06010a070a060y10020301010a0v2f01010u0k05063t08030d0a01016l' +
  '0z060z190702010w2f0v0u330103030k04060a0b01046h0z0710190404020w05012a0v0u35030w0904010b6g0x0c0y170404' +
  '030y020101012a03010s0u33080n02030903010603036e0z0c0y1603192l0o0u33070m040408096j0z0e0y13041e2j0h0105' +
  '0u34050m0504070a6i100d01010x10051g02012k0i0x33060k04020301030d6g110d100y021m02012p0a102x01010102070k' +
  '02010201010i6e130d100v021t2p06172r0604050j0302020b02036f04010z0d102r2o06182o0804060j040203046r040106' +
  '010q08140q011v02032p061201062l0806060f010176020404010q08142n01062m061a2l07030a0a7k01030p08142o01052m' +
  '061a2l07040b067l02030p05172w2l061a2j07040c067p0r04172w2n03192l03070c067m02030q03182x3v02022w0b037o02' +
  '030q02192w02013r04022v08047q0303212w05013m05022u020c7q0304202y04013706020a04357s03042030040232040204' +
  '0208092w7w0304203203022z02070c092s02037w0302223302022y01090b0b2q81040123333b0b0d2r7y050123333b0j0102' +
  '022t7v060222343a010106010e012u26030o054r070321343c01020203391s0306060m084q080123343e0101010101013a1q' +
  '0604050l0a4p2d343802073d0r020w0707010l084r090223343603053g0r050s0902060j084r0a0322343206033i0k020605' +
  '0r0k0h074r0b04213430080236010c0i0506050q0m0g074p0c071y33303f0p04020807060m0o0f084m0c0a1x332z3g0o0c01' +
  '0306080k0r0c0a4e03010d0820332z3g0p0a020406090i0r0d094c0j01040221342z3f0o0b020607070h09060c0e08010248' +
  '0k0226342w3j0l0m07060j050b080g0b470m0125332v3l0j0f020a070309040303150701013q020f0l0325332t3m0j0g020b' +
  '04010202060102051b053s030d0n0424342s3m0i05020a020d010706061b083o040402060p0424342r3m0j0h020d02070506' +
  '1b083n050206040p0424352p3n0j0w01090507180a3j0f060n0425362l01023o0h0w020a0505190a3k0e070m0326372k0101' +
  '3p0g0r060c0407180a3m03010b050k0426372k3r0f0m0107030d03091a073m020508060i0526382k3v080b04010b07010f01' +
  '0a050213033u0a060e0926382k3w010c0k12020403044p0c060d0927392j3w01090o1e4o0d060d09273a2h3x030102030p0q' +
  '040e02044n0e06060g273b2g3w0z1702054n0e02090901032b3d2c3y0x1f4p0m04010201032f3g273y101e4q0k0103040201' +
  '2g3h253x141b4s0h0501022l3h233y1a0e040o4s0j032o3i213y1e09070n4t0h032p3j1z3z1e090a0j4v0g032p3j03031s3z' +
  '1h070f0504044v0i012q3k03031r3z1k045n393k03031b0709407a393l03031a0c053y38053z383m03020z080201010c043x' +
  '2e010u053z383n03020x0q043v3b053x393o02030u0r053j010a2h010u053x393m05040r0t043r2l040r063t3b3n05030q0u' +
  '053p2n030s073r3b3p04040o0v043p2n040s0704033i3c3r02040p0u043n2p050r0e3h3d3s02030p0v033n2q050q02010901' +
  '023g3d3s02050m0x013n2s040t080209050201032x3e3s03050l12013i2s040t06040l2v0502383t03050k4k2u040s05060l' +
  '2t0502393v02050j4j2v06130k2r0503393w01060i4j2v06150j2o070339440g0s093i2x06150l2j09023a450f0r0203073g' +
  '2y05160i1802170e013a450g0t0105053d3004150k05010x06143s450g0f060h043b3004140m04010t0a0v05013v1b012t0h' +
  '0d070i06392z05120o01040s0b0s06023v450i0c060k06382z06100t0s0d0r431c022r0i0c060t053030060z0t0q0g0p0604' +
  '3u1c022s0i0a070t072y30070y0u0o0h0p05043v480h08080u082x2z070w0w0n0j0o05043v490i010c0k03050608032r3106' +
  '0u0x0m0l0n0t04374d0r4032060r0z0l0m0o0s03384e0q4032070p100j0o0p0r04374h0m4033070m140i0o05010k0q04374j' +
  '07010c4033080j160g0p04030l0p03384m02050j3r34060j170e0y0m0n03394u0j3p36060h190c100m0m03394v0i3o39040d' +
  '1d0c100m0m03394w0i3o39030c1f0b100m0n03010136500d3q3902091i0b100n0n010103010133520201083p3b02041m0c10' +
  '03020h0m0203023455083p3c01031o0b1003020h0n013956070n02313c1r0a1103050e0s0101023157060m0234390f011d09' +
  '1103060c0q0105013158040k0403042y3a0a051d091102070c0q0203023158050g0e0b0102012l39030b1e08110208090s03' +
  '02013258050g07010c020402012l3n1e0712010b050o01070234590101030f07020j2n3m1f0513010c030w020101335c0305' +
  '04040u2n3k1g0502020z020b020o0109010401305d080202020v2o3j1g0304020y040z010d042z5e0504122l3i1i0204030y' +
  '0419072z5h0303132k3i1n040z0317092z5o132l3f1p040z02170103052z5p132l3e1p0410030u020d03315p142m0p052h1q' +
  '0311040s030d03315p1b2g0m082g2v040r053f5p1e2e0h0d2e2l0506050p073e5p1f2f040o2d2n0505060m083f5p1g3d262o' +
  '0504060l083g5q1g3d242q0504050k083h5p1h3e222s0503050j093h5o1i3e212u0503040g0d3g5n1k3d202w0503040e0e0k' +
  '012v5m1m3b1z2z0603020b02010e0j012w5m1m3b1x32070d0j0501060105022v5k1o3b1w300102080c0i040906022v5k1o3b' +
  '1v35080b0h0k012w4x010l1m0105381u37070b0h04010f0105012q4x010l1s0102341u38070c0g040105020g052k5i1s0105' +
  '321u350103080b0e0502010301010f062k5i1r0109301s3a080201080d060505010501080407022b5i21301r3c080102070d' +
  '05060l030506295j252w1p3e0a0201040d050301020k05030b255k2a2r1n3f090c02010506030103070202050405010e235i' +
  '2d2r1m3g080h0201010602010308010c01010k205i2e2r1k3i070r0202030o0k0f011i5h2g2r1j3k050r02020101010r0i0c' +
  '021j5i2j2n1i3m040r0204010t0h0a021k5i2k2m1i5i0h040606011e5i2k2n1h3q041g01080i040209011d5k2i2n1i3o0703' +
  '031801080i0g011c5l2h2o1h3q0e1f0g1u5l2h2o1h3t01010b0x010d0c02051t5m2g2p1g3z0905010c010q02020705041s5m' +
  '2g2o1h4906020406040r0606040o01125n2e2p1h4p030w01010108051p5n2d2q1i4e03060319050k01135o2c2r1h4n011e03' +
  '1n5o2a2t1i7r5p292u1h53010j02225q272v1h500103020h02225q262v1i0h014j0c0903225r252u1j0h014i0c0a04215r23' +
  '2v1k0g034g0c0b04215r232v1k0f044g0c0b04215s222v1k0f044803040d0b05205s222u1m0d064506030c0c071y5t212u1l' +
  '0d07450m0b0816010q5v1z2u1l0b070101440p09081x5x1x2u1k090b450q08081x5z1v2u1j0a0b4101010u05091u0201611t' +
  '2t1h0c0b410z030a1w621s2t1g0d0b411c1r0203631q2v1e0e0b411c1w631q2w1c0f0a411e1v631q2w1a0i09411f1u641o2y' +
  '180j093z1j1s641o2y170k080i013d1o1r641n30170i093s1t0v010u641m31170h0a0e013b1w0v010t641m32170g093q1x0w' +
  '020r631m34160f0a3p1y0y010q631l35160g093n231m631g3a160g093n231m631e3c160g083o241l631b3f160g083o251k63' +
  '1a3g150i063p261j63193i110m033s261i63183j104i261i63183j104i261i62193j104h271i62193k0z4i261i62193k0y4j' +
  '271h62193l0x4k261h61193n0v4l261h61183p0t4n251h61173q0s4o251h61173q0s4o241i611401013s0q4p241i61143v0o' +
  '4r231i61133w0n4s0r06161i61133x0l4t0o0c121j61123x0l4u0j0i101k61123x0j4w0h0l06010r1l6011400g4x0h0n0401' +
  '0s1l600r0109410656090w02020r1m600s030444015c050y010301010p1m5z0uaw0o19030b5z0uat01030n1a020b5y0wax0l' +
  '1c010b5y0xax0k1d010a5x0xay0k1d03085x0wb00i1f030202035x0vb20701051i08035x0tbe011k07045x0nd406065x0nd5' +
  '05065w0nbp011h04065w0nd2010403075w0ibn081b040202085w01020fbo071a050c5w01020g0101bm051b050c5w01010h01' +
  '01bm051a050d5v02010gbq021a060e5y0fd1080e5y0fcz070h5v01010gcy070i5v01010dd0080i5v0ed0080j5u0fd1060k5u' +
  '0gdq5v0hdo5v0hdo5t0jdo5t0hdq5t0g7l03635t02010ddr5t01010cdt5u0cdu5w0adu5w0a0h05d85w0bdt5x060103dt5y04' +
  '0104dt5x050205dr600301061o01c1620b1m01c06405drk0k0k0k0k0k0k0k0k0'
