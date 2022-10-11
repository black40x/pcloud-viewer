// @flow

import {extend} from "./Utils"
import {Box3, Frustum, Matrix4, PerspectiveCamera, OrthographicCamera, Vector3, Scene, WebGLRenderer} from "three"
import {OctreeNode} from "./Node"
import {createChildAABB} from "./Utils"
import {BinaryHeap} from "./BinaryHeap"

export type PointCloudOptions = {
  metaUrl: string,
  chunkUrl?: string,
  pointBudget?: number,
  maxLevel: number
}

const defaultOptions = {
  pointBudget: 500_000,
  maxLevel: Infinity
}

class MetaBoundingBox {
  lx: number
  ly: number
  lz: number
  ux: number
  uy: number
  uz: number

  constructor(lx: number, ly: number, lz: number, ux: number, uy: number, uz: number) {
    this.lx = lx
    this.ly = ly
    this.lz = lz
    this.ux = ux
    this.uy = uy
    this.uz = uz
  }
}

export class PointCloudMeta {
  _spacing: number
  _hierarchy: Array

  constructor(spacing, hierarchy, boundingBox) {
    this._spacing = spacing;
    this._hierarchy = hierarchy;
    this._boundingBox = new MetaBoundingBox(
      boundingBox.Lx,
      boundingBox.Ly,
      boundingBox.Lz,
      boundingBox.Ux,
      boundingBox.Uy,
      boundingBox.Uz,
    )
  }

  getSpacing() {
    return this._spacing
  }

  getHierarchy() {
    return this._hierarchy
  }

  getBoundingBox() {
    return this._boundingBox
  }

  get hierarchy() {
    return this._hierarchy
  }
}

export class PointCloud {
  options: PointCloudOptions
  meta: ?PointCloudMeta
  boundingBox: ?Box3
  nodes: $Values<typeof OctreeNode>
  rootNode: ?OctreeNode
  onInit: ?Function
  isInit: boolean = false
  scene: ?Scene = null
  minimumNodePixelSize: number = 150

  constructor(options: PointCloudOptions) {
    this.options = extend({}, defaultOptions, options)
    this.rootNode = null
    this.nodes = {}
    this.rootNode = null
    this.boundingBox = null
    this.meta = null
    this.onInit = null
    this.isInit = false
    this.scene = null

    if (!this.options.chunkUrl) {
      this.options.chunkUrl = options.metaUrl.replace("meta.json", "{r}")
    }
  }

  init(scene: Scene, onInit: Function) {
    this.scene = scene
    this.onInit = onInit
    this._loadMeta()
  }

  _buildNodes() {
    {
      let name = 'r'
      this.rootNode = new OctreeNode(name, this.boundingBox, this.scene, this.options.chunkUrl)
      this.rootNode.level = 0
      this.rootNode.hasChildren = true
      this.rootNode.spacing = this.meta.getSpacing()
      this.rootNode.numPoints = 0
      this.nodes[name] = this.rootNode
    }

    for (let i = 1; i < this.meta.hierarchy.length; i++) {
      let name = this.meta.hierarchy[i][0]
      let numPoints = this.meta.hierarchy[i][1];
      let index = parseInt(name.charAt(name.length - 1))
      let parentName = name.substring(0, name.length - 1)
      let parentNode = this.nodes[parentName]
      let level = name.length - 1

      if (parentNode === undefined) {
        continue
      }

      let boundingBox = createChildAABB(parentNode.boundingBox, index)
      let node = new OctreeNode(name, boundingBox, this.scene, this.options.chunkUrl)

      node.name = name
      node.boundingBox = boundingBox
      node.level = level
      node.numPoints = numPoints
      node.spacing = this.meta.getSpacing() / Math.pow(2, level)
      parentNode.addChild(node)

      this.nodes[name] = node
    }

    this.isInit = true
    this.onInit()
  }

  isInited(): boolean {
    return this.isInit
  }

