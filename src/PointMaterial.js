// @flow

import {ShaderLib, ShaderMaterial, VertexColors} from "three"

export class PointMaterial extends ShaderMaterial {
  constructor(size: number = 5, scale: number = 1) {
    super({
      transparent: true,
      uniforms: {
        size: {value: size},
        scale: {value: scale},
      },
      vertexColors: VertexColors,
      vertexShader: ShaderLib.points.vertexShader,
      fragmentShader: `
        uniform vec3 color;
        varying vec3 vColor;
        void main() {
            vec2 xy = gl_PointCoord.xy - vec2(0.5);
            float ll = length(xy);
            gl_FragColor = vec4(vColor.rgb, step(ll, 0.5));
        }
      `
    })
  }
}
