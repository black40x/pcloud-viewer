import {
  BufferGeometry,
  BufferAttribute,
  LineSegments,
  LineBasicMaterial
} from 'three'

export class BoxHelper extends LineSegments {
  constructor (box, color) {
    if (color === undefined) color = 0xff0000;

    let indices = new Uint16Array([ 0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7 ]);
    let positions = new Float32Array([
      box.min.x, box.min.y, box.min.z,
      box.max.x, box.min.y, box.min.z,
      box.max.x, box.min.y, box.max.z,
      box.min.x, box.min.y, box.max.z,
      box.min.x, box.max.y, box.min.z,
      box.max.x, box.max.y, box.min.z,
      box.max.x, box.max.y, box.max.z,
      box.min.x, box.max.y, box.max.z
    ]);

    let geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setAttribute('position', new BufferAttribute(positions, 3));

    let material = new LineBasicMaterial({ color: color });

    super(geometry, material);
  }
}
