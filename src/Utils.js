// @flow

import {Box3, Vector3} from "three"

export function extend(dest: Object, ...sources: Array<?Object>): Object {
  for (const src of sources) {
    for (const k in src) {
      dest[k] = src[k]
    }
  }
  return dest
}

export function createChildAABB(aabb: Box3, index): Box3 {
  let min = aabb.min.clone()
  let max = aabb.max.clone()
  let size = new Vector3().subVectors(max, min)

  if ((index & 0b0001) > 0) {
    min.z += size.z / 2
  } else {
    max.z -= size.z / 2
  }

  if ((index & 0b0010) > 0) {
    min.y += size.y / 2
  } else {
    max.y -= size.y / 2
  }

  if ((index & 0b0100) > 0) {
    min.x += size.x / 2
  } else {
    max.x -= size.x / 2
  }

  return new Box3(min, max)
}
