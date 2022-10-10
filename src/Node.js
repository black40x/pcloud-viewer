// @flow

import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  Sphere,
  Scene,
  Color
} from 'three'

import {BoxHelper} from "./BoxHelper"
import {PointMaterial} from "./PointMaterial";

const binaryRecordSize = 27

export class OctreeNode {
  id: number
  name: string
  chunkUrl: string
  index: number
  boundingBox: Box3
  boundingSphere: any
  children: $Values<typeof OctreeNode>
  hasChildren: boolean
  numPoints: number
  level: ?number
  spacing: number
  loaded: boolean
  visible: boolean
  boxHelper: ?BoxHelper
  parentNode: ?OctreeNode
  geometry: ?BufferGeometry
  pointCloudPoints: ?Points
  scene: ?Scene

  constructor(name: string, boundingBox: Box3, scene: Scene, chunkUrl: string) {
    this.id = OctreeNode.IDCount++
    this.name = name
    this.index = parseInt(name.charAt(name.length - 1))
    this.boundingBox = boundingBox
    this.boundingSphere = boundingBox.getBoundingSphere(new Sphere())
    this.children = {}
    this.hasChildren = false
    this.parentNode = null
    this.visible = false
    this.numPoints = 0
    this.spacing = 0
    this.level = null
    this.loaded = false
    this.boxHelper = new BoxHelper(boundingBox)
    this.boxHelper.matrixAutoUpdate = true
    this.boxHelper.visible = false
    this.geometry = null
    this.pointCloudPoints = null
    this.chunkUrl = chunkUrl
    this.scene = scene
  }

  setVisibility(visible: boolean) {
    this.visible = visible

    if (this.pointCloudPoints) {
      this.pointCloudPoints.visible = visible
    }
  }

  isVisible(): boolean {
    return this.visible
  }

  getBoundingBox(): Box3 {
    return this.boundingBox
  }

  getLevel(): number {
    return this.level
  }

  isLoaded(): boolean {
    return this.loaded
  }

  getChildren(): Array<OctreeNode> {
    let children = [];

    for (let i = 0; i < 8; i++) {
      if (this.children[i]) {
        children.push(this.children[i])
      }
    }

    return children
  }

  addChild(child) {
    this.children[child.index] = child
    child.parent = this
  }

  getNumPoints(): number {
    return this.numPoints
  }

  loadPoints() {
    if (this.loaded) {
      return
    }

    this.loaded = true

    let url = this.chunkUrl.replace("{r}", this.name + ".bin")
    let xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'arraybuffer'
    xhr.overrideMimeType('text/plain; charset=x-user-defined')
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if((xhr.status === 200 || xhr.status === 0) &&  xhr.response !== null){
          let buffer = xhr.response
          this._parseBinary(buffer)
        } else {
          throw new Error(`Failed to load node! HTTP status: ${xhr.status}, file: ${url}`)
        }
      }
    }

    xhr.send()
  }

  _parseBinary(buffer) {
    let numPoints = buffer.byteLength / binaryRecordSize
    let view = new DataView(buffer)
    let color = new Color()

    let vertices = []
    let colors = []

    this.geometry = new BufferGeometry()

    for (let i = 0; i < numPoints; i++) {
      let x, y, z
      let r, g, b
      x = view.getFloat64(i * binaryRecordSize, true)
      y = view.getFloat64(i * binaryRecordSize + 8, true)
      z = view.getFloat64(i * binaryRecordSize + 16, true)

      r = view.getUint8(i * binaryRecordSize + 24)
      g = view.getUint8(i * binaryRecordSize + 25)
      b = view.getUint8(i * binaryRecordSize + 26)

      vertices.push(x, y, z)
      color.setRGB(r / 255, g / 255, b / 255)
      colors.push(color.r, color.g, color.b)
    }

    this.geometry.setAttribute( 'position', new Float32BufferAttribute(vertices, 3))
    this.geometry.setAttribute( 'color', new Float32BufferAttribute(colors, 3))

    this.pointCloudPoints = new Points(this.geometry, new PointMaterial())

    if (this.visible) {
      this.scene.add(this.pointCloudPoints)
    }
  }
}

OctreeNode.IDCount = 0