  _loadMeta() {
    let xhr = new XMLHttpRequest()
    xhr.open('GET', this.options.metaUrl, true)
    xhr.responseType = 'json'
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if ((xhr.status === 200 || xhr.status === 0) &&  xhr.response !== null) {
          xhr.response
          try {
            this.meta = new PointCloudMeta(
              xhr.response.Spacing,
              xhr.response.Hierarchy,
              xhr.response.BoundingBox
            )

            let min = new Vector3(this.meta.getBoundingBox().lx, this.meta.getBoundingBox().ly, this.meta.getBoundingBox().lz)
            let max = new Vector3(this.meta.getBoundingBox().ux, this.meta.getBoundingBox().uy, this.meta.getBoundingBox().uz)
            this.boundingBox = new Box3(min, max)

            this._buildNodes()
          } catch (e) {
            throw new Error(`Failed to parse meta file!`)
          }
        } else {
          throw new Error(`Failed to load meta file! HTTP status: ${xhr.status}, file: ${this.options.metaUrl}`)
        }
      }
    }

    xhr.send()
  }

  setScene(scene: Scene) {
    this.scene = scene
  }

  getVisibleNodes(camera: PerspectiveCamera | OrthographicCamera, renderer: WebGLRenderer) {
    if (!this.scene) {
      return
    }

    let visibleNodes = []

    camera.updateMatrixWorld()

    let priorityQueue = new BinaryHeap(function (x) { return 1 / x.weight })
    let numVisiblePoints = 0
    let frustum = new Frustum()
    let viewInvert = camera.matrixWorldInverse
    let lowestSpacing = Infinity
    let domWidth = renderer.domElement.clientWidth
    let domHeight = renderer.domElement.clientHeight

    let frustumCam = camera.clone()
    let proj = camera.projectionMatrix

    frustumCam.near = Math.min(camera.near, 0.1)
    frustumCam.updateProjectionMatrix()

    let world = this.scene.matrixWorld
    let fm = new Matrix4().multiply(proj).multiply(viewInvert).multiply(world)
    frustum.setFromProjectionMatrix(fm)

    let view = camera.matrixWorld
    let worldInvert = world.clone().invert()
    let camMatrixObject = new Matrix4().multiply(worldInvert).multiply(view)
    let camObjPos = new Vector3().setFromMatrixPosition(camMatrixObject)

    // Add root node first
    Object.keys(this.nodes).forEach(key => {
      if (this.nodes[key].level <= 1) {
        priorityQueue.push({node: this.nodes[key], weight: Number.MAX_VALUE})
      }
    })

    while (priorityQueue.size() > 0) {
      let element = priorityQueue.pop()
      let node: OctreeNode = element.node

      let box = node.getBoundingBox()
      let level = node.getLevel()

      let insideFrustum = frustum.intersectsBox(box)
      let visible = insideFrustum

      visible = visible && !(numVisiblePoints + node.getNumPoints() > this.options.pointBudget);
      visible = visible && level < this.options.maxLevel;
      visible = visible || node.getLevel() <= 1;

      if (node.spacing) {
        lowestSpacing = Math.min(lowestSpacing, node.spacing)
      }

      if (numVisiblePoints + node.getNumPoints() > this.options.pointBudget) {
        break;
      }

      if (visible) {
        numVisiblePoints += node.getNumPoints()
      }

      if (!visible) {
        continue
      } else {
        visibleNodes.push(node)
      }

      node.getChildren().forEach(child => {
        let weight = 0
        // let distance = child.boundingSphere.center.distanceTo(camObjPos)
        let sphere = child.boundingSphere
        let center = sphere.center
        let dx = camObjPos.x - center.x
        let dy = camObjPos.y - center.y
        let dz = camObjPos.z - center.z

        let dd = dx * dx + dy * dy + dz * dz
        let distance = Math.sqrt(dd)

        let radius = sphere.radius

        let fov = (camera.fov * Math.PI) / 180
        let slope = Math.tan(fov / 2)
        let projFactor = (0.5 * domHeight) / (slope * distance)
        let screenPixelRadius = radius * projFactor

        if (screenPixelRadius < this.minimumNodePixelSize) {
          return
        }

        weight = screenPixelRadius

        if (distance - radius < 0) {
          weight = Number.MAX_VALUE
        }

        priorityQueue.push({node: child, weight: weight})
      })
    }

    return {
      lowestSpacing: lowestSpacing,
      visibleNodes: visibleNodes
    }
  }
}
