export type Vec2 = readonly [number, number]
export type Vec3 = readonly [number, number, number]

export function vec2(x: number, y: number): Vec2 {
  return [x, y]
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return [x, y, z]
}

export function add2(left: Vec2, right: Vec2): Vec2 {
  return [left[0] + right[0], left[1] + right[1]]
}

export function sub2(left: Vec2, right: Vec2): Vec2 {
  return [left[0] - right[0], left[1] - right[1]]
}

export function scale2(value: Vec2, factor: number): Vec2 {
  return [value[0] * factor, value[1] * factor]
}

export function dot2(left: Vec2, right: Vec2): number {
  return left[0] * right[0] + left[1] * right[1]
}

export function add3(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]]
}

export function sub3(left: Vec3, right: Vec3): Vec3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
}

export function scale3(value: Vec3, factor: number): Vec3 {
  return [value[0] * factor, value[1] * factor, value[2] * factor]
}

export function addScaled3(origin: Vec3, direction: Vec3, parameter: number): Vec3 {
  return [
    origin[0] + parameter * direction[0],
    origin[1] + parameter * direction[1],
    origin[2] + parameter * direction[2],
  ]
}

export function dot3(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
}

export function cross3(left: Vec3, right: Vec3): Vec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ]
}

export function addScaled(left: readonly number[], right: readonly number[], scale: number): number[] {
  return left.map((value, index) => value + scale * (right[index] ?? 0))
}
